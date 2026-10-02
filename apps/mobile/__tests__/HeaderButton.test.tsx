import { fireEvent, render, screen } from '@testing-library/react-native';
import { HeaderButton } from '../src/ui/HeaderButton';

test('«Guardar» de la barra superior es un botón con nombre para VoiceOver', async () => {
  const onPress = jest.fn();
  await render(<HeaderButton label="Guardar" onPress={onPress} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Guardar' }));
  expect(onPress).toHaveBeenCalledTimes(1);
});
