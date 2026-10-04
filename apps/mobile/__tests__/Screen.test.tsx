import { render, screen } from '@testing-library/react-native';
import { useEffect } from 'react';
import { StyleSheet, Text, type ViewStyle } from 'react-native';
import { Screen } from '../src/ui/Screen';

let mockFontScale = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 393, height: 852, scale: 3, fontScale: mockFontScale }),
}));

let mockBottomInset = 0;
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual<object>('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: mockBottomInset, left: 0 }),
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

test('HU-02 HU-03 con el teclado abierto, el primer toque en una opción la selecciona en vez de solo cerrar el teclado', async () => {
  await render(tree());
  expect(screen.root?.props.keyboardShouldPersistTaps).toBe('handled');
});

test('T-044 el final del contenido queda por encima de la barra de pestañas flotante (área segura inferior)', async () => {
  // Dentro de las pestañas, el área segura inferior incluye la barra: 34 pt del indicador + 49 de la barra.
  mockBottomInset = 83;
  await render(
    <Screen contentContainerStyle={{ padding: 16 }}>
      <Text>contenido</Text>
    </Screen>,
  );
  const style = StyleSheet.flatten(screen.root?.props.contentContainerStyle as never) as ViewStyle;
  expect(style.paddingBottom).toBe(16 + 83);
  // Arriba, el ajuste automático deja libre la barra de estado y el título grande.
  expect(screen.root?.props.contentInsetAdjustmentBehavior).toBe('automatic');
});

test('HU-03 HU-06 al abrirse el teclado, el contenido sube y el campo enfocado queda visible (iOS)', async () => {
  await render(tree());
  // React Native 0.86 (Fabric): ajusta el margen inferior al teclado y desplaza hasta el TextInput
  // enfocado (RCTScrollViewComponentView, _keyboardWillChangeFrame). Se verifica en un iPhone real.
  expect(screen.root?.props.automaticallyAdjustKeyboardInsets).toBe(true);
});
