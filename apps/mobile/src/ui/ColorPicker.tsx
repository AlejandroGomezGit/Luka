import { COLOR_TOKENS } from '@luka/domain';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useTheme } from '../theme';
import { colorFor } from './palette';

interface Props {
  value: string;
  onChange: (token: string) => void;
}

/**
 * Los 12 colores en una sola fila que se desliza; cada círculo conserva el área táctil de 44 puntos y
 * VoiceOver lee el nombre del color, nunca depende solo del color.
 */
export function ColorPicker({ value, onChange }: Props) {
  const { colors, scheme, spacing } = useTheme();
  const { fontScale } = useWindowDimensions();
  const cell = Math.round(44 * Math.min(Math.max(1, fontScale), 2));
  return (
    <View style={{ gap: spacing.sm }}>
      <Text accessibilityRole="header" style={[styles.label, { color: colors.text }]}>
        Color
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        accessibilityRole="radiogroup"
        contentContainerStyle={{ gap: spacing.sm }}
      >
        {COLOR_TOKENS.map(({ token, name }) => {
          const selected = value === token;
          return (
            <Pressable
              key={token}
              accessibilityRole="radio"
              accessibilityLabel={name}
              accessibilityState={{ selected }}
              onPress={() => onChange(token)}
              style={[
                styles.cell,
                { width: cell, height: cell, borderColor: selected ? colors.text : 'transparent' },
              ]}
            >
              <View
                style={[
                  styles.swatch,
                  {
                    backgroundColor: colorFor(token, scheme),
                    width: cell * 0.6,
                    height: cell * 0.6,
                  },
                ]}
              />
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 17, fontWeight: '600' },
  cell: { alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderRadius: 999 },
  swatch: { borderRadius: 999 },
});
