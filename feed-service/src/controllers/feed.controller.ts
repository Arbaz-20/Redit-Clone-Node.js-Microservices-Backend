// feed-service/src/controllers/feed.controller.ts
import { Request, Response } from 'express';
import { feedService } from '../services/feed.service';

export class FeedController {
  // Hot feed (time-decayed ranking). Optional ?communityId filter = lightweight personalization.
  public async getHotFeed(req: Request, res: Response) {
    const limit = Math.min(Number(req.query.limit) || 25, 100);
    const communityId = typeof req.query.communityId === 'string' ? req.query.communityId : undefined;
    res.json(await feedService.getHotFeed(limit, communityId));
  }

  // Top feed (raw vote score).
  public async getTopFeed(req: Request, res: Response) {
    const limit = Math.min(Number(req.query.limit) || 25, 100);
    res.json(await feedService.getTopFeed(limit));
  }
}
export const feedController = new FeedController();
