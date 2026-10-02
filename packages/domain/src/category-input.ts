/** Reglas de las categorías que crea o edita la persona (HU-07, CU-13, documento 02). */
import { predefinedCategoryId } from './categories.js';
import type { CategoryKind } from './enums.js';
import { deterministicId } from './ids.js';
import { sameName } from './names.js';
import { isColorToken, isEmoji } from './tokens.js';

export const MAX_CATEGORY_NAME = 40;

export interface CategoryInput {
  name: string;
  kind: CategoryKind;
  icon: string;
  color: string;
}

/** Lo que el llamador ya leyó: la categoría principal (si es subcategoría) y los nombres hermanos. */
export interface CategoryInputContext {
  parent: { kind: CategoryKind; parentId: string | null } | null;
  siblingNames: readonly string[];
}

export type CategoryInputError =
  | 'name_required'
  | 'name_too_long'
  | 'name_duplicate'
  | 'icon_invalid'
  | 'color_unknown'
  | 'parent_not_main'
  | 'parent_kind_mismatch';

export function checkCategoryInput(
  input: CategoryInput,
  { parent, siblingNames }: CategoryInputContext,
): CategoryInputError[] {
  const errors: CategoryInputError[] = [];
  const name = input.name.trim();
  if (name.length === 0) errors.push('name_required');
  else if (name.length > MAX_CATEGORY_NAME) errors.push('name_too_long');
  else if (siblingNames.some((sibling) => sameName(sibling, name))) errors.push('name_duplicate');
  // El ícono es opcional: vacío se muestra con uno de respaldo.
  if (input.icon !== '' && !isEmoji(input.icon)) errors.push('icon_invalid');
  if (!isColorToken(input.color)) errors.push('color_unknown');
  if (parent) {
    if (parent.parentId !== null) errors.push('parent_not_main');
    if (parent.kind !== input.kind) errors.push('parent_kind_mismatch');
  }
  return errors;
}

/**
 * Id del «General» (\`.other\`) de una categoría principal, estable en cualquier dispositivo y aunque se
 * renombre: en una predefinida, uuid5(usuario, "<clave>.other"); en una creada por la persona,
 * uuid5(id de la principal, "other"). Así el categorizador y las reglas de V2 lo encuentran siempre.
 */
export function generalCategoryId(
  userId: string,
  parent: { id: string; systemKey: string | null },
): string {
  return parent.systemKey
    ? predefinedCategoryId(userId, `${parent.systemKey}.other`)
    : deterministicId(parent.id, 'other');
}
