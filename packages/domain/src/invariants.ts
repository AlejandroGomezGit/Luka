/**
 * Invariantes INV-01 a INV-07 del documento 02. Cada función devuelve los ids violados (vacío = válido);
 * el id es estable y la API lo usa como `code` en problem+json.
 */
import type { CategoryKind, TransactionKind } from './enums.js';
import type { CurrencyCode } from './money.js';

export type InvariantId =
  'INV-01' | 'INV-02' | 'INV-03' | 'INV-04' | 'INV-05' | 'INV-06' | 'INV-07';

export interface AccountRef {
  id: string;
  currency: CurrencyCode;
  /** Milisegundos UTC, o null si la cuenta está activa. */
  archivedAt: number | null;
}

export interface CategoryRef {
  kind: CategoryKind;
  /** Clave de las categorías predefinidas; null si la creó la persona. */
  systemKey: string | null;
}

export interface NewTransaction {
  kind: TransactionKind;
  amountMinor: number;
  toAmountMinor: number | null;
  accountId: string;
  toAccountId: string | null;
  currency: CurrencyCode;
  categoryId: string | null;
}

/** Lo que el llamador ya leyó de la base: cuenta de origen, de destino y categoría, si las hay. */
export interface TransactionContext {
  account: AccountRef;
  toAccount: AccountRef | null;
  category: CategoryRef | null;
}

/** Valida un movimiento nuevo antes de guardarlo. */
export function checkNewTransaction(tx: NewTransaction, ctx: TransactionContext): InvariantId[] {
  const violations: InvariantId[] = [];
  const isTransfer = tx.kind === 'transfer';

  const amount = tx.amountMinor;
  const wrongSign =
    ((tx.kind === 'expense' || isTransfer) && amount > 0) || (tx.kind === 'income' && amount < 0);
  if (!Number.isSafeInteger(amount) || amount === 0 || wrongSign) violations.push('INV-01');

  const validDestination = isTransfer
    ? tx.toAccountId !== null &&
      tx.toAccountId !== tx.accountId &&
      tx.toAmountMinor !== null &&
      Number.isSafeInteger(tx.toAmountMinor) &&
      tx.toAmountMinor > 0
    : tx.toAccountId === null && tx.toAmountMinor === null;
  if (!validDestination) violations.push('INV-02');

  if (
    isTransfer &&
    ctx.toAccount?.currency === ctx.account.currency &&
    tx.toAmountMinor !== -amount
  ) {
    violations.push('INV-03');
  }

  const takesCategory = tx.kind === 'expense' || tx.kind === 'income';
  const wrongCategory = takesCategory
    ? ctx.category !== null && ctx.category.kind !== tx.kind
    : tx.categoryId !== null;
  if (wrongCategory) violations.push('INV-04');

  if (tx.currency !== ctx.account.currency) violations.push('INV-05');

  if (ctx.account.archivedAt !== null || (ctx.toAccount?.archivedAt ?? null) !== null) {
    violations.push('INV-06');
  }

  return violations;
}

/** INV-05: la moneda de una cuenta con movimientos no cambia. */
export function checkAccountCurrencyChange(
  from: CurrencyCode,
  to: CurrencyCode,
  hasTransactions: boolean,
): InvariantId[] {
  return from !== to && hasTransactions ? ['INV-05'] : [];
}

/** INV-07: las categorías predefinidas (con `system_key`) solo se renombran o se archivan. */
export function checkCategoryDelete(category: CategoryRef): InvariantId[] {
  return category.systemKey !== null ? ['INV-07'] : [];
}
