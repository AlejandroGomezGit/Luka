import { fireEvent, getDefaultNormalizer, screen } from '@testing-library/react-native';
import { Stack } from 'expo-router';
import { renderRouter } from 'expo-router/testing-library';
import type { ReactNode } from 'react';
import { predefinedCategoryId } from '@luka/domain';
import Home from '../src/app/(tabs)/index';
import MovementsScreen from '../src/app/(tabs)/movements';
import SummaryScreen from '../src/app/(tabs)/summary';
import { createAccount } from '../src/db/accounts';
import { seedPredefinedCategories } from '../src/db/categories';
import { LocalSessionProvider, type LocalSession } from '../src/db/session';
import { createTestDb, testClock, testRandom } from '../src/db/testing';
import { createTransaction } from '../src/db/transactions';
import { blockNetwork } from '../src/testing';
import { UndoProvider } from '../src/undo';

// Texto normal: el mock de React Native para Jest reporta fontScale 2.
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 393, height: 852, scale: 3, fontScale: 1 }),
}));

const networkAttempts = blockNetwork();
const userId = '0199a6f0-0000-7000-8000-000000000001';
const BOGOTA = 'America/Bogota';
const cat = (key: string) => predefinedCategoryId(userId, key);

async function app(initialUrl = '/summary', withDollars = true) {
  // 3 de octubre de 2026 a mediodía en Bogotá.
  const clock = testClock(Date.UTC(2026, 9, 3, 17));
  const session: LocalSession = {
    db: await createTestDb(),
    userId,
    deviceId: 'd1',
    clock,
    random: testRandom(),
  };
  seedPredefinedCategories(session);
  const account = (name: string, currency: 'COP' | 'USD') => {
    const r = createAccount(session, {
      name,
      type: 'cash',
      currency,
      openingAmountMinor: 0,
      icon: '💵',
      color: 'green',
    });
    if (!r.ok) throw new Error(r.errors.join());
    return r.id;
  };
  const cash = account('Efectivo', 'COP');
  const dollars = withDollars ? account('Dólares', 'USD') : null;
  const add = (
    kind: 'expense' | 'income',
    amount: number,
    key: string,
    occurredOn: string,
    accountId = cash,
  ) => {
    clock.advance(1_000);
    const r = createTransaction(
      session,
      { kind, amountMinor: amount, accountId, categoryId: cat(key), occurredOn },
      BOGOTA,
    );
    if (!r.ok) throw new Error(r.errors.join());
  };
  add('income', 3_000_000_00, 'salary.other', '2026-09-01');
  add('income', 20_000_00, 'refunds.other', '2026-09-10');
  for (const [key, amount] of [
    ['food.groceries', 100_000],
    ['food.restaurants', 50_000],
    ['transport.taxi_apps', 120_000],
    ['housing.other', 90_000],
    ['utilities.electricity', 40_000],
    ['health.pharmacy', 30_000],
    ['education.other', 20_000],
    ['entertainment.other', 15_000],
    ['shopping.other', 10_000],
  ] as const) {
    add('expense', amount * 100, key, '2026-09-15');
  }
  add('expense', 12_500_00, 'food.groceries', '2026-10-02');
  if (dollars) add('expense', 25_00, 'subscriptions.other', '2026-10-01', dollars);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <LocalSessionProvider value={session}>{children}</LocalSessionProvider>
  );
  await renderRouter(
    {
      _layout: () => (
        <UndoProvider>
          <Stack />
        </UndoProvider>
      ),
      index: Home,
      summary: SummaryScreen,
      movements: MovementsScreen,
    },
    { initialUrl, wrapper },
  );
}

test('HU-08 la pestaña Resumen muestra ingresos, gastos y balance del mes en curso, «hasta hoy», sin red', async () => {
  await app();
  expect(screen.getByRole('header', { name: 'Resumen' })).toBeOnTheScreen();
  expect(screen.queryByText('Disponible pronto')).toBeNull();
  expect(screen.getByText('Octubre 2026 · hasta hoy')).toBeOnTheScreen();
  expect(screen.getByLabelText('Ingresos, $ 0')).toBeOnTheScreen();
  expect(screen.getByLabelText('Gastos, $ 12.500')).toBeOnTheScreen();
  expect(screen.getByLabelText('Balance, -$ 12.500')).toBeOnTheScreen();
  expect(networkAttempts).toEqual([]);
});

