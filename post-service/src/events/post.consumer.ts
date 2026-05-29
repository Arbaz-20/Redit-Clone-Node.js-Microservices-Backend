// post-service/src/events/post.consumer.ts
import { consumeEvents } from '../lib/broker';
import { postService } from '../services/post.service';

export async function startConsumers(): Promise<void> {
  await consumeEvents('post-service.events', ['vote.created'], async (_key, payload) => {
    await postService.applyVote(payload.targetType, payload.targetId, payload.delta);
  });
}
