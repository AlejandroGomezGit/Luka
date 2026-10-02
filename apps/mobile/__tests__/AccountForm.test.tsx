import { fireEvent, render, screen } from '@testing-library/react-native';
import { accountFormValues, type AccountRow } from '../src/db/accounts';
import { AccountForm } from '../src/ui/AccountForm';

const empty = {
  name: '',
  type: 'cash',
  currency: 'COP',
  openingAmountMinor: 0,
  icon: 'banknote',
  color: 'green',
} as const;

test('HU-02 crear una cuenta con nombre, tipo y saldo inicial; el tipo trae ícono y color por defecto', async () => {
  const onSubmit = jest.fn();
  await render(<AccountForm initial={empty} errors={[]} onSubmit={onSubmit} />);
  await fireEvent.changeText(screen.getByLabelText('Nombre'), 'Nequi');
  await fireEvent.press(screen.getByRole('radio', { name: 'Otra' }));
  await fireEvent.changeText(screen.getByLabelText('Saldo inicial'), '120.000');
  await fireEvent.press(screen.getByRole('button', { name: 'Guardar' }));
  expect(onSubmit).toHaveBeenCalledWith({
    name: 'Nequi',
    type: 'other',
    currency: 'COP',
    openingAmountMinor: 120_000_00,
    icon: 'phone',
    color: 'purple',
  });
});

test('HU-02 «Otra» explica con ejemplos qué cuentas son', async () => {
  await render(<AccountForm initial={empty} errors={[]} onSubmit={jest.fn()} />);
  expect(screen.getByText('Nequi, Daviplata…')).toBeOnTheScreen();
});

test('HU-02 editar una tarjeta de crédito muestra la deuda en positivo y al guardar sin cambios queda igual', async () => {
  const stored = {
    type: 'credit_card',
    currency: 'COP',
    openingBalanceMinor: -500_000_00,
    name: 'Visa',
    icon: 'card',
    color: 'red',
  } as AccountRow;
  const onSubmit = jest.fn();
  await render(<AccountForm initial={accountFormValues(stored)} errors={[]} onSubmit={onSubmit} />);
  expect(screen.getByLabelText('Deuda actual')).toHaveDisplayValue('500.000');
  await fireEvent.press(screen.getByRole('button', { name: 'Guardar' }));
  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({ type: 'credit_card', openingAmountMinor: 500_000_00 }),
  );
});

test('HU-02 el saldo inicial tiene un texto de ayuda: se puede corregir después', async () => {
  await render(<AccountForm initial={empty} errors={[]} onSubmit={jest.fn()} />);
  expect(
    screen.getByText('Puedes corregirlo después; cambia el saldo de la cuenta.'),
  ).toBeOnTheScreen();
});

test('HU-02 un monto inválido se explica y no se guarda', async () => {
  const onSubmit = jest.fn();
  await render(
    <AccountForm initial={{ ...empty, name: 'Efectivo' }} errors={[]} onSubmit={onSubmit} />,
  );
  await fireEvent.changeText(screen.getByLabelText('Saldo inicial'), '12,50');
  await fireEvent.press(screen.getByRole('button', { name: 'Guardar' }));
  expect(onSubmit).not.toHaveBeenCalled();
  expect(screen.getByText('Escribe el monto en pesos, por ejemplo 120.000.')).toBeOnTheScreen();
});

test('el formulario no pide número de cuenta ni de tarjeta', async () => {
  await render(<AccountForm initial={empty} errors={[]} onSubmit={jest.fn()} />);
  expect(screen.queryByLabelText(/número/i)).toBeNull();
  expect(screen.queryByText(/número/i)).toBeNull();
});
