import { predefinedCategoryId } from '@luka/domain';
import { transactions, transactionSearch } from '@luka/schema-sqlite';
import { sql } from 'drizzle-orm';
import { createAccount, listActiveAccounts } from '../src/db/accounts';
import { seedPredefinedCategories } from '../src/db/categories';
import { prepareLocalData } from '../src/db/prepare';
import { createTestDb, testClock, testRandom } from '../src/db/testing';
import {
  backfillTransactionSearch,
  countTransactions,
  createTransaction,
  fillSearchInBackground,
  listTransactions,
  transactionListQuery,
  type TransactionFilters,
  updateTransaction,
} from '../src/db/transactions';
import { insertRow, softDelete, type WriteContext } from '../src/db/write';

const userId = '0199a6f0-0000-7000-8000-000000000001';
const BOGOTA = 'America/Bogota';
const cat = (key: string) => predefinedCategoryId(userId, key);

async function setup() {
  const clock = testClock(Date.UTC(2026, 9, 2, 17));
  const ctx: WriteContext = { db: await createTestDb(), userId, clock, random: testRandom() };
  seedPredefinedCategories(ctx);
  const account = (
    name: string,
    currency: 'COP' | 'USD' = 'COP',
    type: 'cash' | 'savings' = 'cash',
  ) => {
    const result = createAccount(ctx, {
      name,
      type,
      currency,
      openingAmountMinor: 0,
      icon: '💵',
      color: 'green',
    });
    if (!result.ok) throw new Error(result.errors.join());
    return result.id;
  };
  const cash = account('Efectivo');
  const savings = account('Ahorro Bancolombia', 'COP', 'savings');
  const dollars = account('Dolares', 'USD');
  const add = (input: Parameters<typeof createTransaction>[1]) => {
    clock.advance(1_000);
    const result = createTransaction(ctx, input, BOGOTA);
    if (!result.ok) throw new Error(result.errors.join());
    return result.id;
  };
  const expense = (
    occurredOn: string,
    amount: number,
    categoryId: string | null,
    note = '',
    accountId = cash,
  ) => add({ kind: 'expense', amountMinor: amount, accountId, categoryId, occurredOn, note });
  return { ctx, clock, cash, savings, dollars, add, expense };
}

const ids = (list: { id: string }[]) => list.map((item) => item.id);
const all = (ctx: WriteContext, filters: TransactionFilters = {}) =>
  listTransactions(ctx.db, userId, filters, null, 1_000).items;

