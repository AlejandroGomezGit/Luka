import { deviceProfile } from '@luka/schema-sqlite';
import { sql } from 'drizzle-orm';
import type { StoredSession, TokenStore } from '../src/auth/tokenStore';
import { prepareLocalData } from '../src/db/prepare';
import { renewDeviceId } from '../src/db/profile';
import { createTestDb, testClock, testRandom } from '../src/db/testing';
import type { LocalDb } from '../src/db/types';

const session: StoredSession = {
  accessToken: ['acceso', 'viejo'].join('-'),
  refreshToken: ['refresco', 'viejo'].join('-'),
  accessExpiresAt: Date.UTC(2026, 9, 21, 18),
};

/** Keychain en memoria que anota, en cada borrado, si la identidad local ya existía en ese momento. */
function fakeTokens(db: LocalDb, failClear = false) {
  let stored: StoredSession | null = session;
  const clears: { profileExisted: boolean }[] = [];
  const store: TokenStore = {
    read: () => Promise.resolve(stored),
    write: (value) => {
      stored = value;
      return Promise.resolve();
    },
    clear: () => {
      clears.push({ profileExisted: db.select().from(deviceProfile).get() !== undefined });
      if (failClear) return Promise.reject(new Error('Keychain no disponible'));
      stored = null;
      return Promise.resolve();
    },
  };
  return { store, clears, stored: () => stored };
}

const profileRow = (db: LocalDb) => db.select().from(deviceProfile).get();

describe('T-019c1a limpieza del Keychain en el primer arranque', () => {
  it('sin identidad local, los tokens viejos se borran antes de crear device_profile', async () => {
    const db = await createTestDb();
    const tokens = fakeTokens(db);
    await prepareLocalData(db, testClock(), testRandom(), tokens.store);
    expect(tokens.clears).toEqual([{ profileExisted: false }]);
    expect(tokens.stored()).toBeNull();
    expect(profileRow(db)).toBeDefined();
  });

  it('si la app se cierra entre la limpieza y la identidad, el siguiente arranque vuelve a limpiar', async () => {
    const db = await createTestDb();
    const tokens = fakeTokens(db);
    // Falla al crear la identidad, después de limpiar: como si la app se cerrara en medio.
    const broken = () => {
      throw new Error('la app se cerró');
    };
    await expect(prepareLocalData(db, testClock(), broken, tokens.store)).rejects.toThrow();
    expect(profileRow(db)).toBeUndefined();
    await prepareLocalData(db, testClock(), testRandom(), tokens.store);
    expect(tokens.clears).toEqual([{ profileExisted: false }, { profileExisted: false }]);
    expect(profileRow(db)).toBeDefined();
  });

  it('con la identidad ya creada, el Keychain no se toca', async () => {
    const db = await createTestDb();
    const tokens = fakeTokens(db);
    await prepareLocalData(db, testClock(), testRandom(), tokens.store);
    await tokens.store.write(session);
    await prepareLocalData(db, testClock(), testRandom(), tokens.store);
    expect(tokens.clears).toHaveLength(1);
    expect(tokens.stored()).toEqual(session);
  });

  it('si falla el borrado del Keychain, no se crea la identidad (falla cerrado)', async () => {
    const db = await createTestDb();
    const tokens = fakeTokens(db, true);
    await expect(prepareLocalData(db, testClock(), testRandom(), tokens.store)).rejects.toThrow(
      'Keychain no disponible',
    );
    expect(profileRow(db)).toBeUndefined();
  });

  it('ningún token queda en SQLite: ninguna tabla contiene sus valores', async () => {
    const db = await createTestDb();
    const tokens = fakeTokens(db);
    await prepareLocalData(db, testClock(), testRandom(), tokens.store);
    await tokens.store.write(session);
    await prepareLocalData(db, testClock(), testRandom(), tokens.store);
    const tables = db
      .all<{ name: string }>(sql`select name from sqlite_master where type = 'table'`)
      .map(({ name }) => name);
    expect(tables).toContain('device_profile');
    const dump = JSON.stringify(
      tables.map((name) => db.all(sql.raw(`select * from "${name.replaceAll('"', '""')}"`))),
    );
    expect(dump).not.toContain(session.accessToken);
    expect(dump).not.toContain(session.refreshToken);
  });
});

describe('HU-01 renewDeviceId', () => {
  it('HU-01 cambia el id de dispositivo en device_profile y conserva el user_id', async () => {
    const db = await createTestDb();
    const clock = testClock();
    const random = testRandom();
    const tokens = fakeTokens(db);
    const before = await prepareLocalData(db, clock, random, tokens.store);
    const renewed = renewDeviceId(db, clock, random);
    expect(renewed).not.toBe(before.deviceId);
    expect(db.select().from(deviceProfile).all()).toEqual([
      expect.objectContaining({ deviceId: renewed, userId: before.userId }),
    ]);
  });
});
