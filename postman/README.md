# Postman — Reddit Clone

Postman collection for the Reddit-clone microservices backend. Every request goes
through the **API Gateway** (`http://localhost:8080`), which verifies the JWT and
forwards an `x-user-id` identity to the downstream service.

## Files

| File | Import as |
| --- | --- |
| `reddit-clone.postman_collection.json` | Collection |
| `reddit-clone.postman_environment.json` | Environment (**Reddit Clone — Local**) |

## Setup

1. In Postman: **Import** → drop both files in.
2. Top-right environment selector → choose **Reddit Clone — Local**.
3. Send **Auth → Register** (or **Login**). Their test scripts auto-save
   `accessToken`, `refreshToken`, and `userId` into the environment.
4. All other requests inherit `Bearer {{accessToken}}` at the collection level —
   nothing else to configure.

The gateway listens on `GATEWAY_PORT` (default `8080`). If you changed it in
`.env`, update the `baseUrl` environment variable to match.

## Auto-saved variables

These get populated by request test scripts so later requests chain automatically:

| Variable | Set by |
| --- | --- |
| `accessToken` / `refreshToken` | Register, Login, Refresh |
| `userId` | Register, Login |
| `communityId` | Create community |
| `postId` | Create post |
| `commentId` | Create comment |

## Endpoint summary

Requests marked **(auth)** require a valid token; the rest are public.

| Folder | Method & path | Auth |
| --- | --- | --- |
| Health | `GET /health` | — |
| Auth | `POST /auth/register` | — |
| Auth | `POST /auth/login` | — |
| Auth | `POST /auth/refresh` | — |
| Users | `GET /users/me` | auth |
| Users | `PATCH /users/me` | auth |
| Users | `GET /users/:id` | — |
| Communities | `POST /communities` | auth |
| Communities | `GET /communities` | — |
| Communities | `GET /communities/:id` | — |
| Communities | `POST /communities/:id/join` | auth |
| Communities | `DELETE /communities/:id/leave` | auth |
| Posts | `POST /posts` | auth |
| Posts | `GET /posts?communityId=` | — |
| Posts | `GET /posts/:id` | — |
| Posts | `DELETE /posts/:id` | auth |
| Comments | `POST /comments` | auth |
| Comments | `GET /comments?postId=` | — |
| Comments | `GET /comments/:id` | — |
| Comments | `DELETE /comments/:id` | auth |
| Votes | `POST /votes` | auth |
| Votes | `GET /votes/score?targetType=&targetId=` | — |
| Votes | `GET /votes/me?targetType=&targetId=` | auth |
| Feed | `GET /feed?limit=&communityId=` | — |
| Feed | `GET /feed/top?limit=` | — |
| Notifications | `GET /notifications` | auth |
| Notifications | `GET /notifications/unread-count` | auth |
| Notifications | `POST /notifications/read-all` | auth |
| Notifications | `POST /notifications/:id/read` | auth |

## Suggested flow

Register → Create community → Create post → Comment → Cast vote → Hot feed.
Each step populates the id variable the next step needs.
