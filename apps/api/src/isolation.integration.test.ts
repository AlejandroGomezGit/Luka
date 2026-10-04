import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import postgres from 'postgres';
import { loadEnv } from './config.js';
import { Database, setUserContext } from './db/database.js';

// AM-03, INV-08: PostgreSQL real con todas las migraciones; las pruebas hablan como luka_app, el rol
// de la API. El dueño de las tablas (superusuario aquí) solo migra: él se salta la RLS.
const MIGRATIONS = fileURLToPath(new URL('../../../packages/schema-pg/drizzle', import.meta.url));
const TABLES = [
  'users',
  'devices',
  'consents',
  'accounts',
  'categories',
  'transactions',
  'attachments',
];
const A = randomUUID();
const B = randomUUID();
type Rows = Record<string, string>;
const rows: Record<string, Rows> = {};

/** Aplica en orden las migraciones del journal entre `from` y `to`, como el migrador de Drizzle. */
async function migrate(sql: postgres.Sql, from = 0, to = Infinity) {
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

let container: StartedPostgreSqlContainer;
let owner: postgres.Sql;
let app: postgres.Sql;
let appUrl: string;

/** Única forma de conectarse en estas pruebas: falla si el rol se salta la RLS. */
async function appConnection(url: string): Promise<postgres.Sql> {
  const sql = postgres(url, { max: 1 });
  const [role] =
    await sql`select rolname, rolsuper, rolbypassrls from pg_roles where rolname = current_user`;
  if (role?.['rolname'] !== 'luka_app' || role['rolsuper'] || role['rolbypassrls']) {
    await sql.end();
    throw new Error(
      'Las pruebas de aislamiento deben conectarse como luka_app, sin superusuario ni BYPASSRLS',
    );
  }
  return sql;
}

/** Corre `work` como `user` (null: sin contexto), igual que withUser. */
const as = <T>(user: string | null, work: (tx: postgres.TransactionSql) => Promise<T>) =>
  app.begin(async (tx) => {
    if (user) await setUserContext(tx, user);
    return work(tx);
  }) as Promise<T>;

/** Una fila de `table` a nombre de `user`, con referencias a las filas `refs`. */
function insert(
  tx: postgres.TransactionSql,
  table: string,
  user: string,
  refs: Rows,
  id: string = randomUUID(),
) {
  const sync = { id, user_id: user, created_at: new Date(), updated_at: new Date() };
  const values: Record<string, Record<string, unknown>> = {
    users: { id: user, email: `${id}@ejemplo.co`, display_name: 'Ana' },
    devices: { id, user_id: user, platform: 'ios', app_version: '1.0' },
    consents: { id, user_id: user, purpose: 'terms', version: 'v1', granted_at: new Date() },
    accounts: {
      ...sync,
      name: 'Efectivo',
      type: 'cash',
      currency: 'COP',
      color: 'green',
      icon: '💵',
    },
    categories: { ...sync, name: 'Comida', kind: 'expense', color: 'orange', icon: '🍽️' },
    transactions: {
      ...sync,
      account_id: refs['accounts'],
      kind: 'expense',
      amount_minor: -1000,
      currency: 'COP',
      occurred_on: '2026-10-01',
      category_id: refs['categories'],
    },
    attachments: {
      ...sync,
      transaction_id: refs['transactions'],
      kind: 'receipt',
      mime_type: 'image/jpeg',
      size_bytes: 1,
      sha256: 'x',
    },
  };
  return tx`insert into ${tx(table)} ${tx(values[table] ?? {})}`;
}

async function seed(user: string) {
  const r: Rows = {};
  await as(user, async (tx) => {
    for (const table of TABLES) {
      r[table] = table === 'users' ? user : randomUUID();
      await insert(tx, table, user, r, r[table]);
    }
  });
  rows[user] = r;
}

/** Problemas del catálogo: tablas sin RLS forzada, políticas abiertas y privilegios de más. */
async function catalogProblems(sql: postgres.Sql | postgres.TransactionSql): Promise<string[]> {
  const found = await sql<{ problem: string }[]>`
    select c.relname || ': sin RLS activa y forzada' as problem from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' and not (c.relrowsecurity and c.relforcerowsecurity)
    union all
    select c.relname || ': tabla sin user_id que no es users' from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' and c.relname <> 'users'
       and not exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'user_id' and not a.attisdropped)
    union all
    select tablename || '.' || policyname || ': política sin app.current_user_id()' from pg_policies
     where schemaname = 'public'
       and (coalesce(qual, '') not like '%app.current_user_id()%' or coalesce(with_check, '') not like '%app.current_user_id()%')
    union all
    select c.relname || ': luka_app es dueño o tiene TRUNCATE, REFERENCES o TRIGGER' from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r'
       and (pg_get_userbyid(c.relowner) = 'luka_app' or pg_has_role('luka_app', c.relowner, 'MEMBER')
         or has_table_privilege('luka_app', c.oid, 'TRUNCATE, REFERENCES, TRIGGER'))`;
  return found.map((row) => row.problem);
}

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:18-alpine').start();
  owner = postgres(container.getConnectionUri(), { max: 1, onnotice: () => undefined });
  await migrate(owner);
  const password = randomUUID();
  await owner.unsafe(`alter role luka_app password '${password}'`);
  const url = new URL(container.getConnectionUri());
  url.username = 'luka_app';
  url.password = password;
  appUrl = url.toString();
  app = await appConnection(appUrl);
  await seed(A);
  await seed(B);
});

