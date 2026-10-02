import { describe, expect, it } from '@jest/globals';
import { type Clock, isLocalDate, toLocalDate, today } from './dates.js';

// 31 de enero de 2026, 11:30 p. m. en Bogotá = 1 de febrero, 04:30 UTC.
const lateNight = Date.UTC(2026, 1, 1, 4, 30);

describe('toLocalDate', () => {
  it('un gasto de las 11 p. m. queda en la fecha local y no en el mes siguiente', () => {
    expect(toLocalDate(lateNight, 'America/Bogota')).toBe('2026-01-31');
    expect(toLocalDate(lateNight, 'UTC')).toBe('2026-02-01');
  });

  it('today usa el reloj inyectado, no la hora real', () => {
    const clock: Clock = { now: () => lateNight };
    expect(today(clock, 'America/Bogota')).toBe('2026-01-31');
  });
});

describe('isLocalDate', () => {
  it('acepta fechas AAAA-MM-DD reales y rechaza las imposibles o mal formadas', () => {
    expect(isLocalDate('2028-02-29')).toBe(true);
    for (const value of ['2026-02-29', '2026-13-01', '2026-1-1', '2026-01-01T00:00', '']) {
      expect(isLocalDate(value)).toBe(false);
    }
  });
});
