/** Movimientos: registrar un gasto o ingreso (HU-03, CU-08) y las ayudas del formulario. */
import {
  buildTransaction,
  type CategoryKind,
  generalCategoryId,
  predefinedCategoryId,
  today,
  type TransactionInput,
  type TransactionInputError,
} from '@luka/domain';
import { categories, transactions } from '@luka/schema-sqlite';
import { and, count, desc, eq, isNotNull, isNull, max } from 'drizzle-orm';
import { getAccount, listActiveAccounts } from './accounts';
import { getCategory } from './categories';
import type { LocalDb } from './types';
import { insertRow, notDeleted, type WriteContext } from './write';

export type TransactionResult =
  { ok: true; id: string } | { ok: false; errors: TransactionInputError[] };

/**
 * Guarda un movimiento escrito por la persona: origen manual, categoría puesta por la persona y
 * confirmado. «Hoy» sale del reloj inyectado en la zona horaria del dispositivo.
 */
export function createTransaction(
  ctx: WriteContext,
  input: TransactionInput & { note?: string },
  timeZone: string,
): TransactionResult {
  const account = getAccount(ctx.db, input.accountId);
  if (!account) return { ok: false, errors: ['INV-06'] };
  const category = input.categoryId ? getCategory(ctx.db, input.categoryId) : undefined;
  const result = buildTransaction(
    input,
    {
      account: {
        id: account.id,
        currency: account.currency as 'COP',
        archivedAt: account.archivedAt?.getTime() ?? null,
      },
      toAccount: null,
      category: category
        ? { kind: category.kind, systemKey: category.systemKey, parentId: category.parentId }
        : null,
    },
    today(ctx.clock, timeZone),
  );
  if (!result.ok) return result;
  const id = insertRow(ctx, transactions, {
    ...result.transaction,
    occurredOn: input.occurredOn,
    note: input.note?.trim() ? input.note.trim() : null,
    categorySource: 'user',
    source: 'manual',
    reviewStatus: 'confirmed',
  });
  return { ok: true, id };
}

/** La cuenta del movimiento más reciente; si está archivada o no hay movimientos, la primera activa. */
export function lastUsedAccountId(db: LocalDb): string | null {
  const active = listActiveAccounts(db);
  const latest = db
    .select({ accountId: transactions.accountId })
    .from(transactions)
    .where(notDeleted(transactions))
    .orderBy(desc(transactions.createdAt))
    .limit(1)
    .get();
  const used = active.find((account) => account.id === latest?.accountId);
  return used?.id ?? active[0]?.id ?? null;
}

export interface TopCategory {
  id: string;
  /** Lo que se ve: la subcategoría, o la principal si es su «General». */
  label: string;
  /** Lo que lee VoiceOver: «Supermercado, Alimentación»; solo la principal si es su «General». */
  accessibilityLabel: string;
  icon: string;
  color: string;
}

/** Sugerencias cuando aún no hay historial, en este orden. */
const SUGGESTED: Record<CategoryKind, readonly string[]> = {
  expense: [
    'food.groceries',
    'food.restaurants',
    'transport.public_transit',
    'transport.taxi_apps',
    'food.delivery',
    'utilities.electricity',
  ],
  income: [
    'salary.other',
    'freelance.other',
    'business.other',
    'investment_income.other',
    'refunds.other',
    'other_income.other',
  ],
};

/** Nombre y lectura de una subcategoría junto a su principal. */
export function categoryLabels(
  userId: string,
  sub: { id: string; name: string },
  main: { id: string; name: string; systemKey: string | null },
): { label: string; accessibilityLabel: string } {
  return sub.id === generalCategoryId(userId, main)
    ? { label: main.name, accessibilityLabel: main.name }
    : { label: sub.name, accessibilityLabel: `${sub.name}, ${main.name}` };
}

/**
 * Las seis subcategorías más usadas de un tipo: por número de movimientos confirmados, desempate por
 * el uso más reciente y luego por la lista fija de sugerencias, que también completa las que falten.
 * Nunca ofrece archivadas ni subcategorías de una principal archivada.
 */
export function topCategories(db: LocalDb, userId: string, kind: CategoryKind): TopCategory[] {
  const usage = new Map(
    db
      .select({ id: transactions.categoryId, uses: count(), lastUsed: max(transactions.createdAt) })
      .from(transactions)
      .where(
        and(
          notDeleted(transactions),
          eq(transactions.reviewStatus, 'confirmed'),
          isNotNull(transactions.categoryId),
        ),
      )
      .groupBy(transactions.categoryId)
      .all()
      .map((row) => [row.id, { uses: row.uses, lastUsed: row.lastUsed?.getTime() ?? 0 }]),
  );
  const rows = db
    .select()
    .from(categories)
    .where(and(eq(categories.kind, kind), notDeleted(categories), isNull(categories.archivedAt)))
    .all();
  const mains = new Map(rows.filter((row) => row.parentId === null).map((row) => [row.id, row]));
  const suggested = SUGGESTED[kind].map((key) => predefinedCategoryId(userId, key));
  const rank = (id: string) => {
    const index = suggested.indexOf(id);
    return index < 0 ? Number.POSITIVE_INFINITY : index;
  };

  return rows
    .filter((row) => row.parentId !== null && mains.has(row.parentId))
    .map((row) => ({ row, ...(usage.get(row.id) ?? { uses: 0, lastUsed: 0 }) }))
    .filter(({ row, uses }) => uses > 0 || rank(row.id) < Number.POSITIVE_INFINITY)
    .sort((a, b) => b.uses - a.uses || b.lastUsed - a.lastUsed || rank(a.row.id) - rank(b.row.id))
    .slice(0, 6)
    .map(({ row }) => {
      const main = mains.get(row.parentId ?? '');
      const labels = main
        ? categoryLabels(userId, row, main)
        : { label: row.name, accessibilityLabel: row.name };
      return { id: row.id, ...labels, icon: row.icon, color: row.color };
    });
}

/** Texto del aviso de guardado: «Gasto guardado: $ 12.500 en Supermercado». */
export function savedMessage(
  db: LocalDb,
  userId: string,
  kind: CategoryKind,
  amount: string,
  categoryId: string | null,
) {
  const sub = categoryId ? getCategory(db, categoryId) : undefined;
  const main = sub?.parentId ? getCategory(db, sub.parentId) : undefined;
  const where = sub && main ? ` en ${categoryLabels(userId, sub, main).label}` : '';
  return `${kind === 'expense' ? 'Gasto' : 'Ingreso'} guardado: ${amount}${where}`;
}
