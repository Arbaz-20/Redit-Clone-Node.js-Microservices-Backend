import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { createClient } from 'redis';
import { createProxyMiddleware, Options } from 'http-proxy-middleware';
import { logger } from './logger';

const PORT = Number(process.env.GATEWAY_PORT || 8080);
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';

interface JwtPayload {
  sub: string;
  username: string;
}

async function bootstrap() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));

  // ---- Redis-backed rate limiting ----
  const redisClient = createClient({
    socket: { host: process.env.REDIS_HOST || 'redis', port: Number(process.env.REDIS_PORT || 6379) },
  });
  redisClient.on('error', (err) => logger.error(`Redis error: ${err.message}`));
  await redisClient.connect();

  app.use(
    rateLimit({
      windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60000),
      max: Number(process.env.RATE_LIMIT_MAX || 120),
      standardHeaders: true,
      legacyHeaders: false,
      store: new RedisStore({ sendCommand: (...args: string[]) => redisClient.sendCommand(args) }),
    })
  );

  // ---- JWT validation: decode if present, attach identity, strip spoofed headers ----
  app.use((req: Request, _res: Response, next: NextFunction) => {
    // Never trust client-supplied identity headers.
    delete req.headers['x-user-id'];
    delete req.headers['x-username'];

    const header = req.headers['authorization'];
    if (header && header.startsWith('Bearer ')) {
      const token = header.slice(7);
      try {
        const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
        (req as any).userId = payload.sub;
        (req as any).username = payload.username;
      } catch {
        return _res.status(401).json({ error: 'Invalid or expired token' });
      }
    }
    next();
  });

  app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'api-gateway' }));

  // ---- Proxy routing ----
  const routes: Record<string, string | undefined> = {
    '/auth': process.env.AUTH_SERVICE_URL,
    '/users': process.env.USER_SERVICE_URL,
    '/communities': process.env.COMMUNITY_SERVICE_URL,
    '/posts': process.env.POST_SERVICE_URL,
    '/comments': process.env.COMMENT_SERVICE_URL,
    '/votes': process.env.VOTE_SERVICE_URL,
    '/feed': process.env.FEED_SERVICE_URL,
    '/notifications': process.env.NOTIFICATION_SERVICE_URL,
  };

  for (const [prefix, target] of Object.entries(routes)) {
    if (!target) {
      logger.warn(`No target configured for ${prefix}, skipping`);
      continue;
    }
    // Mount at root and match via pathFilter so the FULL path (e.g. /communities/x)
    // is forwarded — Express would otherwise strip the mount prefix.
    const options: Options = {
      target,
      changeOrigin: true,
      pathFilter: (path: string) => path === prefix || path.startsWith(prefix + '/'),
      on: {
        proxyReq: (proxyReq, req) => {
          const userId = (req as any).userId;
          if (userId) {
            proxyReq.setHeader('x-user-id', userId);
            proxyReq.setHeader('x-username', (req as any).username || '');
          }
        },
        error: (err, _req, res) => {
          logger.error(`Proxy error for ${prefix}: ${err.message}`);
          (res as Response).status?.(502).json?.({ error: 'Upstream service unavailable' });
        },
      },
    };
    app.use(createProxyMiddleware(options));
    logger.info(`Routing ${prefix}/* -> ${target}`);
  }

  app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

  app.listen(PORT, () => logger.info(`API Gateway listening on :${PORT}`));
}

bootstrap().catch((err) => {
  logger.error(`Gateway failed to start: ${err.message}`);
  process.exit(1);
});
