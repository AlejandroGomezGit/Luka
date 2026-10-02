/**
 * Ícono y color de categorías y cuentas (documento 02). El ícono es un emoji que la persona elige con el
 * teclado; el color es un token de una paleta fija que la app traduce a su valor en un solo archivo.
 */

// Un emoji: par de banderas, tecla (1️⃣) o pictograma con selector, tono de piel y uniones ZWJ (🧑‍💻).
const PICTOGRAPH = String.raw`\p{Extended_Pictographic}️?\p{Emoji_Modifier}?`;
const EMOJI = String.raw`(?:\p{Regional_Indicator}{2}|[#*0-9]️?⃣|${PICTOGRAPH}(?:‍${PICTOGRAPH})*)`;
const ONE_EMOJI = new RegExp(`^${EMOJI}$`, 'u');
const ANY_EMOJI = new RegExp(EMOJI, 'gu');

/** true si el valor es exactamente un emoji. */
export function isEmoji(value: string): boolean {
  return ONE_EMOJI.test(value);
}

/** El último emoji del texto: al escribir uno nuevo en el campo, reemplaza al anterior. */
export function lastEmoji(text: string): string | null {
  return text.match(ANY_EMOJI)?.at(-1) ?? null;
}

/** Doce colores; el nombre es el que lee VoiceOver, porque el color nunca va solo. */
export const COLOR_TOKENS = [
  { token: 'red', name: 'Rojo' },
  { token: 'orange', name: 'Naranja' },
  { token: 'amber', name: 'Ámbar' },
  { token: 'green', name: 'Verde' },
  { token: 'teal', name: 'Verde azulado' },
  { token: 'cyan', name: 'Cian' },
  { token: 'blue', name: 'Azul' },
  { token: 'indigo', name: 'Índigo' },
  { token: 'purple', name: 'Morado' },
  { token: 'pink', name: 'Rosado' },
  { token: 'brown', name: 'Marrón' },
  { token: 'gray', name: 'Gris' },
] as const;

export type ColorToken = (typeof COLOR_TOKENS)[number]['token'];

export function isColorToken(value: string): value is ColorToken {
  return COLOR_TOKENS.some((color) => color.token === value);
}
