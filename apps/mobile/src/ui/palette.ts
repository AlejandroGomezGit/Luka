/**
 * Único lugar que traduce un token de color de categoría a su valor. En modo claro son tonos oscuros y
 * en modo oscuro tonos claros: todos superan 4,5:1 contra el fondo (lo comprueba la prueba de paleta).
 * El color acompaña al ícono y al nombre; nunca es la única forma de distinguir una categoría.
 */
import type { ColorToken } from '@luka/domain';
import { themeColors, type Scheme } from '../theme';

export const CATEGORY_COLORS: Record<ColorToken, Record<Scheme, string>> = {
  red: { light: '#DC2626', dark: '#F87171' },
  orange: { light: '#C2410C', dark: '#FB923C' },
  amber: { light: '#B45309', dark: '#FBBF24' },
  green: { light: '#15803D', dark: '#4ADE80' },
  teal: { light: '#0F766E', dark: '#2DD4BF' },
  cyan: { light: '#0E7490', dark: '#22D3EE' },
  blue: { light: '#2563EB', dark: '#60A5FA' },
  indigo: { light: '#4F46E5', dark: '#818CF8' },
  purple: { light: '#9333EA', dark: '#C084FC' },
  pink: { light: '#DB2777', dark: '#F472B6' },
  brown: { light: '#92400E', dark: '#D6A77A' },
  gray: { light: '#4B5563', dark: '#9CA3AF' },
};

export function colorFor(token: string, scheme: Scheme): string {
  return Object.hasOwn(CATEGORY_COLORS, token)
    ? CATEGORY_COLORS[token as ColorToken][scheme]
    : themeColors[scheme].muted;
}
