import { lastEmoji } from '@luka/domain';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '../theme';

interface Props {
  value: string;
  onChange: (emoji: string) => void;
}

/**
 * Ícono como emoji del teclado (documento 02): ocupa una sola línea y el teclado de emojis ofrece más
 * opciones que cualquier cuadrícula. Un emoji nuevo reemplaza al anterior; lo que no es emoji se ignora.
 */
export function EmojiField({ value, onChange }: Props) {
  const { colors, spacing } = useTheme();
  return (
    <View style={[styles.row, { gap: spacing.md }]}>
      <Text style={[styles.label, { color: colors.text }]}>Ícono</Text>
      <TextInput
        accessibilityLabel="Ícono"
        accessibilityHint="Abre el teclado de emojis y elige uno"
        value={value}
        onChangeText={(text) => {
          const emoji = lastEmoji(text);
          if (emoji && emoji !== value) onChange(emoji);
        }}
        style={[styles.input, { borderColor: colors.muted }]}
      />
      <Text style={[styles.hint, { color: colors.muted }]}>Elige un emoji del teclado 😀</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  label: { fontSize: 17, fontWeight: '600' },
  input: {
    fontSize: 28,
    borderWidth: 1,
    borderRadius: 8,
    minWidth: 56,
    padding: 6,
    textAlign: 'center',
  },
  hint: { fontSize: 15, flexShrink: 1 },
});
