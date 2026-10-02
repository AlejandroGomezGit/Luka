import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { createRef } from 'react';
import type { FormHandle } from '../src/ui/FormHandle';

/** «Guardar» está en la barra superior de la pantalla: la prueba lo invoca con la referencia del formulario. */
const form = createRef<FormHandle>();
const save = () =>
  act(() => {
    form.current?.submit();
  });
import { CategoryForm } from '../src/ui/CategoryForm';

const noop = () => undefined;

test('HU-07 crear con nombre, emoji del teclado y color elegido por su nombre para VoiceOver', async () => {
  const onSubmit = jest.fn();
  await render(
    <CategoryForm
      ref={form}
      initial={{ name: '', icon: '🏷️', color: 'gray' }}
      errors={[]}
      onSubmit={onSubmit}
    />,
  );
  await fireEvent.changeText(screen.getByLabelText('Nombre'), 'Mercado campesino');
  await fireEvent.changeText(screen.getByLabelText('Ícono'), '🏷️🧺');
  await fireEvent.press(screen.getByRole('radio', { name: 'Verde' }));
  expect(screen.getByRole('radio', { name: 'Verde' })).toBeSelected();
  await save();
  expect(onSubmit).toHaveBeenCalledWith({ name: 'Mercado campesino', icon: '🧺', color: 'green' });
});

test('HU-07 los errores se explican en español junto al campo', async () => {
  await render(
    <CategoryForm
      ref={form}
      initial={{ name: 'Supermercado', icon: '🛒', color: 'orange' }}
      errors={['name_duplicate']}
      onSubmit={noop}
    />,
  );
  expect(screen.getByText('Ya hay una categoría con ese nombre aquí.')).toBeOnTheScreen();
});

test('INV-07 el formulario no ofrece eliminar: solo guardar y, al editar, archivar', async () => {
  await render(
    <CategoryForm
      ref={form}
      initial={{ name: 'Supermercado', icon: '🛒', color: 'orange' }}
      errors={[]}
      onSubmit={noop}
      archived={false}
      onToggleArchived={noop}
    />,
  );
  expect(screen.queryByRole('button', { name: /eliminar/i })).toBeNull();
  expect(screen.getByRole('button', { name: 'Archivar' })).toBeOnTheScreen();
});
