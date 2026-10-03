import { fireEvent, render, screen } from '@testing-library/react-native';
import type { TransactionListItem } from '../src/db/transactions';
import { TransactionRow } from '../src/ui/TransactionRow';

const item = (patch: Partial<TransactionListItem> = {}): TransactionListItem => ({
  id: 't1',
  kind: 'expense',
  amountMinor: -12_500_00,
  currency: 'COP',
  toAmountMinor: null,
  toCurrency: null,
  occurredOn: '2026-10-01',
  accountName: 'Efectivo',
  toAccountName: null,
  category: {
    label: 'Supermercado',
    accessibilityLabel: 'Supermercado, Alimentación',
    icon: '🛒',
    color: 'orange',
  },
  ...patch,
});

test('HU-04 un gasto muestra categoría, fecha, cuenta y monto con signo; VoiceOver lee tipo, monto, categoría, cuenta y fecha con «Toca para editar»', async () => {
  const onPress = jest.fn();
  await render(<TransactionRow item={item()} today="2026-10-01" onPress={onPress} />);
  expect(screen.getByText('Supermercado')).toBeOnTheScreen();
  expect(screen.getByText('Hoy · Efectivo')).toBeOnTheScreen();
  expect(screen.getByText('-$ 12.500')).toBeOnTheScreen();
  const row = screen.getByRole('button', {
    name: 'Gasto, -$ 12.500, Supermercado, Alimentación, Efectivo, hoy',
  });
  expect(row.props.accessibilityHint).toBe('Toca para editar');
  await fireEvent.press(row);
  expect(onPress).toHaveBeenCalledWith('t1');
});

test('HU-04 un ingreso sin categoría dice «Sin categoría» y lleva signo +', async () => {
  await render(
    <TransactionRow
      item={item({
        kind: 'income',
        amountMinor: 3_200_000_00,
        category: null,
        occurredOn: '2026-09-25',
      })}
      today="2026-10-01"
      onPress={jest.fn()}
    />,
  );
  expect(screen.getByText('Sin categoría')).toBeOnTheScreen();
  expect(screen.getByText('+$ 3.200.000')).toBeOnTheScreen();
  expect(screen.getByText('25 de septiembre · Efectivo')).toBeOnTheScreen();
  expect(
    screen.getByRole('button', {
      name: 'Ingreso, +$ 3.200.000, Sin categoría, Efectivo, 25 de septiembre',
    }),
  ).toBeOnTheScreen();
});

test('HU-04 una transferencia muestra «Efectivo → Dolares» y, con monedas distintas, ambos montos', async () => {
  await render(
    <TransactionRow
      item={item({
        kind: 'transfer',
        amountMinor: -100_000_00,
        toAmountMinor: 25_00,
        toCurrency: 'USD',
        toAccountName: 'Dolares',
        category: null,
        occurredOn: '2026-09-30',
      })}
      today="2026-10-01"
      onPress={jest.fn()}
    />,
  );
  expect(screen.getByText('Efectivo → Dolares')).toBeOnTheScreen();
  expect(screen.getByText('$ 100.000 → US$ 25,00')).toBeOnTheScreen();
  expect(screen.getByText('Ayer · Transferencia')).toBeOnTheScreen();
  expect(
    screen.getByRole('button', {
      name: 'Transferencia, $ 100.000, de Efectivo a Dolares, llegan US$ 25,00, ayer',
    }),
  ).toBeOnTheScreen();
});

test('HU-04 una transferencia en la misma moneda muestra un solo monto', async () => {
  await render(
    <TransactionRow
      item={item({
        kind: 'transfer',
        amountMinor: -50_000_00,
        toAmountMinor: 50_000_00,
        toCurrency: 'COP',
        toAccountName: 'Ahorro',
        category: null,
      })}
      today="2026-10-01"
      onPress={jest.fn()}
    />,
  );
  expect(screen.getByText('$ 50.000')).toBeOnTheScreen();
  expect(screen.queryByText(/→ \$/)).toBeNull();
});