afterAll(async () => {
  // Si beforeAll falló, app no existe: igual se cierran el dueño y el contenedor.
  try {
    await app.end();
  } finally {
    await owner.end();
    await container.stop();
  }
});

describe('AM-03 catálogo', () => {
  it('AM-03 toda tabla tiene RLS forzada, políticas con app.current_user_id() y luka_app sin privilegios de más', async () => {
    expect(await catalogProblems(owner)).toEqual([]);
  });

  it('AM-03 la prueba del catálogo detecta una tabla sin RLS y una política USING (true)', async () => {
    const problems = await owner
      .begin(async (tx) => {
        await tx`create table zz_sin_rls (user_id uuid)`;
        await tx`create table zz_abierta (user_id uuid)`;
        await tx`alter table zz_abierta enable row level security`;
        await tx`alter table zz_abierta force row level security`;
        await tx`create policy abierta on zz_abierta using (true) with check (true)`;
        const found = await catalogProblems(tx);
        throw Object.assign(new Error('deshacer'), { found });
      })
      .catch((error: unknown) => (error as { found?: string[] }).found ?? []);
    expect(problems).toEqual(
      expect.arrayContaining([
        'zz_sin_rls: sin RLS activa y forzada',
        'zz_abierta.abierta: política sin app.current_user_id()',
      ]),
    );
  });

  it('AM-03 la conexión de las pruebas rechaza al dueño de las tablas', async () => {
    await expect(appConnection(container.getConnectionUri())).rejects.toThrow(
      'deben conectarse como luka_app',
    );
  });

  it('AM-03 app.current_user_id() es STABLE, trata la cadena vacía como NULL y la consulta usa el índice por user_id', async () => {
    const [fn] = await owner`select provolatile from pg_proc where proname = 'current_user_id'`;
    expect(fn?.['provolatile']).toBe('s');
    expect(
      await as(null, async (tx) => {
        await tx`select set_config('app.user_id', '', true)`;
        return (
          await tx`select app.current_user_id() as id, (select count(*)::int from transactions) as n`
        )[0];
      }),
    ).toEqual({ id: null, n: 0 });
    await as(
      B,
      (
        tx,
      ) => tx`insert into transactions (id, user_id, created_at, updated_at, account_id, kind, amount_minor, currency, occurred_on)
      select gen_random_uuid(), ${B}, now(), now(), ${rows[B]?.['accounts'] ?? ''}, 'expense', -1, 'COP', '2026-01-01' from generate_series(1, 3000)`,
    );
    await owner`analyze transactions`;
    const plan = await as(A, (tx) => tx`explain select id from transactions`);
    const text = plan.map((line) => String(line['QUERY PLAN'])).join('\n');
    expect(text).toMatch(/Index (Only )?Scan|Bitmap Index Scan/);
    expect(text).not.toMatch(/Seq Scan/);
  });
});

