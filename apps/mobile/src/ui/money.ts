import { type AccountType, type CurrencyCode, formatMoney } from '@luka/domain';

/** Monto para un campo de texto, sin símbolo ni signo: «500.000» o «1.234,56». */
export const amountText = (minor: number, currency: CurrencyCode) =>
  formatMoney(Math.abs(minor), currency).replace(/^\S+ /, '');

/**
 * Saldo como lo lee la persona. En la tarjeta de crédito un saldo negativo es deuda («Debes $ X») y uno
 * positivo, plata a favor («A favor $ X»); en las demás cuentas el signo se muestra tal cual.
 */
export function balanceText(
  type: AccountType,
  balanceMinor: number,
  currency: CurrencyCode,
): string {
  if (type === 'credit_card' && balanceMinor < 0)
    return `Debes ${formatMoney(-balanceMinor, currency)}`;
  if (type === 'credit_card' && balanceMinor > 0)
    return `A favor ${formatMoney(balanceMinor, currency)}`;
  return formatMoney(balanceMinor, currency);
}
