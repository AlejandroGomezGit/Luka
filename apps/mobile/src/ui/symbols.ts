/**
 * Único lugar que traduce un token de ícono (lo que guarda la base) a un símbolo SF de iOS.
 * Cada símbolo existe en iOS 16.4, la versión mínima de la app: lo comprueba la prueba de símbolos
 * contra symbol-availability.json, que genera `pnpm --filter @luka/mobile symbols:check` en macOS.
 */
import type { IconToken } from '@luka/domain';
import type { SFSymbol } from 'expo-symbols';

export const SYMBOLS: Record<IconToken, SFSymbol> = {
  utensils: 'fork.knife',
  cart: 'cart',
  coffee: 'cup.and.saucer',
  takeout: 'takeoutbag.and.cup.and.straw',
  bag: 'bag',
  car: 'car',
  fuel: 'fuelpump',
  bus: 'bus',
  tram: 'tram',
  taxi: 'car.side',
  parking: 'parkingsign',
  wrench: 'wrench.and.screwdriver',
  shield: 'checkmark.shield',
  home: 'house',
  building: 'building.2',
  hammer: 'hammer',
  bolt: 'bolt',
  drop: 'drop',
  flame: 'flame',
  wifi: 'wifi',
  phone: 'iphone',
  heart: 'heart',
  pill: 'pills',
  stethoscope: 'stethoscope',
  run: 'figure.run',
  dumbbell: 'dumbbell',
  book: 'book',
  graduation: 'graduationcap',
  ticket: 'ticket',
  game: 'gamecontroller',
  airplane: 'airplane',
  shirt: 'tshirt',
  laptop: 'laptopcomputer',
  sofa: 'sofa',
  sparkles: 'sparkles',
  scissors: 'scissors',
  repeat: 'arrow.triangle.2.circlepath',
  card: 'creditcard',
  percent: 'percent',
  banknote: 'banknote',
  bank: 'building.columns',
  receipt: 'doc.text',
  gift: 'gift',
  paw: 'pawprint',
  more: 'ellipsis.circle',
  briefcase: 'briefcase',
  person: 'person',
  chart: 'chart.line.uptrend.xyaxis',
  refund: 'arrow.uturn.backward.circle',
  plus: 'plus.circle',
  tag: 'tag',
  leaf: 'leaf',
  bicycle: 'bicycle',
};

/** Para tokens desconocidos: de una versión más nueva de la app o de datos de prueba antiguos. */
export const FALLBACK_SYMBOL: SFSymbol = 'tag';

export function symbolFor(token: string): SFSymbol {
  return Object.hasOwn(SYMBOLS, token) ? SYMBOLS[token as IconToken] : FALLBACK_SYMBOL;
}
