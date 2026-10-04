// Pruebas de db:migrate (scripts/migrate.mjs): node --test scripts/*.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { describeUrl, explain, localAppPassword, migrationUrl } from './migrate.mjs';

test('las migraciones las aplica el dueño luka; con luka_app (el rol de la API) se niega', () => {
  assert.equal(migrationUrl({}).username, 'luka');
  assert.equal(migrationUrl({}).port, '55432');
  assert.throws(
    () => migrationUrl({ MIGRATION_DATABASE_URL: 'postgres://luka_app:x@localhost:55432/luka' }),
    /luka_app.*dueño/,
  );
});

test('el resumen de la conexión nunca muestra la contraseña', () => {
  const url = migrationUrl({
    MIGRATION_DATABASE_URL: 'postgres://luka:s3creta@db.local:6543/luka',
  });
  assert.equal(describeUrl(url), 'luka@db.local:6543/luka');
  assert.doesNotMatch(describeUrl(url), /s3creta/);
});

test('el error real de PostgreSQL se muestra sin la contraseña y con la pista del puerto', () => {
  const url = migrationUrl({
    MIGRATION_DATABASE_URL: 'postgres://luka:s3creta@localhost:5432/luka',
  });
  const text = explain(
    { code: '28000', message: 'role "luka" does not exist (s3creta)', detail: 'd', hint: 'h' },
    url,
  );
  assert.match(text, /28000: role "luka" does not exist/);
  assert.match(text, /lsof -nP -iTCP:5432 -sTCP:LISTEN/);
  assert.doesNotMatch(text, /s3creta/);
});

test('la contraseña local de luka_app se fija solo con APP_ENV local y una URL de luka_app', () => {
  assert.equal(localAppPassword({}), 'luka-app-local');
  assert.equal(
    localAppPassword({ DATABASE_URL: 'postgres://luka_app:otra@localhost:55432/luka' }),
    'otra',
  );
  assert.equal(localAppPassword({ APP_ENV: 'production' }), null);
  assert.equal(localAppPassword({ DATABASE_URL: 'postgres://luka:luka@localhost/luka' }), null);
});

test('drizzle envuelve el error: se muestra el de PostgreSQL que viene en cause, o el de red', () => {
  const url = migrationUrl({
    MIGRATION_DATABASE_URL: 'postgres://nadie:s3creta@localhost:55432/luka',
  });
  const wrapped = {
    message: 'Failed query: CREATE SCHEMA IF NOT EXISTS "drizzle"',
    cause: { code: '28P01', message: 'password authentication failed for user "nadie"' },
  };
  assert.match(explain(wrapped, url), /28P01: password authentication failed for user "nadie"/);
  assert.match(explain(wrapped, url), /lsof -nP -iTCP:55432/);
  const refused = {
    message: 'Failed query: …',
    cause: { code: 'ECONNREFUSED', message: 'connect ECONNREFUSED 127.0.0.1:55432' },
  };
  assert.match(explain(refused, url), /ECONNREFUSED.*¿Está levantado Docker Compose/s);
});
