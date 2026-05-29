// api-gateway/src/app.ts
import express, { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { createClient } from 'redis';
import { env } from './config/env';
import { jwtMiddleware } from './middleware/auth';
import { buildGatewayRoutes } from './routes/gateway.routes';
import { logger } from './logger';

export async function buildApp(): Promise<Express> {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.corsOrigin }));

  // ---- Redis-backed rate limiting ----
  const redisClient = createClient({
    socket: { host: env.redis.host, port: env.redis.port },
  });
  redisClient.on('error', (err) => logger.error(`Redis error: ${err.message}`));
  await redisClient.connect();

  app.use(
    rateLimit({
      windowMs: env.rateLimit.windowMs,
      max: env.rateLimit.max,
      standardHeaders: true,
      legacyHeaders: false,
      store: new RedisStore({ sendCommand: (...args: string[]) => redisClient.sendCommand(args) }),
    })
  );

  // ---- JWT validation: decode if present, attach identity, strip spoofed headers ----
  app.use(jwtMiddleware);

  app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'api-gateway' }));

  // ---- Proxy routing ----
  app.use(buildGatewayRoutes());

  app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

  return app;
}
