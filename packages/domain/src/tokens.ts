/**
 * Tokens de ícono y color de las categorías (documento 02). La base de datos guarda solo estos tokens
 * genéricos; la app los traduce a símbolo y a color en un solo archivo cada uno.
 */
export const ICON_TOKENS = [
  'utensils',
  'cart',
  'coffee',
  'takeout',
  'bag',
  'car',
  'fuel',
  'bus',
  'tram',
  'taxi',
  'parking',
  'wrench',
  'shield',
  'home',
  'building',
  'hammer',
  'bolt',
  'drop',
  'flame',
  'wifi',
  'phone',
  'heart',
  'pill',
  'stethoscope',
  'run',
  'dumbbell',
  'book',
  'graduation',
  'ticket',
  'game',
  'airplane',
  'shirt',
  'laptop',
  'sofa',
  'sparkles',
  'scissors',
  'repeat',
  'card',
  'percent',
  'banknote',
  'bank',
  'receipt',
  'gift',
  'paw',
  'more',
  'briefcase',
  'person',
  'chart',
  'refund',
  'plus',
  'tag',
  'leaf',
  'bicycle',
] as const;

export type IconToken = (typeof ICON_TOKENS)[number];

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

export function isIconToken(value: string): value is IconToken {
  return (ICON_TOKENS as readonly string[]).includes(value);
}

export function isColorToken(value: string): value is ColorToken {
  return COLOR_TOKENS.some((color) => color.token === value);
}
