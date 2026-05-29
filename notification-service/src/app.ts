// notification-service/src/app.ts
import express from 'express';
import { attachUser } from './middleware/auth';
import { notificationRoutes } from './routes/notification.routes';
import { errorHandler } from './middleware/error';

export function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(attachUser);
  app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'notification-service' }));
  app.use('/notifications', notificationRoutes);
  app.use(errorHandler);
  return app;
}
