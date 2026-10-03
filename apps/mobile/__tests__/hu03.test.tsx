import { fireEvent, screen } from '@testing-library/react-native';
import { Stack } from 'expo-router';
import { renderRouter } from 'expo-router/testing-library';
import type { ReactNode } from 'react';
import { transactions } from '@luka/schema-sqlite';
import Home from '../src/app/(tabs)/index';
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
  // Maqueta docs/diseno/Agregar gasto.png: «Cancelar» mientras no se guarde nada.
  expect(screen.getByRole('button', { name: 'Cancelar' })).toBeOnTheScreen();
  // Escribir el monto es teclado: no cuenta como toque (documento 01, HU-03).
  await fireEvent.changeText(screen.getByLabelText('Monto'), '12500');
  await tap(screen.getByRole('radio', { name: 'Supermercado, Alimentación' }));
  expect(screen.getByText('Alimentación › Supermercado')).toBeOnTheScreen();
  await tap(screen.getByRole('button', { name: 'Guardar' }));
  expect(taps).toBeLessThanOrEqual(3);

  const saved = value.db.select().from(transactions).all();
  expect(saved).toHaveLength(1);
  expect(saved[0]?.amountMinor).toBe(-1_250_000);
  expect(fetchSpy).not.toHaveBeenCalled();

  // El formulario queda listo para otro: ya no se cancela nada, se termina con «Listo».
  await fireEvent.press(screen.getByRole('radio', { name: 'Ingreso' }));
  expect(screen.getByRole('button', { name: 'Depositado en Efectivo, COP' })).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Listo' }));
  expect(screen.getByText('$ 107.500')).toBeOnTheScreen();
});

test('HU-03 con una cuenta COP y otra USD, se elige la de dólares en la hoja, se registra 12,50 y Inicio descuenta US$ 12,50', async () => {
  const value = await session();
  const usd = createAccount(value, {
    name: 'Ahorro USD',
    type: 'savings',
    currency: 'USD',
    openingAmountMinor: 100_00,
    icon: '🐷',
    color: 'teal',
  });
  if (!usd.ok) throw new Error(usd.errors.join());
  const wrapper = ({ children }: { children: ReactNode }) => (
    <LocalSessionProvider value={value}>{children}</LocalSessionProvider>
  );
  await renderRouter(
    { _layout: () => <Stack />, index: Home, 'transactions/new': NewTransactionScreen },
    { initialUrl: '/', wrapper },
  );
  expect(screen.getByText('US$ 100,00')).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole('button', { name: 'Agregar' }));
  // La cuenta es lo primero del formulario: una fila grande «Pagado con».
  await fireEvent.press(screen.getByRole('button', { name: 'Pagado con Efectivo, COP' }));
  await fireEvent.press(screen.getByRole('button', { name: /^Ahorro USD,/ }));
  expect(screen.getByRole('button', { name: 'Pagado con Ahorro USD, USD' })).toBeOnTheScreen();
  expect(screen.getByText('US$', { includeHiddenElements: true })).toBeOnTheScreen();
  expect(screen.getByText('USD')).toBeOnTheScreen();
  expect(screen.getByText('Saldo de la cuenta: US$ 100,00')).toBeOnTheScreen();

  await fireEvent.changeText(screen.getByLabelText('Monto'), '12,50');
  expect(screen.getByLabelText('Monto')).toHaveDisplayValue('12,50');
  await fireEvent.press(screen.getByRole('button', { name: 'Guardar' }));

  const saved = value.db.select().from(transactions).all();
  expect(saved).toEqual([
    expect.objectContaining({ accountId: usd.id, amountMinor: -1250, currency: 'USD' }),
  ]);
  await fireEvent.press(screen.getByRole('button', { name: 'Listo' }));
  expect(screen.getByText('US$ 87,50')).toBeOnTheScreen();
  expect(screen.getByText('$ 120.000')).toBeOnTheScreen();
});
