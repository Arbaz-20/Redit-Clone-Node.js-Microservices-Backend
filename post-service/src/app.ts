// post-service/src/app.ts
import express from 'express';
import { attachUser } from './middleware/auth';
import { postRoutes } from './routes/post.routes';
import { errorHandler } from './middleware/error';

export function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(attachUser);
  app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'post-service' }));
  app.use('/posts', postRoutes);
  app.use(errorHandler);
  return app;
}
