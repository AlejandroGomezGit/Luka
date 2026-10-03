import { countText, dayLabel, sectionTitle } from '../src/ui/dates';

test('HU-04 dayLabel: Hoy, Ayer o la fecha con el mes en español', () => {
  expect(dayLabel('2026-10-02', '2026-10-02')).toBe('Hoy');
  expect(dayLabel('2026-10-01', '2026-10-02')).toBe('Ayer');
  expect(dayLabel('2026-09-25', '2026-10-02')).toBe('25 de septiembre');
  expect(dayLabel('2025-12-31', '2026-10-02')).toBe('31 de diciembre de 2025');
});

test('HU-05 encabezados de día de la lista, con el día de la semana', () => {
  expect(sectionTitle('2026-10-02', '2026-10-02')).toBe('Hoy · viernes 2 de octubre');
  expect(sectionTitle('2026-10-01', '2026-10-02')).toBe('Ayer · jueves 1 de octubre');
  expect(sectionTitle('2026-09-30', '2026-10-02')).toBe('Miércoles 30 de septiembre');
  expect(sectionTitle('2025-12-31', '2026-10-02')).toBe('Miércoles 31 de diciembre de 2025');
});

test('HU-05 el número de movimientos lleva punto de miles y singular', () => {
  expect(countText(1)).toBe('1 movimiento');
  expect(countText(2)).toBe('2 movimientos');
  expect(countText(10_000)).toBe('10.000 movimientos');
});
