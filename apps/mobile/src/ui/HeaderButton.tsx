import { Pressable, Text } from 'react-native';
import { headingScale, useTheme } from '../theme';

interface Props {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** Acción principal de la pantalla, como «Guardar»: va rellena con el color de acento. */
  prominent?: boolean;
}

/** Botón de texto para la barra superior, por ejemplo «Guardar»: siempre visible sin desplazarse. */
export function HeaderButton({ label, onPress, disabled = false, prominent = false }: Props) {
  const { colors, radius, spacing, typography } = useTheme();
  const tint = disabled ? colors.muted : colors.accent;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={12}
      style={
        prominent && {
          borderRadius: radius.pill,
          paddingVertical: spacing.xs + 2,
          paddingHorizontal: spacing.md - 2,
          backgroundColor: tint,
        }
      }
    >
      <Text
        maxFontSizeMultiplier={headingScale.bar}
        style={[typography.headline, { color: prominent ? colors.onAccent : tint }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}
