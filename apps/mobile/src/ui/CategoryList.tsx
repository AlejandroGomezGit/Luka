import { View } from 'react-native';
import type { CategoryNode } from '../db/categories';
import { useTheme } from '../theme';
import { CategoryLabel } from './CategoryLabel';
import { GroupedCard } from './GroupedCard';
import { ListRow } from './ListRow';

interface Props {
  tree: readonly CategoryNode[];
  onSelect: (id: string) => void;
}

/** Árbol de dos niveles (HU-07): cada principal es una tarjeta con sus subcategorías como filas. */
export function CategoryList({ tree, onSelect }: Props) {
  const { spacing } = useTheme();
  return (
    <View style={{ gap: spacing.lg }}>
      {tree.map((main) => (
        <GroupedCard
          key={main.id}
          header={
            <View
              accessible
              accessibilityRole="header"
              accessibilityLabel={main.name}
              style={{ flexShrink: 1 }}
            >
              <CategoryLabel name={main.name} icon={main.icon} color={main.color} />
            </View>
          }
          action={{
            label: 'Editar',
            accessibilityLabel: `Editar ${main.name}`,
            onPress: () => onSelect(main.id),
          }}
        >
          {main.children.map((category) => (
            <ListRow
              key={category.id}
              icon={category.icon}
              color={category.color}
              title={category.name}
              accessibilityLabel={
                category.archivedAt ? `${category.name}, archivada` : category.name
              }
              onPress={() => onSelect(category.id)}
              chevron
            />
          ))}
        </GroupedCard>
      ))}
    </View>
  );
}
