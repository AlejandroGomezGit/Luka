import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { createRef } from 'react';
import { AccessibilityInfo, StyleSheet } from 'react-native';
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

describe('HU-02 transferencias (CU-06)', () => {
  const transferForm = (
    list: readonly AccountWithBalance[],
    onSubmit: (values: TransactionValues) => SubmitResult = () => ({ ok: true, message: 'ok' }),
  ) =>
    render(
      <TransactionForm
        ref={form}
        accounts={list}
        initialAccountId="cop"
        today="2026-10-01"
        topCategories={() => [groceries]}
        allCategories={() => []}
        onSubmit={onSubmit}
      />,
    );

  test('HU-02 con una sola cuenta activa «Transferencia» está deshabilitada, explica por qué y VoiceOver la lee deshabilitada', async () => {
    await transferForm([account('cop', 'Efectivo', 'COP')]);
    const option = screen.getByRole('radio', { name: 'Transferencia' });
    expect(option).toBeDisabled();
    expect(
      screen.getByText('Para transferir necesitas al menos dos cuentas activas.'),
    ).toBeOnTheScreen();
    await fireEvent.press(option);
    expect(screen.queryByRole('button', { name: /^Hacia/ })).toBeNull();
  });

  test('HU-02 en Transferencia se eligen «Desde» y «Hacia», no hay categorías y con la misma moneda no se pide cuánto llega', async () => {
    const onSubmit = jest.fn(() => ({ ok: true as const, message: 'ok' }));
    await transferForm(
      [account('cop', 'Efectivo', 'COP'), account('bank', 'Ahorro', 'COP')],
      onSubmit,
    );
    await fireEvent.press(screen.getByRole('radio', { name: 'Transferencia' }));
    expect(screen.getByRole('button', { name: 'Desde Efectivo, COP' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Hacia Ahorro, COP' })).toBeOnTheScreen();
    expect(screen.queryByRole('radio', { name: 'Supermercado, Alimentación' })).toBeNull();
    expect(screen.queryByLabelText(/^Llega a/)).toBeNull();
    await fireEvent.changeText(screen.getByLabelText('Monto'), '50000');
    await act(() => {
      form.current?.submit();
    });
    expect(onSubmit).toHaveBeenCalledWith({
      kind: 'transfer',
      amountMinor: 50_000_00,
      accountId: 'cop',
      toAccountId: 'bank',
      toAmountMinor: null,
      occurredOn: '2026-10-01',
      note: '',
    });
  });

  test('HU-02 con monedas distintas se escribe cuánto llega en «Llega a Ahorro USD · USD»', async () => {
    const onSubmit = jest.fn(() => ({ ok: true as const, message: 'ok' }));
    await transferForm(accounts, onSubmit);
    await fireEvent.press(screen.getByRole('radio', { name: 'Transferencia' }));
    await fireEvent.changeText(screen.getByLabelText('Monto'), '100000');
    const arrives = screen.getByLabelText('Llega a Ahorro USD · USD');
    expect(screen.getByText('Llega a Ahorro USD · USD')).toBeOnTheScreen();
    await fireEvent.changeText(arrives, '25,5');
    expect(screen.getByLabelText('Llega a Ahorro USD · USD')).toHaveDisplayValue('25,5');
    await act(() => {
      form.current?.submit();
    });
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        amountMinor: 100_000_00,
        toAccountId: 'usd',
        toAmountMinor: 25_50,
      }),
    );
  });

  test('HU-02 la hoja «Hacia» no ofrece la cuenta de origen', async () => {
    await transferForm([...accounts, account('bank', 'Ahorro', 'COP')]);
    await fireEvent.press(screen.getByRole('radio', { name: 'Transferencia' }));
    await fireEvent.press(screen.getByRole('button', { name: /^Hacia / }));
    expect(screen.queryByRole('button', { name: /^Efectivo,/ })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: /^Ahorro,/ }));
    expect(screen.getByRole('button', { name: 'Hacia Ahorro, COP' })).toBeOnTheScreen();
  });

  test('HU-02 los errores de una transferencia se explican en español', async () => {
    await transferForm(accounts, () => ({
      ok: false,
      errors: ['to_amount_not_positive', 'INV-02', 'INV-06'],
    }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Transferencia' }));
    await fireEvent.changeText(screen.getByLabelText('Monto'), '100000');
    await act(() => {
      form.current?.submit();
    });
    expect(screen.getByText('Escribe cuánto llega a la cuenta de destino.')).toBeOnTheScreen();
    expect(screen.getByText('Elige una cuenta de destino distinta.')).toBeOnTheScreen();
    expect(screen.getByText('Esta cuenta está archivada: elige otra.')).toBeOnTheScreen();
  });
});

test('HU-03 el campo del monto toma el ancho del texto escrito, para que iOS no oculte el primer dígito al agregar el punto de miles', async () => {
  await setup();
  await fireEvent.changeText(screen.getByLabelText('Monto'), '6000');
  // Un texto invisible con el mismo estilo mide lo escrito; el campo toma ese ancho.
  const mirror = screen.getByTestId('amount-mirror', { includeHiddenElements: true });
  expect(mirror).toHaveTextContent('6.000');
  await fireEvent(mirror, 'layout', { nativeEvent: { layout: { width: 150, height: 58 } } });
  const width = (
    StyleSheet.flatten(screen.getByLabelText('Monto').props.style as never) as {
      width?: number;
    }
  ).width;
  expect(width).toBeGreaterThanOrEqual(150);
});

