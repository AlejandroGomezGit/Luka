import { type TextStyle, useColorScheme } from 'react-native';

export type Scheme = 'light' | 'dark';

/**
 * Colores de la base de diseño (T-044, maquetas en docs/diseno/); en oscuro, los del sistema de iOS.
 * Contraste verificado en __tests__/theme.test.ts (RNF-13):
 * - text, muted (texto secundario), accentText (enlaces y texto pequeño) y alert: 4,5:1 sobre el fondo
 *   y la tarjeta.
 * - accent: botones y rellenos, 3:1 con el fondo; onAccent es el texto encima, 4,5:1.
 */
export const themeColors = {
  light: {
    background: '#F2F2F7',
    card: '#FFFFFF',
    text: '#1C1C1E',
    muted: '#6C6C70',
    accent: '#0E7C66',
    accentText: '#0B6350',
    onAccent: '#FFFFFF',
    alert: '#B3261E',
    separator: '#C6C6C8',
    // Franja de controles segmentados (como tertiarySystemFill de iOS).
    fill: '#E3E3E8',
    // Velo detrás de una hoja inferior.
    scrim: '#00000066',
  },
  dark: {
    background: '#000000',
    card: '#1C1C1E',
    text: '#FFFFFF',
    muted: '#AEAEB2',
    accent: '#3DD6B5',
    accentText: '#3DD6B5',
    onAccent: '#000000',
    alert: '#FF8A80',
    separator: '#38383A',
    fill: '#2C2C2E',
    scrim: '#000000A6',
  },
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24 } as const;

/** Radios: tarjetas agrupadas, controles (campos, segmentos) y píldoras (chips, botones). */
export const radius = { card: 20, control: 12, pill: 999 } as const;

/**
 * Tamaños mínimos, nunca fijos, para que crezcan con Dynamic Type: área táctil de 44 pt (Apple) y filas
 * de lista de 58 pt como en las maquetas; el círculo del ícono mide 32 pt antes de Dynamic Type.
 */
export const sizes = { touch: 44, row: 58, badge: 32 } as const;

/** Escala tipográfica de iOS; el tamaño de Dynamic Type se aplica encima (allowFontScaling). */
export const typography = {
  largeTitle: { fontSize: 34, fontWeight: '700' },
  title: { fontSize: 22, fontWeight: '700' },
  headline: { fontSize: 17, fontWeight: '600' },
  body: { fontSize: 17 },
  subhead: { fontSize: 15 },
  footnote: { fontSize: 13 },
  amount: { fontSize: 48, fontWeight: '700' },
} as const satisfies Record<string, TextStyle>;

/**
 * Cuánto pueden crecer los títulos con Dynamic Type (maxFontSizeMultiplier): con AX5 un título de 34 pt
 * pasaría de 100 pt y partiría palabras como «Administrar». iOS también limita sus títulos grandes y los
 * botones de la barra superior (`bar`); con más, «Guardar» se escondía en el menú «…».
 */
export const headingScale = { largeTitle: 1.5, title: 2, bar: 1.5 } as const;

/**
 * Tamaños de accesibilidad de Dynamic Type (desde AX1, escala de 1,6 o más): Apple recomienda pasar de
 * filas a columnas para que el texto no se parta a mitad de palabra.
 */
export const isAccessibilitySize = (fontScale: number) => fontScale >= 1.6;

/** Tema según el modo claro u oscuro del sistema. */
export function useTheme() {
  const scheme: Scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return { scheme, colors: themeColors[scheme], spacing, radius, sizes, typography };
}
