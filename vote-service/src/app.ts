// vote-service/src/app.ts
import express from 'express';
import { attachUser } from './middleware/auth';
import { voteRoutes } from './routes/vote.routes';
import { errorHandler } from './middleware/error';

export function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(attachUser);
  app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'vote-service' }));
  app.use('/votes', voteRoutes);
  app.use(errorHandler);
  return app;
}
