// user-service/src/app.ts
import express from 'express';
import { attachUser } from './middleware/auth';
import { profileRoutes } from './routes/profile.routes';
import { errorHandler } from './middleware/error';

export function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(attachUser);
  app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'user-service' }));
  app.use('/users', profileRoutes);
  app.use(errorHandler);
  return app;
}
