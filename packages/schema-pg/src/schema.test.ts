import { afterAll, describe, expect, it } from '@jest/globals';
import { PGlite } from '@electric-sql/pglite';
import { citext } from '@electric-sql/pglite/contrib/citext';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { accounts, transactions, users } from './schema.js';

// Base PostgreSQL vacía en memoria (PGlite) con todas las migraciones aplicadas desde cero.
const clients: PGlite[] = [];
afterAll(() => Promise.all(clients.map((client) => client.close())));

async function freshDb() {
  const client = new PGlite({ extensions: { citext } });
  clients.push(client);
  const db = drizzle(client);
  await migrate(db, { migrationsFolder: 'drizzle' });
  return db;
}

const userId = '0199a6f0-0000-7000-8000-000000000001';
const cashId = '0199a6f0-0000-7000-8000-000000000002';
const bankId = '0199a6f0-0000-7000-8000-000000000003';
const now = new Date('2026-10-02T12:00:00Z');
const sync = { userId, createdAt: now, updatedAt: now };

async function seeded() {
  const db = await freshDb();
  await db.insert(users).values({ id: userId, email: 'Ana@Ejemplo.co', displayName: 'Ana' });
  await db.insert(accounts).values(
    [cashId, bankId].map((id) => ({
      ...sync,
      id,
      name: id === cashId ? 'Efectivo' : 'Banco',
      type: 'cash' as const,
      currency: 'COP',
      color: 'green',
      icon: 'wallet',
    })),
  );
  return db;
}

let txId = 0;
const tx = (patch: Partial<typeof transactions.$inferInsert>) => ({
  ...sync,
  id: `0199a6f0-0000-7000-8000-1000000000${String(++txId).padStart(2, '0')}`,
  accountId: cashId,
  kind: 'expense' as const,
  amountMinor: -1_250_000,
  currency: 'COP',
  occurredOn: '2026-10-01',
  ...patch,
});

describe('migraciones de PostgreSQL', () => {
  it('se aplican desde cero y crean las tablas del MVP', async () => {
    const db = await seeded();
    await db.insert(transactions).values(tx({}));
    const rows = await db.select().from(transactions);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.tags).toEqual([]);
    expect(rows[0]?.reviewStatus).toBe('confirmed');
  });

  it('users.email no distingue mayúsculas (citext)', async () => {
    const db = await seeded();
    await expect(
      db.insert(users).values({ id: bankId, email: 'ana@ejemplo.co', displayName: 'Otra' }),
    ).rejects.toThrow();
  });

  it('INV-01 el CHECK rechaza montos en cero o con el signo contrario al tipo', async () => {
    const db = await seeded();
    for (const patch of [
      { amountMinor: 0 },
      { amountMinor: 500 },
      { kind: 'income' as const, amountMinor: -500 },
    ]) {
      await expect(db.insert(transactions).values(tx(patch))).rejects.toThrow();
    }
    await db.insert(transactions).values(tx({ kind: 'adjustment', amountMinor: 300 }));
  });

  it('INV-02 el CHECK exige destino distinto y monto positivo solo en transferencias', async () => {
    const db = await seeded();
    const transfer = { kind: 'transfer' as const, toAccountId: bankId, toAmountMinor: 1_250_000 };
    await db.insert(transactions).values(tx(transfer));
    for (const patch of [
      { ...transfer, toAccountId: cashId },
      { ...transfer, toAmountMinor: -1 },
      { ...transfer, toAccountId: null },
      { toAccountId: bankId },
    ]) {
      await expect(db.insert(transactions).values(tx(patch))).rejects.toThrow();
    }
  });

  it('rechaza valores fuera de las enumeraciones', async () => {
    const db = await seeded();
    const bad = tx({}) as Record<string, unknown>;
    bad['source'] = 'sms';
    await expect(
      db.insert(transactions).values(bad as typeof transactions.$inferInsert),
    ).rejects.toThrow();
  });
});
