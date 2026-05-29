// comment-service/src/routes/comment.routes.ts
import { Router } from 'express';
import { asyncHandler } from '../middleware/error';
import { requireUser } from '../middleware/auth';
import { commentController } from '../controllers/comment.controller';

export const commentRoutes = Router();
commentRoutes.post('/', requireUser, asyncHandler(commentController.create));
commentRoutes.get('/', asyncHandler(commentController.list));
commentRoutes.get('/:id', asyncHandler(commentController.getById));
commentRoutes.delete('/:id', requireUser, asyncHandler(commentController.remove));
