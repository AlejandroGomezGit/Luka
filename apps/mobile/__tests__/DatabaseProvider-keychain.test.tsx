import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { DatabaseProvider } from '../src/db/DatabaseProvider';
import { prepareLocalData } from '../src/db/prepare';

jest.mock('../src/db/database', () => ({ expoDb: {}, localDb: {} }));
jest.mock('drizzle-orm/expo-sqlite/migrator', () => ({
  useMigrations: () => ({ success: true, error: undefined }),
}));
jest.mock('../src/db/prepare', () => ({ prepareLocalData: jest.fn() }));
// Tareas de después del primer render: aquí no hay base real.
jest.mock('../src/db/transactions', () => ({ fillSearchInBackground: jest.fn() }));
jest.mock('../src/files/receipts', () => ({ purgeReceiptFiles: jest.fn() }));

const prepare = jest.mocked(prepareLocalData);

test('T-019c1a si falla el borrado del Keychain, la app no arranca y «Reintentar» vuelve a preparar los datos', async () => {
  prepare
    .mockRejectedValueOnce(new Error('Keychain no disponible'))
    .mockResolvedValueOnce({ deviceId: 'd1', userId: 'u1' });
  await render(
    <DatabaseProvider>
      <Text>app</Text>
    </DatabaseProvider>,
  );
  expect(
    await screen.findByRole('header', { name: 'No se pudo preparar tus datos' }),
  ).toBeOnTheScreen();
  expect(screen.queryByText('app')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Reintentar' }));
  expect(await screen.findByText('app')).toBeOnTheScreen();
  expect(prepare).toHaveBeenCalledTimes(2);
});
