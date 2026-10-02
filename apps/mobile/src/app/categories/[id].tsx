import type { CategoryInputError } from '@luka/domain';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { getCategory, setCategoryArchived, updateCategory } from '../../db/categories';
import { useLocalSession } from '../../db/session';
import { useTheme } from '../../theme';
import { CategoryForm } from '../../ui/CategoryForm';

/** Editar o archivar una categoría; no se puede eliminar (INV-07, HU-07). */
export default function EditCategoryScreen() {
  const session = useLocalSession();
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const category = getCategory(session.db, id);
  const [errors, setErrors] = useState<CategoryInputError[]>([]);
  if (!category) return null;

  return (
    <>
      <Stack.Screen
        options={{
          title: category.name,
          headerRight: category.parentId
            ? undefined
            : () => (
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    router.push({ pathname: '/categories/new', params: { parentId: category.id } })
                  }
                >
                  <Text style={{ color: colors.accent, fontSize: 17 }}>Agregar subcategoría</Text>
                </Pressable>
              ),
        }}
      />
      <CategoryForm
        initial={{ name: category.name, icon: category.icon, color: category.color }}
        errors={errors}
        archived={category.archivedAt !== null}
        onToggleArchived={() => {
          setCategoryArchived(session, category.id, category.archivedAt === null);
          router.back();
        }}
        onSubmit={(values) => {
          const result = updateCategory(session, category.id, values);
          if (result.ok) router.back();
          else setErrors(result.errors);
        }}
      />
    </>
  );
}
