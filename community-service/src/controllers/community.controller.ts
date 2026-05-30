// community-service/src/controllers/community.controller.ts
import { Request, Response } from 'express';
import { AuthedRequest } from '../middleware/auth';
import { AppError } from '../middleware/error';
import { createCommunitySchema } from '../validation/community.schema';
import { communityService } from '../services/community.service';

export class CommunityController {
  public async create(req: AuthedRequest, res: Response) {
    const { error, value } = createCommunitySchema.validate(req.body);
    if (error) throw new AppError(400, error.details[0].message);
    res.status(201).json(await communityService.create(req.userId!, value));
  }
  public async list(_req: Request, res: Response) {
    res.json(await communityService.list());
  }
  public async getById(req: Request, res: Response) {
    res.json(await communityService.getById(req.params.id));
  }
  public async join(req: AuthedRequest, res: Response) {
    res.json(await communityService.join(req.params.id, req.userId!));
  }
  public async leave(req: AuthedRequest, res: Response) {
    res.json(await communityService.leave(req.params.id, req.userId!));
  }
}
export const communityController = new CommunityController();
