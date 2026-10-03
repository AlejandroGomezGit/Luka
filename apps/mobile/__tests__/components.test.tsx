import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import { radius, sizes } from '../src/theme';
import { Button } from '../src/ui/Button';
import { GroupedCard } from '../src/ui/GroupedCard';
import { ListRow } from '../src/ui/ListRow';
import { TextField } from '../src/ui/TextField';

const style = (element: { props: { style?: unknown } }) =>
  StyleSheet.flatten(element.props.style as never) as Record<string, unknown>;

test('T-044 el botón tiene nombre para VoiceOver, 44 pt de alto mínimo y respeta «deshabilitado»', async () => {
  const onPress = jest.fn();
  const view = await render(<Button label="Agregar" icon="+" onPress={onPress} />);
  const button = screen.getByRole('button', { name: 'Agregar' });
  expect(style(button).minHeight).toBeGreaterThanOrEqual(sizes.touch);
  await fireEvent.press(button);
  expect(onPress).toHaveBeenCalledTimes(1);

  await view.rerender(<Button label="Agregar" onPress={onPress} disabled />);
  const disabled = screen.getByRole('button', { name: 'Agregar' });
  expect(disabled).toBeDisabled();
  await fireEvent.press(disabled);
  expect(onPress).toHaveBeenCalledTimes(1);
});

test('T-044 la fila de lista mide 58 pt o más y VoiceOver la lee en una frase; el chevron no se anuncia', async () => {
  const onPress = jest.fn();
  await render(
    <ListRow
      icon="💵"
      color="green"
      title="Efectivo"
      subtitle="Efectivo · COP"
      value="$ 120.000"
      onPress={onPress}
      chevron
    />,
  );
  const row = screen.getByRole('button', { name: 'Efectivo, Efectivo · COP, $ 120.000' });
  expect(style(row).minHeight).toBeGreaterThanOrEqual(sizes.row);
  expect(screen.queryByText('›')).toBeNull();
  await fireEvent.press(row);
  expect(onPress).toHaveBeenCalledTimes(1);
});

test('T-044 la fila acepta una etiqueta y una ayuda propias para VoiceOver', async () => {
  await render(
    <ListRow
      icon="🏷️"
      color="purple"
      title="Categorías"
      accessibilityLabel="Categorías"
      accessibilityHint="Abre tus categorías"
      onPress={jest.fn()}
      chevron
    />,
  );
  expect(screen.getByRole('button', { name: 'Categorías' }).props.accessibilityHint).toBe(
    'Abre tus categorías',
  );
});

test('T-044 la tarjeta agrupada tiene título de sección, radio 20 y un separador entre filas', async () => {
  await render(
    <GroupedCard title="Mis cuentas" action={{ label: 'Ver todos', onPress: jest.fn() }}>
      <Text>Uno</Text>
      <Text>Dos</Text>
      <Text>Tres</Text>
    </GroupedCard>,
  );
  expect(screen.getByRole('header', { name: 'Mis cuentas' })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Ver todos' })).toBeOnTheScreen();
  expect(style(screen.getByTestId('grouped-card')).borderRadius).toBe(radius.card);
  expect(screen.getAllByTestId('separator', { includeHiddenElements: true })).toHaveLength(2);
});

test('T-044 el campo de texto tiene etiqueta visible y para VoiceOver, y 44 pt de alto mínimo', async () => {
  const onChangeText = jest.fn();
  await render(<TextField label="Nombre" value="" onChangeText={onChangeText} />);
  expect(screen.getByText('Nombre')).toBeOnTheScreen();
  const input = screen.getByLabelText('Nombre');
  expect(style(input).minHeight).toBeGreaterThanOrEqual(sizes.touch);
  await fireEvent.changeText(input, 'Nequi');
  expect(onChangeText).toHaveBeenCalledWith('Nequi');
});
