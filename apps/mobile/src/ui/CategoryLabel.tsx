import { SymbolView } from 'expo-symbols';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { isAccessibilitySize, useTheme } from '../theme';
import { colorFor } from './palette';
import { symbolFor } from './symbols';

interface Props {
  name: string;
  /** Token de ícono guardado en la base. */
  icon: string;
  /** Token de color guardado en la base. */
  color: string;
}

/** Una categoría siempre con ícono y nombre (RNF-13); VoiceOver lee solo el nombre. */
export function CategoryLabel({ name, icon, color }: Props) {
  const { colors, scheme, spacing } = useTheme();
  // El ícono crece con Dynamic Type, igual que el texto.
  const { fontScale } = useWindowDimensions();
  return (
    <View
      accessible
      accessibilityLabel={name}
      style={[isAccessibilitySize(fontScale) ? styles.column : styles.row, { gap: spacing.sm }]}
    >
      <SymbolView
        testID="category-icon"
        name={symbolFor(icon)}
        tintColor={colorFor(color, scheme)}
        size={Math.round(20 * fontScale)}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
      <Text style={[styles.name, { color: colors.text }]}>{name}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  // Con tamaños de accesibilidad el ícono va arriba y el nombre usa todo el ancho.
  column: { flexDirection: 'column', alignItems: 'flex-start', flexShrink: 1 },
  name: { fontSize: 17, flexShrink: 1 },
});
