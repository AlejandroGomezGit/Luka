/**
 * Un gasto, ingreso o transferencia que registra la persona (HU-03, CU-08, CU-06): de lo escrito al
 * movimiento nuevo.
 */
import { isLocalDate } from './dates.js';
import {
  checkNewTransaction,
  type InvariantId,
  type NewTransaction,
  type TransactionContext,
} from './invariants.js';
import { applySign } from './money.js';

interface InputBase {
  /** Lo que escribe la persona, siempre positivo; el tipo fija el signo (INV-01). */
  amountMinor: number;
  /** Cuenta del gasto o del ingreso; en una transferencia, la de origen. */
  accountId: string;
  /** Fecha local AAAA-MM-DD. */
  occurredOn: string;
}

export type TransactionInput =
  | (InputBase & {
      kind: 'expense' | 'income';
      /** Opcional: un movimiento puede quedar sin categoría (documento 02). */
      categoryId: string | null;
    })
  | (InputBase & {
      kind: 'transfer';
      toAccountId: string;
      /**
       * Lo que llega, en la moneda del destino. Solo cuenta con monedas distintas; con la misma
       * moneda llega exactamente lo que sale (INV-03).
       */
      toAmountMinor: number | null;
    });

export type TransactionInputError =
  | 'amount_not_positive'
  | 'to_amount_not_positive'
  | 'date_invalid'
  | 'date_in_future'
  | InvariantId;

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
  const transfer = input.kind === 'transfer' ? input : null;
  const sameCurrency = ctx.toAccount?.currency === ctx.account.currency;
  const toAmountMinor = transfer && (sameCurrency ? input.amountMinor : transfer.toAmountMinor);
  if (
    transfer &&
    !sameCurrency &&
    (toAmountMinor === null || !Number.isSafeInteger(toAmountMinor) || toAmountMinor <= 0)
  )
    errors.push('to_amount_not_positive');
  if (!isLocalDate(input.occurredOn)) errors.push('date_invalid');
  // Las fechas AAAA-MM-DD se comparan bien como texto.
  else if (input.occurredOn > today) errors.push('date_in_future');
  if (errors.length > 0) return { ok: false, errors };

  const transaction: NewTransaction = {
    kind: input.kind,
    amountMinor: applySign(input.kind, input.amountMinor),
    toAmountMinor,
    accountId: input.accountId,
    toAccountId: transfer?.toAccountId ?? null,
    currency: ctx.account.currency,
    categoryId: input.kind === 'transfer' ? null : input.categoryId,
  };
  const violations = checkNewTransaction(transaction, ctx);
  return violations.length > 0 ? { ok: false, errors: violations } : { ok: true, transaction };
}
