import { useColorScheme } from 'react-native';

// Contraste AA o mejor (RNF-13) en ambos esquemas.
const palette = {
  light: { background: '#FFFFFF', text: '#111827', muted: '#4B5563', accent: '#0F766E' },
  dark: { background: '#0B0F14', text: '#F3F4F6', muted: '#9CA3AF', accent: '#2DD4BF' },
} as const;

export const spacing = { sm: 8, md: 16, lg: 24 } as const;

/** Tema según el modo claro u oscuro del sistema. */
export function useTheme() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return { colors: palette[scheme], spacing };
}
