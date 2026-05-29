// api-gateway/src/config/env.ts
import 'dotenv/config';

export const env = {
  port: Number(process.env.GATEWAY_PORT || 8080),
  jwtSecret: process.env.JWT_SECRET || 'dev_secret',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  redis: {
    host: process.env.REDIS_HOST || 'redis',
    port: Number(process.env.REDIS_PORT || 6379),
  },
  rateLimit: {
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60000),
    max: Number(process.env.RATE_LIMIT_MAX || 120),
  },
  services: {
    auth: process.env.AUTH_SERVICE_URL,
    user: process.env.USER_SERVICE_URL,
    community: process.env.COMMUNITY_SERVICE_URL,
    post: process.env.POST_SERVICE_URL,
    comment: process.env.COMMENT_SERVICE_URL,
    vote: process.env.VOTE_SERVICE_URL,
    feed: process.env.FEED_SERVICE_URL,
    notification: process.env.NOTIFICATION_SERVICE_URL,
  },
};
