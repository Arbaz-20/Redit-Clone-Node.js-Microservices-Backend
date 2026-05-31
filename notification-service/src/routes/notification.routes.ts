// notification-service/src/routes/notification.routes.ts
import { Router } from 'express';
import { requireUser } from '../middleware/auth';
import { notificationController } from '../controllers/notification.controller';

export const notificationRoutes = Router();
notificationRoutes.get('/', requireUser, notificationController.List);
notificationRoutes.get('/unread-count', requireUser, notificationController.UnreadCount);
notificationRoutes.post('/read-all', requireUser, notificationController.MarkAllRead);
notificationRoutes.post('/:id/read', requireUser, notificationController.MarkRead);
