import { fireEvent, screen } from '@testing-library/react-native';
import { predefinedCategoryId } from '@luka/domain';
import { Stack } from 'expo-router';
import { renderRouter } from 'expo-router/testing-library';
import type { ReactNode } from 'react';
import Home from '../src/app/(tabs)/index';
import AccountsScreen from '../src/app/accounts/index';
import NewTransactionScreen from '../src/app/transactions/new';
import { createAccount } from '../src/db/accounts';
import { seedPredefinedCategories } from '../src/db/categories';
import { LocalSessionProvider, type LocalSession } from '../src/db/session';
import { createTestDb, testClock, testRandom } from '../src/db/testing';
import { createTransaction } from '../src/db/transactions';
import { blockNetwork } from '../src/testing';

const networkAttempts = blockNetwork();
const userId = '0199a6f0-0000-7000-8000-000000000001';
const HELP = 'Saldo negativo: revisa los movimientos o corrige el saldo inicial';

/** Efectivo sin saldo inicial con un gasto de 25.000 (queda en -25.000) y una Visa con deuda. */
async function app() {
  const session: LocalSession = {
    db: await createTestDb(),
    userId,
    deviceId: 'd1',
    clock: testClock(Date.UTC(2026, 9, 1, 17)),
    random: testRandom(),
  };
  seedPredefinedCategories(session);
  const add = (name: string, type: 'cash' | 'credit_card', openingAmountMinor: number) => {
    const result = createAccount(session, {
      name,
      type,
      currency: 'COP',
      openingAmountMinor,
      icon: '💵',
      color: 'green',
    });
    if (!result.ok) throw new Error(result.errors.join());
    return result.id;
  };
  const cash = add('Efectivo', 'cash', 0);
  add('Visa', 'credit_card', 500_000_00);
  createTransaction(
    session,
    {
      kind: 'expense',
      amountMinor: 25_000_00,
      accountId: cash,
      categoryId: predefinedCategoryId(userId, 'food.groceries'),
      occurredOn: '2026-10-01',
    },
    'America/Bogota',
  );
  const wrapper = ({ children }: { children: ReactNode }) => (
    <LocalSessionProvider value={session}>{children}</LocalSessionProvider>
  );
  await renderRouter(
    {
      _layout: () => <Stack />,
      index: Home,
      'accounts/index': AccountsScreen,
      'transactions/new': NewTransactionScreen,
    },
    { initialUrl: '/', wrapper },
  );
}

test('HU-02 Inicio y Cuentas muestran la ayuda solo en el efectivo en negativo, no en la tarjeta, sin red', async () => {
  await app();
  expect(
    screen.getByRole('button', { name: 'Efectivo, Efectivo, saldo negativo, menos 25.000 pesos' }),
  ).toBeOnTheScreen();
  expect(screen.getAllByText(HELP)).toHaveLength(1);
  expect(screen.getByText('Debes $ 500.000')).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole('button', { name: 'Cuentas' }));
  expect(
    screen.getByRole('button', { name: 'Efectivo, Efectivo, saldo negativo, menos 25.000 pesos' }),
  ).toBeOnTheScreen();
  expect(screen.getAllByText(HELP)).toHaveLength(1);
  expect(networkAttempts).toEqual([]);
});

test('HU-02 en el formulario, «Saldo de la cuenta» muestra el aviso solo si la cuenta no es de crédito', async () => {
  await app();
  await fireEvent.press(screen.getByRole('button', { name: 'Agregar' }));
  expect(screen.getByText('Saldo de la cuenta: -$ 25.000')).toBeOnTheScreen();
  expect(screen.getByText(HELP)).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole('button', { name: 'Pagado con Efectivo, COP' }));
  await fireEvent.press(screen.getByRole('button', { name: /^Visa,/ }));
  expect(screen.getByText('Saldo de la cuenta: Debes $ 500.000')).toBeOnTheScreen();
  expect(screen.queryByText(HELP)).toBeNull();
  expect(networkAttempts).toEqual([]);
});
