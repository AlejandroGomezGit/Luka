import { render, screen } from '@testing-library/react-native';
import Home from '../src/app/index';

beforeAll(() => {
  // 2 de octubre de 2026 a las 10 a. m. en Bogotá: la misma fecha en UTC.
  jest.useFakeTimers({ now: Date.UTC(2026, 9, 2, 15) });
});

afterAll(() => {
  jest.useRealTimers();
});

test('muestra el título y la fecha local calculada por @luka/domain', async () => {
  // RNTL 14: render es asíncrono.
  await render(<Home />);
  expect(screen.getByRole('header', { name: 'Tus gastos' })).toBeOnTheScreen();
  expect(screen.getByText('Hoy es 2026-10-02')).toBeOnTheScreen();
});
