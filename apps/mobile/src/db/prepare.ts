import type { Clock, RandomBytes } from '@luka/domain';
import { deviceProfile } from '@luka/schema-sqlite';
import type { TokenStore } from '../auth/tokenStore';
import { seedPredefinedCategories } from './categories';
import { ensureDeviceProfile, type DeviceProfile } from './profile';
import type { LocalDb } from './types';

/**
 * Corre en cada arranque, después de las migraciones: identidad local y categorías predefinidas. El texto
 * de búsqueda que falte y los archivos de fotos que sobran se atienden después del primer render
 * (DatabaseProvider).
 *
 * Primer arranque (sin identidad local): el Keychain sobrevive a borrar la app, así que los tokens de una
 * instalación anterior se borran antes de crear la identidad. Si la app se cierra entre las dos cosas, el
 * siguiente arranque vuelve a limpiar; si el borrado falla, no se crea la identidad (falla cerrado).
 */
export async function prepareLocalData(
  db: LocalDb,
  clock: Clock,
  random: RandomBytes,
  tokens: Pick<TokenStore, 'clear'>,
): Promise<DeviceProfile> {
  if (!db.select().from(deviceProfile).get()) await tokens.clear();
  const profile = ensureDeviceProfile(db, clock, random);
  seedPredefinedCategories({ db, clock, random, userId: profile.userId });
  return profile;
}
