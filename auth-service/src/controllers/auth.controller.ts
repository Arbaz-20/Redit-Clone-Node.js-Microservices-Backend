// auth-service/src/controllers/auth.controller.ts
import { Request, Response } from 'express';
import { AppError } from '../middleware/error';
import { registerSchema, loginSchema } from '../validation/auth.schema';
import { authService } from '../services/auth.service';

export const authController = {
  async register(req: Request, res: Response) {
    const { error, value } = registerSchema.validate(req.body);
    if (error) throw new AppError(400, error.details[0].message);
    const result = await authService.register(value);
    res.status(201).json(result);
  },

  async login(req: Request, res: Response) {
    const { error, value } = loginSchema.validate(req.body);
    if (error) throw new AppError(400, error.details[0].message);
    const result = await authService.login(value);
    res.json(result);
  },

  refresh(req: Request, res: Response) {
    const { refreshToken } = req.body || {};
    if (!refreshToken) throw new AppError(400, 'refreshToken required');
    res.json(authService.refresh(refreshToken));
  },
};
