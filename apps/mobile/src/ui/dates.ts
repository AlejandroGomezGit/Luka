import { addDays } from '@luka/domain';

const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/** «25 de septiembre», con el año si no es el de hoy. */
function longDate(date: string, today: string): string {
  const [year, month, day] = date.split('-');
  const text = `${String(Number(day))} de ${MONTHS[Number(month) - 1] ?? ''}`;
  return year === today.slice(0, 4) ? text : `${text} de ${year ?? ''}`;
}

/** Fecha local AAAA-MM-DD como la lee la persona: «Hoy», «Ayer», «25 de septiembre» o con año si es otro. */
export function dayLabel(date: string, today: string): string {
  if (date === today) return 'Hoy';
  if (date === addDays(today, -1)) return 'Ayer';
  return longDate(date, today);
}

const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** Encabezado de un día en la lista (HU-05): «Hoy · viernes 2 de octubre» o «Miércoles 30 de septiembre». */
export function sectionTitle(date: string, today: string): string {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()] ?? '';
  const full = `${weekday} ${longDate(date, today)}`;
  const label = dayLabel(date, today);
  return label === 'Hoy' || label === 'Ayer'
    ? `${label} · ${full}`
    : full.charAt(0).toUpperCase() + full.slice(1);
}
