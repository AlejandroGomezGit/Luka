import { isEmoji } from '@luka/domain';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { isAccessibilitySize, useTheme } from '../theme';
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
  const { colors, scheme, spacing } = useTheme();
  const { fontScale } = useWindowDimensions();
  // El círculo crece con Dynamic Type, igual que el texto.
  const size = Math.round(32 * fontScale);
  return (
    <View
      accessible
      accessibilityLabel={name}
      style={[isAccessibilitySize(fontScale) ? styles.column : styles.row, { gap: spacing.sm }]}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[
          styles.badge,
          // El color de la categoría al 20 % de opacidad, detrás del emoji.
          { width: size, height: size, backgroundColor: `${colorFor(color, scheme)}33` },
        ]}
      >
        <Text style={styles.emoji}>{isEmoji(icon) ? icon : FALLBACK_EMOJI}</Text>
      </View>
      <Text style={[styles.name, { color: colors.text }]}>{name}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  // Con tamaños de accesibilidad el ícono va arriba y el nombre usa todo el ancho.
  column: { flexDirection: 'column', alignItems: 'flex-start', flexShrink: 1 },
  badge: { borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 17 },
  name: { fontSize: 17, flexShrink: 1 },
});
