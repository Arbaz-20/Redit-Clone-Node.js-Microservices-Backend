// community-service/src/app.ts
import express from 'express';
import { attachUser } from './middleware/auth';
import { communityRoutes } from './routes/community.routes';
import { errorHandler } from './middleware/error';

export function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(attachUser);
  app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'community-service' }));
  app.use('/communities', communityRoutes);
  app.use(errorHandler);
  return app;
}
