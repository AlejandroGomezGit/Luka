import { act, fireEvent, screen } from '@testing-library/react-native';
import { Stack } from 'expo-router';
import { renderRouter } from 'expo-router/testing-library';
import type { ReactNode } from 'react';
import { predefinedCategoryId } from '@luka/domain';
import Home from '../src/app/(tabs)/index';
import EditTransactionScreen from '../src/app/transactions/[id]';
import NewTransactionScreen from '../src/app/transactions/new';
import { type AccountFormValues, createAccount } from '../src/db/accounts';
import { seedPredefinedCategories } from '../src/db/categories';
import { LocalSessionProvider, type LocalSession } from '../src/db/session';
import { createTestDb, testClock, testRandom } from '../src/db/testing';
import { createTransaction } from '../src/db/transactions';
import { blockNetwork, headerTitles } from '../src/testing';
import { UndoProvider } from '../src/undo';

// El mock de React Native para Jest reporta fontScale 2 (tamaño de accesibilidad); aquí, texto normal.
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 393, height: 852, scale: 3, fontScale: 1 }),
}));

// Sin red durante todo el flujo, como en HU-03.
const networkAttempts = blockNetwork();
const userId = '0199a6f0-0000-7000-8000-000000000001';
const BOGOTA = 'America/Bogota';
const deleted = 'Movimiento eliminado. Puedes deshacerlo.';

const cash: AccountFormValues = {
  name: 'Efectivo',
  type: 'cash',
  currency: 'COP',
  openingAmountMinor: 120_000_00,
  icon: '💵',
  color: 'green',
};

async function app(
  accounts: AccountFormValues[],
  seed: (session: LocalSession, ids: string[]) => void = () => undefined,
) {
  const value: LocalSession = {
    db: await createTestDb(),
    userId,
    deviceId: 'd1',
    // 1 de octubre de 2026 a mediodía en Bogotá.
    clock: testClock(Date.UTC(2026, 9, 1, 17)),
    random: testRandom(),
  };
  seedPredefinedCategories(value);
  const ids = accounts.map((account) => {
    const result = createAccount(value, account);
    if (!result.ok) throw new Error(result.errors.join());
    return result.id;
  });
  seed(value, ids);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <LocalSessionProvider value={value}>{children}</LocalSessionProvider>
  );
  await renderRouter(
    {
      _layout: () => (
        <UndoProvider>
          <Stack />
        </UndoProvider>
      ),
      index: Home,
      'transactions/new': NewTransactionScreen,
      'transactions/[id]': EditTransactionScreen,
    },
    { initialUrl: '/', wrapper },
  );
}

test('HU-04 sin movimientos, Recientes dice «Aún no tienes movimientos»', async () => {
  await app([cash]);
  expect(screen.getByRole('header', { name: 'Recientes' })).toBeOnTheScreen();
  expect(screen.getByText('Aún no tienes movimientos')).toBeOnTheScreen();
});

test('HU-04 desde Recientes se edita un gasto y cambia el saldo; al borrarlo sale de Recientes y del saldo, y Deshacer lo devuelve, sin red', async () => {
  await app([cash], (session, [id]) => {
    createTransaction(
      session,
      {
        kind: 'expense',
        amountMinor: 12_500_00,
        accountId: id ?? '',
        categoryId: predefinedCategoryId(userId, 'food.groceries'),
        occurredOn: '2026-10-01',
      },
      BOGOTA,
    );
  });
  expect(screen.getByText('$ 107.500')).toBeOnTheScreen();
  await fireEvent.press(
    screen.getByRole('button', {
      name: 'Gasto, -$ 12.500, Supermercado, Alimentación, Efectivo, hoy',
    }),
  );
  expect(headerTitles()).toContain('Editar gasto');
  expect(screen.getByLabelText('Monto')).toHaveDisplayValue('12.500');
  await fireEvent.changeText(screen.getByLabelText('Monto'), '20000');
  await fireEvent.press(screen.getByRole('button', { name: 'Guardar' }));
  expect(screen.getByText('$ 100.000')).toBeOnTheScreen();
  expect(screen.getByText('-$ 20.000')).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole('button', { name: /^Gasto, -\$ 20\.000/ }));
  await fireEvent.press(screen.getByRole('button', { name: 'Eliminar movimiento' }));
  expect(screen.getByText('$ 120.000')).toBeOnTheScreen();
  expect(screen.queryByText('-$ 20.000')).toBeNull();
  expect(screen.getByText('Aún no tienes movimientos')).toBeOnTheScreen();
  expect(screen.getByText(deleted)).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole('button', { name: 'Deshacer' }));
  expect(screen.queryByText(deleted)).toBeNull();
  expect(screen.getByText('$ 100.000')).toBeOnTheScreen();
  expect(screen.getByText('-$ 20.000')).toBeOnTheScreen();
  expect(networkAttempts).toEqual([]);
});

