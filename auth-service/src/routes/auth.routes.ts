// auth-service/src/routes/auth.routes.ts
import { Router } from 'express';
import { asyncHandler } from '../middleware/error';
import { authController } from '../controllers/auth.controller';

export const authRoutes = Router();

authRoutes.post('/register', asyncHandler(authController.register));
authRoutes.post('/login', asyncHandler(authController.login));
authRoutes.post('/refresh', asyncHandler(authController.refresh));
