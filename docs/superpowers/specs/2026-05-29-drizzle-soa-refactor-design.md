# Drizzle ORM + Layered SOA Refactor — Design

**Date:** 2026-05-29
**Project:** Reddit-clone microservices backend
**Status:** Approved (design), pending implementation plan

## Goal

Convert the existing Reddit-clone microservices backend from flat, single-file
services using raw `pg` SQL to a clean, layered architecture backed by **Drizzle
ORM**. Preserve all external behavior (routes, request/response shapes, RabbitMQ
events). This is a structural refactor, not a contract change.

## Current state

- 8 microservices + 1 API gateway, all TypeScript + Express.
- Each Postgres service is a flat ~100-line `src/index.ts` containing routing,
  Joi validation, business logic, and raw inline SQL.
- Data access via `src/lib/db.ts`: a `pg` `Pool` with a `query()` helper and an
  `initSchema(ddl)` that runs `CREATE TABLE IF NOT EXISTS` on boot.
- Database-per-service on one Postgres instance (auth_db, user_db, community_db,
  post_db, comment_db, vote_db, notification_db).
- `feed-service` is **Redis-backed** (no Postgres).
- `api-gateway` has **no database** (reverse proxy).

## Service classification

| Service              | Store    | Gets Drizzle? | Treatment                          |
|----------------------|----------|---------------|------------------------------------|
| auth-service         | Postgres | Yes           | Full refactor (canonical template) |
| user-service         | Postgres | Yes           | Full refactor                      |
| community-service    | Postgres | Yes           | Full refactor                      |
| post-service         | Postgres | Yes           | Full refactor                      |
| comment-service      | Postgres | Yes           | Full refactor                      |
| vote-service         | Postgres | Yes           | Full refactor                      |
| notification-service | Postgres | Yes           | Full refactor                      |
| feed-service         | Redis    | No            | Layering only (Redis stays)        |
| api-gateway          | none     | No            | Layering only (no Drizzle)         |

## Target per-service structure (Postgres services)

```
<service>/
  drizzle.config.ts          # drizzle-kit config (schema path, out dir, db creds)
  drizzle/                   # generated, versioned migration SQL
  src/
    config/env.ts            # typed, validated env loading
    db/
      schema.ts              # Drizzle pgTable defs (replaces inline DDL)
      client.ts              # drizzle() instance over a pg Pool
      migrate.ts             # applies migrations on boot via migrator
    validation/*.schema.ts   # Joi schemas
    repositories/*.ts        # ALL data access via Drizzle (replaces raw query())
    services/*.ts            # business logic (hashing, tokens, event publish)
    controllers/*.ts         # parse req -> call service -> shape response
    routes/*.ts              # express Router: path -> controller
    middleware/              # auth, central error handler
    lib/{logger,broker}.ts   # unchanged infra
    app.ts                   # build express app, mount routes, error handler
    index.ts                 # bootstrap: migrate -> broker -> listen
```

### Layering rules

- Request flow: **routes → controller → service → repository → db**.
- Controllers never touch SQL. Repositories never touch HTTP.
- Validation happens at the controller boundary (Joi).
- Domain events are published from the **service** layer.
- A central error-handling middleware maps typed errors thrown by services to
  HTTP responses, so handlers stop repeating `res.status(...)`.

## Drizzle integration

- Use `drizzle-orm/node-postgres` over the existing `pg` `Pool` — keep the
  driver, swap the query layer.
- `schema.ts` per service uses `pgTable` defs matching current columns exactly
  (uuid PK, varchar, `timestamptz default now()`), so the DB shape is unchanged.
- **Migrations: drizzle-kit (versioned).** `drizzle-kit generate` produces
  versioned SQL into `drizzle/`; `migrate.ts` applies them on boot via the
  drizzle-orm migrator — replacing the current `CREATE TABLE on boot`.
- Database-per-service is unchanged.
- Dependencies added per Postgres service: `drizzle-orm`, `drizzle-kit`. `pg`
  stays as the underlying driver.
- **Validation stays Joi** to minimize churn. (drizzle-zod is a viable future
  option but switching all validation is out of scope.)

## feed-service & api-gateway

- **feed-service:** apply the same layered separation (routes/controllers/
  services/repositories), but the repository layer talks to **Redis**, not
  Drizzle. No schema/migrate files.
- **api-gateway:** split routing/proxy config into routes/controllers; no data
  layer.

## Rollout order

1. **auth-service** end-to-end as the canonical template (most logic-rich:
   tokens + events). Review and bless the pattern.
2. Replicate the identical shape to: user, community, post, comment, vote,
   notification.
3. feed-service (Redis, layering only).
4. api-gateway (layering only).
5. Update `docker-compose.yml` / Dockerfiles only if start commands change
   (e.g. running the migrator before `start`).

## Guarantees / non-goals

- **Preserved:** all HTTP routes, request/response JSON, RabbitMQ event names &
  payloads, database schema (columns, types, constraints), env var names.
- **Non-goals:** switching validation libraries, changing the DB topology,
  adding new features, altering the API gateway's external contract.

## Success criteria

- Every Postgres service uses Drizzle for 100% of its data access (no raw
  `query()` calls remain).
- Each service builds (`tsc`) and starts; migrations apply cleanly on a fresh DB.
- `docker-compose up` brings the whole system up with identical behavior.
- Each service follows the layered structure with no cross-layer violations.
