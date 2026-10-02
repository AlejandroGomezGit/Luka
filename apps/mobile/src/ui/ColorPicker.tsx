import { COLOR_TOKENS } from '@luka/domain';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';
import { pickerStyles, usePickerCell } from './IconPicker';
import { colorFor } from './palette';

interface Props {
  value: string;
  onChange: (token: string) => void;
}

/** Selector de color por token; VoiceOver lee el nombre del color, nunca depende solo del color. */
export function ColorPicker({ value, onChange }: Props) {
  const { colors, scheme, spacing } = useTheme();
  const cell = usePickerCell();
  return (
    <>
      <Text accessibilityRole="header" style={[pickerStyles.label, { color: colors.text }]}>
        Color
      </Text>
      <View accessibilityRole="radiogroup" style={[pickerStyles.grid, { gap: spacing.sm }]}>
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
                pickerStyles.cell,
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
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  swatch: { borderRadius: 999 },
});
