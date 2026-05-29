// notification-service/src/routes/notification.routes.ts
import { Router } from 'express';
import { asyncHandler } from '../middleware/error';
import { requireUser } from '../middleware/auth';
import { notificationController } from '../controllers/notification.controller';

export const notificationRoutes = Router();
notificationRoutes.get('/', requireUser, asyncHandler(notificationController.list));
notificationRoutes.get('/unread-count', requireUser, asyncHandler(notificationController.unreadCount));
notificationRoutes.post('/:id/read', requireUser, asyncHandler(notificationController.markRead));
notificationRoutes.post('/read-all', requireUser, asyncHandler(notificationController.markAllRead));
