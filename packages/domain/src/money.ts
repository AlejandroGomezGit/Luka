import type { TransactionKind } from './enums.js';

/**
 * Dinero (RNF-06, ADR-007): enteros en la unidad menor con código ISO 4217, nunca decimales flotantes.
 * Los montos son `number` enteros; `Number.isSafeInteger` es la guarda (hasta 9 × 10^15 de unidad menor).
 */

/** Decimales de la unidad menor según ISO 4217. */
// ponytail: solo las monedas del MVP; se agrega una línea por moneda cuando haga falta.
export const MINOR_UNITS = { COP: 2, USD: 2, EUR: 2 } as const;

export type CurrencyCode = keyof typeof MINOR_UNITS;

export function isCurrencyCode(code: string): code is CurrencyCode {
  return Object.hasOwn(MINOR_UNITS, code);
}

// Miles con punto y decimales con coma, como se escribe en Colombia: "12.500", "1.234,56", "12500".
const AMOUNT = /^\$?\s*(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d+))?$/;

/**
 * Convierte un monto positivo escrito por la persona a entero en la unidad menor, solo con
 * operaciones de texto. Devuelve null si no es un monto, si tiene más decimales que la moneda o si
 * no cabe en un entero seguro.
 */
export function parseAmount(text: string, currency: CurrencyCode): number | null {
  const match = AMOUNT.exec(text.trim());
  if (!match) return null;
  const [, integer = '', fraction = ''] = match;
  const digits = MINOR_UNITS[currency];
  if (fraction.length > digits) return null;
  const minor = Number(integer.replaceAll('.', '') + fraction.padEnd(digits, '0'));
  return Number.isSafeInteger(minor) ? minor : null;
}

/** INV-01: la persona escribe un número positivo y el tipo fija el signo; un ajuste conserva el suyo. */
export function applySign(kind: TransactionKind, amountMinor: number): number {
  if (kind === 'adjustment') return amountMinor;
  const absolute = Math.abs(amountMinor);
  return kind === 'income' ? absolute : -absolute;
}
