// api-gateway/src/config/services.ts
import { env } from './env';

export interface ServiceRoute {
  prefix: string;
  target: string | undefined;
}

// Declarative proxy route table. Order is significant: proxies are mounted in
// this order and matched by pathFilter. The gateway does not gate any prefix
// itself — JWT is decoded globally (optional) and downstream services enforce
// auth via the forwarded x-user-id / x-username identity headers.
export const serviceRoutes: ServiceRoute[] = [
  { prefix: '/auth', target: env.services.auth },
  { prefix: '/users', target: env.services.user },
  { prefix: '/communities', target: env.services.community },
  { prefix: '/posts', target: env.services.post },
  { prefix: '/comments', target: env.services.comment },
  { prefix: '/votes', target: env.services.vote },
  { prefix: '/feed', target: env.services.feed },
  { prefix: '/notifications', target: env.services.notification },
];
