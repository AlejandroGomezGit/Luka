import { act, fireEvent, screen } from '@testing-library/react-native';
import { Stack } from 'expo-router';
import { renderRouter } from 'expo-router/testing-library';
import type { ReactNode } from 'react';
import { AccessibilityInfo } from 'react-native';
import { predefinedCategoryId } from '@luka/domain';
import Home from '../src/app/(tabs)/index';
import MovementsScreen from '../src/app/(tabs)/movements';
import EditTransactionScreen from '../src/app/transactions/[id]';
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

interface Seed {
  cash: string;
  dollars: string;
  session: LocalSession;
}

async function app(seed: (s: Seed) => void = () => undefined, initialUrl = '/movements') {
  // 2 de octubre de 2026 a mediodía en Bogotá.
  const clock = testClock(Date.UTC(2026, 9, 2, 17));
  const session: LocalSession = {
    db: await createTestDb(),
    userId,
    deviceId: 'd1',
    clock,
    random: testRandom(),
  };
  seedPredefinedCategories(session);
  const account = (name: string, currency: 'COP' | 'USD') => {
    const result = createAccount(session, {
      name,
      type: 'cash',
      currency,
      openingAmountMinor: 0,
      icon: '💵',
      color: 'green',
    });
    if (!result.ok) throw new Error(result.errors.join());
    return result.id;
  };
  const cash = account('Efectivo', 'COP');
  const dollars = account('Dolares', 'USD');
  seed({ cash, dollars, session });
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
      movements: MovementsScreen,
      'transactions/[id]': EditTransactionScreen,
    },
    { initialUrl, wrapper },
  );
  return session;
}

function expenses(s: Seed, total: number, note = 'Almuerzo') {
  for (let i = 0; i < total; i++) {
    (s.session.clock as ReturnType<typeof testClock>).advance(1_000);
    const day = String((i % 28) + 1).padStart(2, '0');
    const result = createTransaction(
      s.session,
      {
        kind: 'expense',
        amountMinor: (i + 1) * 1_000_00,
        accountId: s.cash,
        categoryId: cat('food.restaurants'),
        occurredOn: `2026-09-${day}`,
        note: `${note} ${String(i + 1)}`,
      },
      BOGOTA,
    );
    if (!result.ok) throw new Error(result.errors.join());
  }
}

const settle = () =>
  act(async () => {
    await Promise.resolve();
  });

test('HU-05 la pestaña Movimientos agrupa por día con encabezados para VoiceOver y usa la fila de movimiento', async () => {
  await app((s) => {
    createTransaction(
      s.session,
      {
        kind: 'expense',
        amountMinor: 12_500_00,
        accountId: s.cash,
        categoryId: cat('food.groceries'),
        occurredOn: '2026-10-02',
      },
      BOGOTA,
    );
    createTransaction(
      s.session,
      {
        kind: 'expense',
        amountMinor: 8_000_00,
        accountId: s.cash,
        categoryId: null,
        occurredOn: '2026-09-30',
      },
      BOGOTA,
    );
  });
  expect(screen.getByRole('header', { name: 'Movimientos' })).toBeOnTheScreen();
  expect(screen.queryByText('Disponible pronto')).toBeNull();
  expect(screen.getByRole('header', { name: 'Hoy · viernes 2 de octubre' })).toBeOnTheScreen();
  expect(screen.getByRole('header', { name: 'Miércoles 30 de septiembre' })).toBeOnTheScreen();
  expect(
    screen.getByRole('button', {
      name: 'Gasto, -$ 12.500, Supermercado, Alimentación, Efectivo, hoy',
    }),
  ).toBeOnTheScreen();
  expect(networkAttempts).toEqual([]);
});

test('HU-05 sin movimientos dice «Aún no tienes movimientos»', async () => {
  await app();
  expect(screen.getByText('Aún no tienes movimientos')).toBeOnTheScreen();
});

test('HU-05 carga de a 50 y agrega la siguiente página al llegar al final', async () => {
  await app((s) => {
    expenses(s, 120);
  });
  const list = screen.getByLabelText('Lista de movimientos: 50 de 120');
  await fireEvent(list, 'endReached');
  expect(screen.getByLabelText('Lista de movimientos: 100 de 120')).toBeOnTheScreen();
  await fireEvent(screen.getByLabelText('Lista de movimientos: 100 de 120'), 'endReached');
  expect(screen.getByLabelText('Lista de movimientos: 120 de 120')).toBeOnTheScreen();
});

