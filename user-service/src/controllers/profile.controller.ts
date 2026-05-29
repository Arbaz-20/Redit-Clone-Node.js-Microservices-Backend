// user-service/src/controllers/profile.controller.ts
import { Response } from 'express';
import { AuthedRequest } from '../middleware/auth';
import { AppError } from '../middleware/error';
import { updateProfileSchema } from '../validation/profile.schema';
import { profileService } from '../services/profile.service';

export const profileController = {
  async getMe(req: AuthedRequest, res: Response) {
    res.json(await profileService.getById(req.userId!));
  },
  async updateMe(req: AuthedRequest, res: Response) {
    const { error, value } = updateProfileSchema.validate(req.body);
    if (error) throw new AppError(400, error.details[0].message);
    res.json(await profileService.updateBio(req.userId!, value.bio));
  },
  async getById(req: AuthedRequest, res: Response) {
    res.json(await profileService.getById(req.params.id));
  },
};
