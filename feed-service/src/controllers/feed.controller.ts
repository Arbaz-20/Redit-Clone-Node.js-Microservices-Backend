// feed-service/src/controllers/feed.controller.ts
import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { feedService } from '../services/feed.service';

export class FeedController {
  // Hot feed (time-decayed ranking). Optional ?communityId filter = lightweight personalization.
  public GetHotFeed = async (req: Request, res: Response) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 25, 100);
      const communityId = typeof req.query.communityId === 'string' ? req.query.communityId : undefined;

      const result = await feedService.getHotFeed(limit, communityId);
      res.status(StatusCodes.OK).json(result);
    } catch (error: any) {
      console.error('Error in GetHotFeed:', error);
      res.status(error.status || StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
    }
  };

  // Top feed (raw vote score).
  public GetTopFeed = async (req: Request, res: Response) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 25, 100);

      const result = await feedService.getTopFeed(limit);
      res.status(StatusCodes.OK).json(result);
    } catch (error: any) {
      console.error('Error in GetTopFeed:', error);
      res.status(error.status || StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
    }
  };
}

export const feedController = new FeedController();
