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

/** Fecha local AAAA-MM-DD como la lee la persona: «Hoy», «Ayer», «25 de septiembre» o con año si es otro. */
export function dayLabel(date: string, today: string): string {
  if (date === today) return 'Hoy';
  if (date === addDays(today, -1)) return 'Ayer';
  const [year, month, day] = date.split('-');
  const text = `${String(Number(day))} de ${MONTHS[Number(month) - 1] ?? ''}`;
  return year === today.slice(0, 4) ? text : `${text} de ${year ?? ''}`;
}
