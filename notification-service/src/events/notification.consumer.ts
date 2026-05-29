// notification-service/src/events/notification.consumer.ts
import { consumeEvents } from '../lib/broker';
import { notificationService } from '../services/notification.service';

export async function startConsumers(): Promise<void> {
  await consumeEvents(
    'notification-service.events',
    ['user.created', 'comment.created', 'vote.created'],
    async (key, payload) => {
      if (key === 'user.created') {
        await notificationService.create(payload.id, 'welcome', { message: `Welcome to Reddit Clone, ${payload.username}!` });
      } else if (key === 'comment.created' && payload.replyToUserId && payload.replyToUserId !== payload.authorId) {
        await notificationService.create(payload.replyToUserId, 'reply', {
          postId: payload.postId, commentId: payload.id, from: payload.authorUsername, snippet: payload.snippet,
        });
      } else if (key === 'vote.created' && payload.value === 1 && payload.authorId && payload.authorId !== payload.voterId) {
        await notificationService.create(payload.authorId, 'upvote', { targetType: payload.targetType, targetId: payload.targetId });
      }
    }
  );
}
