import { act, fireEvent, screen } from '@testing-library/react-native';
import { router, Stack } from 'expo-router';
import { renderRouter } from 'expo-router/testing-library';
import type { ReactNode } from 'react';
import TabsLayout from '../src/app/(tabs)/_layout';
import Home from '../src/app/(tabs)/index';
import Movements from '../src/app/(tabs)/movements';
import Summary from '../src/app/(tabs)/summary';
import { LocalSessionProvider } from '../src/db/session';
import { createTestDb, testClock, testRandom } from '../src/db/testing';
import { Text } from 'react-native';

async function renderApp() {
  const value = {
    db: await createTestDb(),
    userId: 'u1',
    deviceId: 'd1',
    clock: testClock(Date.UTC(2026, 9, 2, 15)),
    random: testRandom(),
  };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <LocalSessionProvider value={value}>{children}</LocalSessionProvider>
  );
  await renderRouter(
    {
      _layout: () => <Stack />,
      '(tabs)/_layout': TabsLayout,
      '(tabs)/index': Home,
      '(tabs)/movements': Movements,
      '(tabs)/summary': Summary,
      'accounts/index': () => <Text>Pantalla de cuentas</Text>,
      'categories/index': () => <Text>Pantalla de categorías</Text>,
    },
    { initialUrl: '/', wrapper },
  );
}

// Los botones de la barra de pestañas son nativos: las pruebas navegan por ruta.
test('T-044 T-016 T-017 Movimientos y Resumen ya no son marcadores de posición', async () => {
  await renderApp();
  expect(screen.getByRole('header', { name: 'Tus gastos' })).toBeOnTheScreen();
  await act(() => router.navigate('/movements'));
  expect(screen.getByRole('header', { name: 'Movimientos' })).toBeOnTheScreen();
  expect(screen.getByLabelText('Buscar movimientos')).toBeOnTheScreen();
  await act(() => router.navigate('/summary'));
  expect(screen.getByRole('header', { name: 'Resumen' })).toBeOnTheScreen();
  // Movimientos (T-016) y Resumen (T-017) reemplazaron sus marcadores.
  expect(screen.getByRole('button', { name: 'Mes anterior' })).toBeOnTheScreen();
  expect(screen.queryAllByText('Disponible pronto')).toHaveLength(0);
});

test('T-044 «Administrar» al final de Inicio lleva a Cuentas y Categorías, con etiquetas para VoiceOver', async () => {
  await renderApp();
  expect(screen.getByRole('header', { name: 'Administrar' })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Cuentas' }).props.accessibilityHint).toBe(
    'Abre la lista de tus cuentas',
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Categorías' }));
  expect(screen.getByText('Pantalla de categorías')).toBeOnTheScreen();
});
