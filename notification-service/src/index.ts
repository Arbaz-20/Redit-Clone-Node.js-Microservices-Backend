import 'dotenv/config';
import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from './lib/logger';
import { initSchema, query } from './lib/db';
import { initBroker, consumeEvents, publishEvent } from './lib/broker';
import { AuthedRequest, attachUser, requireUser } from './lib/middleware';

const PORT = Number(process.env.PORT || 4008);

const DDL = `
  CREATE TABLE IF NOT EXISTS notifications (
    id         UUID PRIMARY KEY,
    user_id    UUID NOT NULL,
    type       VARCHAR(32) NOT NULL,
    payload    JSONB NOT NULL DEFAULT '{}'::jsonb,
    read       BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read);
`;

async function createNotification(userId: string, type: string, payload: object) {
  const id = uuidv4();
  await query('INSERT INTO notifications (id, user_id, type, payload) VALUES ($1, $2, $3, $4)', [id, userId, type, payload]);
  publishEvent('notification.created', { id, userId, type });
  logger.info(`Notification '${type}' -> ${userId}`);
}

async function bootstrap() {
  await initSchema(DDL);
  await initBroker();

  await consumeEvents(
    'notification-service.events',
    ['user.created', 'comment.created', 'vote.created'],
    async (key, payload) => {
      if (key === 'user.created') {
        await createNotification(payload.id, 'welcome', { message: `Welcome to Reddit Clone, ${payload.username}!` });
      } else if (key === 'comment.created' && payload.replyToUserId && payload.replyToUserId !== payload.authorId) {
        await createNotification(payload.replyToUserId, 'reply', {
          postId: payload.postId, commentId: payload.id, from: payload.authorUsername, snippet: payload.snippet,
        });
      } else if (key === 'vote.created' && payload.value === 1 && payload.authorId && payload.authorId !== payload.voterId) {
        await createNotification(payload.authorId, 'upvote', { targetType: payload.targetType, targetId: payload.targetId });
      }
    }
  );

  const app = express();
  app.use(express.json());
  app.use(attachUser);

  app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'notification-service' }));

  app.get('/notifications', requireUser, async (req: AuthedRequest, res) => {
    const rows = await query(
      'SELECT id, type, payload, read, created_at FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100',
      [req.userId]
    );
    res.json(rows);
  });

  app.get('/notifications/unread-count', requireUser, async (req: AuthedRequest, res) => {
    const rows = await query('SELECT count(*)::int AS count FROM notifications WHERE user_id = $1 AND read = false', [req.userId]);
    res.json({ count: rows[0].count });
  });

  app.post('/notifications/:id/read', requireUser, async (req: AuthedRequest, res) => {
    const rows = await query(
      'UPDATE notifications SET read = true WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Notification not found' });
    res.json({ read: true, id: req.params.id });
  });

  app.post('/notifications/read-all', requireUser, async (req: AuthedRequest, res) => {
    await query('UPDATE notifications SET read = true WHERE user_id = $1 AND read = false', [req.userId]);
    res.json({ read: true });
  });

  app.listen(PORT, () => logger.info(`Notification service listening on :${PORT}`));
}

bootstrap().catch((err) => {
  logger.error(`Notification service failed to start: ${err.message}`);
  process.exit(1);
});
