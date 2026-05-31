// auth-service/src/controllers/auth.controller.ts
import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { registerSchema, loginSchema } from '../validation/auth.schema';
import { authService } from '../services/auth.service';

export class AuthController {
  public Register = async (req: Request, res: Response) => {
    try {
      const { error, value } = registerSchema.validate(req.body);

      if (error) {
        res.status(StatusCodes.BAD_REQUEST).json({ error: error.details[0].message });
      } else {
        const result = await authService.register(value);
        res.status(StatusCodes.CREATED).json(result);
      }
    } catch (error: any) {
      console.error('Error in Register:', error);
      res.status(error.status || StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
    }
  };

  public Login = async (req: Request, res: Response) => {
    try {
      const { error, value } = loginSchema.validate(req.body);

      if (error) {
        res.status(StatusCodes.BAD_REQUEST).json({ error: error.details[0].message });
      } else {
        const result = await authService.login(value);
        res.status(StatusCodes.OK).json(result);
      }
    } catch (error: any) {
      console.error('Error in Login:', error);
      res.status(error.status || StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
    }
  };

  public Refresh = async (req: Request, res: Response) => {
    try {
      const { refreshToken } = req.body || {};

      if (!refreshToken) {
        res.status(StatusCodes.BAD_REQUEST).json({ error: 'refreshToken required' });
      } else {
        const result = await authService.refresh(refreshToken);
        res.status(StatusCodes.OK).json(result);
      }
    } catch (error: any) {
      console.error('Error in Refresh:', error);
      res.status(error.status || StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
    }
  };
}

export const authController = new AuthController();
