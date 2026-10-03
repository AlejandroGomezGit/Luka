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

describe('HU-05 datos de prueba creíbles (también para el resumen de T-017)', () => {
  async function loaded() {
    const ctx = await context();
    loadDemoData(ctx, 'America/Bogota');
    const rows = ctx.db.select().from(transactions).all();
    const byName = new Map(listActiveAccounts(ctx.db).map((a) => [a.name, a]));
    return { ctx, rows, byName };
  }

  it('HU-05 ninguna cuenta de débito queda en negativo y la tarjeta debe a lo sumo un mes de gastos', async () => {
    const { rows, byName } = await loaded();
    for (const name of ['Efectivo', 'Ahorros', 'Dólares']) {
      expect({ name, positive: (byName.get(name)?.balanceMinor ?? -1) > 0 }).toEqual({
        name,
        positive: true,
      });
    }
    const card = byName.get('Visa');
    const cardId = card?.id;
    const monthly = new Map<string, number>();
    for (const r of rows.filter((r) => r.kind === 'expense' && r.accountId === cardId)) {
      const month = r.occurredOn.slice(0, 7);
      monthly.set(month, (monthly.get(month) ?? 0) - r.amountMinor);
    }
    const debt = -(card?.balanceMinor ?? 0);
    expect(debt).toBeGreaterThanOrEqual(0);
    expect(debt).toBeLessThanOrEqual(Math.max(...monthly.values()));
  });

  it('HU-05 cada mes los ingresos en pesos cubren los gastos en pesos', async () => {
    const { rows } = await loaded();
    const months = new Map<string, { income: number; expense: number }>();
    for (const r of rows.filter((r) => r.currency === 'COP' && r.kind !== 'transfer')) {
      const month = months.get(r.occurredOn.slice(0, 7)) ?? { income: 0, expense: 0 };
      if (r.kind === 'income') month.income += r.amountMinor;
      else month.expense -= r.amountMinor;
      months.set(r.occurredOn.slice(0, 7), month);
    }
    expect(months.size).toBeGreaterThanOrEqual(24);
    for (const [month, { income, expense }] of months) {
      expect({ month, covered: income >= expense }).toEqual({ month, covered: true });
    }
  });

  it('HU-05 los gastos en pesos son enteros, sin centavos', async () => {
    const { rows } = await loaded();
    expect(rows.filter((r) => r.currency === 'COP' && r.amountMinor % 100 !== 0)).toEqual([]);
  });
});
