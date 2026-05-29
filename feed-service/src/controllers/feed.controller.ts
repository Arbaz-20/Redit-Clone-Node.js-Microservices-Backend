// feed-service/src/controllers/feed.controller.ts
import { Request, Response } from 'express';
import { feedService } from '../services/feed.service';

export const feedController = {
  // Hot feed (time-decayed ranking). Optional ?communityId filter = lightweight personalization.
  async getHotFeed(req: Request, res: Response) {
    const limit = Math.min(Number(req.query.limit) || 25, 100);
    res.json(await feedService.getHotFeed(limit, req.query.communityId));
  },

  // Top feed (raw vote score).
  async getTopFeed(req: Request, res: Response) {
    const limit = Math.min(Number(req.query.limit) || 25, 100);
    res.json(await feedService.getTopFeed(limit));
  },
};
