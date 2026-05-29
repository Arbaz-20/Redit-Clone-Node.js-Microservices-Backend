// user-service/src/routes/profile.routes.ts
import { Router } from 'express';
import { asyncHandler } from '../middleware/error';
import { requireUser } from '../middleware/auth';
import { profileController } from '../controllers/profile.controller';

export const profileRoutes = Router();
profileRoutes.get('/me', requireUser, asyncHandler(profileController.getMe));
profileRoutes.patch('/me', requireUser, asyncHandler(profileController.updateMe));
profileRoutes.get('/:id', asyncHandler(profileController.getById));
