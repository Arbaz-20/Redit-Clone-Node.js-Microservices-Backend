// comment-service/src/controllers/comment.controller.ts
import { Request, Response } from 'express';
import { AuthedRequest } from '../middleware/auth';
import { AppError } from '../middleware/error';
import { createCommentSchema } from '../validation/comment.schema';
import { commentService } from '../services/comment.service';

export class CommentController {
  public async create(req: AuthedRequest, res: Response) {
    const { error, value } = createCommentSchema.validate(req.body);
    if (error) throw new AppError(400, error.details[0].message);
    res.status(201).json(await commentService.create(req.userId!, req.username || 'unknown', value));
  }

  public async list(req: Request, res: Response) {
    const postId = typeof req.query.postId === 'string' ? req.query.postId : undefined;
    if (!postId) throw new AppError(400, 'postId query param required');
    res.json(await commentService.listByPost(postId));
  }

  public async getById(req: Request, res: Response) {
    res.json(await commentService.getById(req.params.id));
  }

  public async remove(req: AuthedRequest, res: Response) {
    res.json(await commentService.delete(req.params.id, req.userId!));
  }
}

export const commentController = new CommentController();
