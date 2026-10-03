import { fireEvent, screen } from '@testing-library/react-native';
import { Stack } from 'expo-router';
import { renderRouter } from 'expo-router/testing-library';
import type { ReactNode } from 'react';
import { transactions } from '@luka/schema-sqlite';
import Home from '../src/app/index';
import NewTransactionScreen from '../src/app/transactions/new';
import { createAccount } from '../src/db/accounts';
import { seedPredefinedCategories } from '../src/db/categories';
import { LocalSessionProvider, type LocalSession } from '../src/db/session';
import { createTestDb, testClock, testRandom } from '../src/db/testing';

async function session(): Promise<LocalSession> {
  const db = await createTestDb();
  // 1 de octubre de 2026 a mediodía en Bogotá.
  const value = {
    db,
    userId: '0199a6f0-0000-7000-8000-000000000001',
    deviceId: 'd1',
    clock: testClock(Date.UTC(2026, 9, 1, 17)),
    random: testRandom(),
  };
  seedPredefinedCategories(value);
  createAccount(value, {
    name: 'Efectivo',
    type: 'cash',
    currency: 'COP',
    openingAmountMinor: 120_000_00,
    icon: '💵',
    color: 'green',
  });
  return value;
}

test('HU-03 desde Inicio se llega a «Guardar» en 3 toques, sin red, y el saldo de la cuenta se actualiza al volver', async () => {
  const value = await session();
  const fetchSpy = jest.spyOn(global, 'fetch');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <LocalSessionProvider value={value}>{children}</LocalSessionProvider>
  );
  await renderRouter(
    { _layout: () => <Stack />, index: Home, 'transactions/new': NewTransactionScreen },
    { initialUrl: '/', wrapper },
  );
  expect(screen.getByText('$ 120.000')).toBeOnTheScreen();

  let taps = 0;
  const tap = async (element: Parameters<typeof fireEvent.press>[0]) => {
    taps += 1;
    await fireEvent.press(element);
  };
  await tap(screen.getByRole('button', { name: 'Agregar' }));
  // Escribir el monto es teclado: no cuenta como toque (documento 01, HU-03).
  await fireEvent.changeText(screen.getByLabelText('Monto'), '12500');
  await tap(screen.getByRole('radio', { name: 'Supermercado, Alimentación' }));
  await tap(screen.getByRole('button', { name: 'Guardar' }));
  expect(taps).toBeLessThanOrEqual(3);

  const saved = value.db.select().from(transactions).all();
  expect(saved).toHaveLength(1);
  expect(saved[0]?.amountMinor).toBe(-1_250_000);
  expect(fetchSpy).not.toHaveBeenCalled();

  await fireEvent.press(screen.getByRole('button', { name: 'Listo' }));
  expect(screen.getByText('$ 107.500')).toBeOnTheScreen();
});
