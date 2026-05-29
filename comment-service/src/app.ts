// comment-service/src/app.ts
import express from 'express';
import { attachUser } from './middleware/auth';
import { commentRoutes } from './routes/comment.routes';
import { errorHandler } from './middleware/error';

export function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(attachUser);
  app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'comment-service' }));
  app.use('/comments', commentRoutes);
  app.use(errorHandler);
  return app;
}
