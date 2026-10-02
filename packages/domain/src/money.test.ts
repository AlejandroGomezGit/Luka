import { describe, expect, it } from '@jest/globals';
import fc from 'fast-check';
import { applySign, formatMoney, isCurrencyCode, parseAmount } from './money.js';

const group = (n: number, sep: string) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, sep);

describe('parseAmount en COP: se escribe en pesos enteros', () => {
  it('RNF-06 punto o coma seguidos de exactamente 3 dígitos son separadores de miles', () => {
    expect(parseAmount('12.500', 'COP')).toBe(1_250_000);
    expect(parseAmount('12,500', 'COP')).toBe(1_250_000);
    expect(parseAmount('12500', 'COP')).toBe(1_250_000);
    expect(parseAmount('$ 1.234.567', 'COP')).toBe(123_456_700);
    expect(parseAmount('1,234,567', 'COP')).toBe(123_456_700);
    expect(parseAmount(' 0 ', 'COP')).toBe(0);
  });

  it('RNF-06 rechaza decimales y separadores que no agrupan de a tres', () => {
    for (const text of [
      '12,50',
      '12.5',
      '1.23',
      '1.2345',
      '12.50.0',
      '12..500',
      '.500',
      '1,',
      '',
    ]) {
      expect(parseAmount(text, 'COP')).toBeNull();
    }
  });

  it('RNF-06 propiedad: pesos escritos con puntos o comas de miles dan el entero exacto', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: Math.floor(Number.MAX_SAFE_INTEGER / 100) }),
        fc.constantFrom('.', ','),
        (pesos, sep) => {
          expect(parseAmount(group(pesos, sep), 'COP')).toBe(pesos * 100);
        },
      ),
    );
  });
});

describe('parseAmount en USD y EUR: el último separador con 1 o 2 dígitos es el decimal', () => {
  it('RNF-06 acepta coma o punto decimal, con miles en el otro', () => {
    expect(parseAmount('12,50', 'USD')).toBe(1250);
    expect(parseAmount('12.50', 'USD')).toBe(1250);
    expect(parseAmount('12.5', 'EUR')).toBe(1250);
    expect(parseAmount('1.234,56', 'USD')).toBe(123_456);
    expect(parseAmount('1,234.56', 'USD')).toBe(123_456);
    expect(parseAmount('1.234.567,8', 'EUR')).toBe(123_456_780);
    expect(parseAmount('0,05', 'USD')).toBe(5);
  });

  it('RNF-06 tres dígitos después del último separador son miles, no decimales', () => {
    expect(parseAmount('1,234', 'USD')).toBe(123_400);
    expect(parseAmount('US$ 3.000', 'USD')).toBe(300_000);
  });

  it('RNF-06 rechaza grupos de miles mal formados y más de dos decimales', () => {
    for (const text of ['12.3456', '1,23,456', '12,,50', '-5', '1e3', 'abc']) {
      expect(parseAmount(text, 'USD')).toBeNull();
    }
  });

  it('RNF-06 propiedad: cualquier monto con miles y decimales en cualquier estilo da el mismo entero', () => {
    fc.assert(
      fc.property(fc.maxSafeNat(), fc.boolean(), (minor, latin) => {
        const [thousands, decimal] = latin ? ['.', ','] : [',', '.'];
        const text = `${group(Math.floor(minor / 100), thousands)}${decimal}${String(minor % 100).padStart(2, '0')}`;
        expect(parseAmount(text, 'USD')).toBe(minor);
      }),
    );
  });

  it('rechaza montos que no caben en un entero seguro', () => {
    expect(parseAmount('99999999999999999', 'COP')).toBeNull();
  });
});

describe('formatMoney (formato colombiano)', () => {
  it('COP en pesos con punto de miles; los centavos solo si los hay', () => {
    expect(formatMoney(0, 'COP')).toBe('$ 0');
    expect(formatMoney(1_250_000, 'COP')).toBe('$ 12.500');
    expect(formatMoney(-1_250_000, 'COP')).toBe('-$ 12.500');
    expect(formatMoney(123_456_789, 'COP')).toBe('$ 1.234.567,89');
  });

  it('USD y EUR siempre con dos decimales', () => {
    expect(formatMoney(123_456, 'USD')).toBe('US$ 1.234,56');
    expect(formatMoney(5, 'EUR')).toBe('€ 0,05');
  });

  it('propiedad: lo que muestra formatMoney se vuelve a leer igual con parseAmount', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: Math.floor(Number.MAX_SAFE_INTEGER / 100) }),
        (pesos) => {
          expect(parseAmount(formatMoney(pesos * 100, 'COP'), 'COP')).toBe(pesos * 100);
        },
      ),
    );
    fc.assert(
      fc.property(fc.maxSafeNat(), (minor) => {
        expect(parseAmount(formatMoney(minor, 'USD'), 'USD')).toBe(minor);
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
