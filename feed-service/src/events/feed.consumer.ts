// feed-service/src/events/feed.consumer.ts
import { consumeEvents } from '../lib/broker';
import { feedService } from '../services/feed.service';

export async function startConsumers(): Promise<void> {
  await consumeEvents('feed-service.events', ['post.created', 'post.deleted', 'vote.created'], async (key, payload) => {
    if (key === 'post.created') await feedService.indexPost(payload);
    else if (key === 'post.deleted') await feedService.removePost(payload.id);
    else if (key === 'vote.created' && payload.targetType === 'post' && payload.delta) await feedService.applyVote(payload.targetId, payload.delta);
  });
}
