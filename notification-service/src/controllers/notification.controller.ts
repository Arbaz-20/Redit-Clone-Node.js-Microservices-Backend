// notification-service/src/controllers/notification.controller.ts
import { Response } from 'express';
import { AuthedRequest } from '../middleware/auth';
import { notificationService } from '../services/notification.service';

export const notificationController = {
  async list(req: AuthedRequest, res: Response) {
    res.json(await notificationService.list(req.userId!));
  },
  async unreadCount(req: AuthedRequest, res: Response) {
    res.json({ count: await notificationService.unreadCount(req.userId!) });
  },
  async markRead(req: AuthedRequest, res: Response) {
    res.json(await notificationService.markRead(req.params.id, req.userId!));
  },
  async markAllRead(req: AuthedRequest, res: Response) {
    res.json(await notificationService.markAllRead(req.userId!));
  },
};
