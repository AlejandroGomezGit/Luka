import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { DatabaseProvider } from '../src/db/DatabaseProvider';

jest.mock('../src/db/database', () => ({ expoDb: {}, localDb: {} }));
jest.mock('drizzle-orm/expo-sqlite/migrator', () => ({
  useMigrations: () => ({ success: false, error: new Error('falló la migración') }),
}));

test('si la migración falla, no recomienda reinstalar sin advertir que se borrarían los datos sin sincronizar', async () => {
  await render(
    <DatabaseProvider>
      <Text>app</Text>
    </DatabaseProvider>,
  );
  expect(screen.getByRole('header', { name: 'No se pudo preparar tus datos' })).toBeOnTheScreen();
  expect(
    screen.getByText(
      'Cierra la app y vuelve a abrirla. Si el problema sigue, no la reinstales todavía: reinstalarla borra los datos guardados en este iPhone que aún no se han sincronizado.',
    ),
  ).toBeOnTheScreen();
  expect(screen.queryByText('app')).toBeNull();
});
