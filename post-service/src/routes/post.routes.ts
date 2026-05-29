// post-service/src/routes/post.routes.ts
import { Router } from 'express';
import { asyncHandler } from '../middleware/error';
import { requireUser } from '../middleware/auth';
import { postController } from '../controllers/post.controller';

export const postRoutes = Router();
postRoutes.post('/', requireUser, asyncHandler(postController.create));
postRoutes.get('/', asyncHandler(postController.list));
postRoutes.get('/:id', asyncHandler(postController.getById));
postRoutes.delete('/:id', requireUser, asyncHandler(postController.remove));
