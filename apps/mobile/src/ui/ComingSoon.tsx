import { Text } from 'react-native';
import { useTheme } from '../theme';
import { Screen } from './Screen';

/** Marcador de posición de una pestaña que llega en un issue posterior. */
export function ComingSoon({ title, detail }: { title: string; detail: string }) {
  const { colors, spacing, typography } = useTheme();
  return (
    <Screen contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}>
      <Text accessibilityRole="header" style={[typography.largeTitle, { color: colors.text }]}>
        {title}
      </Text>
      <Text style={[typography.headline, { color: colors.text }]}>Disponible pronto</Text>
      <Text style={[typography.body, { color: colors.muted }]}>{detail}</Text>
    </Screen>
  );
}
