// notification-service/src/controllers/notification.controller.ts
import { Response } from 'express';
import { AuthedRequest } from '../middleware/auth';
import { notificationService } from '../services/notification.service';

export class NotificationController {
  public async list(req: AuthedRequest, res: Response) {
    res.json(await notificationService.list(req.userId!));
  }
  public async unreadCount(req: AuthedRequest, res: Response) {
    res.json({ count: await notificationService.unreadCount(req.userId!) });
  }
  public async markRead(req: AuthedRequest, res: Response) {
    res.json(await notificationService.markRead(req.params.id, req.userId!));
  }
  public async markAllRead(req: AuthedRequest, res: Response) {
    res.json(await notificationService.markAllRead(req.userId!));
  }
}
export const notificationController = new NotificationController();
