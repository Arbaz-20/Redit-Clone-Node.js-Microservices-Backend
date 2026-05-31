// vote-service/src/controllers/vote.controller.ts
import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { AuthedRequest } from '../middleware/auth';
import { voteSchema } from '../validation/vote.schema';
import { voteService } from '../services/vote.service';

export class VoteController {
  public Cast = async (req: AuthedRequest, res: Response) => {
    try {
      const userId = req.userId;
      const { error, value } = voteSchema.validate(req.body);

      if (!userId) {
        res.status(StatusCodes.UNAUTHORIZED).json({ error: 'userId is required' });
      } else if (error) {
        res.status(StatusCodes.BAD_REQUEST).json({ error: error.details[0].message });
      } else {
        const result = await voteService.cast(userId, value);
        res.status(StatusCodes.OK).json(result);
      }
    } catch (error: any) {
      console.error('Error in Cast:', error);
      res.status(error.status || StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
    }
  };

  public Score = async (req: Request, res: Response) => {
    try {
      const targetType = typeof req.query.targetType === 'string' ? req.query.targetType : undefined;
      const targetId = typeof req.query.targetId === 'string' ? req.query.targetId : undefined;

      if (!targetType || !targetId) {
        res.status(StatusCodes.BAD_REQUEST).json({ error: 'targetType and targetId required' });
      } else {
        const score = await voteService.score(targetType, targetId);
        res.status(StatusCodes.OK).json({ targetType, targetId, score });
      }
    } catch (error: any) {
      console.error('Error in Score:', error);
      res.status(error.status || StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
    }
  };

  public Mine = async (req: AuthedRequest, res: Response) => {
    try {
      const userId = req.userId;
      const targetType = typeof req.query.targetType === 'string' ? req.query.targetType : undefined;
      const targetId = typeof req.query.targetId === 'string' ? req.query.targetId : undefined;

      if (!userId) {
        res.status(StatusCodes.UNAUTHORIZED).json({ error: 'userId is required' });
      } else if (!targetType || !targetId) {
        res.status(StatusCodes.BAD_REQUEST).json({ error: 'targetType and targetId required' });
      } else {
        const value = await voteService.myValue(userId, targetType, targetId);
        res.status(StatusCodes.OK).json({ value });
      }
    } catch (error: any) {
      console.error('Error in Mine:', error);
      res.status(error.status || StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
    }
  };
}

export const voteController = new VoteController();
