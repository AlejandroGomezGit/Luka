import { predefinedCategoryId } from '@luka/domain';
import { transactions } from '@luka/schema-sqlite';
import { sql } from 'drizzle-orm';
import { createAccount } from '../src/db/accounts';
import { seedPredefinedCategories } from '../src/db/categories';
import { monthlySummary, summaryCurrencies, summaryQuery } from '../src/db/summary';
import { createTestDb, testClock, testRandom } from '../src/db/testing';
import { createTransaction } from '../src/db/transactions';
import { insertRow, softDelete, type WriteContext } from '../src/db/write';

const userId = '0199a6f0-0000-7000-8000-000000000001';
const BOGOTA = 'America/Bogota';
const cat = (key: string) => predefinedCategoryId(userId, key);

async function setup() {
  const clock = testClock(Date.UTC(2026, 9, 3, 17));
  const ctx: WriteContext = { db: await createTestDb(), userId, clock, random: testRandom() };
  seedPredefinedCategories(ctx);
  const account = (name: string, type: 'cash' | 'credit_card', currency: 'COP' | 'USD') => {
    const r = createAccount(ctx, {
      name,
      type,
      currency,
      openingAmountMinor: 0,
      icon: '💵',
      color: 'green',
    });
    if (!r.ok) throw new Error(r.errors.join());
    return r.id;
  };
  const cash = account('Efectivo', 'cash', 'COP');
  const card = account('Visa', 'credit_card', 'COP');
  const dollars = account('Dólares', 'cash', 'USD');
  const add = (input: Parameters<typeof createTransaction>[1]) => {
    clock.advance(1_000);
    const r = createTransaction(ctx, input, BOGOTA);
    if (!r.ok) throw new Error(r.errors.join());
    return r.id;
  };
  const spend = (amount: number, key: string | null, occurredOn = '2026-09-15', accountId = cash) =>
    add({
      kind: 'expense',
      amountMinor: amount,
      accountId,
      categoryId: key ? cat(key) : null,
      occurredOn,
    });
  const earn = (amount: number, key: string, occurredOn = '2026-09-01') =>
    add({ kind: 'income', amountMinor: amount, accountId: cash, categoryId: cat(key), occurredOn });
  return { ctx, cash, card, dollars, add, spend, earn };
}

