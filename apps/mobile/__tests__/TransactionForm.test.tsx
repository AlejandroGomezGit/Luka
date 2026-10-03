import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { createRef } from 'react';
import { AccessibilityInfo } from 'react-native';
import type { AccountWithBalance } from '../src/db/accounts';
import type { TopCategory } from '../src/db/transactions';
import type { FormHandle } from '../src/ui/FormHandle';
import {
  type SubmitResult,
  TransactionForm,
  type TransactionValues,
} from '../src/ui/TransactionForm';

const account = (id: string, name: string, currency: string) =>
  ({
    id,
    name,
    currency,
    type: 'cash',
    icon: '💵',
    color: 'green',
    balanceMinor: 0,
    archivedAt: null,
  }) as AccountWithBalance;
const accounts = [account('cop', 'Efectivo', 'COP'), account('usd', 'Ahorro USD', 'USD')];
const groceries: TopCategory = {
  id: 'groceries',
  label: 'Supermercado',
  accessibilityLabel: 'Supermercado, Alimentación',
  icon: '🛒',
  color: 'orange',
};

const form = createRef<FormHandle>();
function setup(
  onSubmit: (values: TransactionValues) => SubmitResult = () => ({
    ok: true,
    message: 'Gasto guardado',
  }),
) {
  return render(
    <TransactionForm
      ref={form}
      accounts={accounts}
      initialAccountId="cop"
      today="2026-10-01"
      topCategories={() => [groceries]}
      allCategories={() => []}
      onSubmit={onSubmit}
    />,
  );
}

test('HU-03 al cambiar a una cuenta de otra moneda se conserva el número escrito y se ve el código de moneda', async () => {
  await setup();
  // El campo se vuelve a montar al cambiar de moneda: se busca de nuevo cada vez.
  const amount = () => screen.getByLabelText('Monto');
  await fireEvent.changeText(amount(), '12500');
  expect(amount()).toHaveDisplayValue('12.500');
  expect(screen.getByText('COP')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Pagado con Efectivo, COP' }));
  await fireEvent.press(screen.getByRole('button', { name: /^Ahorro USD,/ }));
  expect(amount()).toHaveDisplayValue('12.500');
  expect(screen.getByText('USD')).toBeOnTheScreen();
  await fireEvent.changeText(amount(), '1234,5');
  await fireEvent.press(screen.getByRole('button', { name: 'Pagado con Ahorro USD, USD' }));
  await fireEvent.press(screen.getByRole('button', { name: /^Efectivo,/ }));
  // COP no tiene centavos: el número entero se conserva.
  expect(amount()).toHaveDisplayValue('1.234');
});

test('HU-03 sin monto se explica «El monto debe ser mayor que cero» y no se guarda', async () => {
  const onSubmit = jest.fn(() => ({ ok: true as const, message: '' }));
  await setup(onSubmit);
  await act(() => {
    form.current?.submit();
  });
  expect(onSubmit).not.toHaveBeenCalled();
  expect(screen.getByText('El monto debe ser mayor que cero.')).toBeOnTheScreen();
});

test('HU-03 una fecha futura se explica «La fecha no puede ser futura»', async () => {
  await setup(jest.fn(() => ({ ok: false as const, errors: ['date_in_future' as const] })));
  await fireEvent.changeText(screen.getByLabelText('Monto'), '12500');
  await act(() => {
    form.current?.submit();
  });
  expect(screen.getByText('La fecha no puede ser futura.')).toBeOnTheScreen();
});

test('HU-03 VoiceOver lee la categoría con su principal y el aviso de guardado se anuncia', async () => {
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
  const onSubmit = jest.fn(() => ({
    ok: true as const,
    message: 'Gasto guardado: $ 12.500 en Supermercado',
  }));
  await setup(onSubmit);
  await fireEvent.changeText(screen.getByLabelText('Monto'), '12500');
  await fireEvent.press(screen.getByRole('radio', { name: 'Supermercado, Alimentación' }));
  await act(() => {
    form.current?.submit();
  });
  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({
      kind: 'expense',
      amountMinor: 12_500_00,
      accountId: 'cop',
      categoryId: 'groceries',
      occurredOn: '2026-10-01',
    }),
  );
  expect(announce).toHaveBeenCalledWith('Gasto guardado: $ 12.500 en Supermercado');
  expect(screen.getByText('Gasto guardado: $ 12.500 en Supermercado')).toBeOnTheScreen();
  // Listo para otro: el monto y la categoría se limpian.
  expect(screen.getByLabelText('Monto')).toHaveDisplayValue('');
});

test('HU-03 dos toques seguidos de Guardar crean un solo movimiento', async () => {
  const onSubmit = jest.fn(() => ({ ok: true as const, message: 'Gasto guardado' }));
  await setup(onSubmit);
  await fireEvent.changeText(screen.getByLabelText('Monto'), '12500');
  await act(() => {
    form.current?.submit();
    form.current?.submit();
  });
  expect(onSubmit).toHaveBeenCalledTimes(1);
});

test('HU-03 al cambiar a Ingreso la cuenta dice «Depositado en» y la pantalla puede titularse «Nuevo ingreso»', async () => {
  const onKindChange = jest.fn();
  await render(
    <TransactionForm
      ref={form}
      accounts={accounts}
      initialAccountId="cop"
      today="2026-10-01"
      topCategories={() => [groceries]}
      allCategories={() => []}
      onSubmit={() => ({ ok: true, message: '' })}
      onKindChange={onKindChange}
    />,
  );
  await fireEvent.press(screen.getByRole('radio', { name: 'Ingreso' }));
  expect(onKindChange).toHaveBeenCalledWith('income');
  expect(screen.getByRole('button', { name: 'Depositado en Efectivo, COP' })).toBeOnTheScreen();
});
