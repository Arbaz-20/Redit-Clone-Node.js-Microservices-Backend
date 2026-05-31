// comment-service/src/routes/comment.routes.ts
import { Router } from 'express';
import { requireUser } from '../middleware/auth';
import { commentController } from '../controllers/comment.controller';

export const commentRoutes = Router();
commentRoutes.post('/', requireUser, commentController.Create);
commentRoutes.get('/', commentController.List);
commentRoutes.get('/:id', commentController.GetById);
commentRoutes.delete('/:id', requireUser, commentController.Remove);
