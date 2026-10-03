import { useColorScheme } from 'react-native';

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
  },
} as const;

export const spacing = { sm: 8, md: 16, lg: 24 } as const;

/**
 * Tamaños de accesibilidad de Dynamic Type (desde AX1, escala de 1,6 o más): Apple recomienda pasar de
 * filas a columnas para que el texto no se parta a mitad de palabra.
 */
export const isAccessibilitySize = (fontScale: number) => fontScale >= 1.6;

/** Tema según el modo claro u oscuro del sistema. */
export function useTheme() {
  const scheme: Scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return { scheme, colors: themeColors[scheme], spacing };
}
