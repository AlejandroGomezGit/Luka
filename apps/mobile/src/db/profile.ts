import { newId, type Clock, type RandomBytes } from '@luka/domain';
import { deviceProfile } from '@luka/schema-sqlite';
import type { LocalDb } from './types';

export interface DeviceProfile {
  deviceId: string;
  userId: string;
}

/** Devuelve la identidad local; la crea en el primer arranque (documento 02, `device_profile`). */
export function ensureDeviceProfile(db: LocalDb, clock: Clock, random: RandomBytes): DeviceProfile {
  const existing = db.select().from(deviceProfile).get();
  if (existing) return { deviceId: existing.deviceId, userId: existing.userId };
  const profile = { deviceId: newId(clock, random), userId: newId(clock, random) };
  db.insert(deviceProfile)
    .values({ ...profile, createdAt: new Date(clock.now()) })
    .run();
  return profile;
}
