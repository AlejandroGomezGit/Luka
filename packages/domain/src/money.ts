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

/**
 * Decimales que la persona escribe y ve: COP en pesos enteros (aunque la unidad menor tenga centavos);
 * USD y EUR con centavos.
 */
export const INPUT_DECIMALS: Record<CurrencyCode, number> = { COP: 0, USD: 2, EUR: 2 };

const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = { COP: '$', USD: 'US$', EUR: '€' };

/**
 * Convierte un monto positivo escrito por la persona a entero en la unidad menor, solo con operaciones
 * de texto. Punto y coma valen igual: un separador seguido de exactamente 3 dígitos agrupa miles; en una
 * moneda con decimales, el último separador seguido de 1 o 2 dígitos es el decimal. Devuelve null si no
 * es un monto, si los miles están mal agrupados o si no cabe en un entero seguro.
 */
export function parseAmount(text: string, currency: CurrencyCode): number | null {
  const clean = text.trim().replace(/^(US\$|€|\$)\s*/, '');
  if (!/^\d+([.,]\d+)*$/.test(clean)) return null;
  let groups = clean.split(/[.,]/);
  let fraction = '';
  const last = groups.at(-1) ?? '';
  if (groups.length > 1 && last.length <= INPUT_DECIMALS[currency]) {
    fraction = last;
    groups = groups.slice(0, -1);
  }
  const [first = '', ...rest] = groups;
  if (rest.length > 0 && (first.length > 3 || rest.some((group) => group.length !== 3)))
    return null;
  const minor = Number(groups.join('') + fraction.padEnd(MINOR_UNITS[currency], '0'));
  return Number.isSafeInteger(minor) ? minor : null;
}

/**
 * Formato colombiano: símbolo, punto de miles y coma decimal. COP se muestra en pesos y solo enseña los
 * centavos si los hay; USD y EUR siempre con dos decimales. Sin Intl, para que sea igual en Hermes y Node.
 */
export function formatMoney(minor: number, currency: CurrencyCode): string {
  const unit = 10 ** MINOR_UNITS[currency];
  const absolute = Math.abs(minor);
  const integer = String(Math.floor(absolute / unit)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const cents = absolute % unit;
  const showCents = INPUT_DECIMALS[currency] > 0 || cents !== 0;
  const decimals = showCents ? `,${String(cents).padStart(MINOR_UNITS[currency], '0')}` : '';
  return `${minor < 0 ? '-' : ''}${CURRENCY_SYMBOLS[currency]} ${integer}${decimals}`;
}

/** INV-01: la persona escribe un número positivo y el tipo fija el signo; un ajuste conserva el suyo. */
export function applySign(kind: TransactionKind, amountMinor: number): number {
  if (kind === 'adjustment') return amountMinor;
  const absolute = Math.abs(amountMinor);
  return kind === 'income' ? absolute : -absolute;
}

const groupThousands = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const withoutLeadingZeros = (digits: string) => digits.replace(/^0+(?=\d)/, '');

/**
 * Da formato a un monto mientras se escribe: la persona solo escribe dígitos y los puntos de miles se
 * ponen solos. En COP se ignora cualquier separador; en USD y EUR la coma, o un punto recién escrito al
 * final, abre los decimales (máximo 2) y se muestra como coma. El resultado lo lee parseAmount.
 */
export function formatAmountInput(text: string, currency: CurrencyCode): string {
  let decimalAt = INPUT_DECIMALS[currency] > 0 ? text.indexOf(',') : -1;
  if (decimalAt < 0 && INPUT_DECIMALS[currency] > 0 && text.endsWith('.'))
    decimalAt = text.length - 1;
  const integerPart = decimalAt < 0 ? text : text.slice(0, decimalAt);
  const integer = withoutLeadingZeros(integerPart.replace(/\D/g, ''));
  if (decimalAt < 0) return groupThousands(integer);
  const fraction = text
    .slice(decimalAt + 1)
    .replace(/\D/g, '')
    .slice(0, INPUT_DECIMALS[currency]);
  return `${groupThousands(integer || '0')},${fraction}`;
}
