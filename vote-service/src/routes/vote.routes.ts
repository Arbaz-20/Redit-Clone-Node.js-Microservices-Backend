// vote-service/src/routes/vote.routes.ts
import { Router } from 'express';
import { requireUser } from '../middleware/auth';
import { voteController } from '../controllers/vote.controller';

export const voteRoutes = Router();
voteRoutes.post('/', requireUser, voteController.Cast);
voteRoutes.get('/score', voteController.Score);
voteRoutes.get('/me', requireUser, voteController.Mine);
