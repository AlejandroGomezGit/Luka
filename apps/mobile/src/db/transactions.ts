/**
 * Movimientos: registrar un gasto, ingreso (HU-03, CU-08) o transferencia (CU-06), editarlos (HU-04,
 * CU-09) y las ayudas del formulario. Borrar y deshacer usan softDelete y restore de write.ts.
 */
import {
  type AccountRef,
  buildTransaction,
  type CategoryKind,
  editContext,
  type CurrencyCode,
  formatMoney,
  generalCategoryId,
  predefinedCategoryId,
  today,
  type TransactionContext,
  type TransactionInput,
  type TransactionInputError,
} from '@luka/domain';
import { categories, transactions } from '@luka/schema-sqlite';
import { and, count, desc, eq, isNotNull, isNull, max } from 'drizzle-orm';
import { type AccountRow, getAccount, listActiveAccounts } from './accounts';
import { getCategory } from './categories';
import type { LocalDb } from './types';
import { insertRow, notDeleted, updateRow, type WriteContext } from './write';

export type TransactionResult =
  { ok: true; id: string } | { ok: false; errors: TransactionInputError[] };

export type TransactionRow = typeof transactions.$inferSelect;

/** Lo que escribe la persona en el formulario: el movimiento con el monto en positivo y su nota. */
export type TransactionValues = TransactionInput & { note: string };

const accountRef = (account: AccountRow): AccountRef => ({
  id: account.id,
  currency: account.currency as CurrencyCode,
  archivedAt: account.archivedAt?.getTime() ?? null,
});

/** Lee de la base lo que las invariantes necesitan: cuentas de origen y destino, y categoría. */
function contextFor(
  db: LocalDb,
  input: TransactionInput,
): { ok: true; ctx: TransactionContext } | { ok: false; errors: TransactionInputError[] } {
  const account = getAccount(db, input.accountId);
  if (!account) return { ok: false, errors: ['INV-06'] };
  const toAccount = input.kind === 'transfer' ? getAccount(db, input.toAccountId) : undefined;
  if (input.kind === 'transfer' && !toAccount) return { ok: false, errors: ['INV-02'] };
  const categoryId = input.kind === 'transfer' ? null : input.categoryId;
  const category = categoryId ? getCategory(db, categoryId) : undefined;
  return {
    ok: true,
    ctx: {
      account: accountRef(account),
      toAccount: toAccount ? accountRef(toAccount) : null,
      category: category
        ? { kind: category.kind, systemKey: category.systemKey, parentId: category.parentId }
        : null,
    },
  };
}

const cleanNote = (note: string | undefined) => (note?.trim() ? note.trim() : null);

export function getTransaction(db: LocalDb, id: string): TransactionRow | undefined {
  return db.select().from(transactions).where(eq(transactions.id, id)).get();
}

/**
 * Guarda un movimiento escrito por la persona: origen manual, categoría puesta por la persona y
 * confirmado. «Hoy» sale del reloj inyectado en la zona horaria del dispositivo.
 */
export function createTransaction(
  ctx: WriteContext,
  input: TransactionInput & { note?: string },
  timeZone: string,
): TransactionResult {
  const read = contextFor(ctx.db, input);
  if (!read.ok) return read;
  const result = buildTransaction(input, read.ctx, today(ctx.clock, timeZone));
  if (!result.ok) return result;
  const id = insertRow(ctx, transactions, {
    ...result.transaction,
    occurredOn: input.occurredOn,
    note: cleanNote(input.note),
    categorySource: 'user',
    source: 'manual',
    reviewStatus: 'confirmed',
  });
  return { ok: true, id };
}

/**
 * Edita un movimiento (HU-04, CU-09) con las mismas reglas que al crearlo, salvo que puede seguir en una
 * cuenta que se archivó después (editContext, INV-06). Una transferencia sigue siendo transferencia y un
 * gasto o ingreso no se convierte en ella. `version` no cambia: queda pendiente para T-029.
 */
export function updateTransaction(
  ctx: WriteContext,
  id: string,
  input: TransactionInput & { note?: string },
  timeZone: string,
): TransactionResult {
  const existing = getTransaction(ctx.db, id);
  if (!existing || (existing.kind === 'transfer') !== (input.kind === 'transfer')) {
    throw new Error(
      'Solo se edita un movimiento existente, sin convertirlo en transferencia ni al revés',
    );
  }
  const read = contextFor(ctx.db, input);
  if (!read.ok) return read;
  const result = buildTransaction(
    input,
    editContext(read.ctx, { accountId: existing.accountId, toAccountId: existing.toAccountId }),
    today(ctx.clock, timeZone),
  );
  if (!result.ok) return result;
  updateRow(ctx, transactions, id, {
    ...result.transaction,
    occurredOn: input.occurredOn,
    note: cleanNote(input.note),
  });
  return { ok: true, id };
}