describe('HU-08 resumen mensual (CU-18)', () => {
  it('HU-08 ingresos, gastos y balance del mes; transferencias, pago de tarjeta, borrados, por revisar y ajustes no cuentan', async () => {
    const { ctx, cash, card, add, spend, earn } = await setup();
    earn(3_000_000_00, 'salary.other');
    spend(100_000_00, 'food.groceries');
    spend(50_000_00, 'food.restaurants', '2026-09-20', card);
    add({
      kind: 'transfer',
      amountMinor: 50_000_00,
      accountId: cash,
      toAccountId: card,
      toAmountMinor: null,
      occurredOn: '2026-09-25',
    });
    softDelete(ctx, transactions, spend(999_00, 'food.groceries'));
    for (const reviewStatus of ['pending_review', 'confirmed'] as const) {
      insertRow(ctx, transactions, {
        kind: reviewStatus === 'confirmed' ? 'adjustment' : 'expense',
        amountMinor: -7_00,
        accountId: cash,
        currency: 'COP',
        occurredOn: '2026-09-10',
        categorySource: 'user',
        source: 'manual',
        reviewStatus,
      });
    }
    expect(monthlySummary(ctx.db, userId, '2026-09', 'COP')).toMatchObject({
      incomeMinor: 3_000_000_00,
      expenseMinor: 150_000_00,
      balanceMinor: 2_850_000_00,
      incomeCount: 1,
      expenseCount: 2,
    });
  });

  it('HU-08 los reembolsos cuentan como ingreso', async () => {
    const { ctx, spend, earn } = await setup();
    spend(80_000_00, 'food.groceries');
    earn(20_000_00, 'refunds.other', '2026-09-16');
    const summary = monthlySummary(ctx.db, userId, '2026-09', 'COP');
    expect(summary).toMatchObject({ incomeMinor: 20_000_00, expenseMinor: 80_000_00 });
    expect(summary.income.map((c) => c.name)).toEqual(['Reembolsos']);
  });

  it('HU-08 por categoría principal, sumando sus subcategorías, de mayor a menor, con «Sin categoría»', async () => {
    const { ctx, spend } = await setup();
    spend(100_000_00, 'food.groceries');
    spend(50_000_00, 'food.restaurants');
    spend(120_000_00, 'transport.taxi_apps');
    spend(10_000_00, null);
    expect(monthlySummary(ctx.db, userId, '2026-09', 'COP').expense).toEqual([
      expect.objectContaining({
        id: cat('food'),
        name: 'Alimentación',
        amountMinor: 150_000_00,
        count: 2,
      }),
      expect.objectContaining({ id: cat('transport'), amountMinor: 120_000_00, count: 1 }),
      expect.objectContaining({
        id: null,
        name: 'Sin categoría',
        amountMinor: 10_000_00,
        count: 1,
      }),
    ]);
  });

  it('HU-08 cada moneda por separado, sin convertir', async () => {
    const { ctx, dollars, spend } = await setup();
    spend(100_000_00, 'food.groceries');
    spend(25_00, 'subscriptions.other', '2026-09-15', dollars);
    expect(summaryCurrencies(ctx.db)).toEqual(['COP', 'USD']);
    expect(monthlySummary(ctx.db, userId, '2026-09', 'COP').expenseMinor).toBe(100_000_00);
    expect(monthlySummary(ctx.db, userId, '2026-09', 'USD').expenseMinor).toBe(25_00);
  });

  it('HU-08 los límites del mes son la fecha local: el 30 de septiembre cuenta en septiembre y el 1 de octubre en octubre', async () => {
    const { ctx, spend } = await setup();
    spend(1_00, null, '2026-08-31');
    spend(2_00, null, '2026-09-01');
    spend(3_00, null, '2026-09-30');
    spend(4_00, null, '2026-10-01');
    expect(monthlySummary(ctx.db, userId, '2026-09', 'COP').expenseMinor).toBe(5_00);
    expect(monthlySummary(ctx.db, userId, '2026-10', 'COP').expenseMinor).toBe(4_00);
  });

  it('HU-08 con 10 000 movimientos el resumen busca por índice con el rango del mes y responde rápido', async () => {
    const { ctx, cash } = await setup();
    ctx.db.transaction((tx) => {
      for (let i = 0; i < 10_000; i++) {
        insertRow({ ...ctx, db: tx, clock: { now: () => 1_700_000_000_000 + i } }, transactions, {
          kind: 'expense',
          amountMinor: -(1_000 + i) * 100,
          accountId: cash,
          currency: 'COP',
          occurredOn: `2026-0${String((i % 9) + 1)}-${String((i % 28) + 1).padStart(2, '0')}`,
          categoryId: i % 4 ? cat('food.groceries') : null,
          categorySource: 'user',
          source: 'manual',
          reviewStatus: 'confirmed',
        });
      }
    });
    const plan = ctx.db
      .all<{ detail: string }>(
        sql`explain query plan ${summaryQuery(ctx.db, userId, '2026-09', 'COP').getSQL()}`,
      )
      .map((r) => r.detail)
      .join(' | ');
    // SQLite elige un índice con usuario y fechas (hoy transactions_list): nunca recorre toda la tabla.
    expect(plan).toMatch(
      /SEARCH transactions USING INDEX \S+ \(user_id=\? AND occurred_on>\? AND occurred_on<\?\)/,
    );
    expect(plan).not.toContain('SCAN transactions');
    const start = performance.now();
    const summary = monthlySummary(ctx.db, userId, '2026-09', 'COP');
    // Margen generoso para el CI; la medición en el simulador queda en el documento 02.
    expect(performance.now() - start).toBeLessThan(200);
    expect(summary.expenseCount).toBeGreaterThan(1_000);
  });
});
