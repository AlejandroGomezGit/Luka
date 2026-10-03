import { describe, expect, it } from '@jest/globals';
import fc from 'fast-check';
import { monthOf, monthRange, percentages, shiftMonth, topWithRest } from './summary.js';

describe('HU-08 meses del resumen', () => {
  it('HU-08 el mes de una fecha, su rango y el anterior o siguiente, con cambio de año', () => {
    expect(monthOf('2026-10-03')).toBe('2026-10');
    expect(monthRange('2026-09')).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(monthRange('2028-02')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2025-12', 1)).toBe('2026-01');
  });
});

describe('HU-08 porcentajes por el método del mayor resto', () => {
  it('HU-08 suman exactamente 100 y redondean hacia el mayor resto', () => {
    expect(percentages([1, 1, 1])).toEqual([34, 33, 33]);
    expect(percentages([520_000, 342_500, 168_000, 121_000, 78_000, 55_000])).toEqual([
      41, 27, 13, 9, 6, 4,
    ]);
    expect(percentages([0, 0])).toEqual([0, 0]);
  });

  it('HU-08 propiedad: con cualquier lista de montos positivos suman 100', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 1e9 }), { minLength: 1, maxLength: 30 }),
        (values) => {
          expect(percentages(values).reduce((a, b) => a + b, 0)).toBe(100);
        },
      ),
    );
  });
});

describe('HU-08 las 6 categorías más grandes y «Otras categorías»', () => {
  const items = Array.from({ length: 9 }, (_, i) => ({
    id: `c${String(i)}`,
    amountMinor: (9 - i) * 100,
  }));

  it('HU-08 agrupa el resto y la suma sigue siendo el total', () => {
    const { top, rest } = topWithRest(items, 6);
    expect(top.map((i) => i.id)).toEqual(['c0', 'c1', 'c2', 'c3', 'c4', 'c5']);
    expect(rest).toEqual({ count: 3, amountMinor: 300 + 200 + 100 });
    const sum = top.reduce((a, i) => a + i.amountMinor, 0) + (rest?.amountMinor ?? 0);
    expect(sum).toBe(items.reduce((a, i) => a + i.amountMinor, 0));
  });

  it('HU-08 con 6 o menos no hay «Otras categorías»', () => {
    expect(topWithRest(items.slice(0, 6), 6).rest).toBeNull();
  });
});
