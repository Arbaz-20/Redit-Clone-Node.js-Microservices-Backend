// notification-service/src/services/notification.service.ts
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '../middleware/error';
import { notificationRepository } from '../repositories/notification.repository';
import { publishEvent } from '../lib/broker';
import { logger } from '../lib/logger';

export const notificationService = {
  async create(userId: string, type: string, payload: object) {
    const id = uuidv4();
    await notificationRepository.insert({ id, userId, type, payload });
    publishEvent('notification.created', { id, userId, type });
    logger.info(`Notification '${type}' -> ${userId}`);
  },
  list(userId: string) {
    return notificationRepository.listForUser(userId);
  },
  unreadCount(userId: string) {
    return notificationRepository.unreadCount(userId);
  },
  async markRead(id: string, userId: string) {
    const ok = await notificationRepository.markRead(id, userId);
    if (!ok) throw new AppError(404, 'Notification not found');
    return { read: true, id };
  },
  async markAllRead(userId: string) {
    await notificationRepository.markAllRead(userId);
    return { read: true };
  },
};
