import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { EmojiField } from '../src/ui/EmojiField';

function Harness({ onChange }: { onChange: (emoji: string) => void }) {
  const [value, setValue] = useState('🛒');
  return (
    <EmojiField
      value={value}
      color="orange"
      onChange={(emoji) => {
        setValue(emoji);
        onChange(emoji);
      }}
    />
  );
}

test('HU-07 el ícono se elige con el teclado: un emoji nuevo reemplaza al anterior', async () => {
  const onChange = jest.fn();
  await render(<Harness onChange={onChange} />);
  const field = screen.getByLabelText('Ícono');
  expect(field).toHaveDisplayValue('🛒');
  await fireEvent.changeText(field, '🛒🍽️');
  expect(onChange).toHaveBeenLastCalledWith('🍽️');
  expect(field).toHaveDisplayValue('🍽️');
});

test('HU-07 lo que no es emoji se ignora y el ícono no cambia', async () => {
  const onChange = jest.fn();
  await render(<Harness onChange={onChange} />);
  await fireEvent.changeText(screen.getByLabelText('Ícono'), '🛒a');
  expect(onChange).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Ícono')).toHaveDisplayValue('🛒');
});

test('un ícono guardado que no es emoji (dato antiguo como «banknote») se ve como un espacio en blanco', async () => {
  await render(<EmojiField value="banknote" color="green" onChange={jest.fn()} />);
  expect(screen.getByLabelText('Ícono')).toHaveDisplayValue('');
});

test('borrar el emoji deja el ícono vacío', async () => {
  const onChange = jest.fn();
  await render(<Harness onChange={onChange} />);
  await fireEvent.changeText(screen.getByLabelText('Ícono'), '');
  expect(onChange).toHaveBeenLastCalledWith('');
});
