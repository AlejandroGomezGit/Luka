import type { CategoryInputError, CategoryKind } from '@luka/domain';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { createCategory, getCategory } from '../../db/categories';
import { useLocalSession } from '../../db/session';
import { CategoryForm } from '../../ui/CategoryForm';

/** Nueva categoría principal (`?kind=`) o subcategoría (`?parentId=`). */
export default function NewCategoryScreen() {
  const session = useLocalSession();
  const params = useLocalSearchParams<{ kind?: string; parentId?: string }>();
  const parent = params.parentId ? getCategory(session.db, params.parentId) : undefined;
  const kind: CategoryKind = parent?.kind ?? (params.kind === 'income' ? 'income' : 'expense');
  const [errors, setErrors] = useState<CategoryInputError[]>([]);

  return (
    <>
      <Stack.Screen options={{ title: parent ? `Nueva en ${parent.name}` : 'Nueva categoría' }} />
      <CategoryForm
        initial={{ name: '', icon: parent?.icon ?? '🏷️', color: parent?.color ?? 'gray' }}
        errors={errors}
        onSubmit={(values) => {
          const result = createCategory(session, { ...values, kind, parentId: parent?.id ?? null });
          if (result.ok) router.back();
          else setErrors(result.errors);
        }}
      />
    </>
  );
}
