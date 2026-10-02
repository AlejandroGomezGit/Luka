import { render, screen } from '@testing-library/react-native';
import { CategoryLabel } from '../src/ui/CategoryLabel';

// El ícono está oculto para VoiceOver, así que hay que pedirlo con includeHiddenElements.
const icon = () => screen.getByTestId('category-icon', { includeHiddenElements: true });

test('HU-07 una categoría se muestra con ícono y nombre, y VoiceOver lee el nombre', async () => {
  await render(<CategoryLabel name="Supermercado" icon="cart" color="orange" />);
  expect(screen.getByLabelText('Supermercado')).toBeOnTheScreen();
  expect(screen.getByText('Supermercado')).toBeOnTheScreen();
  // El ícono es decorativo: está, pero VoiceOver no lo anuncia por separado.
  expect(icon()).toHaveProp('accessibilityElementsHidden', true);
});

test('HU-07 un token de ícono desconocido igual muestra un ícono (el de respaldo), nunca un hueco', async () => {
  await render(<CategoryLabel name="Mercado" icon="food" color="desconocido" />);
  expect(icon()).toBeTruthy();
  expect(screen.getByText('Mercado')).toBeOnTheScreen();
});
