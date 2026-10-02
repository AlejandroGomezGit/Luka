/** Reglas de las cuentas que crea o edita la persona (HU-02, CU-05, documento 02). */
import { ACCOUNT_TYPES, type AccountType } from './enums.js';
import { isCurrencyCode } from './money.js';
import { sameName } from './names.js';
import { isColorToken, isIconToken } from './tokens.js';

export const MAX_ACCOUNT_NAME = 40;

/** Lo que llena la persona; el monto inicial siempre en positivo (en la tarjeta de crédito, la deuda). */
export interface AccountInput {
  name: string;
  type: string;
  currency: string;
  openingAmountMinor: number;
  icon: string;
  color: string;
}

export type AccountInputError =
  | 'name_required'
  | 'name_too_long'
  | 'name_duplicate'
  | 'type_unknown'
  | 'currency_unknown'
  | 'amount_invalid'
  | 'icon_unknown'
  | 'color_unknown'
  /** INV-05: la moneda de una cuenta con movimientos no cambia. */
  | 'currency_locked';

export function checkAccountInput(
  input: AccountInput,
  { activeNames }: { activeNames: readonly string[] },
): AccountInputError[] {
  const errors: AccountInputError[] = [];
  const name = input.name.trim();
  if (name.length === 0) errors.push('name_required');
  else if (name.length > MAX_ACCOUNT_NAME) errors.push('name_too_long');
  else if (activeNames.some((active) => sameName(active, name))) errors.push('name_duplicate');
  if (!(ACCOUNT_TYPES as readonly string[]).includes(input.type)) errors.push('type_unknown');
  if (!isCurrencyCode(input.currency)) errors.push('currency_unknown');
  if (!Number.isSafeInteger(input.openingAmountMinor) || input.openingAmountMinor < 0) {
    errors.push('amount_invalid');
  }
  if (!isIconToken(input.icon)) errors.push('icon_unknown');
  if (!isColorToken(input.color)) errors.push('color_unknown');
  return errors;
}

/** Saldo inicial que se guarda: en la tarjeta de crédito la deuda es negativa (documento 02). */
export function openingBalanceFor(type: AccountType, amountMinor: number): number {
  return type === 'credit_card' && amountMinor !== 0 ? -amountMinor : amountMinor;
}

/** Monto que se muestra al editar: el inverso de openingBalanceFor. */
export function openingAmountFor(type: AccountType, openingBalanceMinor: number): number {
  return type === 'credit_card' && openingBalanceMinor !== 0
    ? -openingBalanceMinor
    : openingBalanceMinor;
}
