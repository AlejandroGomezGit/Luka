import { lastEmoji } from '@luka/domain';
import { StyleSheet, TextInput } from 'react-native';
import { useTheme } from '../theme';
import { colorFor } from './palette';

interface Props {
  value: string;
  /** Token de color: el campo muestra el emoji sobre su color, como en las listas. */
  color: string;
  onChange: (emoji: string) => void;
}

/**
 * Ícono como emoji del teclado (documento 02): un solo campo pequeño, porque el teclado de emojis ofrece
 * más opciones que cualquier cuadrícula. Un emoji nuevo reemplaza al anterior; lo que no es emoji se ignora.
 */
export function EmojiField({ value, color, onChange }: Props) {
  const { colors, scheme } = useTheme();
  return (
    <TextInput
      accessibilityLabel="Ícono"
      accessibilityHint="Abre el teclado de emojis y elige uno"
      value={value}
      onChangeText={(text) => {
        const emoji = lastEmoji(text);
        if (emoji && emoji !== value) onChange(emoji);
      }}
      style={[
        styles.input,
        { borderColor: colors.muted, backgroundColor: `${colorFor(color, scheme)}33` },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    fontSize: 24,
    borderWidth: 1,
    borderRadius: 8,
    width: 56,
    padding: 8,
    textAlign: 'center',
  },
});
