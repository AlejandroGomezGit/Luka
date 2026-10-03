/**
 * Cargador de datos de prueba SOLO PARA DESARROLLO (HU-05): 10 000 movimientos para probar la lista en el
 * simulador o en Expo Go. Se importa solo detrás de `__DEV__`, así que no entra al bundle de producción;
 * el build lo comprueba buscando DEMO_MARKER en dist.
 */
import { addDays, predefinedCategoryId, today } from '@luka/domain';
import { accounts, transactions } from '@luka/schema-sqlite';
import { count } from 'drizzle-orm';
import { createAccount } from '../db/accounts';
import { backfillTransactionSearch } from '../db/transactions';
import { insertRow, type WriteContext } from '../db/write';

export const DEMO_MARKER = 'LUKA_DEV_SEED';

const EXPENSES = [
  ['food.groceries', 'Mercado'],
  ['food.restaurants', 'Almuerzo'],
  ['food.delivery', 'Domicilio'],
  ['transport.taxi_apps', 'Taxi'],
  ['transport.public_transit', 'Pasaje'],
  ['utilities.electricity', 'Luz'],
  ['health.pharmacy', 'Farmacia'],
] as const;

export type DemoResult = { ok: true; transactions: number } | { ok: false; reason: string };

/** Crea 4 cuentas y `total` movimientos válidos en los últimos dos años; se niega si ya hay datos. */
export function loadDemoData(ctx: WriteContext, timeZone: string, total = 10_000): DemoResult {
  const hasData =
    (ctx.db.select({ n: count() }).from(accounts).get()?.n ?? 0) > 0 ||
    (ctx.db.select({ n: count() }).from(transactions).get()?.n ?? 0) > 0;
  if (hasData) return { ok: false, reason: 'La base ya tiene datos: no se cargó nada.' };

  const account = (
    name: string,
    type: 'cash' | 'savings' | 'credit_card',
    currency: 'COP' | 'USD',
    opening: number,
    icon: string,
  ) => {
    const result = createAccount(ctx, {
      name,
      type,
      currency,
      openingAmountMinor: opening,
      icon,
      color: 'green',
    });
    if (!result.ok) throw new Error(result.errors.join());
    return result.id;
  };
  const cash = account('Efectivo', 'cash', 'COP', 500_000_00, '💵');
  const savings = account('Ahorros', 'savings', 'COP', 5_000_000_00, '🐷');
  const card = account('Visa', 'credit_card', 'COP', 0, '💳');
  const dollars = account('Dólares', 'cash', 'USD', 200_00, '💵');

  const end = today(ctx.clock, timeZone);
  const start = ctx.clock.now() - total;
  ctx.db.transaction((tx) => {
    for (let i = 0; i < total; i++) {
      // Un milisegundo por movimiento: ids UUID v7 distintos y ordenados.
      const write = { ...ctx, db: tx, clock: { now: () => start + i } };
      // Repartidos en dos años: unos 14 por día, del más reciente al más antiguo.
      const occurredOn = addDays(end, -Math.floor((i * 730) / total));
      const base = {
        occurredOn,
        categorySource: 'user',
        source: 'manual',
        reviewStatus: 'confirmed',
      } as const;
      // Un salario cada mes, más o menos.
      if (i % Math.floor(total / 24) === 0) {
        insertRow(write, transactions, {
          ...base,
          kind: 'income',
          amountMinor: 3_200_000_00,
          accountId: savings,
          currency: 'COP',
          categoryId: predefinedCategoryId(ctx.userId, 'salary.other'),
          note: 'Salario',
        });
      } else if (i % 25 === 0) {
        insertRow(write, transactions, {
          ...base,
          kind: 'transfer',
          amountMinor: -400_000_00,
          accountId: cash,
          currency: 'COP',
          toAccountId: dollars,
          toAmountMinor: 100_00,
          note: 'Compra de dólares',
        });
      } else if (i % 20 === 0) {
        insertRow(write, transactions, {
          ...base,
          kind: 'transfer',
          amountMinor: -200_000_00,
          accountId: savings,
          currency: 'COP',
          toAccountId: card,
          toAmountMinor: 200_000_00,
          note: 'Pago de tarjeta',
        });
      } else {
        const [key, note] = EXPENSES[i % EXPENSES.length] ?? EXPENSES[0];
        insertRow(write, transactions, {
          ...base,
          kind: 'expense',
          // Pesos enteros, sin centavos, como se escriben en COP.
          amountMinor: -(5_000 + ((i * 7_919) % 95_000)) * 100,
          accountId: i % 3 === 0 ? card : cash,
          currency: 'COP',
          categoryId: predefinedCategoryId(ctx.userId, key),
          note: `${note} ${String(i)}`,
        });
      }
    }
  });
  backfillTransactionSearch(ctx.db);
  return { ok: true, transactions: total };
}
