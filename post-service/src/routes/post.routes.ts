// post-service/src/routes/post.routes.ts
import { Router } from 'express';
import { requireUser } from '../middleware/auth';
import { postController } from '../controllers/post.controller';

export const postRoutes = Router();
postRoutes.post('/', requireUser, postController.Create);
postRoutes.get('/', postController.List);
postRoutes.get('/:id', postController.GetById);
postRoutes.delete('/:id', requireUser, postController.Remove);
