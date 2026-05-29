// vote-service/src/routes/vote.routes.ts
import { Router } from 'express';
import { asyncHandler } from '../middleware/error';
import { requireUser } from '../middleware/auth';
import { voteController } from '../controllers/vote.controller';

export const voteRoutes = Router();
voteRoutes.post('/', requireUser, asyncHandler(voteController.cast));
voteRoutes.get('/score', asyncHandler(voteController.score));
voteRoutes.get('/me', requireUser, asyncHandler(voteController.mine));
