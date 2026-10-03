import { transactions } from '@luka/schema-sqlite';
import { count } from 'drizzle-orm';
import { createAccount, listActiveAccounts } from '../src/db/accounts';
import { seedPredefinedCategories } from '../src/db/categories';
import { createTestDb, testClock, testRandom } from '../src/db/testing';
import { countTransactions } from '../src/db/transactions';
import { DEMO_MARKER, loadDemoData } from '../src/dev/demoData';
import type { WriteContext } from '../src/db/write';

const userId = '0199a6f0-0000-7000-8000-000000000001';

async function context(): Promise<WriteContext> {
  const ctx = {
    db: await createTestDb(),
    userId,
    clock: testClock(Date.UTC(2026, 9, 2, 17)),
    random: testRandom(),
  };
  seedPredefinedCategories(ctx);
  return ctx;
}

test('HU-05 el cargador de desarrollo crea 10 000 movimientos válidos en una base vacía, buscables y sin fechas futuras', async () => {
  const ctx = await context();
  expect(loadDemoData(ctx, 'America/Bogota')).toEqual({ ok: true, transactions: 10_000 });
  expect(ctx.db.select({ n: count() }).from(transactions).get()?.n).toBe(10_000);
  expect(
    listActiveAccounts(ctx.db)
      .map((a) => a.currency)
      .sort(),
  ).toEqual(['COP', 'COP', 'COP', 'USD']);
  const rows = ctx.db.select().from(transactions).all();
  expect(rows.filter((r) => r.occurredOn > '2026-10-02')).toEqual([]);
  expect(rows.some((r) => r.kind === 'transfer')).toBe(true);
  expect(countTransactions(ctx.db, userId, { text: 'almuerzo' })).toBeGreaterThan(0);
  expect(DEMO_MARKER).toBe('LUKA_DEV_SEED');
});

test('HU-05 el cargador se niega a correr si la base ya tiene datos', async () => {
  const ctx = await context();
  createAccount(ctx, {
    name: 'Efectivo',
    type: 'cash',
    currency: 'COP',
    openingAmountMinor: 0,
    icon: '💵',
    color: 'green',
  });
  expect(loadDemoData(ctx, 'America/Bogota')).toEqual({
    ok: false,
    reason: 'La base ya tiene datos: no se cargó nada.',
  });
  expect(ctx.db.select({ n: count() }).from(transactions).get()?.n).toBe(0);
});
