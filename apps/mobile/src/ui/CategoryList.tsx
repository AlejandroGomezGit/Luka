import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import type { CategoryNode, CategoryRow } from '../db/categories';
import { isAccessibilitySize, useTheme } from '../theme';
import { CategoryLabel } from './CategoryLabel';

interface Props {
  tree: readonly CategoryNode[];
  onSelect: (id: string) => void;
}

/** Árbol de dos niveles (HU-07): la principal como encabezado y sus subcategorías debajo. */
export function CategoryList({ tree, onSelect }: Props) {
  const { colors, spacing } = useTheme();
  const { fontScale } = useWindowDimensions();
  const item = (category: CategoryRow) => (
    <Pressable
      key={category.id}
      accessibilityRole="button"
      accessibilityLabel={category.archivedAt ? `${category.name}, archivada` : category.name}
      onPress={() => onSelect(category.id)}
      style={{ paddingVertical: spacing.sm, paddingLeft: spacing.lg }}
    >
      <CategoryLabel name={category.name} icon={category.icon} color={category.color} />
    </Pressable>
  );
  return (
    <View style={{ gap: spacing.md }}>
      {tree.map((main) => (
        <View key={main.id}>
          <View style={isAccessibilitySize(fontScale) ? styles.headerColumn : styles.header}>
            <View
              accessible
              accessibilityRole="header"
              accessibilityLabel={main.name}
              style={styles.flex}
            >
              <CategoryLabel name={main.name} icon={main.icon} color={main.color} />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Editar ${main.name}`}
              onPress={() => onSelect(main.id)}
              style={{ padding: spacing.sm }}
            >
              <Text style={[styles.edit, { color: colors.accent }]}>Editar</Text>
            </Pressable>
          </View>
          {main.children.map(item)}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  headerColumn: { flexDirection: 'column', alignItems: 'flex-start' },
  flex: { flex: 1 },
  edit: { fontSize: 17 },
});
