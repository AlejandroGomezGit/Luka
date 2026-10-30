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

/**
 * Id de dispositivo nuevo, cuando el servidor dice que el actual está ligado a otra cuenta
 * (`device_unavailable`, T-019c). Conserva el user_id. Hoy ninguna tabla guarda el id del dispositivo;
 * con el outbox de H3 habrá que revisar este cambio (#97).
 */
export function renewDeviceId(db: LocalDb, clock: Clock, random: RandomBytes): string {
  const deviceId = newId(clock, random);
  db.update(deviceProfile).set({ deviceId }).run();
  return deviceId;
}
