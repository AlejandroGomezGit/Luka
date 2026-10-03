import { render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import Home from '../src/app/(tabs)/index';
import { createAccount } from '../src/db/accounts';
import { LocalSessionProvider } from '../src/db/session';
import { createTestDb, testClock, testRandom } from '../src/db/testing';

// Fuera de una navegación, useFocusEffect corre como un efecto al montar.
jest.mock('expo-router', () => ({
  ...jest.requireActual<object>('expo-router'),
  useFocusEffect: (effect: () => void) => {
    jest.requireActual<typeof import('react')>('react').useEffect(effect, [effect]);
  },
}));

async function session() {
  const db = await createTestDb();
  return {
    db,
    userId: 'u1',
    deviceId: 'd1',
    clock: testClock(Date.UTC(2026, 9, 2, 15)),
    random: testRandom(),
  };
}

const wrap = (value: Awaited<ReturnType<typeof session>>, children: ReactNode) => (
  <LocalSessionProvider value={value}>{children}</LocalSessionProvider>
);

beforeAll(() => {
  // 2 de octubre de 2026 a las 10 a. m. en Bogotá: la misma fecha en UTC.
  jest.useFakeTimers({ now: Date.UTC(2026, 9, 2, 15) });
});

afterAll(() => {
  jest.useRealTimers();
});

test('muestra el título y la fecha local calculada por @luka/domain', async () => {
  await render(wrap(await session(), <Home />));
  expect(screen.getByRole('header', { name: 'Tus gastos' })).toBeOnTheScreen();
  expect(screen.getByText('Hoy es 2026-10-02')).toBeOnTheScreen();
});

test('HU-02 CU-01 sin cuentas, la pantalla de inicio lleva a crear la primera', async () => {
  await render(wrap(await session(), <Home />));
  expect(screen.getByText('Crea tu primera cuenta')).toBeOnTheScreen();
});

test('HU-02 con una cuenta activa ya no pide crear la primera', async () => {
  const value = await session();
  createAccount(value, {
    name: 'Efectivo',
    type: 'cash',
    currency: 'COP',
    openingAmountMinor: 0,
    icon: '💵',
    color: 'green',
  });
  await render(wrap(value, <Home />));
  expect(screen.queryByText('Crea tu primera cuenta')).toBeNull();
});
