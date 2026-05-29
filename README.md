# Reddit Clone — Microservices Backend

A scalable, Reddit-style social platform built as an event-driven microservices system using
**Node.js + Express + TypeScript**, orchestrated with **Docker Compose**, backed by **PostgreSQL**,
**Redis**, and **RabbitMQ**.

Every service owns its own database, communicates synchronously through a single **API Gateway**, and
reacts to domain events asynchronously over a **RabbitMQ topic exchange**.

---

## Table of contents

1. [Architecture](#architecture)
2. [Services](#services)
3. [Technology stack](#technology-stack)
4. [Event-driven design](#event-driven-design)
5. [Redis usage](#redis-usage)
6. [Feed ranking](#feed-ranking)
7. [Prerequisites](#prerequisites)
8. [Quick start](#quick-start)
9. [Environment variables](#environment-variables)
10. [API reference](#api-reference)
11. [End-to-end walkthrough](#end-to-end-walkthrough)
12. [Authentication flow](#authentication-flow)
13. [Project structure](#project-structure)
14. [Local development](#local-development)
15. [Security](#security)
16. [Troubleshooting](#troubleshooting)
17. [Production roadmap](#production-roadmap)

---

## Architecture

```
                            ┌─────────────────────────┐
        HTTP (clients)      │      API Gateway         │  :8080  (only public port)
   ───────────────────────▶ │  JWT validate · routing  │
                            │  rate limiting · CORS    │
                            └────────────┬─────────────┘
                                         │ proxies + x-user-id header
   ┌───────────┬───────────┬────────────┼───────────┬───────────┬───────────┐
   ▼           ▼           ▼            ▼           ▼           ▼           ▼
┌──────┐  ┌──────┐  ┌──────────┐  ┌──────┐  ┌────────┐  ┌──────┐  ┌──────┐  ┌──────────────┐
│ Auth │  │ User │  │Community │  │ Post │  │Comment │  │ Vote │  │ Feed │  │ Notification │
└──┬───┘  └──┬───┘  └────┬─────┘  └──┬───┘  └───┬────┘  └──┬───┘  └──┬───┘  └──────┬───────┘
   │         │           │           │          │          │         │             │
   │         └────────── PostgreSQL (one DB per service) ───────────┘             │
   │                                  │                       Redis (feed) ───────┘
   └──────────────────────────────── RabbitMQ topic exchange "reddit.events" ──────
```

- The **API Gateway** is the only container with a published port. Clients always talk to `http://localhost:8080`.
- The gateway validates the JWT and forwards the caller's identity to services via a trusted `x-user-id`
  header. Services never see the raw token — they **trust the gateway**.
- Services publish/consume domain events through RabbitMQ for everything asynchronous (profiles, karma,
  feed ranking, notifications).

---

## Services

| Service                | Internal port | Database          | Responsibility                                              |
|------------------------|---------------|-------------------|-------------------------------------------------------------|
| **api-gateway**        | 8080 (public) | —                 | Routing, JWT validation, Redis rate limiting, CORS, Helmet  |
| **auth-service**       | 4001          | `auth_db`         | Register / login / refresh, bcrypt hashing, JWT issuance    |
| **user-service**       | 4002          | `user_db`         | Profiles, karma (updated from vote events)                  |
| **community-service**  | 4003          | `community_db`    | Create communities, join / leave                            |
| **post-service**       | 4004          | `post_db`         | Create / list / delete posts, denormalized vote score       |
| **comment-service**    | 4005          | `comment_db`      | Nested comments (self-referencing `parent_id`)              |
| **vote-service**       | 4006          | `vote_db`         | Up / down / clear votes, emits score deltas                 |
| **feed-service**       | 4007          | Redis only        | Hot + top ranking, time-decay scoring                       |
| **notification-service** | 4008        | `notification_db` | Event-driven notifications (welcome, reply, upvote)         |

Infrastructure containers: **postgres** (`:5432`), **redis** (`:6379`),
**rabbitmq** (`:5672` AMQP, `:15672` management UI).

---

## Technology stack

- **Runtime:** Node.js 22 (Alpine), TypeScript 5
- **Web:** Express 4
- **Auth:** JSON Web Tokens (access + refresh), bcryptjs
- **Datastores:** PostgreSQL 16 (database-per-service), Redis 7
- **Messaging:** RabbitMQ 3.13 (topic exchange, durable queues)
- **Validation:** Joi
- **Hardening:** Helmet, CORS, `express-rate-limit` backed by Redis
- **Logging:** Winston
- **Orchestration:** Docker + Docker Compose

---

## Event-driven design

All events flow through a single durable **topic exchange**: `reddit.events`.
Each consumer binds its own durable queue, so adding a new consumer never affects existing ones.

| Event              | Published by        | Consumed by                                  | Effect                                              |
|--------------------|---------------------|----------------------------------------------|-----------------------------------------------------|
| `user.created`     | auth-service        | user-service, notification-service           | Create profile · send welcome notification          |
| `community.created`| community-service   | (open for future consumers)                  | —                                                   |
| `post.created`     | post-service        | feed-service                                 | Index post into the ranked feed                     |
| `post.deleted`     | post-service        | feed-service                                 | Remove post from feed                               |
| `comment.created`  | comment-service     | notification-service                         | Notify the user being replied to                    |
| `vote.created`     | vote-service        | post/comment-service, user-service, feed, notification | Update score · karma · feed rank · notify author |
| `notification.created` | notification-service | (open for future: websocket push gateway) | —                                                   |

**Vote deltas:** the vote service computes `delta = newValue - oldValue` and includes it in `vote.created`.
Downstream consumers simply apply the delta, so changing a vote from +1 to −1 correctly moves a score by −2.

---

## Redis usage

- **Feed ranking** — two sorted sets: `feed:ranked` (time-decayed "hot") and `feed:score` (raw "top").
- **Post cache** — each post's display data is cached in a `post:{id}` hash for fast feed hydration.
- **Rate limiting** — the gateway stores request counters in Redis (shared across gateway replicas).

---

## Feed ranking

The feed service uses the decay formula from the execution plan:

```
score      = upvotes - downvotes
ageInHours = (Date.now() - createdAt) / 3_600_000
rank       = score / Math.pow(ageInHours + 2, 1.5)
```

`rank` is recomputed whenever a `vote.created` event arrives and stored as the sorted-set score in
`feed:ranked`. `GET /feed` returns posts in descending `rank` order; `GET /feed/top` returns them by raw score.

---

## Prerequisites

- **Docker** 20+ and **Docker Compose v2** (`docker compose`, not `docker-compose`).
- Ports free on the host: `8080`, `5432`, `6379`, `5672`, `15672`.
- No local Node.js required to run — everything builds inside containers. (Node 22 only needed for
  running a service outside Docker during development.)

---

## Quick start

```bash
# 1. Copy the environment template
cp .env.example .env        # (Windows PowerShell: Copy-Item .env.example .env)

# 2. Build and start the whole stack
docker compose up --build

# 3. Wait until you see each service log "listening on :<port>"
#    The gateway is now reachable at http://localhost:8080
```

Stop with `Ctrl+C`, then `docker compose down` (add `-v` to also wipe the Postgres volume).

Health check:

```bash
curl http://localhost:8080/health
# {"status":"ok","service":"api-gateway"}
```

RabbitMQ management UI: http://localhost:15672 (user/pass from `.env`, default `reddit` / `reddit_pass`).

---

## Environment variables

All configuration lives in `.env` (copied from `.env.example`). Key values:

| Variable                | Default               | Purpose                                  |
|-------------------------|-----------------------|------------------------------------------|
| `JWT_SECRET`            | `super_secret_...`    | **Change in production.** Signs all JWTs |
| `JWT_EXPIRES_IN`        | `15m`                 | Access token lifetime                    |
| `REFRESH_TOKEN_EXPIRES_IN` | `7d`               | Refresh token lifetime                   |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` | `reddit` / `reddit_pass` | Postgres credentials      |
| `RABBITMQ_USER` / `RABBITMQ_PASSWORD` | `reddit` / `reddit_pass` | RabbitMQ credentials      |
| `GATEWAY_PORT`          | `8080`                | Public API port                          |
| `RATE_LIMIT_WINDOW_MS`  | `60000`               | Rate-limit window                        |
| `RATE_LIMIT_MAX`        | `120`                 | Max requests per window per IP           |
| `CORS_ORIGIN`           | `*`                   | Allowed CORS origin                      |

---

## API reference

> Base URL: `http://localhost:8080`
> Protected endpoints require `Authorization: Bearer <accessToken>`.

### Auth (`/auth`) — public

| Method | Path             | Body                                  | Description                |
|--------|------------------|---------------------------------------|----------------------------|
| POST   | `/auth/register` | `{ username, email, password }`       | Create account, get tokens |
| POST   | `/auth/login`    | `{ identifier, password }`            | `identifier` = username or email |
| POST   | `/auth/refresh`  | `{ refreshToken }`                    | New access token           |

### Users (`/users`)

| Method | Path          | Auth | Description              |
|--------|---------------|------|--------------------------|
| GET    | `/users/me`   | ✅   | Own profile (+ karma)    |
| PATCH  | `/users/me`   | ✅   | Update `{ bio }`         |
| GET    | `/users/:id`  | —    | Public profile           |

### Communities (`/communities`)

| Method | Path                        | Auth | Description                       |
|--------|-----------------------------|------|-----------------------------------|
| POST   | `/communities`              | ✅   | `{ name, description }`            |
| GET    | `/communities`              | —    | List (with member counts)         |
| GET    | `/communities/:id`          | —    | One community                     |
| POST   | `/communities/:id/join`     | ✅   | Join                              |
| DELETE | `/communities/:id/leave`    | ✅   | Leave                             |

### Posts (`/posts`)

| Method | Path                   | Auth | Description                          |
|--------|------------------------|------|--------------------------------------|
| POST   | `/posts`               | ✅   | `{ communityId, title, body }`       |
| GET    | `/posts`               | —    | List; optional `?communityId=`       |
| GET    | `/posts/:id`           | —    | One post                             |
| DELETE | `/posts/:id`           | ✅   | Delete (author only)                 |

### Comments (`/comments`)

| Method | Path                | Auth | Description                                           |
|--------|---------------------|------|-------------------------------------------------------|
| POST   | `/comments`         | ✅   | `{ postId, parentId?, body, replyToUserId? }`         |
| GET    | `/comments?postId=` | —    | Flat list (build tree client-side via `parent_id`)    |
| GET    | `/comments/:id`     | —    | One comment                                           |
| DELETE | `/comments/:id`     | ✅   | Delete (author only)                                  |

### Votes (`/votes`)

| Method | Path                                   | Auth | Description                                            |
|--------|----------------------------------------|------|--------------------------------------------------------|
| POST   | `/votes`                               | ✅   | `{ targetType, targetId, value, authorId? }` value ∈ {1,0,−1} |
| GET    | `/votes/score?targetType=&targetId=`   | —    | Aggregate score                                        |
| GET    | `/votes/me?targetType=&targetId=`      | ✅   | Caller's current vote                                  |

### Feed (`/feed`)

| Method | Path                       | Auth | Description                                  |
|--------|----------------------------|------|----------------------------------------------|
| GET    | `/feed?limit=&communityId=`| —    | Hot feed (time-decayed); optional filter     |
| GET    | `/feed/top?limit=`         | —    | Top feed (raw score)                         |

### Notifications (`/notifications`)

| Method | Path                            | Auth | Description            |
|--------|---------------------------------|------|------------------------|
| GET    | `/notifications`                | ✅   | List own notifications |
| GET    | `/notifications/unread-count`   | ✅   | Unread count           |
| POST   | `/notifications/:id/read`       | ✅   | Mark one read          |
| POST   | `/notifications/read-all`       | ✅   | Mark all read          |

---

## End-to-end walkthrough

```bash
BASE=http://localhost:8080

# 1. Register (returns accessToken)
TOKEN=$(curl -s -X POST $BASE/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"username":"alice","email":"alice@example.com","password":"password123"}' \
  | python -c "import sys,json;print(json.load(sys.stdin)['accessToken'])")

AUTH="Authorization: Bearer $TOKEN"

# 2. Create a community
CID=$(curl -s -X POST $BASE/communities -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"name":"programming","description":"All things code"}' \
  | python -c "import sys,json;print(json.load(sys.stdin)['id'])")

# 3. Create a post in it
PID=$(curl -s -X POST $BASE/posts -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"communityId\":\"$CID\",\"title\":\"Hello world\",\"body\":\"My first post\"}" \
  | python -c "import sys,json;print(json.load(sys.stdin)['id'])")

# 4. Upvote it (authorId so karma + notification are attributed)
curl -s -X POST $BASE/votes -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"targetType\":\"post\",\"targetId\":\"$PID\",\"value\":1}"

# 5. See it in the feed
curl -s "$BASE/feed"

# 6. Check notifications (welcome message will be there)
curl -s $BASE/notifications -H "$AUTH"
```

---

## Authentication flow

1. User registers → password hashed with **bcrypt** → row stored in `auth_db`.
2. Auth service publishes `user.created`; the user service creates a profile, the notification service
   sends a welcome message.
3. Auth service issues a short-lived **access token** and a long-lived **refresh token**.
4. Client stores the tokens and sends `Authorization: Bearer <accessToken>` on each request.
5. The **gateway validates** the token, strips any client-supplied identity headers, and forwards a
   trusted `x-user-id` to the target service.
6. Services trust the gateway — protected routes require the `x-user-id` header.
7. When the access token expires, the client calls `/auth/refresh` for a new one.

---

## Project structure

```
redit clone nodejs backend/
├── api-gateway/            # routing, JWT, rate limiting
├── auth-service/           # register/login/refresh
├── user-service/           # profiles + karma
├── community-service/      # communities + memberships
├── post-service/           # posts
├── comment-service/        # nested comments
├── vote-service/           # votes + score deltas
├── feed-service/           # Redis ranking
├── notification-service/   # event-driven notifications
├── infra/
│   └── postgres/init/01-create-databases.sql   # creates one DB per service
├── docker-compose.yml
├── .env.example
└── README.md

# Each service:
<service>/
├── Dockerfile              # multi-stage: build (tsc) → slim runtime
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts            # express app, routes, event wiring
    └── lib/
        ├── logger.ts       # winston
        ├── db.ts           # pg pool + schema-on-boot  (not in feed)
        ├── broker.ts       # RabbitMQ publish/consume helpers
        └── middleware.ts   # attachUser / requireUser (reads gateway headers)
```

Database tables are created on service boot via `CREATE TABLE IF NOT EXISTS` (migration-on-start) — no
separate migration step is needed for local development.

---

## Local development

Run a single service outside Docker (with infra still in Docker):

```bash
# Start only the infrastructure
docker compose up postgres redis rabbitmq

# In a service folder
cd auth-service
npm install
# point env at localhost instead of container names, then:
POSTGRES_HOST=localhost RABBITMQ_URL=amqp://reddit:reddit_pass@localhost:5672 \
  REDIS_HOST=localhost npm run dev
```

Useful commands:

```bash
docker compose logs -f auth-service     # tail one service
docker compose ps                       # status of all containers
docker compose up -d --build post-service   # rebuild + restart one service
docker compose down -v                  # stop and delete data volume
```

---

## Security

Implemented:

- bcrypt password hashing, JWT access + refresh tokens with expiry.
- Gateway strips client-supplied `x-user-id` / `x-username` to prevent identity spoofing.
- Helmet security headers + configurable CORS at the gateway.
- Redis-backed rate limiting.
- Joi input validation on every write endpoint.
- Parameterized SQL everywhere (no string concatenation) → SQL-injection safe.
- Database-per-service isolation.

For production also add: HTTPS/TLS termination, secret management (not `.env`), refresh-token rotation
& revocation, and per-route rate limits.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `502 Upstream service unavailable` | Target service still starting — wait for its "listening on" log, or `docker compose logs <svc>`. |
| Service exits then restarts | It couldn't reach Postgres/RabbitMQ yet. Compose health checks gate startup, but cold first boot can still race — it will recover on restart. |
| Port already in use | Another process holds `8080/5432/6379/5672`. Stop it or change the port in `.env`. |
| Schema/data weirdness after changes | `docker compose down -v` to drop the Postgres volume, then `up --build`. |
| RabbitMQ "connection closed" loop | Check the management UI at `:15672`; ensure `RABBITMQ_URL` credentials match `.env`. |

---

## Production roadmap

Kubernetes / ECS deployment · managed Postgres + Redis cluster + RabbitMQ cluster · CI/CD · Swagger/OpenAPI
docs · Elasticsearch search · file-upload service · email verification · moderation tools · OpenTelemetry +
Prometheus/Grafana observability · WebSocket push for real-time notifications.
