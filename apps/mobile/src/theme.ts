import { useColorScheme } from 'react-native';

export type Scheme = 'light' | 'dark';

// Contraste AA o mejor (RNF-13) en ambos esquemas.
export const themeColors = {
  // surface: fondo de tarjetas y campos agrupados, con el mismo contraste para text, muted y accent.
  light: {
    background: '#FFFFFF',
    surface: '#F1F3F5',
    text: '#111827',
    muted: '#4B5563',
    accent: '#0F766E',
  },
  dark: {
    background: '#0B0F14',
    surface: '#1A2028',
    text: '#F3F4F6',
    muted: '#9CA3AF',
    accent: '#2DD4BF',
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
