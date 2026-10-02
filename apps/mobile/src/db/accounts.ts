/** Cuentas (HU-02, CU-05): crear, editar, archivar y saldo calculado (documento 02). */
import {
  type AccountInputError,
  type AccountType,
  checkAccountCurrencyChange,
  checkAccountInput,
  type CurrencyCode,
  openingAmountFor,
  openingBalanceFor,
  sameName,
} from '@luka/domain';
import { accounts, transactions } from '@luka/schema-sqlite';
import { and, asc, eq, getTableColumns, isNull, max, or, sql } from 'drizzle-orm';
import type { LocalDb } from './types';
import { insertRow, notDeleted, updateRow, type WriteContext } from './write';

/** Lo que llena la persona; el monto inicial siempre en positivo (en la tarjeta, la deuda). */
export interface AccountFormValues {
  name: string;
  type: AccountType;
  currency: CurrencyCode;
  openingAmountMinor: number;
  icon: string;
  color: string;
}

export type AccountRow = typeof accounts.$inferSelect;
export interface AccountWithBalance extends AccountRow {
  balanceMinor: number;
}
export type AccountResult = { ok: true; id: string } | { ok: false; errors: AccountInputError[] };

/**
 * Saldo = inicial + sus montos + lo que recibe por transferencias, sin movimientos eliminados ni por
 * revisar (INV-09). Se calcula al leer, con los índices de account_id y to_account_id; no hay caché
 * hasta que la prueba de 10 000 movimientos (HU-05) lo pida.
 */
// Nombres de tabla explícitos: en una consulta de una sola tabla Drizzle escribe las columnas sin
// calificar y la subconsulta compararía la transacción consigo misma ("account_id" = "id").
const balance = sql<number>`"accounts"."opening_balance_minor"
  + coalesce((select sum(t.amount_minor) from transactions t
      where t.account_id = "accounts"."id" and t.deleted_at is null
        and t.review_status = 'confirmed'), 0)
  + coalesce((select sum(t.to_amount_minor) from transactions t
      where t.to_account_id = "accounts"."id" and t.deleted_at is null
        and t.review_status = 'confirmed'), 0)`.mapWith(Number);

export function getAccount(db: LocalDb, id: string): AccountRow | undefined {
  return db.select().from(accounts).where(eq(accounts.id, id)).get();
}

/** Cuentas con su saldo, en el orden de sort_order. */
export function listAccounts(
  db: LocalDb,
  { includeArchived }: { includeArchived: boolean },
): AccountWithBalance[] {
  return db
    .select({ ...getTableColumns(accounts), balanceMinor: balance })
    .from(accounts)
    .where(and(notDeleted(accounts), includeArchived ? undefined : isNull(accounts.archivedAt)))
    .orderBy(asc(accounts.sortOrder))
    .all();
}

/** Las cuentas que se ofrecen para movimientos nuevos: nunca las archivadas (INV-06). */
export function listActiveAccounts(db: LocalDb): AccountWithBalance[] {
  return listAccounts(db, { includeArchived: false });
}

/** Nombres de las cuentas activas; los nombres solo son únicos entre ellas. */
function activeNames(db: LocalDb, exceptId?: string): string[] {
  return listActiveAccounts(db)
    .filter((account) => account.id !== exceptId)
    .map((account) => account.name);
}

function hasTransactions(db: LocalDb, id: string): boolean {
  return (
    db
      .select({ id: transactions.id })
      .from(transactions)
      .where(or(eq(transactions.accountId, id), eq(transactions.toAccountId, id)))
      .limit(1)
      .get() !== undefined
  );
}

const stored = (values: AccountFormValues) => ({
  name: values.name.trim(),
  type: values.type,
  currency: values.currency,
  openingBalanceMinor: openingBalanceFor(values.type, values.openingAmountMinor),
  icon: values.icon,
  color: values.color,
});

/** Crea una cuenta al final de la lista (sort_order = máximo + 1). */
export function createAccount(ctx: WriteContext, values: AccountFormValues): AccountResult {
  const errors = checkAccountInput(values, { activeNames: activeNames(ctx.db) });
  if (errors.length > 0) return { ok: false, errors };
  const last = ctx.db
    .select({ value: max(accounts.sortOrder) })
    .from(accounts)
    .get()?.value;
  const id = insertRow(ctx, accounts, { ...stored(values), sortOrder: (last ?? -1) + 1 });
  return { ok: true, id };
}

/** Edita una cuenta. El saldo inicial se puede corregir; la moneda no, si ya tiene movimientos (INV-05). */
export function updateAccount(
  ctx: WriteContext,
  id: string,
  values: AccountFormValues,
): AccountResult {
  const current = getAccount(ctx.db, id);
  if (!current) return { ok: false, errors: ['name_required'] };
  // Una archivada puede repetir el nombre de una activa; se revisa al desarchivar.
  const names = current.archivedAt ? [] : activeNames(ctx.db, id);
  const errors = checkAccountInput(values, { activeNames: names });
  const locked = checkAccountCurrencyChange(
    current.currency as CurrencyCode,
    values.currency,
    hasTransactions(ctx.db, id),
  );
  if (locked.length > 0) errors.push('currency_locked');
  if (errors.length > 0) return { ok: false, errors };
  updateRow(ctx, accounts, id, stored(values));
  return { ok: true, id };
}

/**
 * Archiva o desarchiva. Una cuenta archivada conserva su historial y su saldo. Para desarchivar, su
 * nombre no puede estar en uso por una cuenta activa: hay que renombrarla primero.
 */
export function setAccountArchived(
  ctx: WriteContext,
  id: string,
  archived: boolean,
): AccountResult {
  const current = getAccount(ctx.db, id);
  if (!current) return { ok: false, errors: ['name_required'] };
  if (!archived && activeNames(ctx.db, id).some((name) => sameName(name, current.name))) {
    return { ok: false, errors: ['name_duplicate'] };
  }
  updateRow(ctx, accounts, id, { archivedAt: archived ? new Date(ctx.clock.now()) : null });
  return { ok: true, id };
}

/** Valores para editar una cuenta guardada: en la tarjeta de crédito, la deuda en positivo. */
export function accountFormValues(account: AccountRow): AccountFormValues {
  const type = account.type;
  return {
    name: account.name,
    type,
    currency: account.currency as CurrencyCode,
    openingAmountMinor: openingAmountFor(type, account.openingBalanceMinor),
    icon: account.icon,
    color: account.color,
  };
}
