// vote-service/src/services/vote.service.ts
import { v4 as uuidv4 } from 'uuid';
import { voteRepository } from '../repositories/vote.repository';
import { publishEvent } from '../lib/broker';

export class VoteService {
  public async cast(voterId: string, input: { targetType: string; targetId: string; value: number; authorId: string | null }) {
    const oldValue = await voteRepository.currentValue(voterId, input.targetType, input.targetId);
    const delta = input.value - oldValue;

    if (input.value === 0) {
      await voteRepository.clear(voterId, input.targetType, input.targetId);
    } else {
      await voteRepository.upsert(uuidv4(), voterId, input.targetType, input.targetId, input.value);
    }

    if (delta !== 0) {
      publishEvent('vote.created', {
        voterId, targetType: input.targetType, targetId: input.targetId, value: input.value,
        delta, authorId: input.authorId, createdAt: new Date().toISOString(),
      });
    }
    return { value: input.value, delta };
  }
  public score(targetType: string, targetId: string) {
    return voteRepository.score(targetType, targetId);
  }
  public myValue(userId: string, targetType: string, targetId: string) {
    return voteRepository.currentValue(userId, targetType, targetId);
  }
}
export const voteService = new VoteService();
