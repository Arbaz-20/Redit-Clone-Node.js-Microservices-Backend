// community-service/src/services/community.service.ts
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '../middleware/error';
import { communityRepository } from '../repositories/community.repository';
import { publishEvent } from '../lib/broker';

export const communityService = {
  async create(ownerId: string, input: { name: string; description: string }) {
    const taken = await communityRepository.findByName(input.name);
    if (taken.length) throw new AppError(409, 'Community name taken');
    const id = uuidv4();
    await communityRepository.insert({ id, name: input.name, description: input.description, ownerId });
    await communityRepository.addMember(id, ownerId);
    publishEvent('community.created', { id, name: input.name, ownerId });
    return { id, name: input.name, description: input.description, ownerId };
  },

  list() {
    return communityRepository.list();
  },

  async getById(id: string) {
    const c = await communityRepository.getById(id);
    if (!c) throw new AppError(404, 'Community not found');
    return c;
  },

  async join(id: string, userId: string) {
    if (!(await communityRepository.exists(id))) throw new AppError(404, 'Community not found');
    await communityRepository.addMember(id, userId, true);
    return { joined: true, communityId: id };
  },

  async leave(id: string, userId: string) {
    await communityRepository.removeMember(id, userId);
    return { left: true, communityId: id };
  },
};
