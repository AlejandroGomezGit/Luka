import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';
import { monthTitle } from './dates';

interface Props {
  /** Mes AAAA-MM elegido. */
  month: string;
  /** Mes en curso: no se puede pasar de él y se marca «hasta hoy». */
  current: string;
  onChange: (next: 'previous' | 'next') => void;
}

/** Selector de mes del resumen (HU-08): «‹ Septiembre 2026 ›»; el siguiente se deshabilita en el mes en curso. */
export function MonthPicker({ month, current, onChange }: Props) {
  const { colors, sizes, spacing, typography } = useTheme();
  const atCurrent = month >= current;
  const arrow = (label: string, glyph: string, next: 'previous' | 'next', disabled: boolean) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        onChange(next);
      }}
      hitSlop={8}
      style={[styles.arrow, { minWidth: sizes.touch, minHeight: sizes.touch }]}
    >
      <Text style={[typography.title, { color: disabled ? colors.muted : colors.accentText }]}>
        {glyph}
      </Text>
    </Pressable>
  );
  return (
    <View style={[styles.row, { gap: spacing.sm }]}>
      {arrow('Mes anterior', '‹', 'previous', false)}
      <Text
        accessibilityRole="header"
        style={[typography.headline, styles.label, { color: colors.text }]}
      >
        {atCurrent ? `${monthTitle(month)} · hasta hoy` : monthTitle(month)}
      </Text>
      {arrow('Mes siguiente', '›', 'next', atCurrent)}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  arrow: { alignItems: 'center', justifyContent: 'center' },
  label: { flex: 1, textAlign: 'center' },
});
