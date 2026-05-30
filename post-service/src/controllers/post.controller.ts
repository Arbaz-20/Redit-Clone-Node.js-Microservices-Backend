// post-service/src/controllers/post.controller.ts
import { Request, Response } from 'express';
import { AuthedRequest } from '../middleware/auth';
import { AppError } from '../middleware/error';
import { createPostSchema } from '../validation/post.schema';
import { postService } from '../services/post.service';

export class PostController {
  public async create(req: AuthedRequest, res: Response) {
    const { error, value } = createPostSchema.validate(req.body);
    if (error) throw new AppError(400, error.details[0].message);
    res.status(201).json(await postService.create(req.userId!, req.username || 'unknown', value));
  }

  public async list(req: Request, res: Response) {
    const communityId = typeof req.query.communityId === 'string' ? req.query.communityId : undefined;
    res.json(await postService.list(communityId));
  }

  public async getById(req: Request, res: Response) {
    res.json(await postService.getById(req.params.id));
  }

  public async remove(req: AuthedRequest, res: Response) {
    res.json(await postService.delete(req.params.id, req.userId!));
  }
}

export const postController = new PostController();
