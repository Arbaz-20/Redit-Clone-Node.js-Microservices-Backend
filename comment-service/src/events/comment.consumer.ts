// comment-service/src/events/comment.consumer.ts
import { consumeEvents } from '../lib/broker';
import { commentService } from '../services/comment.service';

export async function startConsumers(): Promise<void> {
  await consumeEvents('comment-service.events', ['vote.created'], async (_key, payload) => {
    await commentService.applyVote(payload.targetType, payload.targetId, payload.delta);
  });
}
