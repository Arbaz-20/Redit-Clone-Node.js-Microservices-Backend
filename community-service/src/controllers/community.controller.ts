// community-service/src/controllers/community.controller.ts
import { Request, Response } from 'express';
import { AuthedRequest } from '../middleware/auth';
import { AppError } from '../middleware/error';
import { createCommunitySchema } from '../validation/community.schema';
import { communityService } from '../services/community.service';

export const communityController = {
  async create(req: AuthedRequest, res: Response) {
    const { error, value } = createCommunitySchema.validate(req.body);
    if (error) throw new AppError(400, error.details[0].message);
    res.status(201).json(await communityService.create(req.userId!, value));
  },
  async list(_req: Request, res: Response) {
    res.json(await communityService.list());
  },
  async getById(req: Request, res: Response) {
    res.json(await communityService.getById(req.params.id));
  },
  async join(req: AuthedRequest, res: Response) {
    res.json(await communityService.join(req.params.id, req.userId!));
  },
  async leave(req: AuthedRequest, res: Response) {
    res.json(await communityService.leave(req.params.id, req.userId!));
  },
};
