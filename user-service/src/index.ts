import 'dotenv/config';
import express from 'express';
import Joi from 'joi';
import { logger } from './lib/logger';
import { initSchema, query } from './lib/db';
import { initBroker, consumeEvents } from './lib/broker';
import { AuthedRequest, attachUser, requireUser } from './lib/middleware';

const PORT = Number(process.env.PORT || 4002);

const DDL = `
  CREATE TABLE IF NOT EXISTS profiles (
    id         UUID PRIMARY KEY,
    username   VARCHAR(32) UNIQUE NOT NULL,
    bio        TEXT NOT NULL DEFAULT '',
    karma      INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
`;

const updateSchema = Joi.object({ bio: Joi.string().max(500).allow('').required() });

async function bootstrap() {
  await initSchema(DDL);
  await initBroker();

  // React to platform events.
  await consumeEvents('user-service.events', ['user.created', 'vote.created'], async (key, payload) => {
    if (key === 'user.created') {
      await query(
        'INSERT INTO profiles (id, username) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING',
        [payload.id, payload.username]
      );
      logger.info(`Profile created for ${payload.username}`);
    } else if (key === 'vote.created' && payload.authorId && payload.delta) {
      await query('UPDATE profiles SET karma = karma + $1 WHERE id = $2', [payload.delta, payload.authorId]);
    }
  });

  const app = express();
  app.use(express.json());
  app.use(attachUser);

  app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'user-service' }));

  app.get('/users/me', requireUser, async (req: AuthedRequest, res) => {
    const rows = await query('SELECT id, username, bio, karma, created_at FROM profiles WHERE id = $1', [req.userId]);
    if (!rows.length) return res.status(404).json({ error: 'Profile not found' });
    res.json(rows[0]);
  });

  app.patch('/users/me', requireUser, async (req: AuthedRequest, res) => {
    const { error, value } = updateSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });
    const rows = await query(
      'UPDATE profiles SET bio = $1 WHERE id = $2 RETURNING id, username, bio, karma, created_at',
      [value.bio, req.userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Profile not found' });
    res.json(rows[0]);
  });

  app.get('/users/:id', async (req, res) => {
    const rows = await query('SELECT id, username, bio, karma, created_at FROM profiles WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Profile not found' });
    res.json(rows[0]);
  });

  app.listen(PORT, () => logger.info(`User service listening on :${PORT}`));
}

bootstrap().catch((err) => {
  logger.error(`User service failed to start: ${err.message}`);
  process.exit(1);
});
