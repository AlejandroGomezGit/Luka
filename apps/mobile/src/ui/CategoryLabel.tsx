import { isEmoji } from '@luka/domain';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { isAccessibilitySize, typography, useTheme } from '../theme';
import { colorFor } from './palette';

interface Props {
  name: string;
  /** Emoji guardado en la base. */
  icon: string;
  /** Token de color guardado en la base. */
  color: string;
}

/** Para íconos que no son emoji, como los tokens de datos de prueba antiguos. */
export const FALLBACK_EMOJI = '🏷️';

/** Una categoría o cuenta con su emoji sobre su color y su nombre; VoiceOver lee solo el nombre. */
export function CategoryLabel({ name, icon, color }: Props) {
  const { colors, spacing } = useTheme();
  const { fontScale } = useWindowDimensions();
  return (
    <View
      accessible
      accessibilityLabel={name}
      style={[isAccessibilitySize(fontScale) ? styles.column : styles.row, { gap: spacing.sm }]}
    >
      <IconBadge icon={icon} color={color} />
      <Text style={[styles.name, { color: colors.text }]}>{name}</Text>
    </View>
  );
}

/** El emoji sobre su color al 20 %, en un círculo que crece con Dynamic Type; VoiceOver no lo anuncia. */
export function IconBadge({ icon, color }: { icon: string; color: string }) {
  const { scheme } = useTheme();
  const { fontScale } = useWindowDimensions();
  const size = Math.round(32 * fontScale);
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.badge,
        { width: size, height: size, backgroundColor: `${colorFor(color, scheme)}33` },
      ]}
    >
      <Text style={styles.emoji}>{isEmoji(icon) ? icon : FALLBACK_EMOJI}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  // Con tamaños de accesibilidad el ícono va arriba y el nombre usa todo el ancho.
  column: { flexDirection: 'column', alignItems: 'flex-start', flexShrink: 1 },
  badge: { borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  emoji: typography.body,
  name: { ...typography.body, flexShrink: 1 },
});
