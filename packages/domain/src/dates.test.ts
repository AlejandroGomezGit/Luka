import { describe, expect, it } from '@jest/globals';
import {
  addDays,
  type Clock,
  isLocalDate,
  localDateFromParts,
  toLocalDate,
  today,
} from './dates.js';

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

describe('fechas locales para movimientos', () => {
  it('a las 21:00 en Bogotá, today da la fecha de Bogotá aunque en UTC ya sea el día siguiente (sin toISOString)', () => {
    // 1 de octubre de 2026, 21:00 en Bogotá = 2 de octubre, 02:00 UTC.
    const nineAtNight: Clock = { now: () => Date.UTC(2026, 9, 2, 2, 0) };
    expect(today(nineAtNight, 'America/Bogota')).toBe('2026-10-01');
    expect(new Date(nineAtNight.now()).toISOString().slice(0, 10)).toBe('2026-10-02');
  });

  it('addDays suma o resta días a una fecha local, incluso entre meses y años bisiestos', () => {
    expect(addDays('2026-10-01', -1)).toBe('2026-09-30');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('localDateFromParts arma AAAA-MM-DD con los componentes locales del selector de fecha', () => {
    expect(localDateFromParts(2026, 9, 1)).toBe('2026-10-01');
    expect(localDateFromParts(2026, 0, 5)).toBe('2026-01-05');
  });
});
