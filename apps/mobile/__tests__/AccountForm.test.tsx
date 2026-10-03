import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { createRef } from 'react';
import type { FormHandle } from '../src/ui/FormHandle';

/** «Guardar» está en la barra superior de la pantalla: la prueba lo invoca con la referencia del formulario. */
const form = createRef<FormHandle>();
const save = () =>
  act(() => {
    form.current?.submit();
  });
import { accountFormValues, type AccountRow } from '../src/db/accounts';
import { AccountForm } from '../src/ui/AccountForm';

const empty = {
  name: '',
  type: 'cash',
  currency: 'COP',
  openingAmountMinor: 0,
  icon: '💵',
  color: 'green',
} as const;

test('HU-02 crear una cuenta con nombre, tipo y saldo inicial; el tipo trae ícono y color por defecto', async () => {
  const onSubmit = jest.fn();
  await render(<AccountForm ref={form} initial={empty} errors={[]} onSubmit={onSubmit} />);
  await fireEvent.changeText(screen.getByLabelText('Nombre'), 'Nequi');
  await fireEvent.press(screen.getByRole('radio', { name: 'Otra' }));
  await fireEvent.changeText(screen.getByLabelText('Saldo inicial'), '120.000');
  await save();
  expect(onSubmit).toHaveBeenCalledWith({
    name: 'Nequi',
    type: 'other',
    currency: 'COP',
    openingAmountMinor: 120_000_00,
    icon: '📱',
    color: 'purple',
  });
});

test('HU-02 «Otra» explica con ejemplos qué cuentas son', async () => {
  await render(<AccountForm ref={form} initial={empty} errors={[]} onSubmit={jest.fn()} />);
  expect(screen.getByText('Nequi, Daviplata…')).toBeOnTheScreen();
});

test('HU-02 editar una tarjeta de crédito muestra la deuda en positivo y al guardar sin cambios queda igual', async () => {
  const stored = {
    type: 'credit_card',
    currency: 'COP',
    openingBalanceMinor: -500_000_00,
    name: 'Visa',
    icon: '💳',
    color: 'red',
  } as AccountRow;
  const onSubmit = jest.fn();
  await render(
    <AccountForm ref={form} initial={accountFormValues(stored)} errors={[]} onSubmit={onSubmit} />,
  );
  expect(screen.getByLabelText('Deuda actual')).toHaveDisplayValue('500.000');
  await save();
  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({ type: 'credit_card', openingAmountMinor: 500_000_00 }),
  );
});

test('HU-02 el saldo inicial tiene un texto de ayuda: se puede corregir después', async () => {
  await render(<AccountForm ref={form} initial={empty} errors={[]} onSubmit={jest.fn()} />);
  expect(
    screen.getByText('Puedes corregirlo después; cambia el saldo de la cuenta.'),
  ).toBeOnTheScreen();
});

test('HU-02 el monto no deja escribir más de 13 dígitos enteros, así nunca pasa de un entero seguro', async () => {
  const onSubmit = jest.fn();
  await render(
    <AccountForm
      ref={form}
      initial={{ ...empty, name: 'Efectivo' }}
      errors={[]}
      onSubmit={onSubmit}
    />,
  );
  const field = screen.getByLabelText('Saldo inicial');
  await fireEvent.changeText(field, '99999999999999999');
  expect(field).toHaveDisplayValue('9.999.999.999.999');
  await save();
  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({ openingAmountMinor: 999_999_999_999_900 }),
  );
});

test('el formulario no pide número de cuenta ni de tarjeta', async () => {
  await render(<AccountForm ref={form} initial={empty} errors={[]} onSubmit={jest.fn()} />);
  expect(screen.queryByLabelText(/número/i)).toBeNull();
  expect(screen.queryByText(/número/i)).toBeNull();
});

test('el formulario es compacto: tipo y moneda son opciones en fila y no hay un botón Guardar al final', async () => {
  await render(<AccountForm ref={form} initial={empty} errors={[]} onSubmit={jest.fn()} />);
  expect(screen.getAllByRole('radio').map((r) => r.props.accessibilityLabel as string)).toEqual([
    'Efectivo',
    'Cuenta de ahorros',
    'Cuenta corriente',
    'Tarjeta de crédito',
    'Otra',
    'Peso colombiano (COP)',
    'Dólar (USD)',
    'Euro (EUR)',
    'Rojo',
    'Naranja',
    'Ámbar',
    'Verde',
    'Verde azulado',
    'Cian',
    'Azul',
    'Índigo',
    'Morado',
    'Rosado',
    'Marrón',
    'Gris',
  ]);
  expect(screen.queryByRole('button', { name: 'Guardar' })).toBeNull();
});

test('HU-02 al escribir el monto los puntos de miles se ponen solos', async () => {
  const onSubmit = jest.fn();
  await render(
    <AccountForm
      ref={form}
      initial={{ ...empty, name: 'Banco' }}
      errors={[]}
      onSubmit={onSubmit}
    />,
  );
  const field = screen.getByLabelText('Saldo inicial');
  await fireEvent.changeText(field, '1500000');
  expect(field).toHaveDisplayValue('1.500.000');
  await save();
  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({ openingAmountMinor: 1_500_000_00 }),
  );
});

test('HU-02 en dólares la coma abre los centavos y una coma final no impide guardar', async () => {
  const onSubmit = jest.fn();
  await render(
    <AccountForm
      ref={form}
      initial={{ ...empty, name: 'Ahorro USD', currency: 'USD' }}
      errors={[]}
      onSubmit={onSubmit}
    />,
  );
  const field = screen.getByLabelText('Saldo inicial');
  await fireEvent.changeText(field, '1234,5');
  expect(field).toHaveDisplayValue('1.234,5');
  await fireEvent.changeText(field, '1.234,');
  await save();
  expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ openingAmountMinor: 123_400 }));
});

test('editar una cuenta con un ícono antiguo que no es emoji muestra el campo vacío y se puede guardar así', async () => {
  const onSubmit = jest.fn();
  await render(
    <AccountForm
      ref={form}
      initial={{ ...empty, name: 'Efectivo', icon: 'banknote' }}
      errors={[]}
      onSubmit={onSubmit}
    />,
  );
  expect(screen.getByLabelText('Ícono')).toHaveDisplayValue('');
  await save();
  expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ icon: '' }));
});
