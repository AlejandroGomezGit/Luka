/** Un gasto o ingreso que registra la persona (HU-03, CU-08): de lo escrito al movimiento nuevo. */
import { isLocalDate } from './dates.js';
import {
  checkNewTransaction,
  type InvariantId,
  type NewTransaction,
  type TransactionContext,
} from './invariants.js';
import { applySign } from './money.js';

export interface TransactionInput {
  kind: 'expense' | 'income';
  /** Lo que escribe la persona, siempre positivo; el tipo fija el signo (INV-01). */
  amountMinor: number;
  accountId: string;
  /** Opcional: un movimiento puede quedar sin categoría (documento 02). */
  categoryId: string | null;
  /** Fecha local AAAA-MM-DD. */
  occurredOn: string;
}

export type TransactionInputError =
  'amount_not_positive' | 'date_invalid' | 'date_in_future' | InvariantId;

export type BuildResult =
  { ok: true; transaction: NewTransaction } | { ok: false; errors: TransactionInputError[] };

/**
 * Arma el movimiento nuevo: el monto con el signo de su tipo, la moneda de su cuenta (INV-05) y las
 * invariantes INV-01 a INV-06. `today` es la fecha local de hoy, calculada con el reloj inyectado.
 */
export function buildTransaction(
  input: TransactionInput,
  ctx: TransactionContext,
  today: string,
): BuildResult {
  const errors: TransactionInputError[] = [];
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0)
    errors.push('amount_not_positive');
  if (!isLocalDate(input.occurredOn)) errors.push('date_invalid');
  // Las fechas AAAA-MM-DD se comparan bien como texto.
  else if (input.occurredOn > today) errors.push('date_in_future');
  if (errors.length > 0) return { ok: false, errors };

  const transaction: NewTransaction = {
    kind: input.kind,
    amountMinor: applySign(input.kind, input.amountMinor),
    toAmountMinor: null,
    accountId: input.accountId,
    toAccountId: null,
    currency: ctx.account.currency,
    categoryId: input.categoryId,
  };
  const violations = checkNewTransaction(transaction, ctx);
  return violations.length > 0 ? { ok: false, errors: violations } : { ok: true, transaction };
}