describe('HU-05 lista de movimientos (CU-10)', () => {
  it('HU-05 orden por fecha descendente y desempate por id descendente, aunque se creen fuera de orden; el cursor no repite ni salta', async () => {
    const { ctx, expense } = await setup();
    const sep28 = expense('2026-09-28', 1_00, null);
    const oct01a = expense('2026-10-01', 2_00, null);
    const sep30 = expense('2026-09-30', 3_00, null);
    const oct01b = expense('2026-10-01', 4_00, null);
    const oct02 = expense('2026-10-02', 5_00, null);
    expect(ids(all(ctx))).toEqual([oct02, oct01b, oct01a, sep30, sep28]);

    const pages: string[] = [];
    let cursor = null;
    do {
      const page = listTransactions(ctx.db, userId, {}, cursor, 2);
      pages.push(...ids(page.items));
      cursor = page.nextCursor;
    } while (cursor);
    expect(pages).toEqual([oct02, oct01b, oct01a, sep30, sep28]);
  });

  it('HU-05 no muestra borrados ni movimientos por revisar', async () => {
    const { ctx, cash, expense } = await setup();
    const kept = expense('2026-10-01', 1_00, null);
    softDelete(ctx, transactions, expense('2026-10-01', 2_00, null));
    insertRow(ctx, transactions, {
      kind: 'expense',
      amountMinor: -3_00,
      accountId: cash,
      currency: 'COP',
      occurredOn: '2026-10-01',
      categorySource: 'user',
      source: 'manual',
      reviewStatus: 'pending_review',
    });
    expect(ids(all(ctx))).toEqual([kept]);
  });

  it('HU-05 filtro por tipo', async () => {
    const { ctx, cash, savings, add, expense } = await setup();
    const spent = expense('2026-10-01', 1_00, null);
    const earned = add({
      kind: 'income',
      amountMinor: 2_00,
      accountId: cash,
      categoryId: null,
      occurredOn: '2026-10-01',
    });
    const moved = add({
      kind: 'transfer',
      amountMinor: 3_00,
      accountId: cash,
      toAccountId: savings,
      toAmountMinor: null,
      occurredOn: '2026-10-01',
    });
    expect(ids(all(ctx, { kind: 'expense' }))).toEqual([spent]);
    expect(ids(all(ctx, { kind: 'income' }))).toEqual([earned]);
    expect(ids(all(ctx, { kind: 'transfer' }))).toEqual([moved]);
  });

  it('HU-05 filtro por cuenta incluye las transferencias de origen y de destino', async () => {
    const { ctx, cash, savings, dollars, add, expense } = await setup();
    const own = expense('2026-10-01', 1_00, null, '', savings);
    const fromSavings = add({
      kind: 'transfer',
      amountMinor: 2_00,
      accountId: savings,
      toAccountId: cash,
      toAmountMinor: null,
      occurredOn: '2026-10-01',
    });
    const toSavings = add({
      kind: 'transfer',
      amountMinor: 3_00,
      accountId: cash,
      toAccountId: savings,
      toAmountMinor: null,
      occurredOn: '2026-10-01',
    });
    expense('2026-10-01', 4_00, null, '', dollars);
    expect(ids(all(ctx, { accountId: savings })).sort()).toEqual(
      [own, fromSavings, toSavings].sort(),
    );
  });

  it('HU-05 filtro por categoría: una principal incluye sus subcategorías; una subcategoría, solo a sí misma; las transferencias quedan fuera', async () => {
    const { ctx, cash, savings, add, expense } = await setup();
    const groceries = expense('2026-10-01', 1_00, cat('food.groceries'));
    const restaurants = expense('2026-10-01', 2_00, cat('food.restaurants'));
    expense('2026-10-01', 3_00, cat('transport.taxi_apps'));
    add({
      kind: 'transfer',
      amountMinor: 4_00,
      accountId: cash,
      toAccountId: savings,
      toAmountMinor: null,
      occurredOn: '2026-10-01',
    });
    expect(ids(all(ctx, { categoryId: cat('food') })).sort()).toEqual(
      [groceries, restaurants].sort(),
    );
    expect(ids(all(ctx, { categoryId: cat('food.groceries') }))).toEqual([groceries]);
  });

  it('HU-05 el rango de fechas incluye los dos extremos', async () => {
    const { ctx, expense } = await setup();
    expense('2026-08-31', 1_00, null);
    const first = expense('2026-09-01', 2_00, null);
    const last = expense('2026-09-30', 3_00, null);
    expense('2026-10-01', 4_00, null);
    expect(ids(all(ctx, { from: '2026-09-01', to: '2026-09-30' }))).toEqual([last, first]);
  });

  it('HU-05 el monto lleva moneda: solo mira cuentas en esa moneda y en transferencias compara el monto que sale', async () => {
    const { ctx, cash, dollars, add, expense } = await setup();
    const small = expense('2026-10-01', 50_000_00, null);
    const big = expense('2026-10-01', 150_000_00, null);
    const usd = expense('2026-10-01', 100_00, null, '', dollars);
    const exchange = add({
      kind: 'transfer',
      amountMinor: 100_000_00,
      accountId: cash,
      toAccountId: dollars,
      toAmountMinor: 25_00,
      occurredOn: '2026-10-01',
    });
    expect(
      ids(all(ctx, { amount: { currency: 'COP', minMinor: 90_000_00, maxMinor: 120_000_00 } })),
    ).toEqual([exchange]);
    expect(ids(all(ctx, { amount: { currency: 'COP', minMinor: 100_000_00 } })).sort()).toEqual(
      [big, exchange].sort(),
    );
    expect(ids(all(ctx, { amount: { currency: 'COP', maxMinor: 60_000_00 } }))).toEqual([small]);
    // En dólares solo cuentan las cuentas en dólares: la transferencia sale en pesos.
    expect(ids(all(ctx, { amount: { currency: 'USD' } }))).toEqual([usd]);
  });

  it('HU-05 la búsqueda encuentra «cafe» en «Café», partes de palabra y nombres de categoría y de cuenta, combinada con otros filtros', async () => {
    const { ctx, savings, expense } = await setup();
    const cafe = expense('2026-10-01', 1_00, null, 'Café con Ana');
    const market = expense('2026-10-01', 2_00, cat('food.groceries'), '');
    const pharmacy = expense('2026-10-01', 3_00, cat('health.pharmacy'), '');
    const bank = expense('2026-10-01', 4_00, null, '', savings);
    expect(ids(all(ctx, { text: 'cafe' }))).toEqual([cafe]);
    expect(ids(all(ctx, { text: 'ANA' }))).toEqual([cafe]);
    // Subcategoría por su nombre, y principal por el suyo (Alimentación).
    expect(ids(all(ctx, { text: 'ercad' }))).toEqual([market]);
    expect(ids(all(ctx, { text: 'alimentacion' }))).toEqual([market]);
    expect(ids(all(ctx, { text: 'salud' }))).toEqual([pharmacy]);
    expect(ids(all(ctx, { text: 'bancolombia' }))).toEqual([bank]);
    expect(ids(all(ctx, { text: 'bancolombia', kind: 'income' }))).toEqual([]);
  });

  it('HU-05 «50%», «_» y «\\» se buscan tal cual: «50%» no coincide con todo', async () => {
    const { ctx, expense } = await setup();
    const percent = expense('2026-10-01', 1_00, null, 'Descuento 50%');
    expense('2026-10-01', 2_00, null, 'Cuota 500');
    const underscore = expense('2026-10-01', 3_00, null, 'ref a_b');
    expense('2026-10-01', 4_00, null, 'ref axb');
    const slash = expense('2026-10-01', 5_00, null, 'ruta c:\\x');
    expect(ids(all(ctx, { text: '50%' }))).toEqual([percent]);
    expect(ids(all(ctx, { text: 'a_b' }))).toEqual([underscore]);
    expect(ids(all(ctx, { text: 'c:\\x' }))).toEqual([slash]);
  });

  it('HU-05 al editar la nota cambia lo que encuentra la búsqueda', async () => {
    const { ctx, cash, expense } = await setup();
    const id = expense('2026-10-01', 1_00, null, 'Almuerzo');
    updateTransaction(
      ctx,
      id,
      {
        kind: 'expense',
        amountMinor: 1_00,
        accountId: cash,
        categoryId: null,
        occurredOn: '2026-10-01',
        note: 'Cena',
      },
      BOGOTA,
    );
    expect(ids(all(ctx, { text: 'almuerzo' }))).toEqual([]);
    expect(ids(all(ctx, { text: 'cena' }))).toEqual([id]);
  });

  it('HU-05 completar el texto de búsqueda de los movimientos existentes es idempotente', async () => {
    const { ctx, cash } = await setup();
    insertRow(ctx, transactions, {
      kind: 'expense',
      amountMinor: -1_00,
      accountId: cash,
      currency: 'COP',
      occurredOn: '2026-10-01',
      note: 'Café',
      merchant: 'Éxito',
      categorySource: 'user',
      source: 'manual',
      reviewStatus: 'confirmed',
    });
    expect(ctx.db.select().from(transactionSearch).all()).toEqual([]);
    backfillTransactionSearch(ctx.db);
    backfillTransactionSearch(ctx.db);
    expect(
      ctx.db.select({ content: transactionSearch.content }).from(transactionSearch).all(),
    ).toEqual([{ content: 'cafe exito' }]);
    expect(countTransactions(ctx.db, userId, { text: 'exito' })).toBe(1);
  });

  it('HU-05 cada arranque completa el texto de búsqueda que falte', async () => {
    const { ctx, cash } = await setup();
    insertRow(ctx, transactions, {
      kind: 'expense',
      amountMinor: -1_00,
      accountId: cash,
      currency: 'COP',
      occurredOn: '2026-10-01',
      note: 'Panadería',
      categorySource: 'user',
      source: 'manual',
      reviewStatus: 'confirmed',
    });
    // El relleno corre después del primer render (DatabaseProvider), lote a lote.
    prepareLocalData(ctx.db, ctx.clock, ctx.random);
    expect(countTransactions(ctx.db, userId, { text: 'panaderia' })).toBe(0);
    fillSearchInBackground(ctx.db, (task) => task());
    expect(countTransactions(ctx.db, userId, { text: 'panaderia' })).toBe(1);
  });

  it('HU-05 con 10 000 movimientos la lista usa su índice y la primera página, la cuenta y los saldos responden rápido', async () => {
    const { ctx, clock, cash, savings } = await setup();
    ctx.db.transaction((tx) => {
      for (let i = 0; i < 10_000; i++) {
        // Un milisegundo por movimiento: UUID v7 distintos con el azar determinista de las pruebas.
        clock.advance(1);
        insertRow({ ...ctx, db: tx }, transactions, {
          kind: 'expense',
          amountMinor: -(1_000 + i),
          accountId: i % 2 ? cash : savings,
          currency: 'COP',
          occurredOn: `2025-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
          note: i % 7 ? `nota ${String(i)}` : 'café',
          categoryId: i % 3 ? cat('food.groceries') : null,
          categorySource: 'user',
          source: 'manual',
          reviewStatus: 'confirmed',
        });
      }
    });
    backfillTransactionSearch(ctx.db);

    // El SQL real de la consulta, con sus parámetros (getSQL no la envuelve en paréntesis).
    const plan = (filters: TransactionFilters) =>
      ctx.db
        .all<{ detail: string }>(
          sql`explain query plan ${transactionListQuery(ctx.db, userId, filters, null, 50).getSQL()}`,
        )
        .map((row) => row.detail)
        .join(' | ');
    expect(plan({})).toContain('transactions_list');
    expect(plan({ kind: 'expense', text: 'cafe' })).toContain('transactions_list');

    const time = (run: () => unknown) => {
      const start = performance.now();
      run();
      return performance.now() - start;
    };
    // Márgenes generosos para el CI; en el iPhone 17 la primera página tarda menos de 1 ms.
    expect(time(() => listTransactions(ctx.db, userId, {}, null, 50))).toBeLessThan(200);
    expect(
      time(() =>
        listTransactions(ctx.db, userId, { text: 'cafe', categoryId: cat('food') }, null, 50),
      ),
    ).toBeLessThan(200);
    expect(time(() => countTransactions(ctx.db, userId, { text: 'cafe' }))).toBeLessThan(200);
    expect(time(() => listActiveAccounts(ctx.db))).toBeLessThan(200);
    expect(listTransactions(ctx.db, userId, {}, null, 50).items).toHaveLength(50);
  });
});
