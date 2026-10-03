/** Resumen mensual (HU-08, CU-18): ingresos, gastos y balance de un mes, por moneda y por categoría. */
import { type CurrencyCode, monthRange } from '@luka/domain';
import { categories, transactions } from '@luka/schema-sqlite';
import { and, count, eq, gte, inArray, lte, sum } from 'drizzle-orm';
import { listActiveAccounts } from './accounts';
import type { LocalDb } from './types';
import { notDeleted } from './write';

/** Total de una categoría principal (sus subcategorías sumadas); `id` null es «Sin categoría». */
export interface CategoryTotal {
  id: string | null;
  name: string;
  icon: string;
  color: string;
  amountMinor: number;
  count: number;
}

export interface MonthSummary {
  incomeMinor: number;
  expenseMinor: number;
  balanceMinor: number;
  incomeCount: number;
  expenseCount: number;
  /** De mayor a menor. */
  income: CategoryTotal[];
  expense: CategoryTotal[];
}

/** Monedas de las cuentas activas, con COP primero: el resumen no convierte monedas (documento 02). */
export function summaryCurrencies(db: LocalDb): CurrencyCode[] {
  const currencies = [...new Set(listActiveAccounts(db).map((a) => a.currency as CurrencyCode))];
  return currencies.sort((a, b) => (a === 'COP' ? -1 : b === 'COP' ? 1 : a.localeCompare(b)));
}

/**
 * Sumas del mes por tipo y categoría. Solo gastos e ingresos confirmados y no borrados: las
 * transferencias (incluido el pago de la tarjeta) no son gasto ni ingreso, y los ajustes corrigen saldos.
 */
export function summaryQuery(db: LocalDb, userId: string, month: string, currency: CurrencyCode) {
  const { from, to } = monthRange(month);
  return db
    .select({
      kind: transactions.kind,
      categoryId: transactions.categoryId,
      total: sum(transactions.amountMinor).mapWith(Number),
      count: count(),
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.occurredOn, from),
        lte(transactions.occurredOn, to),
        inArray(transactions.kind, ['expense', 'income']),
        eq(transactions.currency, currency),
        notDeleted(transactions),
        eq(transactions.reviewStatus, 'confirmed'),
      ),
    )
    .groupBy(transactions.kind, transactions.categoryId);
}

/** Resumen de un mes AAAA-MM en una moneda. Los reembolsos son ingresos (documento 02). */
export function monthlySummary(
  db: LocalDb,
  userId: string,
  month: string,
  currency: CurrencyCode,
): MonthSummary {
  const rows = summaryQuery(db, userId, month, currency).all();
  const byId = new Map(
    db
      .select()
      .from(categories)
      .all()
      .map((c) => [c.id, c]),
  );
  const group = (kind: 'expense' | 'income'): CategoryTotal[] => {
    const totals = new Map<string | null, CategoryTotal>();
    for (const row of rows.filter((r) => r.kind === kind)) {
      const sub = row.categoryId ? byId.get(row.categoryId) : undefined;
      const main = sub?.parentId ? byId.get(sub.parentId) : sub;
      const id = main?.id ?? null;
      const current = totals.get(id) ?? {
        id,
        name: main?.name ?? 'Sin categoría',
        icon: main?.icon ?? '🏷️',
        color: main?.color ?? 'gray',
        amountMinor: 0,
        count: 0,
      };
      current.amountMinor += Math.abs(row.total);
      current.count += row.count;
      totals.set(id, current);
    }
    return [...totals.values()].sort((a, b) => b.amountMinor - a.amountMinor);
  };
  const income = group('income');
  const expense = group('expense');
  const total = (list: CategoryTotal[], key: 'amountMinor' | 'count') =>
    list.reduce((acc, c) => acc + c[key], 0);
  return {
    incomeMinor: total(income, 'amountMinor'),
    expenseMinor: total(expense, 'amountMinor'),
    balanceMinor: total(income, 'amountMinor') - total(expense, 'amountMinor'),
    incomeCount: total(income, 'count'),
    expenseCount: total(expense, 'count'),
    income,
    expense,
  };
}
