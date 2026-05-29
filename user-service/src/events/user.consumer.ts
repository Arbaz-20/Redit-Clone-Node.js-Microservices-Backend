// user-service/src/events/user.consumer.ts
import { consumeEvents } from '../lib/broker';
import { profileRepository } from '../repositories/profile.repository';
import { logger } from '../lib/logger';

export async function startConsumers(): Promise<void> {
  await consumeEvents('user-service.events', ['user.created', 'vote.created'], async (key, payload) => {
    if (key === 'user.created') {
      await profileRepository.upsertFromUserCreated(payload.id, payload.username);
      logger.info(`Profile created for ${payload.username}`);
    } else if (key === 'vote.created' && payload.authorId && payload.delta) {
      await profileRepository.addKarma(payload.authorId, payload.delta);
    }
  });
}
