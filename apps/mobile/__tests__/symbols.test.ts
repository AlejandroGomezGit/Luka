import { ICON_TOKENS } from '@luka/domain';
import availability from '../src/ui/symbol-availability.json';
import { FALLBACK_SYMBOL, SYMBOLS, symbolFor } from '../src/ui/symbols';

// Versión mínima de iOS de la app: la exige ExpoModulesCore en Expo SDK 57.
const MIN_IOS = '16.4';
const version = (v: string) => v.split('.').map(Number);
const atMost = (a: string, b: string) => {
  const [x, y] = [version(a), version(b)];
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) < (y[i] ?? 0);
  }
  return true;
};

describe('símbolos de los íconos', () => {
  it('cada token tiene su símbolo y no sobra ningún símbolo sin token', () => {
    expect(Object.keys(SYMBOLS).sort()).toEqual([...ICON_TOKENS].sort());
  });

  it(`cada símbolo, incluido el de respaldo, existe en iOS ${MIN_IOS} según la tabla de Apple`, () => {
    const table = availability as Record<string, string>;
    for (const symbol of [...Object.values(SYMBOLS), FALLBACK_SYMBOL]) {
      expect(table[symbol]).toBeDefined();
      expect(atMost(table[symbol] ?? '99', MIN_IOS)).toBe(true);
    }
  });

  it('un token desconocido (de otra versión de la app o antiguo) usa el símbolo de respaldo', () => {
    expect(symbolFor('food')).toBe(FALLBACK_SYMBOL);
    expect(symbolFor('cart')).toBe(SYMBOLS.cart);
  });
});
