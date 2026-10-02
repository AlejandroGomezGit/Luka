import type { CategoryInputError } from '@luka/domain';

/** Mensajes en español para los códigos de checkCategoryInput, y el campo donde se muestran. */
export const CATEGORY_ERRORS: Record<
  CategoryInputError,
  { field: 'name' | 'icon' | 'color'; message: string }
> = {
  name_required: { field: 'name', message: 'Escribe un nombre.' },
  name_too_long: { field: 'name', message: 'Usa 40 caracteres o menos.' },
  name_duplicate: { field: 'name', message: 'Ya hay una categoría con ese nombre aquí.' },
  icon_unknown: { field: 'icon', message: 'Elige un ícono de la lista.' },
  color_unknown: { field: 'color', message: 'Elige un color de la lista.' },
  parent_not_main: {
    field: 'name',
    message: 'Las subcategorías solo se crean dentro de una categoría principal.',
  },
  parent_kind_mismatch: {
    field: 'name',
    message: 'La subcategoría debe ser del mismo tipo que su categoría principal.',
  },
};
