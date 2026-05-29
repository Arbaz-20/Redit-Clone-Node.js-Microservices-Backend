// auth-service/src/app.ts
import express from 'express';
import { authRoutes } from './routes/auth.routes';
import { errorHandler } from './middleware/error';

export function buildApp() {
  const app = express();
  app.use(express.json());
  app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'auth-service' }));
  app.use('/auth', authRoutes);
  app.use(errorHandler);
  return app;
}
