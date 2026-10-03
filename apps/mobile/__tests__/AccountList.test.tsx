import { fireEvent, render, screen } from '@testing-library/react-native';
import type { AccountWithBalance } from '../src/db/accounts';
import { themeColors } from '../src/theme';
import { AccountList } from '../src/ui/AccountList';

const account = (patch: Partial<AccountWithBalance>): AccountWithBalance =>
  ({
    id: 'a',
    name: 'Efectivo',
    type: 'cash',
    currency: 'COP',
    openingBalanceMinor: 0,
    balanceMinor: 120_000_00,
    icon: '💵',
    color: 'green',
    sortOrder: 0,
    archivedAt: null,
    ...patch,
  }) as AccountWithBalance;

test('HU-02 la lista muestra cada cuenta con su tipo y saldo, y VoiceOver lo lee junto', async () => {
  const onSelect = jest.fn();
  await render(
    <AccountList
      accounts={[
        account({}),
        account({
          id: 'v',
          name: 'Visa',
          type: 'credit_card',
          balanceMinor: -500_000_00,
          icon: '💳',
          color: 'red',
        }),
        account({ id: 'x', name: 'Vieja', archivedAt: new Date(0), balanceMinor: 0 }),
      ]}
      onSelect={onSelect}
    />,
  );
  expect(screen.getByRole('button', { name: 'Efectivo, Efectivo, $ 120.000' })).toBeOnTheScreen();
  expect(screen.getByText('Debes $ 500.000')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Vieja, Efectivo, $ 0, archivada' })).toBeOnTheScreen();
  await fireEvent.press(
    screen.getByRole('button', { name: 'Visa, Tarjeta de crédito, Debes $ 500.000' }),
  );
  expect(onSelect).toHaveBeenCalledWith('v');
});

const HELP = 'Saldo negativo: revisa los movimientos o corrige el saldo inicial';

test('HU-02 un saldo negativo en efectivo o ahorros va en color de alerta, con su signo y la ayuda; VoiceOver dice «saldo negativo, menos … pesos» o «dólares»', async () => {
  const onSelect = jest.fn();
  await render(
    <AccountList
      accounts={[
        account({ balanceMinor: -25_000_00 }),
        account({
          id: 'u',
          name: 'Ahorro USD',
          type: 'savings',
          currency: 'USD',
          balanceMinor: -12_50,
        }),
      ]}
      onSelect={onSelect}
    />,
  );
  // El color nunca es la única señal: el signo y la ayuda también lo dicen.
  expect(screen.getByText('-$ 25.000')).toHaveStyle({ color: themeColors.light.alert });
  expect(screen.getByText('-US$ 12,50')).toHaveStyle({ color: themeColors.light.alert });
  const help = screen.getAllByText(HELP);
  expect(help).toHaveLength(2);
  // Con texto grande la ayuda se parte en varias líneas: nunca se corta.
  for (const text of help) expect(text.props.numberOfLines).toBeUndefined();

  const cash = screen.getByRole('button', {
    name: 'Efectivo, Efectivo, saldo negativo, menos 25.000 pesos',
  });
  expect(cash.props.accessibilityHint).toBe(`${HELP}. Abre la edición de la cuenta.`);
  expect(
    screen.getByRole('button', {
      name: 'Ahorro USD, Cuenta de ahorros, saldo negativo, menos 12,50 dólares',
    }),
  ).toBeOnTheScreen();
  // La ayuda va dentro de la fila: tocarla abre la edición de la cuenta.
  const [first] = help;
  if (!first) throw new Error('sin ayuda');
  await fireEvent.press(first);
  expect(onSelect).toHaveBeenCalledWith('a');
});

test('HU-02 sin ayuda ni alerta en un saldo positivo o en cero, y la tarjeta de crédito sigue igual', async () => {
  await render(
    <AccountList
      accounts={[
        account({}),
        account({ id: 'z', name: 'Nequi', type: 'other', balanceMinor: 0 }),
        account({ id: 'v', name: 'Visa', type: 'credit_card', balanceMinor: -500_000_00 }),
        account({ id: 'm', name: 'Master', type: 'credit_card', balanceMinor: 30_000_00 }),
      ]}
      onSelect={jest.fn()}
    />,
  );
  expect(screen.queryByText(HELP)).toBeNull();
  expect(screen.getByText('$ 120.000')).toHaveStyle({ color: themeColors.light.text });
  expect(screen.getByText('Debes $ 500.000')).toHaveStyle({ color: themeColors.light.alert });
  expect(
    screen.getByRole('button', { name: 'Visa, Tarjeta de crédito, Debes $ 500.000' }).props
      .accessibilityHint,
  ).toBeUndefined();
  expect(screen.getByText('A favor $ 30.000')).toHaveStyle({ color: themeColors.light.text });
});
