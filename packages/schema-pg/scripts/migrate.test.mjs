// Pruebas de db:migrate (scripts/migrate.mjs): node --test scripts/*.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  alterAppPassword,
  urlSource,
  describeUrl,
  explain,
  localAppPassword,
  migrationUrl,
} from './migrate.mjs';

test('las migraciones las aplica el dueño luka; con luka_app (el rol de la API) se niega', () => {
  assert.equal(migrationUrl({}).username, 'luka');
  assert.equal(migrationUrl({}).port, '15432');
  assert.throws(
    () => migrationUrl({ MIGRATION_DATABASE_URL: 'postgres://luka_app:x@localhost:15432/luka' }),
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

test('la contraseña de luka_app se fija solo con APP_ENV=local explícito y un servidor localhost o 127.0.0.1', () => {
  const local = migrationUrl({});
  const app = 'postgres://luka_app:otra@localhost:15432/luka';
  assert.equal(localAppPassword({ APP_ENV: 'local' }, local), 'luka-app-local');
  assert.equal(localAppPassword({ APP_ENV: 'local', DATABASE_URL: app }, local), 'otra');
  // Sin APP_ENV no hace nada, aunque .env.example diga local.
  assert.equal(localAppPassword({}, local), null);
  assert.equal(localAppPassword({ APP_ENV: 'production' }, local), null);
  assert.equal(
    localAppPassword(
      { APP_ENV: 'local' },
      migrationUrl({ MIGRATION_DATABASE_URL: 'postgres://luka:luka@127.0.0.1:15432/luka' }),
    ),
    'luka-app-local',
  );
  assert.equal(
    localAppPassword(
      { APP_ENV: 'local' },
      migrationUrl({ MIGRATION_DATABASE_URL: 'postgres://luka:luka@db.ejemplo.co:5432/luka' }),
    ),
    null,
  );
  assert.equal(
    localAppPassword(
      { APP_ENV: 'local', DATABASE_URL: 'postgres://luka:luka@localhost/luka' },
      local,
    ),
    null,
  );
});

test('una contraseña con comilla simple se escapa en el ALTER ROLE', () => {
  assert.equal(alterAppPassword("o'brien"), "alter role luka_app password 'o''brien'");
  assert.equal(alterAppPassword("a''b'"), "alter role luka_app password 'a''''b'''");
});

test('drizzle envuelve el error: se muestra el de PostgreSQL que viene en cause, o el de red', () => {
  const url = migrationUrl({
    MIGRATION_DATABASE_URL: 'postgres://nadie:s3creta@localhost:15432/luka',
  });
  const wrapped = {
    message: 'Failed query: CREATE SCHEMA IF NOT EXISTS "drizzle"',
    cause: { code: '28P01', message: 'password authentication failed for user "nadie"' },
  };
  assert.match(explain(wrapped, url), /28P01: password authentication failed for user "nadie"/);
  assert.match(explain(wrapped, url), /lsof -nP -iTCP:15432/);
  const refused = {
    message: 'Failed query: …',
    cause: { code: 'ECONNREFUSED', message: 'connect ECONNREFUSED 127.0.0.1:15432' },
  };
  assert.match(explain(refused, url), /ECONNREFUSED.*¿Está levantado Docker Compose/s);
});

test('dice de dónde salió la URL de migraciones: la terminal, .env o el valor por defecto', () => {
  const shell = new Set(['MIGRATION_DATABASE_URL']);
  assert.equal(
    urlSource({ MIGRATION_DATABASE_URL: 'x' }, shell),
    'MIGRATION_DATABASE_URL de la terminal',
  );
  assert.equal(
    urlSource({ MIGRATION_DATABASE_URL: 'x' }, new Set()),
    'MIGRATION_DATABASE_URL de .env',
  );
  assert.equal(urlSource({}, new Set()), 'valor por defecto, sin MIGRATION_DATABASE_URL');
});

test('si nada escucha, sugiere revisar el puerto publicado con docker compose ps', () => {
  const url = migrationUrl({ MIGRATION_DATABASE_URL: 'postgres://luka:x@localhost:5432/luka' });
  const text = explain({ cause: { code: 'ECONNREFUSED', message: '' } }, url);
  assert.match(text, /Nada escucha en localhost:5432/);
  assert.match(text, /docker compose -f infra\/docker-compose.yml ps/);
});
