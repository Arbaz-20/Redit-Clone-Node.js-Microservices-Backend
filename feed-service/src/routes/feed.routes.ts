// feed-service/src/routes/feed.routes.ts
import { Router } from 'express';
import { feedController } from '../controllers/feed.controller';

export const feedRoutes = Router();
feedRoutes.get('/', feedController.GetHotFeed);
feedRoutes.get('/top', feedController.GetTopFeed);
