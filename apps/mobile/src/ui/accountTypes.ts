import type { AccountType, ColorToken, CurrencyCode } from '@luka/domain';

/** Nombres en español de los tipos de cuenta (claves del esquema, documento 02). */
export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  cash: 'Efectivo',
  savings: 'Cuenta de ahorros',
  checking: 'Cuenta corriente',
  credit_card: 'Tarjeta de crédito',
  other: 'Otra',
};

/** Orden en el formulario y ayudas visibles. */
export const ACCOUNT_TYPE_ORDER: readonly AccountType[] = [
  'cash',
  'savings',
  'checking',
  'credit_card',
  'other',
];
export const ACCOUNT_TYPE_HINTS: Partial<Record<AccountType, string>> = {
  other: 'Nequi, Daviplata…',
};

/** Ícono y color con los que nace una cuenta según su tipo; se pueden cambiar. */
export const ACCOUNT_DEFAULTS: Record<AccountType, { icon: string; color: ColorToken }> = {
  cash: { icon: '💵', color: 'green' },
  savings: { icon: '🐷', color: 'teal' },
  checking: { icon: '🏦', color: 'blue' },
  credit_card: { icon: '💳', color: 'red' },
  other: { icon: '📱', color: 'purple' },
};

export const CURRENCY_LABELS: Record<CurrencyCode, string> = {
  COP: 'Peso colombiano (COP)',
  USD: 'Dólar (USD)',
  EUR: 'Euro (EUR)',
};
