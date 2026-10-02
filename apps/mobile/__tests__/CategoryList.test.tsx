import { fireEvent, render, screen } from '@testing-library/react-native';
import type { CategoryNode } from '../src/db/categories';
import { CategoryList } from '../src/ui/CategoryList';

const row = (id: string, name: string, parentId: string | null): CategoryNode => ({
  id,
  name,
  parentId,
  kind: 'expense',
  icon: '🛒',
  color: 'orange',
  systemKey: null,
  archivedAt: null,
  userId: 'u',
  createdAt: new Date(0),
  updatedAt: new Date(0),
  deletedAt: null,
  version: 0,
  fieldClocks: {},
  children: [],
});

test('HU-07 la lista muestra los dos niveles con ícono y nombre, y tocar una abre su edición', async () => {
  const onSelect = jest.fn();
  const food = {
    ...row('food', 'Alimentación', null),
    children: [row('groceries', 'Supermercado', 'food')],
  };
  await render(<CategoryList tree={[food]} onSelect={onSelect} />);
  expect(screen.getByRole('header', { name: 'Alimentación' })).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Supermercado' }));
  expect(onSelect).toHaveBeenCalledWith('groceries');
});
