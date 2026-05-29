// comment-service/src/services/comment.service.ts
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '../middleware/error';
import { commentRepository } from '../repositories/comment.repository';
import { publishEvent } from '../lib/broker';

export const commentService = {
  async create(authorId: string, authorUsername: string, input: { postId: string; parentId: string | null; body: string; replyToUserId: string | null }) {
    if (input.parentId) {
      const parent = await commentRepository.parentOnPost(input.parentId, input.postId);
      if (!parent.length) throw new AppError(400, 'Parent comment not found on this post');
    }
    const id = uuidv4();
    await commentRepository.insert({ id, postId: input.postId, parentId: input.parentId, authorId, authorUsername, body: input.body });
    publishEvent('comment.created', {
      id, postId: input.postId, parentId: input.parentId, authorId, authorUsername,
      replyToUserId: input.replyToUserId, snippet: input.body.slice(0, 120), createdAt: new Date().toISOString(),
    });
    return { id, postId: input.postId, parentId: input.parentId, authorId, body: input.body, voteScore: 0 };
  },

  listByPost(postId: string) {
    return commentRepository.listByPost(postId);
  },

  async getById(id: string) {
    const c = await commentRepository.getById(id);
    if (!c) throw new AppError(404, 'Comment not found');
    return c;
  },

  async delete(id: string, userId: string) {
    const c = await commentRepository.getById(id);
    if (!c) throw new AppError(404, 'Comment not found');
    if (c.author_id !== userId) throw new AppError(403, 'Not your comment');
    await commentRepository.delete(id);
    return { deleted: true, id };
  },

  applyVote(targetType: string, targetId: string, delta: number): Promise<void> {
    if (targetType === 'comment' && delta) return commentRepository.addScore(targetId, delta);
    return Promise.resolve();
  },
};
