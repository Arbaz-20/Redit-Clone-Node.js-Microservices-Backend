// feed-service/src/app.ts
import express from 'express';
import { feedRoutes } from './routes/feed.routes';
import { errorHandler } from './middleware/error';

export function buildApp() {
  const app = express();
  app.use(express.json());
  app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'feed-service' }));
  app.use('/feed', feedRoutes);
  app.use(errorHandler);
  return app;
}
