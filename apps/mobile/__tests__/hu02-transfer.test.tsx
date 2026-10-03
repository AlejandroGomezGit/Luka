import { fireEvent, screen } from '@testing-library/react-native';
import { Stack } from 'expo-router';
import { renderRouter } from 'expo-router/testing-library';
import type { ReactNode } from 'react';
import Home from '../src/app/(tabs)/index';
import NewTransactionScreen from '../src/app/transactions/new';
import { type AccountFormValues, createAccount } from '../src/db/accounts';
import { seedPredefinedCategories } from '../src/db/categories';
import { LocalSessionProvider, type LocalSession } from '../src/db/session';
import { createTestDb, testClock, testRandom } from '../src/db/testing';
import { blockNetwork, headerTitles } from '../src/testing';

// Sin red durante todo el flujo, como en HU-03.
const networkAttempts = blockNetwork();

async function app(accounts: AccountFormValues[]): Promise<LocalSession> {
  const value = {
    db: await createTestDb(),
    userId: '0199a6f0-0000-7000-8000-000000000001',
    deviceId: 'd1',
    // 1 de octubre de 2026 a mediodía en Bogotá.
    clock: testClock(Date.UTC(2026, 9, 1, 17)),
    random: testRandom(),
  };
  seedPredefinedCategories(value);
  for (const account of accounts) {
    const result = createAccount(value, account);
    if (!result.ok) throw new Error(result.errors.join());
  }
  const wrapper = ({ children }: { children: ReactNode }) => (
    <LocalSessionProvider value={value}>{children}</LocalSessionProvider>
  );
  await renderRouter(
    { _layout: () => <Stack />, index: Home, 'transactions/new': NewTransactionScreen },
    { initialUrl: '/', wrapper },
  );
  return value;
}

const cash: AccountFormValues = {
  name: 'Efectivo',
  type: 'cash',
  currency: 'COP',
  openingAmountMinor: 120_000_00,
  icon: '💵',
  color: 'green',
};

async function transfer(amount: string, arrives?: string) {
  await fireEvent.press(screen.getByRole('button', { name: 'Agregar' }));
  await fireEvent.press(screen.getByRole('radio', { name: 'Transferencia' }));
  expect(headerTitles()).toContain('Nueva transferencia');
  await fireEvent.changeText(screen.getByLabelText('Monto'), amount);
  if (arrives !== undefined) {
    await fireEvent.changeText(screen.getByLabelText(/^Llega a /), arrives);
  }
  await fireEvent.press(screen.getByRole('button', { name: 'Guardar' }));
}

test('HU-02 desde Agregar se transfiere de COP a USD y en Inicio cada saldo cambia en su propia moneda, sin red', async () => {
  await app([
    cash,
    { ...cash, name: 'Dolares', currency: 'USD', openingAmountMinor: 100_00, icon: '💵' },
  ]);
  expect(screen.getByText('$ 120.000')).toBeOnTheScreen();
  expect(screen.getByText('US$ 100,00')).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole('button', { name: 'Agregar' }));
  await fireEvent.press(screen.getByRole('radio', { name: 'Transferencia' }));
  expect(screen.getByRole('button', { name: 'Desde Efectivo, COP' })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Hacia Dolares, USD' })).toBeOnTheScreen();
  await fireEvent.changeText(screen.getByLabelText('Monto'), '100000');
  await fireEvent.changeText(screen.getByLabelText('Llega a Dolares · USD'), '25');
  await fireEvent.press(screen.getByRole('button', { name: 'Guardar' }));
  expect(
    screen.getByText('Transferencia guardada: $ 100.000 de Efectivo a Dolares (llegan US$ 25,00)'),
  ).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole('button', { name: 'Listo' }));
  expect(screen.getByText('$ 20.000')).toBeOnTheScreen();
  expect(screen.getByText('US$ 125,00')).toBeOnTheScreen();
  expect(networkAttempts).toEqual([]);
});

test('HU-02 pagar 200.000 a una tarjeta con deuda de 500.000 deja «Debes $ 300.000» y pagar de más deja «A favor», sin red', async () => {
  await app([
    { ...cash, name: 'Ahorro', type: 'savings', openingAmountMinor: 1_000_000_00, icon: '🐷' },
    { ...cash, name: 'Visa', type: 'credit_card', openingAmountMinor: 500_000_00, icon: '💳' },
  ]);
  expect(screen.getByText('Debes $ 500.000')).toBeOnTheScreen();

  await transfer('200000');
  await fireEvent.press(screen.getByRole('button', { name: 'Listo' }));
  expect(screen.getByText('Debes $ 300.000')).toBeOnTheScreen();

  await transfer('350000');
  await fireEvent.press(screen.getByRole('button', { name: 'Listo' }));
  expect(screen.getByText('A favor $ 50.000')).toBeOnTheScreen();
  expect(screen.getByText('$ 450.000')).toBeOnTheScreen();
  expect(networkAttempts).toEqual([]);
});
