import { ICON_TOKENS } from '@luka/domain';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useTheme } from '../theme';
import { colorFor } from './palette';
import { ICON_LABELS, SYMBOLS } from './symbols';

/**
 * Lado de cada celda de los selectores: al menos 44 puntos (área táctil de Apple) que crecen con el texto
 * hasta el doble, así con Dynamic Type grande la cuadrícula pasa a más filas sin un solo ícono por fila.
 */
export function usePickerCell(): number {
  const { fontScale } = useWindowDimensions();
  return Math.round(44 * Math.min(Math.max(1, fontScale), 2));
}

export const pickerStyles = StyleSheet.create({
  label: { fontSize: 17, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderRadius: 10 },
});

interface Props {
  value: string;
  /** Token de color con el que se dibujan los íconos. */
  color: string;
  onChange: (token: string) => void;
}

/** Selector de ícono por token; cada opción tiene nombre en español para VoiceOver. */
export function IconPicker({ value, color, onChange }: Props) {
  const { colors, scheme, spacing } = useTheme();
  const cell = usePickerCell();
  return (
    <>
      <Text accessibilityRole="header" style={[pickerStyles.label, { color: colors.text }]}>
        Ícono
      </Text>
      <View accessibilityRole="radiogroup" style={[pickerStyles.grid, { gap: spacing.sm }]}>
        {ICON_TOKENS.map((token) => {
          const selected = value === token;
          return (
            <Pressable
              key={token}
              accessibilityRole="radio"
              accessibilityLabel={ICON_LABELS[token]}
              accessibilityState={{ selected }}
              onPress={() => onChange(token)}
              style={[
                pickerStyles.cell,
                { width: cell, height: cell, borderColor: selected ? colors.text : 'transparent' },
              ]}
            >
              <SymbolView
                name={SYMBOLS[token]}
                tintColor={colorFor(color, scheme)}
                size={Math.round(cell * 0.55)}
              />
            </Pressable>
          );
        })}
      </View>
    </>
  );
}
