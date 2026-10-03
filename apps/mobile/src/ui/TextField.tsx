import type { ReactNode } from 'react';
import { StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native';
import { useTheme } from '../theme';

interface Props extends Omit<TextInputProps, 'accessibilityLabel' | 'style'> {
  /** Etiqueta visible encima y nombre para VoiceOver. */
  label: string;
  /** Algo delante del campo en la misma fila, por ejemplo el campo de emoji. */
  leading?: ReactNode;
}

/** Campo de texto base (T-044): etiqueta, fondo de tarjeta y 44 pt de alto mínimo. */
export function TextField({ label, leading, ...input }: Props) {
  const { colors, radius, sizes, spacing, typography } = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={[typography.headline, { color: colors.text }]}>{label}</Text>
      <View style={[styles.row, { gap: spacing.sm }]}>
        {leading}
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={colors.muted}
          {...input}
          style={[
            typography.body,
            styles.input,
            {
              minHeight: sizes.touch,
              borderRadius: radius.control,
              paddingHorizontal: spacing.md,
              color: colors.text,
              backgroundColor: colors.card,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1 },
});