/** Valores del formulario para editar un movimiento: el monto en positivo, como lo escribe la persona. */
export function transactionValues(row: TransactionRow): TransactionValues {
  const base = {
    amountMinor: Math.abs(row.amountMinor),
    accountId: row.accountId,
    occurredOn: row.occurredOn,
    note: row.note ?? '',
  };
  return row.kind === 'transfer' && row.toAccountId
    ? { kind: 'transfer', ...base, toAccountId: row.toAccountId, toAmountMinor: row.toAmountMinor }
    : { kind: row.kind === 'income' ? 'income' : 'expense', ...base, categoryId: row.categoryId };
}

/** Un movimiento como lo muestra la lista: montos, cuentas, categoría y fecha. */
export interface TransactionListItem {
  id: string;
  kind: TransactionRow['kind'];
  amountMinor: number;
  currency: CurrencyCode;
  toAmountMinor: number | null;
  toCurrency: CurrencyCode | null;
  occurredOn: string;
  accountName: string;
  toAccountName: string | null;
  category: Pick<TopCategory, 'label' | 'accessibilityLabel' | 'icon' | 'color'> | null;
}

/**
 * «Recientes» en Inicio (HU-04): los últimos movimientos confirmados y no borrados, del más reciente al
 * más antiguo por fecha y, en el mismo día, por hora de registro.
 */
export function listRecentTransactions(
  db: LocalDb,
  userId: string,
  limit = 5,
): TransactionListItem[] {
  return db
    .select()
    .from(transactions)
    .where(and(notDeleted(transactions), eq(transactions.reviewStatus, 'confirmed')))
    .orderBy(desc(transactions.occurredOn), desc(transactions.createdAt))
    .limit(limit)
    .all()
    .map((row) => {
      const account = getAccount(db, row.accountId);
      const toAccount = row.toAccountId ? getAccount(db, row.toAccountId) : undefined;
      const sub = row.categoryId ? getCategory(db, row.categoryId) : undefined;
      const main = sub?.parentId ? getCategory(db, sub.parentId) : undefined;
      return {
        id: row.id,
        kind: row.kind,
        amountMinor: row.amountMinor,
        currency: row.currency as CurrencyCode,
        toAmountMinor: row.toAmountMinor,
        toCurrency: (toAccount?.currency ?? null) as CurrencyCode | null,
        occurredOn: row.occurredOn,
        accountName: account?.name ?? '',
        toAccountName: toAccount?.name ?? null,
        category:
          sub && main
            ? { ...categoryLabels(userId, sub, main), icon: sub.icon, color: sub.color }
            : null,
      };
    });
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

/**
 * Destino por defecto de una transferencia desde `fromId`: el de la última transferencia si sigue activo
 * y no es el origen; si no, la primera cuenta activa distinta del origen. Con una sola cuenta, ninguno.
 */
export function lastTransferDestination(db: LocalDb, fromId: string): string | null {
  const candidates = listActiveAccounts(db).filter((account) => account.id !== fromId);
  const latest = db
    .select({ toAccountId: transactions.toAccountId })
    .from(transactions)
    .where(and(eq(transactions.kind, 'transfer'), notDeleted(transactions)))
    .orderBy(desc(transactions.createdAt))
    .limit(1)
    .get();
  const used = candidates.find((account) => account.id === latest?.toAccountId);
  return used?.id ?? candidates[0]?.id ?? null;
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

/**
 * Aviso de una transferencia: «Transferencia guardada: $ 50.000 de Ahorro a Efectivo»; con otra moneda
 * agrega cuánto llega.
 */
export function transferSavedMessage(
  db: LocalDb,
  transfer: {
    accountId: string;
    toAccountId: string;
    amountMinor: number;
    toAmountMinor: number | null;
  },
): string {
  const from = getAccount(db, transfer.accountId);
  const to = getAccount(db, transfer.toAccountId);
  if (!from || !to) return 'Transferencia guardada';
  const sent = formatMoney(transfer.amountMinor, from.currency as CurrencyCode);
  const arrives =
    from.currency === to.currency || transfer.toAmountMinor === null
      ? ''
      : ` (llegan ${formatMoney(transfer.toAmountMinor, to.currency as CurrencyCode)})`;
  return `Transferencia guardada: ${sent} de ${from.name} a ${to.name}${arrives}`;
}