describe('HU-04 editar un movimiento (CU-09)', () => {
  const edit = async (
    initial: TransactionValues,
    extra: Partial<Parameters<typeof TransactionForm>[0]> = {},
  ) => {
    const onSubmit = jest.fn<SubmitResult, [TransactionValues]>(() => ({
      ok: true,
      message: 'ok',
    }));
    const onDelete = jest.fn();
    const result = await render(
      <TransactionForm
        ref={form}
        mode="edit"
        initial={initial}
        accounts={accounts}
        initialAccountId={initial.accountId}
        today="2026-10-01"
        topCategories={() => [groceries]}
        allCategories={() => []}
        onSubmit={onSubmit}
        onDelete={onDelete}
        {...extra}
      />,
    );
    return { result, onSubmit, onDelete };
  };
  const expense: TransactionValues = {
    kind: 'expense',
    amountMinor: 12_500_00,
    accountId: 'cop',
    categoryId: 'groceries',
    occurredOn: '2026-09-30',
    note: 'Mercado',
  };

  test('HU-04 al editar, el formulario abre con los valores del movimiento y «Eliminar movimiento» es un botón destructivo de 44 pt o más al final', async () => {
    const { onSubmit, onDelete } = await edit(expense);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByLabelText('Monto')).toHaveDisplayValue('12.500');
    expect(screen.getByLabelText('Nota')).toHaveDisplayValue('Mercado');
    expect(screen.getByRole('button', { name: 'Fecha: Ayer' })).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Supermercado, Alimentación' })).toBeSelected();
    const remove = screen.getByRole('button', { name: 'Eliminar movimiento' });
    const style = StyleSheet.flatten(remove.props.style as never) as {
      minHeight?: number;
      backgroundColor?: string;
    };
    expect(style.minHeight).toBeGreaterThanOrEqual(44);
    expect(style.backgroundColor).toBe('#B3261E');
    await fireEvent.press(remove);
    expect(onDelete).toHaveBeenCalledTimes(1);
    await fireEvent.changeText(screen.getByLabelText('Monto'), '20000');
    await act(() => {
      form.current?.submit();
    });
    expect(onSubmit).toHaveBeenCalledWith({ ...expense, amountMinor: 20_000_00 });
  });

  test('HU-04 al editar se puede pasar de gasto a ingreso: la categoría se borra y se pide una nueva; no se ofrece Transferencia', async () => {
    const { onSubmit } = await edit(expense);
    expect(screen.queryByRole('radio', { name: 'Transferencia' })).toBeNull();
    await fireEvent.press(screen.getByRole('radio', { name: 'Ingreso' }));
    expect(screen.getByText('Elige una categoría de ingreso.')).toBeOnTheScreen();
    await act(() => {
      form.current?.submit();
    });
    expect(onSubmit).toHaveBeenCalledWith({ ...expense, kind: 'income', categoryId: null });
  });

  test('HU-04 al editar una transferencia no se cambia el tipo, y con un destino de otra moneda el monto de llegada vuelve a ser obligatorio', async () => {
    const { onSubmit } = await edit(
      {
        kind: 'transfer',
        amountMinor: 50_000_00,
        accountId: 'cop',
        toAccountId: 'bank',
        toAmountMinor: 50_000_00,
        occurredOn: '2026-10-01',
        note: '',
      },
      { accounts: [...accounts, account('bank', 'Ahorro', 'COP')] },
    );
    expect(screen.queryByRole('radio', { name: 'Gasto' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Hacia Ahorro, COP' })).toBeOnTheScreen();
    expect(screen.queryByLabelText(/^Llega a/)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Hacia Ahorro, COP' }));
    await fireEvent.press(screen.getByRole('button', { name: /^Ahorro USD,/ }));
    expect(screen.getByLabelText('Llega a Ahorro USD · USD')).toHaveDisplayValue('');
    await act(() => {
      form.current?.submit();
    });
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'transfer', toAccountId: 'usd', toAmountMinor: null }),
    );
  });

  test('HU-04 la cuenta y la categoría archivadas del movimiento se muestran con «(archivada)» y las hojas no las ofrecen', async () => {
    await edit(expense, {
      accounts: [
        { ...account('cop', 'Efectivo', 'COP'), archivedAt: new Date(0) },
        account('usd', 'Ahorro USD', 'USD'),
      ],
      topCategories: () => [],
      categoryName: () => 'Supermercado (archivada)',
    });
    expect(
      screen.getByRole('button', { name: 'Pagado con Efectivo, COP, archivada' }),
    ).toBeOnTheScreen();
    expect(screen.getByText('Efectivo · COP (archivada)')).toBeOnTheScreen();
    expect(screen.getByText('Supermercado (archivada)')).toBeOnTheScreen();
    await fireEvent.press(
      screen.getByRole('button', { name: 'Pagado con Efectivo, COP, archivada' }),
    );
    expect(screen.queryByRole('button', { name: /^Efectivo,/ })).toBeNull();
    expect(screen.getByRole('button', { name: /^Ahorro USD,/ })).toBeOnTheScreen();
  });
});
