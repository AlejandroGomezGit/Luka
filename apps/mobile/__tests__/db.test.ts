import { accounts, deviceProfile, transactions } from '@luka/schema-sqlite';
import type { Clock } from '@luka/domain';
import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/sql-js';
import { migrate } from 'drizzle-orm/sql-js/migrator';
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import initSqlJs from 'sql.js';
import { ensureDeviceProfile } from '../src/db/profile';
import type { LocalDb } from '../src/db/types';
import {
  insertRow,
  notDeleted,
  pendingUpload,
  restore,
  softDelete,
  updateRow,
  type WriteContext,
} from '../src/db/write';

import { migrationsFolder } from '../src/db/testing';

let time = Date.UTC(2026, 9, 2, 12);
const clock: Clock = { now: () => time };
let seed = 0;
const random = () => Uint8Array.from({ length: 16 }, (_, i) => (seed++ + i) % 256);

/** Base SQLite en memoria (sql.js) con las migraciones reales de @luka/schema-sqlite. */
async function freshDb(): Promise<LocalDb> {
  const SQL = await initSqlJs();
  const db = drizzle(new SQL.Database(), { schema: { accounts, deviceProfile, transactions } });
  migrate(db, { migrationsFolder });
  return db as unknown as LocalDb;
}

const account = {
  name: 'Efectivo',
  type: 'cash' as const,
  currency: 'COP',
  color: 'green',
  icon: 'wallet',
};

async function context(): Promise<WriteContext> {
  const db = await freshDb();
  const { userId } = ensureDeviceProfile(db, clock, random);
  return { db, userId, clock, random };
}

describe('migraciones al abrir (ADR-003)', () => {
  it('se aplican desde cero y volver a aplicarlas no cambia nada', async () => {
    const db = await freshDb();
    migrate(db as unknown as Parameters<typeof migrate>[0], { migrationsFolder });
    expect(db.select().from(accounts).all()).toEqual([]);
  });
});

describe('una migración que falla (ADR-003)', () => {
  /**
   * Copia las migraciones reales y agrega dos pendientes: una válida y otra que falla. Drizzle aplica
   * todas las pendientes en una sola transacción (BEGIN … COMMIT, ROLLBACK si una falla).
   */
  function withFailingMigrations(): string {
    const folder = mkdtempSync(path.join(tmpdir(), 'luka-migraciones-'));
    cpSync(migrationsFolder, folder, { recursive: true });
    const journalPath = path.join(folder, 'meta/_journal.json');
    const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as {
      entries: { idx: number; version: string; when: number; tag: string; breakpoints: boolean }[];
    };
    const last = journal.entries.at(-1);
    if (!last) throw new Error('sin migraciones');
    const extra = [
      ['9998_valida', 'CREATE TABLE `prueba_valida` (`id` text PRIMARY KEY NOT NULL);'],
      [
        '9999_falla',
        'ALTER TABLE `accounts` ADD `nueva` text;--> statement-breakpoint\nINSERT INTO `tabla_inexistente` VALUES (1);',
      ],
    ] as const;
    extra.forEach(([tag, sql], i) => {
      writeFileSync(path.join(folder, `${tag}.sql`), sql);
      journal.entries.push({ ...last, idx: last.idx + i + 1, when: last.when + i + 1, tag });
    });
    writeFileSync(journalPath, JSON.stringify(journal));
    return folder;
  }

  it('deja la base exactamente como estaba: ni la migración válida ni la mitad de la que falla quedan aplicadas', async () => {
    const SQL = await initSqlJs();
    const raw = new SQL.Database();
    const db = drizzle(raw, { schema: { accounts, deviceProfile, transactions } });
    migrate(db, { migrationsFolder });
    const ctx = { db: db as unknown as LocalDb, userId: 'u1', clock, random };
    insertRow(ctx, accounts, { ...account, openingBalanceMinor: 0 });
    const before = raw.export();

    expect(() => {
      migrate(db, { migrationsFolder: withFailingMigrations() });
    }).toThrow(/tabla_inexistente/);
    expect(Buffer.from(raw.export()).equals(Buffer.from(before))).toBe(true);
    expect(raw.exec("select name from sqlite_master where name = 'prueba_valida'")).toEqual([]);
  });
});

describe('perfil del dispositivo', () => {
  it('se crea en el primer arranque y se conserva en los siguientes', async () => {
    const db = await freshDb();
    const first = ensureDeviceProfile(db, clock, random);
    const second = ensureDeviceProfile(db, clock, random);
    expect(second).toEqual(first);
    expect(first.userId).not.toBe(first.deviceId);
    expect(db.select().from(deviceProfile).all()).toHaveLength(1);
  });
});

describe('ruta única de escritura', () => {
  it('insertRow llena las columnas comunes de sincronización', async () => {
    const ctx = await context();
    const id = insertRow(ctx, accounts, account);
    const row = ctx.db.select().from(accounts).where(eq(accounts.id, id)).get();
    expect(row).toMatchObject({
      id,
      userId: ctx.userId,
      createdAt: new Date(time),
      updatedAt: new Date(time),
      deletedAt: null,
      version: 0,
      fieldClocks: {},
      name: 'Efectivo',
    });
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('updateRow cambia los campos y updated_at, no created_at', async () => {
    const ctx = await context();
    const id = insertRow(ctx, accounts, account);
    time += 60_000;
    updateRow(ctx, accounts, id, { name: 'Billetera' });
    const row = ctx.db.select().from(accounts).where(eq(accounts.id, id)).get();
    expect(row?.name).toBe('Billetera');
    expect(row?.updatedAt).toEqual(new Date(time));
    expect(row?.createdAt).toEqual(new Date(time - 60_000));
  });

  it('el borrado lógico oculta el registro de las lecturas y se puede deshacer', async () => {
    const ctx = await context();
    const id = insertRow(ctx, accounts, account);
    softDelete(ctx, accounts, id);
    expect(ctx.db.select().from(accounts).where(notDeleted(accounts)).all()).toEqual([]);
    expect(ctx.db.select().from(accounts).all()).toHaveLength(1);
    restore(ctx, accounts, id);
    expect(ctx.db.select().from(accounts).where(notDeleted(accounts)).all()).toHaveLength(1);
  });

  it('todo lo escrito en H1 queda pendiente de subir para T-029 (version 0)', async () => {
    const ctx = await context();
    const accountId = insertRow(ctx, accounts, account);
    updateRow(ctx, accounts, accountId, { name: 'Billetera' });
    const txId = insertRow(ctx, transactions, {
      accountId,
      kind: 'expense',
      amountMinor: -1_250_000,
      currency: 'COP',
      occurredOn: '2026-10-02',
    });
    softDelete(ctx, transactions, txId);
    expect(ctx.db.select().from(accounts).where(pendingUpload(accounts)).all()).toHaveLength(1);
    expect(
      ctx.db
        .select()
        .from(transactions)
        .where(and(pendingUpload(transactions), eq(transactions.id, txId)))
        .all(),
    ).toHaveLength(1);
  });
});
