// post-service/src/services/post.service.ts
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '../middleware/error';
import { postRepository } from '../repositories/post.repository';
import { publishEvent } from '../lib/broker';

export const postService = {
  async create(authorId: string, authorUsername: string, input: { communityId: string; title: string; body: string }) {
    const id = uuidv4();
    const createdAt = new Date().toISOString();
    await postRepository.insert({ id, communityId: input.communityId, authorId, authorUsername, title: input.title, body: input.body });
    publishEvent('post.created', { id, communityId: input.communityId, authorId, authorUsername, title: input.title, createdAt });
    return { id, communityId: input.communityId, authorId, title: input.title, body: input.body, voteScore: 0, createdAt };
  },

  list(communityId?: string) {
    return postRepository.list(communityId);
  },

  async getById(id: string) {
    const post = await postRepository.getById(id);
    if (!post) throw new AppError(404, 'Post not found');
    return post;
  },

  async delete(id: string, userId: string) {
    const post = await postRepository.getById(id);
    if (!post) throw new AppError(404, 'Post not found');
    if (post.author_id !== userId) throw new AppError(403, 'Not your post');
    await postRepository.delete(id);
    publishEvent('post.deleted', { id });
    return { deleted: true, id };
  },

  applyVote(targetType: string, targetId: string, delta: number): Promise<void> {
    if (targetType === 'post' && delta) return postRepository.addScore(targetId, delta);
    return Promise.resolve();
  },
};
