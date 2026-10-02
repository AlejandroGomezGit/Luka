import type { Clock, RandomBytes } from '@luka/domain';
import { seedPredefinedCategories } from './categories';
import { ensureDeviceProfile, type DeviceProfile } from './profile';
import type { LocalDb } from './types';

/** Corre en cada arranque, después de las migraciones: identidad local y categorías predefinidas. */
export function prepareLocalData(db: LocalDb, clock: Clock, random: RandomBytes): DeviceProfile {
  const profile = ensureDeviceProfile(db, clock, random);
  seedPredefinedCategories({ db, clock, random, userId: profile.userId });
  return profile;
}
