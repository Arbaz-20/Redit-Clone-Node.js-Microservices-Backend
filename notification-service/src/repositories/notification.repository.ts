// notification-service/src/repositories/notification.repository.ts
import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { notifications } from '../db/schema';

export const notificationRepository = {
  async insert(row: { id: string; userId: string; type: string; payload: object }) {
    await db.insert(notifications).values(row);
  },
  async listForUser(userId: string) {
    return db.select({
      id: notifications.id, type: notifications.type, payload: notifications.payload,
      read: notifications.read, created_at: notifications.createdAt,
    }).from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(100);
  },
  async unreadCount(userId: string): Promise<number> {
    const rows = await db.select({ count: sql<number>`count(*)::int` }).from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));
    return rows[0].count;
  },
  async markRead(id: string, userId: string) {
    const rows = await db.update(notifications).set({ read: true })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId))).returning({ id: notifications.id });
    return rows.length > 0;
  },
  async markAllRead(userId: string) {
    await db.update(notifications).set({ read: true })
      .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));
  },
};
