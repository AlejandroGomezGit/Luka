// Solo para pruebas (fuera del build): PostgreSQL desechable con todas las migraciones y luka_app con
// una contraseña nueva en cada corrida. Vive en src/db porque es el único lugar que importa postgres.
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import postgres from 'postgres';

const MIGRATIONS = fileURLToPath(
  new URL('../../../../packages/schema-pg/drizzle', import.meta.url),
);

/** Aplica en orden las migraciones del journal entre `from` y `to`, como el migrador de Drizzle. */
export async function migrate(sql: postgres.Sql, from = 0, to = Infinity): Promise<void> {
  const journal = JSON.parse(readFileSync(join(MIGRATIONS, 'meta/_journal.json'), 'utf8')) as {
    entries: { tag: string }[];
  };
  for (const { tag } of journal.entries.slice(from, to)) {
    for (const statement of readFileSync(join(MIGRATIONS, `${tag}.sql`), 'utf8').split(
      '--> statement-breakpoint',
    )) {
      await sql.unsafe(statement);
    }
  }
}

export interface TestDatabase {
  container: StartedPostgreSqlContainer;
  /** El dueño de las tablas (superusuario aquí): solo para preparar y para comprobar. */
  owner: postgres.Sql;
  /** URL de luka_app, el rol de la API. */
  appUrl: string;
  stop(): Promise<void>;
}

export async function startDatabase(): Promise<TestDatabase> {
  const container = await new PostgreSqlContainer('postgres:18-alpine').start();
  const owner = postgres(container.getConnectionUri(), { max: 1, onnotice: () => undefined });
  await migrate(owner);
  const password = randomUUID();
  await owner.unsafe(`alter role luka_app password '${password}'`);
  const url = new URL(container.getConnectionUri());
  url.username = 'luka_app';
  url.password = password;
  return {
    container,
    owner,
    appUrl: url.toString(),
    async stop() {
      try {
        await owner.end();
      } finally {
        await container.stop();
      }
    },
  };
}