test('HU-04 editar y borrar una transferencia cambia los dos saldos, y Deshacer los devuelve', async () => {
  await app(
    [
      { ...cash, name: 'Ahorro', type: 'savings', openingAmountMinor: 1_000_000_00, icon: '🐷' },
      cash,
    ],
    (session, [savings, wallet]) => {
      createTransaction(
        session,
        {
          kind: 'transfer',
          amountMinor: 50_000_00,
          accountId: savings ?? '',
          toAccountId: wallet ?? '',
          toAmountMinor: null,
          occurredOn: '2026-10-01',
        },
        BOGOTA,
      );
    },
  );
  expect(screen.getByText('$ 950.000')).toBeOnTheScreen();
  expect(screen.getByText('$ 170.000')).toBeOnTheScreen();
  await fireEvent.press(
    screen.getByRole('button', { name: /^Transferencia, \$ 50\.000, de Ahorro a Efectivo/ }),
  );
  expect(headerTitles()).toContain('Editar transferencia');
  await fireEvent.changeText(screen.getByLabelText('Monto'), '30000');
  await fireEvent.press(screen.getByRole('button', { name: 'Guardar' }));
  expect(screen.getByText('$ 970.000')).toBeOnTheScreen();
  expect(screen.getByText('$ 150.000')).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole('button', { name: /^Transferencia, \$ 30\.000/ }));
  await fireEvent.press(screen.getByRole('button', { name: 'Eliminar movimiento' }));
  expect(screen.getByText('$ 1.000.000')).toBeOnTheScreen();
  expect(screen.getByText('$ 120.000')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Deshacer' }));
  expect(screen.getByText('$ 970.000')).toBeOnTheScreen();
  expect(screen.getByText('$ 150.000')).toBeOnTheScreen();
  expect(networkAttempts).toEqual([]);
});

test('HU-04 el aviso de Deshacer se cierra solo a los 8 segundos y el borrado queda hecho', async () => {
  await app([cash], (session, [id]) => {
    createTransaction(
      session,
      {
        kind: 'expense',
        amountMinor: 1_000_00,
        accountId: id ?? '',
        categoryId: null,
        occurredOn: '2026-10-01',
      },
      BOGOTA,
    );
  });
  await fireEvent.press(screen.getByRole('button', { name: /^Gasto, -\$ 1\.000/ }));
  await fireEvent.press(screen.getByRole('button', { name: 'Eliminar movimiento' }));
  expect(screen.getByText(deleted)).toBeOnTheScreen();
  // Deja que se resuelva la consulta a VoiceOver (inactivo en las pruebas) antes de contar los 8 s.
  await act(async () => {
    await Promise.resolve();
  });
  await act(() => {
    jest.advanceTimersByTime(7_999);
  });
  expect(screen.getByText(deleted)).toBeOnTheScreen();
  await act(() => {
    jest.advanceTimersByTime(1);
  });
  expect(screen.queryByText(deleted)).toBeNull();
  expect(screen.getByText('Aún no tienes movimientos')).toBeOnTheScreen();
  expect(screen.getByText('$ 120.000')).toBeOnTheScreen();
});
