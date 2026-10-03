import { Pressable, StyleSheet, Text } from 'react-native';
import { useTheme } from '../theme';

interface Props {
  label: string;
  onPress: () => void;
  /** Símbolo delante del texto, por ejemplo «+»; VoiceOver lee solo `label`. */
  icon?: string;
  /**
   * principal: relleno con el acento; destructivo: relleno con el color de alerta (borrar); secundario:
   * acento suave; texto: solo el texto.
   */
  variant?: 'primary' | 'destructive' | 'secondary' | 'text';
  disabled?: boolean;
  accessibilityHint?: string;
}

/** Botón base (T-044): 44 pt de alto mínimo, en forma de píldora; crece con Dynamic Type. */
export function Button({
  label,
  onPress,
  icon,
  variant = 'primary',
  disabled = false,
  accessibilityHint,
}: Props) {
  const { colors, radius, sizes, spacing, typography } = useTheme();
  const primary = variant === 'primary' || variant === 'destructive';
  const background = primary
    ? disabled
      ? colors.muted
      : variant === 'destructive'
        ? colors.alert
        : colors.accent
    : variant === 'secondary'
      ? `${colors.accent}26`
      : 'transparent';
  const color = primary ? colors.onAccent : disabled ? colors.muted : colors.accentText;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.base,
        {
          minHeight: sizes.touch,
          borderRadius: radius.pill,
          paddingHorizontal: variant === 'text' ? 0 : spacing.md + spacing.xs,
          gap: spacing.sm,
          backgroundColor: background,
        },
      ]}
    >
      {icon && <Text style={[typography.title, { color }]}>{icon}</Text>}
      <Text style={[typography.headline, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});