describe.each(TABLES)('AM-03 aislamiento en %s', (table) => {
  const key = table === 'users' ? 'id' : 'user_id';
  const rowOf = (user: string) => rows[user]?.[table] ?? '';

  it('AM-03 con el contexto de A solo se ven filas de A', async () => {
    const seen = await as(
      A,
      (tx) => tx<{ owner: string }[]>`select ${tx(key)} as owner from ${tx(table)}`,
    );
    expect(seen.length).toBeGreaterThan(0);
    expect(new Set(seen.map((row) => row.owner))).toEqual(new Set([A]));
  });

  it('AM-03 actualizar o borrar una fila de B afecta 0 filas', async () => {
    expect(
      (await as(A, (tx) => tx`update ${tx(table)} set id = id where id = ${rowOf(B)}`)).count,
    ).toBe(0);
    expect((await as(A, (tx) => tx`delete from ${tx(table)} where id = ${rowOf(B)}`)).count).toBe(
      0,
    );
  });

  it('AM-03 insertar a nombre de B o pasar una fila propia a B falla con 42501', async () => {
    await expect(as(A, (tx) => insert(tx, table, B, rows[A] ?? {}))).rejects.toMatchObject({
      code: '42501',
    });
    await expect(
      as(A, (tx) => tx`update ${tx(table)} set ${tx(key)} = ${B} where id = ${rowOf(A)}`),
    ).rejects.toMatchObject({ code: '42501' });
  });

  it('AM-03 sin contexto no se ve ninguna fila ni se puede insertar', async () => {
    expect(await as(null, (tx) => tx`select 1 from ${tx(table)}`)).toHaveLength(0);
    await expect(as(null, (tx) => insert(tx, table, A, rows[A] ?? {}))).rejects.toMatchObject({
      code: '42501',
    });
  });
});

describe('AM-03 referencias a filas de otro usuario', () => {
  // Las claves foráneas se comprueban por encima de la RLS: sin claves compuestas (user_id, id), A
  // podría apuntar a una fila de B. Para to_account_id el movimiento pasa a transferencia (INV-02).
  it.each([
    ['transactions', 'account_id', 'accounts', {}],
    [
      'transactions',
      'to_account_id',
      'accounts',
      { kind: 'transfer', category_id: null, to_amount_minor: 1000 },
    ],
    ['transactions', 'category_id', 'categories', {}],
    ['categories', 'parent_id', 'categories', {}],
    ['attachments', 'transaction_id', 'transactions', {}],
  ])(
    'AM-03 con el contexto de A, %s.%s no puede apuntar a una fila de B',
    async (table, column, target, extra) => {
      const change = { ...extra, [column]: rows[B]?.[target] ?? '' };
      const own = rows[A]?.[table] ?? '';
      await expect(
        as(A, (tx) => tx`update ${tx(table)} set ${tx(change)} where id = ${own}`),
      ).rejects.toMatchObject({ code: '23503' });
    },
  );
});

describe('AM-03 contexto por transacción', () => {
  it('AM-03 otra petición en la misma conexión del pool no ve el contexto anterior, ni tras un error', async () => {
    const pid = async (tx: postgres.TransactionSql | postgres.Sql) =>
      (await tx<{ pid: number }[]>`select pg_backend_pid() as pid`)[0]?.pid;
    const first = await as(A, (tx) => pid(tx));
    await as(A, async () => Promise.reject(new Error('falla a mitad'))).catch(() => undefined);
    const [after] = await app<
      { pid: number; ctx: string | null }[]
    >`select pg_backend_pid() as pid, current_setting('app.user_id', true) as ctx`;
    expect(after?.pid).toBe(first);
    expect(after?.ctx ?? '').toBe('');
  });

  it('AM-03 withUser de la API solo ve las filas de su usuario, petición tras petición', async () => {
    const db = new Database(
      loadEnv({
        DATABASE_URL: appUrl,
        REDIS_URL: 'redis://localhost',
        DATABASE_POOL_SIZE: '1',
        RATE_LIMIT_KEY_SECRET: 'falso-solo-para-pruebas-0123456789',
      }),
    );
    const ownersOf = (user: string) =>
      db.withUser(user, async (tx) =>
        (await tx<{ user_id: string }[]>`select distinct user_id from accounts`).map(
          (row) => row.user_id,
        ),
      );
    expect(await ownersOf(A)).toEqual([A]);
    await db.withUser(A, () => Promise.reject(new Error('falla'))).catch(() => undefined);
    expect(await ownersOf(B)).toEqual([B]);
    await db.onApplicationShutdown();
  });
});

describe('AM-03 migración desde la versión anterior', () => {
  it('AM-03 una base con 0000 y 0001 conserva sus datos al aplicar el aislamiento', async () => {
    await owner`create database previa`;
    const url = new URL(container.getConnectionUri());
    url.pathname = '/previa';
    const previa = postgres(url.toString(), { max: 1, onnotice: () => undefined });
    await migrate(previa, 0, 2);
    await previa`insert into users (id, email, display_name) values (${A}, 'previa@ejemplo.co', 'Ana')`;
    await migrate(previa, 2);
    expect(await previa`select id from users`).toEqual([{ id: A }]);
    await previa.end();
  });
});
