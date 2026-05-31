// user-service/src/controllers/profile.controller.ts
import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { AuthedRequest } from '../middleware/auth';
import { updateProfileSchema } from '../validation/profile.schema';
import { profileService } from '../services/profile.service';

export class ProfileController {
  public GetMe = async (req: AuthedRequest, res: Response) => {
    try {
      const userId = req.userId;

      if (!userId) {
        res.status(StatusCodes.UNAUTHORIZED).json({ error: 'userId is required' });
      } else {
        const result = await profileService.getById(userId);
        res.status(StatusCodes.OK).json(result);
      }
    } catch (error: any) {
      console.error('Error in GetMe:', error);
      res.status(error.status || StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
    }
  };

  public UpdateMe = async (req: AuthedRequest, res: Response) => {
    try {
      const userId = req.userId;
      const { error, value } = updateProfileSchema.validate(req.body);

      if (!userId) {
        res.status(StatusCodes.UNAUTHORIZED).json({ error: 'userId is required' });
      } else if (error) {
        res.status(StatusCodes.BAD_REQUEST).json({ error: error.details[0].message });
      } else {
        const result = await profileService.updateBio(userId, value.bio);
        res.status(StatusCodes.OK).json(result);
      }
    } catch (error: any) {
      console.error('Error in UpdateMe:', error);
      res.status(error.status || StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
    }
  };

  public GetById = async (req: Request, res: Response) => {
    try {
      const id = req.params.id;

      if (!id) {
        res.status(StatusCodes.BAD_REQUEST).json({ error: 'id is required' });
      } else {
        const result = await profileService.getById(id);
        res.status(StatusCodes.OK).json(result);
      }
    } catch (error: any) {
      console.error('Error in GetById:', error);
      res.status(error.status || StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
    }
  };
}

export const profileController = new ProfileController();
