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

const MONTHS = 24;

/** Primer día de cada uno de los últimos `MONTHS` meses y el último día con datos (hoy en el mes actual). */
function monthSpans(end: string) {
  const [year, month] = end.split('-').map(Number) as [number, number];
  return Array.from({ length: MONTHS }, (_, i) => {
    const first = new Date(Date.UTC(year, month - 1 - (MONTHS - 1 - i), 1));
    const start = first.toISOString().slice(0, 10);
    const lastOfMonth = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0));
    const last = lastOfMonth.toISOString().slice(0, 10);
    return { start, last: last > end ? end : last };
  });
}

/**
 * Crea 4 cuentas y `total` movimientos creíbles en los últimos 24 meses; se niega si ya hay datos. Cada
 * mes: salario el día 1 en Ahorros, que cubre con un 15 % de margen lo que sale de Ahorros y lo gastado;
 * Efectivo recibe ese día lo que se gastará en efectivo; la Visa se paga el día 1 con lo gastado el mes
 * anterior; una compra de US$ 100 y dos suscripciones en dólares. Los demás son gastos de $ 2.000 a
 * $ 40.000 repartidos por día. Así los saldos quedan positivos y la tarjeta debe a lo sumo un mes.
 */
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
  const cat = (key: string) => predefinedCategoryId(ctx.userId, key);

  const months = monthSpans(today(ctx.clock, timeZone));
  // Por mes: salario, recarga de efectivo, compra de dólares y dos suscripciones; pago de la Visa
  // desde el segundo mes.
  const fixed = MONTHS * 5 + (MONTHS - 1);
  const days = months.flatMap((m) => {
    const out: string[] = [];
    for (let d = m.start; d <= m.last; d = addDays(d, 1)) out.push(d);
    return out;
  });
  const expenses = Array.from({ length: total - fixed }, (_, k) => {
    const [key, note] = EXPENSES[k % EXPENSES.length] ?? EXPENSES[0];
    return {
      occurredOn: days[Math.floor((k * days.length) / (total - fixed))] ?? months[0]?.start ?? '',
      // Pesos enteros, de $ 2.000 a $ 40.000, como se escriben en COP.
      amountMinor: (2_000 + ((k * 7_919) % 380) * 100) * 100,
      accountId: k % 3 === 0 ? card : cash,
      key,
      note: `${note} ${String(k)}`,
    };
  });
  const spent = (from: string, to: string, accountId: string) =>
    expenses
      .filter((e) => e.accountId === accountId && e.occurredOn >= from && e.occurredOn <= to)
      .reduce((sum, e) => sum + e.amountMinor, 0);

  const start = ctx.clock.now() - total;
  let n = 0;
  ctx.db.transaction((tx) => {
    // Un milisegundo por movimiento: ids UUID v7 distintos y ordenados.
    const write = () => {
      const at = start + n++;
      return { ...ctx, db: tx, clock: { now: () => at } };
    };
    const base = { categorySource: 'user', source: 'manual', reviewStatus: 'confirmed' } as const;
    const transfer = (
      occurredOn: string,
      from: string,
      to: string,
      out: number,
      arrives: number,
      note: string,
    ) =>
      insertRow(write(), transactions, {
        ...base,
        occurredOn,
        kind: 'transfer',
        amountMinor: -out,
        accountId: from,
        currency: from === dollars ? 'USD' : 'COP',
        toAccountId: to,
        toAmountMinor: arrives,
        note,
      });
    months.forEach((m, i) => {
      const cashTopUp = spent(m.start, m.last, cash);
      const previous = months[i - 1];
      const cardPayment = previous ? spent(previous.start, previous.last, card) : 0;
      const usdBuy = 400_000_00;
      // Cubre lo que sale de Ahorros y, aunque el pago de la Visa sea del mes anterior, lo gastado este mes.
      const cardSpent = Math.max(cardPayment, spent(m.start, m.last, card));
      const salary = Math.ceil(((cashTopUp + cardSpent + usdBuy) * 1.15) / 100_000_00) * 100_000_00;
      insertRow(write(), transactions, {
        ...base,
        occurredOn: m.start,
        kind: 'income',
        amountMinor: salary,
        accountId: savings,
        currency: 'COP',
        categoryId: cat('salary.other'),
        note: 'Salario',
      });
      transfer(m.start, savings, cash, cashTopUp, cashTopUp, 'Retiro para el mes');
      if (previous) transfer(m.start, savings, card, cardPayment, cardPayment, 'Pago de tarjeta');
      transfer(m.last, savings, dollars, usdBuy, 100_00, 'Compra de dólares');
      for (const [amount, note] of [
        [9_99, 'Streaming'],
        [15_00, 'Nube'],
      ] as const) {
        insertRow(write(), transactions, {
          ...base,
          occurredOn: m.last,
          kind: 'expense',
          amountMinor: -amount,
          accountId: dollars,
          currency: 'USD',
          categoryId: cat('subscriptions.other'),
          note,
        });
      }
      for (const e of expenses.filter((x) => x.occurredOn >= m.start && x.occurredOn <= m.last)) {
        insertRow(write(), transactions, {
          ...base,
          occurredOn: e.occurredOn,
          kind: 'expense',
          amountMinor: -e.amountMinor,
          accountId: e.accountId,
          currency: 'COP',
          categoryId: cat(e.key),
          note: e.note,
        });
      }
    });
  });
  backfillTransactionSearch(ctx.db);
  return { ok: true, transactions: n };
}
