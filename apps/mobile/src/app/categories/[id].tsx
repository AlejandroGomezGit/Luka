import type { CategoryInputError } from '@luka/domain';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { getCategory, setCategoryArchived, updateCategory } from '../../db/categories';
import { useLocalSession } from '../../db/session';
import { CategoryForm } from '../../ui/CategoryForm';
import type { FormHandle } from '../../ui/FormHandle';
import { HeaderButton } from '../../ui/HeaderButton';

/** Editar o archivar una categoría; no se puede eliminar (INV-07, HU-07). */
export default function EditCategoryScreen() {
  const session = useLocalSession();
  const form = useRef<FormHandle>(null);
  const { id } = useLocalSearchParams<{ id: string }>();
  const category = getCategory(session.db, id);
  const [errors, setErrors] = useState<CategoryInputError[]>([]);
  if (!category) return null;

  return (
    <>
      <Stack.Screen
        options={{
          title: category.name,
          headerRight: () => (
            <HeaderButton label="Guardar" onPress={() => form.current?.submit()} />
          ),
        }}
      />
      <CategoryForm
        ref={form}
        initial={{ name: category.name, icon: category.icon, color: category.color }}
        errors={errors}
        archived={category.archivedAt !== null}
        extraAction={
          category.parentId
            ? undefined
            : {
                label: 'Agregar subcategoría',
                onPress: () =>
                  router.push({ pathname: '/categories/new', params: { parentId: category.id } }),
              }
        }
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
