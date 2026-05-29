// user-service/src/services/profile.service.ts
import { AppError } from '../middleware/error';
import { profileRepository } from '../repositories/profile.repository';

export const profileService = {
  async getById(id: string) {
    const profile = await profileRepository.findById(id);
    if (!profile) throw new AppError(404, 'Profile not found');
    return profile;
  },

  async updateBio(id: string, bio: string) {
    const profile = await profileRepository.updateBio(id, bio);
    if (!profile) throw new AppError(404, 'Profile not found');
    return profile;
  },
};
