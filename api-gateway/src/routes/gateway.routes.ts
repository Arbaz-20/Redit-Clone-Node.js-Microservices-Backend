// api-gateway/src/routes/gateway.routes.ts
import { Router, Response } from 'express';
import { createProxyMiddleware, Options } from 'http-proxy-middleware';
import { serviceRoutes } from '../config/services';
import { AuthedRequest } from '../middleware/auth';
import { logger } from '../logger';

export function buildGatewayRoutes(): Router {
  const router = Router();

  for (const { prefix, target } of serviceRoutes) {
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
          const userId = (req as AuthedRequest).userId;
          if (userId) {
            proxyReq.setHeader('x-user-id', userId);
            proxyReq.setHeader('x-username', (req as AuthedRequest).username || '');
          }
        },
        error: (err, _req, res) => {
          logger.error(`Proxy error for ${prefix}: ${err.message}`);
          (res as Response).status?.(502).json?.({ error: 'Upstream service unavailable' });
        },
      },
    };
    router.use(createProxyMiddleware(options));
    logger.info(`Routing ${prefix}/* -> ${target}`);
  }

  return router;
}
