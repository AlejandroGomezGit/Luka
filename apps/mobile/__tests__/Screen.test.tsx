import { render, screen } from '@testing-library/react-native';
import { useEffect } from 'react';
import { Text } from 'react-native';
import { Screen } from '../src/ui/Screen';

let mockFontScale = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 393, height: 852, scale: 3, fontScale: mockFontScale }),
}));

const mounts = jest.fn();
function Probe() {
  useEffect(() => {
    mounts();
  }, []);
  return <Text>contenido</Text>;
}

// Un elemento nuevo en cada render: con el mismo objeto React no vuelve a renderizar Screen.
const tree = () => (
  <Screen>
    <Probe />
  </Screen>
);

test('#39 al cambiar Dynamic Type con la pantalla abierta, el contenido se vuelve a montar para medir el texto de nuevo', async () => {
  const view = await render(tree());
  expect(mounts).toHaveBeenCalledTimes(1);
  // Mismo tamaño: no se vuelve a montar.
  await view.rerender(tree());
  expect(mounts).toHaveBeenCalledTimes(1);
  mockFontScale = 3.1;
  await view.rerender(tree());
  expect(mounts).toHaveBeenCalledTimes(2);
  expect(screen.getByText('contenido')).toBeOnTheScreen();
});
