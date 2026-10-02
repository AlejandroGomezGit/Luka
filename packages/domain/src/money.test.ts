import { describe, expect, it } from '@jest/globals';
import fc from 'fast-check';
import { applySign, isCurrencyCode, parseAmount } from './money.js';

const group = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

describe('parseAmount', () => {
  it('RNF-06 convierte pesos escritos en formato colombiano a entero en la unidad menor', () => {
    expect(parseAmount('12.500', 'COP')).toBe(1_250_000);
    expect(parseAmount('12500', 'COP')).toBe(1_250_000);
    expect(parseAmount('$ 1.234.567,8', 'COP')).toBe(123_456_780);
    expect(parseAmount(' 0,05 ', 'USD')).toBe(5);
  });

  it('RNF-06 rechaza textos que no son montos o tienen más decimales que la moneda', () => {
    for (const text of ['', 'abc', '12,345', '1.23', '12.50.0', '-5', '1e3', '1,']) {
      expect(parseAmount(text, 'COP')).toBeNull();
    }
  });

  it('RNF-06 rechaza montos que no caben en un entero seguro', () => {
    expect(parseAmount('99999999999999999', 'COP')).toBeNull();
  });

  it('RNF-06 propiedad: escribir un entero con separadores y leerlo devuelve el mismo entero', () => {
    fc.assert(
      fc.property(fc.maxSafeNat(), (minor) => {
        const text = `${group(Math.floor(minor / 100))},${String(minor % 100).padStart(2, '0')}`;
        expect(parseAmount(text, 'COP')).toBe(minor);
      }),
    );
  });
});

describe('applySign', () => {
  it('INV-01 gasto y transferencia quedan negativos, ingreso positivo y ajuste conserva su signo', () => {
    expect(applySign('expense', 500)).toBe(-500);
    expect(applySign('transfer', 500)).toBe(-500);
    expect(applySign('income', -500)).toBe(500);
    expect(applySign('adjustment', -500)).toBe(-500);
  });
});

describe('isCurrencyCode', () => {
  it('reconoce solo las monedas con unidad menor conocida', () => {
    expect(isCurrencyCode('COP')).toBe(true);
    expect(isCurrencyCode('cop')).toBe(false);
    expect(isCurrencyCode('toString')).toBe(false);
  });
});
