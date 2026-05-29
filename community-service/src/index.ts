import 'dotenv/config';
import express from 'express';
import Joi from 'joi';
import { v4 as uuidv4 } from 'uuid';
import { logger } from './lib/logger';
import { initSchema, query } from './lib/db';
import { initBroker, publishEvent } from './lib/broker';
import { AuthedRequest, attachUser, requireUser } from './lib/middleware';

const PORT = Number(process.env.PORT || 4003);

const DDL = `
  CREATE TABLE IF NOT EXISTS communities (
    id          UUID PRIMARY KEY,
    name        VARCHAR(32) UNIQUE NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    owner_id    UUID NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS memberships (
    community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    user_id      UUID NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (community_id, user_id)
  );
`;

const createSchema = Joi.object({
  name: Joi.string().pattern(/^[A-Za-z0-9_]{3,32}$/).required(),
  description: Joi.string().max(500).allow('').default(''),
});

async function bootstrap() {
  await initSchema(DDL);
  await initBroker();

  const app = express();
  app.use(express.json());
  app.use(attachUser);

  app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'community-service' }));

  app.post('/communities', requireUser, async (req: AuthedRequest, res) => {
    const { error, value } = createSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const exists = await query('SELECT id FROM communities WHERE name = $1', [value.name]);
    if (exists.length) return res.status(409).json({ error: 'Community name taken' });

    const id = uuidv4();
    await query('INSERT INTO communities (id, name, description, owner_id) VALUES ($1, $2, $3, $4)', [
      id, value.name, value.description, req.userId,
    ]);
    // Owner auto-joins their community.
    await query('INSERT INTO memberships (community_id, user_id) VALUES ($1, $2)', [id, req.userId]);

    publishEvent('community.created', { id, name: value.name, ownerId: req.userId });
    res.status(201).json({ id, name: value.name, description: value.description, ownerId: req.userId });
  });

  app.get('/communities', async (_req, res) => {
    const rows = await query(
      `SELECT c.id, c.name, c.description, c.owner_id, c.created_at,
              (SELECT count(*)::int FROM memberships m WHERE m.community_id = c.id) AS member_count
       FROM communities c ORDER BY c.created_at DESC`
    );
    res.json(rows);
  });

  app.get('/communities/:id', async (req, res) => {
    const rows = await query(
      `SELECT c.id, c.name, c.description, c.owner_id, c.created_at,
              (SELECT count(*)::int FROM memberships m WHERE m.community_id = c.id) AS member_count
       FROM communities c WHERE c.id = $1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Community not found' });
    res.json(rows[0]);
  });

  app.post('/communities/:id/join', requireUser, async (req: AuthedRequest, res) => {
    const community = await query('SELECT id FROM communities WHERE id = $1', [req.params.id]);
    if (!community.length) return res.status(404).json({ error: 'Community not found' });
    await query(
      'INSERT INTO memberships (community_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.params.id, req.userId]
    );
    res.json({ joined: true, communityId: req.params.id });
  });

  app.delete('/communities/:id/leave', requireUser, async (req: AuthedRequest, res) => {
    await query('DELETE FROM memberships WHERE community_id = $1 AND user_id = $2', [req.params.id, req.userId]);
    res.json({ left: true, communityId: req.params.id });
  });

  app.listen(PORT, () => logger.info(`Community service listening on :${PORT}`));
}

bootstrap().catch((err) => {
  logger.error(`Community service failed to start: ${err.message}`);
  process.exit(1);
});
