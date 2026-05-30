// user-service/src/repositories/profile.repository.ts
import { eq, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { profiles } from '../db/schema';

const snakeCaseProjection = {
  id: profiles.id,
  username: profiles.username,
  bio: profiles.bio,
  karma: profiles.karma,
  created_at: profiles.createdAt,
};

export class ProfileRepository {
  public async findById(id: string) {
    const rows = await db
      .select(snakeCaseProjection)
      .from(profiles)
      .where(eq(profiles.id, id))
      .limit(1);
    return rows[0];
  }

  public async updateBio(id: string, bio: string) {
    const rows = await db
      .update(profiles)
      .set({ bio })
      .where(eq(profiles.id, id))
      .returning(snakeCaseProjection);
    return rows[0];
  }

  public async upsertFromUserCreated(id: string, username: string): Promise<void> {
    await db.insert(profiles).values({ id, username }).onConflictDoNothing({ target: profiles.id });
  }

  public async addKarma(id: string, delta: number): Promise<void> {
    await db.update(profiles).set({ karma: sql`${profiles.karma} + ${delta}` }).where(eq(profiles.id, id));
  }
}
export const profileRepository = new ProfileRepository();
