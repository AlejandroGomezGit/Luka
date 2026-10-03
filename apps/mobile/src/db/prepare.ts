import type { Clock, RandomBytes } from '@luka/domain';
import { seedPredefinedCategories } from './categories';
import { ensureDeviceProfile, type DeviceProfile } from './profile';
import { backfillTransactionSearch } from './transactions';
import type { LocalDb } from './types';

/**
 * Corre en cada arranque, después de las migraciones: identidad local, categorías predefinidas y el texto
 * de búsqueda de los movimientos que aún no lo tienen (HU-05).
 */
export function prepareLocalData(db: LocalDb, clock: Clock, random: RandomBytes): DeviceProfile {
  const profile = ensureDeviceProfile(db, clock, random);
  seedPredefinedCategories({ db, clock, random, userId: profile.userId });
  backfillTransactionSearch(db);
  return profile;
}
