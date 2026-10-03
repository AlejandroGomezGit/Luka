import { Pressable, StyleSheet, Text, View } from 'react-native';
import { headingScale, useTheme } from '../theme';

interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** Ayuda visible debajo del nombre, por ejemplo «Nequi, Daviplata…». */
  hint?: string;
}

/** Opción en forma de píldora (T-044): la elegida va rellena con el acento; 44 pt de alto mínimo. */
export function Chip({ label, selected, onPress, hint }: ChipProps) {
  const { colors, radius, sizes, spacing, typography } = useTheme();
  const color = selected ? colors.onAccent : colors.text;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.chip,
        {
          minHeight: sizes.touch,
          borderRadius: radius.pill,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.xs,
          backgroundColor: selected ? colors.accent : colors.card,
        },
      ]}
    >
      <Text style={[typography.body, { color }]}>{label}</Text>
      {hint && <Text style={[typography.subhead, { color }]}>{hint}</Text>}
    </Pressable>
  );
}

interface SegmentedProps<T extends string> {
  /** Una opción deshabilitada dice por qué en `hint`, que VoiceOver lee como ayuda. */
  options: readonly { value: T; label: string; disabled?: boolean; hint?: string }[];
  value: T;
  onChange: (value: T) => void;
  /** «tab» si cambia lo que muestra la pantalla; «radio» si es un dato del formulario. */
  role?: 'radio' | 'tab';
}

/** Control segmentado de iOS (T-044): dos o tres opciones del mismo ancho sobre una franja. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  role = 'radio',
}: SegmentedProps<T>) {
  const { colors, radius, sizes, spacing, typography } = useTheme();
  return (
    <View
      accessibilityRole={role === 'tab' ? 'tablist' : 'radiogroup'}
      style={[
        styles.segmented,
        { borderRadius: radius.control, padding: spacing.xs, backgroundColor: colors.fill },
      ]}
    >
      {options.map((option) => {
        const selected = value === option.value;
        const disabled = option.disabled ?? false;
        return (
          <Pressable
            key={option.value}
            accessibilityRole={role}
            accessibilityLabel={option.label}
            accessibilityHint={option.hint}
            accessibilityState={{ selected, disabled }}
            disabled={disabled}
            onPress={() => onChange(option.value)}
            style={[
              styles.segment,
              {
                minHeight: sizes.touch - spacing.sm,
                borderRadius: radius.control - spacing.xs,
                backgroundColor: selected ? colors.card : 'transparent',
              },
            ]}
          >
            <Text
              maxFontSizeMultiplier={headingScale.title}
              style={[typography.headline, { color: disabled ? colors.muted : colors.text }]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { justifyContent: 'center' },
  segmented: { flexDirection: 'row' },
  segment: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
