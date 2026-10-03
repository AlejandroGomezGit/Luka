import { Pressable, StyleSheet, Text } from 'react-native';
import { useTheme } from '../theme';

interface Props {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}

/** Botón de texto para la barra superior, por ejemplo «Guardar»: siempre visible sin desplazarse. */
export function HeaderButton({ label, onPress, disabled = false }: Props) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={12}
    >
      <Text style={[styles.text, { color: disabled ? colors.muted : colors.accent }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  text: { fontSize: 17, fontWeight: '600' },
});
