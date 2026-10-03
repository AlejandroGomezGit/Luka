/**
 * Único lugar que traduce un token de color de categoría a su valor. En modo claro son tonos oscuros y
 * en modo oscuro tonos claros: todos superan 3:1 contra el fondo y la tarjeta (WCAG 1.4.11, elementos
 * gráficos; lo comprueban las pruebas de paleta y de tema).
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

/**
 * Colores de la barra del resumen (HU-08), de la categoría más grande a «Otras categorías». Cada uno
 * tiene 3:1 o más con la tarjeta y se distingue del vecino también por luminosidad (pasos de 1,2:1 o
 * más), así que la barra no depende solo del tono. La lista usa el mismo color como pastilla.
 */
export const SERIES_COLORS: Record<Scheme, readonly string[]> = {
  light: ['#33247E', '#683508', '#105A4E', '#AB247E', '#1A74B4', '#A27C09', '#8D939E'],
  dark: ['#EFEDFA', '#F8D0AC', '#26D8BA', '#E78FCA', '#3D9EE3', '#A57E09', '#6D737F'],
};
