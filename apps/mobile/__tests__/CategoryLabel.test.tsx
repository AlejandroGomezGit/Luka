import { render, screen } from '@testing-library/react-native';
import { CategoryLabel } from '../src/ui/CategoryLabel';

test('HU-07 una categoría se muestra con su emoji y su nombre, y VoiceOver lee el nombre', async () => {
  await render(<CategoryLabel name="Supermercado" icon="🛒" color="orange" />);
  expect(screen.getByLabelText('Supermercado')).toBeOnTheScreen();
  expect(screen.getByText('Supermercado')).toBeOnTheScreen();
  // El emoji es decorativo junto al nombre: está, pero VoiceOver no lo anuncia por separado.
  expect(screen.getByText('🛒', { includeHiddenElements: true })).toBeTruthy();
});

test('un ícono antiguo que no es emoji se muestra con el de respaldo, nunca como texto', async () => {
  await render(<CategoryLabel name="Mercado" icon="cart" color="orange" />);
  expect(screen.getByText('🏷️', { includeHiddenElements: true })).toBeTruthy();
  expect(screen.queryByText('cart', { includeHiddenElements: true })).toBeNull();
});