test('HU-08 cambiar de mes: el siguiente está deshabilitado en el mes en curso', async () => {
  await app();
  expect(screen.getByRole('button', { name: 'Mes siguiente' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Mes anterior' }));
  expect(screen.getByText('Septiembre 2026')).toBeOnTheScreen();
  expect(screen.getByLabelText('Ingresos, $ 3.020.000')).toBeOnTheScreen();
  expect(screen.getByLabelText('Gastos, $ 475.000')).toBeOnTheScreen();
  expect(screen.getByLabelText('Balance, $ 2.545.000')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Mes siguiente' })).not.toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Mes anterior' }));
  expect(screen.getByText('Sin movimientos en agosto 2026')).toBeOnTheScreen();
});

// Sin colapsar espacios: el normalizador por defecto convierte el espacio de no separación en uno normal.
const exact = getDefaultNormalizer({ collapseWhitespace: false });

test('HU-08 las 6 categorías más grandes y «Otras categorías», con porcentajes que suman 100, leídos por VoiceOver', async () => {
  await app();
  await fireEvent.press(screen.getByRole('button', { name: 'Mes anterior' }));
  const expected = [
    'Alimentación, $ 150.000, 2 movimientos, 32 % de los gastos',
    'Transporte, $ 120.000, 1 movimiento, 25 % de los gastos',
    'Vivienda, $ 90.000, 1 movimiento, 19 % de los gastos',
    'Servicios, $ 40.000, 1 movimiento, 9 % de los gastos',
    'Salud, $ 30.000, 1 movimiento, 6 % de los gastos',
    'Educación, $ 20.000, 1 movimiento, 4 % de los gastos',
    'Otras categorías, $ 25.000, 2 movimientos, 5 % de los gastos',
  ];
  for (const label of expected) expect(screen.getByLabelText(label)).toBeOnTheScreen();
  expect(screen.queryByLabelText(/^Entretenimiento,/)).toBeNull();
  // Espacio de no separación: el «%» no queda solo en otra línea con textos grandes.
  expect(screen.getByText('2 movimientos · 32\u00a0%', { normalizer: exact })).toBeOnTheScreen();
  expect(screen.getByText('2 movimientos · 5\u00a0%', { normalizer: exact })).toBeOnTheScreen();
});

test('HU-08 Ingresos lista los ingresos; los reembolsos cuentan como ingreso y una línea lo explica', async () => {
  await app();
  await fireEvent.press(screen.getByRole('button', { name: 'Mes anterior' }));
  expect(
    screen.getByText(
      'Los reembolsos cuentan como ingresos y las transferencias entre tus cuentas no cuentan.',
    ),
  ).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('radio', { name: 'Ingresos' }));
  expect(
    screen.getByLabelText('Salario, $ 3.000.000, 1 movimiento, 99 % de los ingresos'),
  ).toBeOnTheScreen();
  expect(
    screen.getByLabelText('Reembolsos, $ 20.000, 1 movimiento, 1 % de los ingresos'),
  ).toBeOnTheScreen();
});

test('HU-08 con cuentas en dos monedas se elige la moneda y cada una se resume por separado', async () => {
  await app();
  await fireEvent.press(screen.getByRole('radio', { name: 'USD' }));
  expect(screen.getByLabelText('Gastos, US$ 25,00')).toBeOnTheScreen();
  expect(
    screen.getByLabelText('Suscripciones, US$ 25,00, 1 movimiento, 100 % de los gastos'),
  ).toBeOnTheScreen();
});

test('HU-08 tocar una categoría abre Movimientos filtrado por esa categoría y ese mes, y el contador coincide con el resumen', async () => {
  await app();
  await fireEvent.press(screen.getByRole('button', { name: 'Mes anterior' }));
  await fireEvent.press(
    screen.getByLabelText('Alimentación, $ 150.000, 2 movimientos, 32 % de los gastos'),
  );
  expect(screen.getByRole('header', { name: 'Movimientos' })).toBeOnTheScreen();
  expect(screen.getByLabelText('Lista de movimientos: 2 de 2')).toBeOnTheScreen();
  expect(screen.getByRole('radio', { name: 'Gastos' })).toBeSelected();
});

test('HU-08 «Gastado este mes» en Inicio coincide con el resumen, una línea por moneda', async () => {
  await app('/');
  expect(screen.getByRole('header', { name: 'Gastado este mes' })).toBeOnTheScreen();
  expect(screen.getByLabelText('Gastado este mes en COP, $ 12.500')).toBeOnTheScreen();
  expect(screen.getByLabelText('Gastado este mes en USD, US$ 25,00')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Ver resumen' }));
  expect(screen.getByLabelText('Gastos, $ 12.500')).toBeOnTheScreen();
});

test('HU-08 con una sola moneda no se ofrece elegir moneda', async () => {
  await app('/summary', false);
  expect(screen.queryByRole('radio', { name: 'COP' })).toBeNull();
});
