// feed-service/src/routes/feed.routes.ts
import { Router } from 'express';
import { asyncHandler } from '../middleware/error';
import { feedController } from '../controllers/feed.controller';

export const feedRoutes = Router();
feedRoutes.get('/', asyncHandler(feedController.getHotFeed));
feedRoutes.get('/top', asyncHandler(feedController.getTopFeed));
