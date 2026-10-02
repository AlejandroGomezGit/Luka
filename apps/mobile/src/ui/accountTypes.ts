import type { AccountType, ColorToken, CurrencyCode, IconToken } from '@luka/domain';

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
export const ACCOUNT_DEFAULTS: Record<AccountType, { icon: IconToken; color: ColorToken }> = {
  cash: { icon: 'banknote', color: 'green' },
  savings: { icon: 'bank', color: 'teal' },
  checking: { icon: 'card', color: 'blue' },
  credit_card: { icon: 'card', color: 'red' },
  other: { icon: 'phone', color: 'purple' },
};

export const CURRENCY_LABELS: Record<CurrencyCode, string> = {
  COP: 'Peso colombiano (COP)',
  USD: 'Dólar (USD)',
  EUR: 'Euro (EUR)',
};
