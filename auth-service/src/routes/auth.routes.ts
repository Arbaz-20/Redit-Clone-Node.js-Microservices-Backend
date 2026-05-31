// auth-service/src/routes/auth.routes.ts
import { Router } from 'express';
import { authController } from '../controllers/auth.controller';

export const authRoutes = Router();

authRoutes.post('/register', authController.Register);
authRoutes.post('/login', authController.Login);
authRoutes.post('/refresh', authController.Refresh);
