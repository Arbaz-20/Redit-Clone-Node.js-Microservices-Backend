// comment-service/src/controllers/comment.controller.ts
import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { AuthedRequest } from '../middleware/auth';
import { createCommentSchema } from '../validation/comment.schema';
import { commentService } from '../services/comment.service';

export class CommentController {
  public Create = async (req: AuthedRequest, res: Response) => {
    try {
      const userId = req.userId;
      const username = req.username || 'unknown';
      const { error, value } = createCommentSchema.validate(req.body);

      if (!userId) {
        res.status(StatusCodes.UNAUTHORIZED).json({ error: 'userId is required' });
      } else if (error) {
        res.status(StatusCodes.BAD_REQUEST).json({ error: error.details[0].message });
      } else {
        const result = await commentService.create(userId, username, value);
        res.status(StatusCodes.CREATED).json(result);
      }
    } catch (error: any) {
      console.error('Error in Create:', error);
      res.status(error.status || StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
    }
  };

  public List = async (req: Request, res: Response) => {
    try {
      const postId = typeof req.query.postId === 'string' ? req.query.postId : undefined;

      if (!postId) {
        res.status(StatusCodes.BAD_REQUEST).json({ error: 'postId query param required' });
      } else {
        const result = await commentService.listByPost(postId);
        res.status(StatusCodes.OK).json(result);
      }
    } catch (error: any) {
      console.error('Error in List:', error);
      res.status(error.status || StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
    }
  };

  public GetById = async (req: Request, res: Response) => {
    try {
      const id = req.params.id;

      if (!id) {
        res.status(StatusCodes.BAD_REQUEST).json({ error: 'id is required' });
      } else {
        const result = await commentService.getById(id);
        res.status(StatusCodes.OK).json(result);
      }
    } catch (error: any) {
      console.error('Error in GetById:', error);
      res.status(error.status || StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
    }
  };

  public Remove = async (req: AuthedRequest, res: Response) => {
    try {
      const userId = req.userId;
      const id = req.params.id;

      if (!userId) {
        res.status(StatusCodes.UNAUTHORIZED).json({ error: 'userId is required' });
      } else if (!id) {
        res.status(StatusCodes.BAD_REQUEST).json({ error: 'id is required' });
      } else {
        const result = await commentService.delete(id, userId);
        res.status(StatusCodes.OK).json(result);
      }
    } catch (error: any) {
      console.error('Error in Remove:', error);
      res.status(error.status || StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
    }
  };
}

export const commentController = new CommentController();
