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
