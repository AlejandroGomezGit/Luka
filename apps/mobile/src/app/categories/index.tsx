import type { CategoryKind } from '@luka/domain';
import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { type CategoryNode, listCategories } from '../../db/categories';
import { useLocalSession } from '../../db/session';
import { useTheme } from '../../theme';
import { Button } from '../../ui/Button';
import { CategoryList } from '../../ui/CategoryList';
import { SegmentedControl } from '../../ui/Chip';
import { GroupedCard } from '../../ui/GroupedCard';
import { SwitchRow } from '../../ui/ListRow';
import { Screen } from '../../ui/Screen';

const KINDS: { value: CategoryKind; label: string }[] = [
  { value: 'expense', label: 'Gastos' },
  { value: 'income', label: 'Ingresos' },
];

export default function CategoriesScreen() {
  const { db } = useLocalSession();
  const { spacing } = useTheme();
  const [kind, setKind] = useState<CategoryKind>('expense');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [tree, setTree] = useState<CategoryNode[]>([]);

  useFocusEffect(
    useCallback(() => {
      setTree(listCategories(db, kind, { includeArchived }));
    }, [db, kind, includeArchived]),
  );

  return (
    <Screen contentContainerStyle={{ padding: spacing.md, gap: spacing.lg }}>
      <Stack.Screen options={{ title: 'Categorías', headerLargeTitle: true }} />
      <SegmentedControl role="tab" options={KINDS} value={kind} onChange={setKind} />
      <GroupedCard>
        <SwitchRow
          title="Mostrar archivadas"
          value={includeArchived}
          onValueChange={setIncludeArchived}
        />
      </GroupedCard>
      <Button
        label="Nueva categoría principal"
        icon="+"
        variant="secondary"
        onPress={() => router.push({ pathname: '/categories/new', params: { kind } })}
      />
      <CategoryList tree={tree} onSelect={(id) => router.push(`/categories/${id}`)} />
    </Screen>
  );
}
