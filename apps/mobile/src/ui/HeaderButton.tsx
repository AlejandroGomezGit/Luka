import { Pressable, StyleSheet, Text } from 'react-native';
import { useTheme } from '../theme';

interface Props {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** Acción principal de la pantalla, como «Guardar»: va rellena con el color de acento. */
  prominent?: boolean;
}

/** Botón de texto para la barra superior, por ejemplo «Guardar»: siempre visible sin desplazarse. */
export function HeaderButton({ label, onPress, disabled = false, prominent = false }: Props) {
  const { colors } = useTheme();
  const tint = disabled ? colors.muted : colors.accent;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={12}
      style={prominent && [styles.prominent, { backgroundColor: tint }]}
    >
      <Text style={[styles.text, { color: prominent ? colors.background : tint }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  text: { fontSize: 17, fontWeight: '600' },
  prominent: { borderRadius: 999, paddingVertical: 6, paddingHorizontal: 14 },
});
