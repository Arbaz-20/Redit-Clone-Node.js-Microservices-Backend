// user-service/src/routes/profile.routes.ts
import { Router } from 'express';
import { requireUser } from '../middleware/auth';
import { profileController } from '../controllers/profile.controller';

export const profileRoutes = Router();
profileRoutes.get('/me', requireUser, profileController.GetMe);
profileRoutes.patch('/me', requireUser, profileController.UpdateMe);
profileRoutes.get('/:id', profileController.GetById);
