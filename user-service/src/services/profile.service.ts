// user-service/src/services/profile.service.ts
import { AppError } from '../middleware/error';
import { profileRepository } from '../repositories/profile.repository';

export class ProfileService {
  public async getById(id: string) {
    const profile = await profileRepository.findById(id);
    if (!profile) throw new AppError(404, 'Profile not found');
    return profile;
  }

  public async updateBio(id: string, bio: string) {
    const profile = await profileRepository.updateBio(id, bio);
    if (!profile) throw new AppError(404, 'Profile not found');
    return profile;
  }
}
export const profileService = new ProfileService();
