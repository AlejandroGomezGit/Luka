import type { CategoryKind } from '@luka/domain';
import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { type CategoryNode, listCategories } from '../../db/categories';
import { useLocalSession } from '../../db/session';
import { useTheme } from '../../theme';
import { CategoryList } from '../../ui/CategoryList';
import { Screen } from '../../ui/Screen';

const KINDS: { kind: CategoryKind; label: string }[] = [
  { kind: 'expense', label: 'Gastos' },
  { kind: 'income', label: 'Ingresos' },
];

export default function CategoriesScreen() {
  const { db } = useLocalSession();
  const { colors, spacing } = useTheme();
  const [kind, setKind] = useState<CategoryKind>('expense');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [tree, setTree] = useState<CategoryNode[]>([]);

  useFocusEffect(
    useCallback(() => {
      setTree(listCategories(db, kind, { includeArchived }));
    }, [db, kind, includeArchived]),
  );

  return (
    <Screen contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
      <Stack.Screen options={{ title: 'Categorías' }} />
      <View accessibilityRole="tablist" style={[styles.row, { gap: spacing.sm }]}>
        {KINDS.map((option) => (
          <Pressable
            key={option.kind}
            accessibilityRole="tab"
            accessibilityState={{ selected: kind === option.kind }}
            onPress={() => setKind(option.kind)}
            style={[
              styles.tab,
              { borderColor: kind === option.kind ? colors.accent : colors.muted },
            ]}
          >
            <Text style={[styles.text, { color: colors.text }]}>{option.label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={[styles.row, styles.between]}>
        <Text style={[styles.text, { color: colors.text }]}>Mostrar archivadas</Text>
        <Switch
          accessibilityLabel="Mostrar archivadas"
          value={includeArchived}
          onValueChange={setIncludeArchived}
        />
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push({ pathname: '/categories/new', params: { kind } })}
      >
        <Text style={[styles.text, { color: colors.accent }]}>Nueva categoría principal</Text>
      </Pressable>
      <CategoryList tree={tree} onSelect={(id) => router.push(`/categories/${id}`)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  between: { justifyContent: 'space-between' },
  tab: { borderWidth: 2, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 16 },
  text: { fontSize: 17 },
});
