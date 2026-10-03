/** Reloj inyectado: el dominio nunca lee la hora real, así las pruebas son deterministas. */
export interface Clock {
  /** Milisegundos UTC desde 1970. */
  now(): number;
}

/**
 * Fecha local AAAA-MM-DD (`occurred_on`) de un instante en una zona horaria IANA. Así un gasto de las
 * 11 p. m. en Bogotá no cae en el día ni en el mes siguientes.
 */
export function toLocalDate(instantMs: number, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instantMs);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function today(clock: Clock, timeZone: string): string {
  return toLocalDate(clock.now(), timeZone);
}

const LOCAL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** true si es una fecha AAAA-MM-DD que existe en el calendario. */
export function isLocalDate(value: string): boolean {
  const match = LOCAL_DATE.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number) as [number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

const pad = (value: number, length: number) => String(value).padStart(length, '0');

/** AAAA-MM-DD con los componentes de una fecha local; el mes empieza en 0, como en Date. */
export function localDateFromParts(year: number, monthIndex: number, day: number): string {
  return `${pad(year, 4)}-${pad(monthIndex + 1, 2)}-${pad(day, 2)}`;
}

/** Suma (o resta) días a una fecha local AAAA-MM-DD, sin pasar por la zona horaria del dispositivo. */
export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  const result = new Date(Date.UTC(year, month - 1, day + days));
  return localDateFromParts(result.getUTCFullYear(), result.getUTCMonth(), result.getUTCDate());
}

export type DateRangePreset = 'this_month' | 'last_month' | 'last_30_days';

/**
 * Rango de fechas locales de los filtros de movimientos (HU-05), a partir de «hoy» calculado con el reloj
 * inyectado en la zona horaria del dispositivo. Los extremos están incluidos.
 */
export function dateRange(preset: DateRangePreset, today: string): { from: string; to: string } {
  if (preset === 'last_30_days') return { from: addDays(today, -29), to: today };
  const [year, month] = today.split('-').map(Number) as [number, number];
  const monthIndex = preset === 'this_month' ? month - 1 : month - 2;
  const first = new Date(Date.UTC(year, monthIndex, 1));
  const last = new Date(Date.UTC(year, monthIndex + 1, 0));
  return {
    from: localDateFromParts(first.getUTCFullYear(), first.getUTCMonth(), 1),
    to: localDateFromParts(last.getUTCFullYear(), last.getUTCMonth(), last.getUTCDate()),
  };
}
