// notification-service/src/controllers/notification.controller.ts
import { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { AuthedRequest } from '../middleware/auth';
import { notificationService } from '../services/notification.service';

export class NotificationController {
  public List = async (req: AuthedRequest, res: Response) => {
    try {
      const userId = req.userId;

      if (!userId) {
        res.status(StatusCodes.UNAUTHORIZED).json({ error: 'userId is required' });
      } else {
        const result = await notificationService.list(userId);
        res.status(StatusCodes.OK).json(result);
      }
    } catch (error: any) {
      console.error('Error in List:', error);
      res.status(error.status || StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
    }
  };

  public UnreadCount = async (req: AuthedRequest, res: Response) => {
    try {
      const userId = req.userId;

      if (!userId) {
        res.status(StatusCodes.UNAUTHORIZED).json({ error: 'userId is required' });
      } else {
        const count = await notificationService.unreadCount(userId);
        res.status(StatusCodes.OK).json({ count });
      }
    } catch (error: any) {
      console.error('Error in UnreadCount:', error);
      res.status(error.status || StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
    }
  };

  public MarkRead = async (req: AuthedRequest, res: Response) => {
    try {
      const userId = req.userId;
      const id = req.params.id;

      if (!userId) {
        res.status(StatusCodes.UNAUTHORIZED).json({ error: 'userId is required' });
      } else if (!id) {
        res.status(StatusCodes.BAD_REQUEST).json({ error: 'id is required' });
      } else {
        const result = await notificationService.markRead(id, userId);
        res.status(StatusCodes.OK).json(result);
      }
    } catch (error: any) {
      console.error('Error in MarkRead:', error);
      res.status(error.status || StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
    }
  };

  public MarkAllRead = async (req: AuthedRequest, res: Response) => {
    try {
      const userId = req.userId;

      if (!userId) {
        res.status(StatusCodes.UNAUTHORIZED).json({ error: 'userId is required' });
      } else {
        const result = await notificationService.markAllRead(userId);
        res.status(StatusCodes.OK).json(result);
      }
    } catch (error: any) {
      console.error('Error in MarkAllRead:', error);
      res.status(error.status || StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
    }
  };
}

export const notificationController = new NotificationController();