test('HU-05 los chips de tipo filtran; sin resultados se ofrece «Quitar filtros»', async () => {
  await app((s) => {
    expenses(s, 3);
  });
  await fireEvent.press(screen.getByRole('radio', { name: 'Ingresos' }));
  expect(screen.getByText('No hay movimientos con estos filtros')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Quitar filtros' }));
  expect(screen.getByLabelText('Lista de movimientos: 3 de 3')).toBeOnTheScreen();
});

test('HU-05 buscar espera 250 ms, filtra y anuncia cuántos movimientos hay', async () => {
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
  await app((s) => {
    expenses(s, 3, 'Almuerzo');
    expenses(s, 2, 'Café');
  });
  await fireEvent.changeText(screen.getByLabelText('Buscar movimientos'), 'cafe');
  expect(screen.getByLabelText('Lista de movimientos: 5 de 5')).toBeOnTheScreen();
  await act(() => {
    jest.advanceTimersByTime(250);
  });
  expect(screen.getByLabelText('Lista de movimientos: 2 de 2')).toBeOnTheScreen();
  expect(announce).toHaveBeenCalledWith('2 movimientos');
});

test('HU-05 la hoja de filtros combina cuenta, categoría, fechas y monto con su moneda', async () => {
  await app((s) => {
    expenses(s, 4);
    createTransaction(
      s.session,
      {
        kind: 'expense',
        amountMinor: 30_00,
        accountId: s.dollars,
        categoryId: null,
        occurredOn: '2026-09-15',
      },
      BOGOTA,
    );
  });
  await fireEvent.press(screen.getByRole('button', { name: 'Filtros' }));
  await fireEvent.press(screen.getByRole('radio', { name: 'Efectivo' }));
  await fireEvent.press(screen.getByRole('radio', { name: 'Alimentación' }));
  await fireEvent.press(screen.getByRole('radio', { name: 'Mes pasado' }));
  // Hay cuentas en COP y en USD: el monto pide la moneda.
  await fireEvent.press(screen.getByRole('radio', { name: 'COP' }));
  await fireEvent.changeText(screen.getByLabelText('Monto mínimo'), '2000');
  await fireEvent.changeText(screen.getByLabelText('Monto máximo'), '3000');
  await fireEvent.press(screen.getByRole('button', { name: 'Ver resultados' }));
  // Gastos de 2.000 y 3.000 en septiembre (mes pasado desde el 2 de octubre).
  expect(screen.getByLabelText('Lista de movimientos: 2 de 2')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Filtros, 4 activos' })).toBeOnTheScreen();
});

test('HU-05 al editar o borrar desde la lista y volver se conservan filtros y movimientos cargados; Deshacer devuelve la fila a su lugar', async () => {
  await app((s) => {
    expenses(s, 120);
  });
  await fireEvent.press(screen.getByRole('radio', { name: 'Gastos' }));
  await fireEvent(screen.getByLabelText('Lista de movimientos: 50 de 120'), 'endReached');
  expect(screen.getByLabelText('Lista de movimientos: 100 de 120')).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole('button', { name: /^Gasto, -\$ 112\.000/ }));
  await fireEvent.press(screen.getByRole('button', { name: 'Eliminar movimiento' }));
  await settle();
  expect(screen.getByRole('radio', { name: 'Gastos' })).toBeSelected();
  expect(screen.getByLabelText('Lista de movimientos: 100 de 119')).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: /^Gasto, -\$ 112\.000/ })).toBeNull();

  await fireEvent.press(screen.getByRole('button', { name: 'Deshacer' }));
  expect(screen.getByLabelText('Lista de movimientos: 100 de 120')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: /^Gasto, -\$ 112\.000/ })).toBeOnTheScreen();
});

test('HU-05 «Ver todos» en Recientes lleva a Movimientos', async () => {
  await app((s) => {
    expenses(s, 1);
  }, '/');
  await fireEvent.press(screen.getByRole('button', { name: 'Ver todos' }));
  expect(screen.getByRole('header', { name: 'Movimientos' })).toBeOnTheScreen();
});
