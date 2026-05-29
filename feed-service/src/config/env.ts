// feed-service/src/config/env.ts
import 'dotenv/config';

export const env = {
  port: Number(process.env.PORT || 4007),
  redis: {
    host: process.env.REDIS_HOST || 'redis',
    port: Number(process.env.REDIS_PORT || 6379),
  },
};
