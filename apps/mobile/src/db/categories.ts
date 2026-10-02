import { PREDEFINED_CATEGORIES, predefinedCategoryId } from '@luka/domain';
import { categories } from '@luka/schema-sqlite';
import { insertRow, type WriteContext } from './write';

/**
 * Siembra las categorías predefinidas (HU-07) con su UUID v5. Es idempotente: si una ya existe, aunque
 * esté renombrada o archivada, no se toca. Ícono y color son tokens del catálogo (documento 02).
 */
export function seedPredefinedCategories(ctx: WriteContext): void {
  ctx.db.transaction((tx) => {
    for (const category of PREDEFINED_CATEGORIES) {
      insertRow(
        { ...ctx, db: tx },
        categories,
        {
          name: category.name,
          kind: category.kind,
          parentId: category.parent ? predefinedCategoryId(ctx.userId, category.parent) : null,
          systemKey: category.key,
          icon: category.icon,
          color: category.color,
        },
        { id: predefinedCategoryId(ctx.userId, category.key), ifAbsent: true },
      );
    }
  });
}
