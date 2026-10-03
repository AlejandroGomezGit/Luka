/** Resumen mensual (HU-08): meses, porcentajes y agrupación de categorías. */
import { addDays, localDateFromParts } from './dates.js';

/** Mes AAAA-MM de una fecha local AAAA-MM-DD. */
export const monthOf = (date: string): string => date.slice(0, 7);

/** Primer y último día del mes, extremos incluidos. */
export function monthRange(month: string): { from: string; to: string } {
  const [year, index] = month.split('-').map(Number) as [number, number];
  const next = new Date(Date.UTC(year, index, 1));
  const from = `${month}-01`;
  const to = addDays(localDateFromParts(next.getUTCFullYear(), next.getUTCMonth(), 1), -1);
  return { from, to };
}

/** El mes `months` antes (negativo) o después. */
export function shiftMonth(month: string, months: number): string {
  const [year, index] = month.split('-').map(Number) as [number, number];
  const date = new Date(Date.UTC(year, index - 1 + months, 1));
  return localDateFromParts(date.getUTCFullYear(), date.getUTCMonth(), 1).slice(0, 7);
}

/**
 * Porcentajes enteros que suman exactamente 100 (método del mayor resto): se redondea hacia abajo y los
 * puntos que faltan van a los de mayor parte decimal. Si todo es cero, todo es 0.
 */
export function percentages(values: readonly number[]): number[] {
  const total = values.reduce((sum, v) => sum + v, 0);
  if (total <= 0) return values.map(() => 0);
  const exact = values.map((v) => (v * 100) / total);
  const result = exact.map(Math.floor);
  const missing = 100 - result.reduce((sum, v) => sum + v, 0);
  exact
    .map((v, i) => ({ i, remainder: v - Math.floor(v) }))
    .sort((a, b) => b.remainder - a.remainder || a.i - b.i)
    .slice(0, missing)
    .forEach(({ i }) => {
      result[i] = (result[i] ?? 0) + 1;
    });
  return result;
}

/** Las `n` mayores (de mayor a menor) y el resto sumado, o null si no sobra ninguna. */
export function topWithRest<T extends { amountMinor: number }>(
  items: readonly T[],
  n: number,
): { top: T[]; rest: { count: number; amountMinor: number } | null } {
  const sorted = [...items].sort((a, b) => b.amountMinor - a.amountMinor);
  const others = sorted.slice(n);
  return {
    top: sorted.slice(0, n),
    rest:
      others.length > 0
        ? { count: others.length, amountMinor: others.reduce((sum, i) => sum + i.amountMinor, 0) }
        : null,
  };
}
