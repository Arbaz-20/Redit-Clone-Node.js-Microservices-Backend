// community-service/src/repositories/community.repository.ts
import { and, eq, sql, desc } from 'drizzle-orm';
import { db } from '../db/client';
import { communities, memberships } from '../db/schema';

const memberCount = sql<number>`(SELECT count(*)::int FROM ${memberships} m WHERE m.community_id = ${communities.id})`;

export class CommunityRepository {
  public async findByName(name: string) {
    return db.select({ id: communities.id }).from(communities).where(eq(communities.name, name)).limit(1);
  }

  public async insert(row: { id: string; name: string; description: string; ownerId: string }) {
    await db.insert(communities).values(row);
  }

  public async addMember(communityId: string, userId: string, ignoreConflict = false) {
    const q = db.insert(memberships).values({ communityId, userId });
    await (ignoreConflict ? q.onConflictDoNothing() : q);
  }

  public async removeMember(communityId: string, userId: string) {
    await db.delete(memberships).where(and(eq(memberships.communityId, communityId), eq(memberships.userId, userId)));
  }

  public async exists(id: string) {
    const rows = await db.select({ id: communities.id }).from(communities).where(eq(communities.id, id)).limit(1);
    return rows.length > 0;
  }

  public async list() {
    return db
      .select({
        id: communities.id, name: communities.name, description: communities.description,
        owner_id: communities.ownerId, created_at: communities.createdAt, member_count: memberCount,
      })
      .from(communities)
      .orderBy(desc(communities.createdAt));
  }

  public async getById(id: string) {
    const rows = await db
      .select({
        id: communities.id, name: communities.name, description: communities.description,
        owner_id: communities.ownerId, created_at: communities.createdAt, member_count: memberCount,
      })
      .from(communities)
      .where(eq(communities.id, id))
      .limit(1);
    return rows[0];
  }
}
export const communityRepository = new CommunityRepository();
