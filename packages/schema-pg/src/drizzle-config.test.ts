import { describe, expect, it } from '@jest/globals';
import { migrationCredentials } from '../drizzle.config.js';

describe('credenciales de drizzle-kit (misma regla que db:migrate, #88)', () => {
  it('el valor por defecto (Docker Compose local) solo vale con APP_ENV=local', () => {
    expect(migrationCredentials({ APP_ENV: 'local' })).toEqual({
      url: 'postgres://luka:luka@localhost:15432/luka',
    });
  });

  it('sin MIGRATION_DATABASE_URL ni APP_ENV=local no hay credenciales: drizzle-kit no se conecta', () => {
    for (const env of [{}, { APP_ENV: 'production' }, { APP_ENV: '' }, { APP_ENV: 'LOCAL' }]) {
      expect(migrationCredentials(env)).toBeUndefined();
    }
  });

  it('una MIGRATION_DATABASE_URL explícita se usa tal cual', () => {
    const url = 'postgres://luka:x@db.ejemplo.co:6543/luka';
    expect(migrationCredentials({ MIGRATION_DATABASE_URL: url })).toEqual({ url });
  });
});
