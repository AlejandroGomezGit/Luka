import { fireEvent, render, screen } from '@testing-library/react-native';
import type { AccountWithBalance } from '../src/db/accounts';
import { AccountList } from '../src/ui/AccountList';

const account = (patch: Partial<AccountWithBalance>): AccountWithBalance =>
  ({
    id: 'a',
    name: 'Efectivo',
    type: 'cash',
    currency: 'COP',
    openingBalanceMinor: 0,
    balanceMinor: 120_000_00,
    icon: 'banknote',
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
          icon: 'card',
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
