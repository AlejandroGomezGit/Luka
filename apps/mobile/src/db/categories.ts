import {
  type CategoryInput,
  type CategoryInputError,
  type CategoryKind,
  checkCategoryInput,
  generalCategoryId,
  PREDEFINED_CATEGORIES,
  predefinedCategoryId,
} from '@luka/domain';
import { categories } from '@luka/schema-sqlite';
import { and, eq, isNull } from 'drizzle-orm';
import type { LocalDb } from './types';
import { insertRow, notDeleted, updateRow, type WriteContext } from './write';

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

export type CategoryRow = typeof categories.$inferSelect;
export interface CategoryNode extends CategoryRow {
  children: CategoryRow[];
}

export type CategoryResult = { ok: true; id: string } | { ok: false; errors: CategoryInputError[] };

export function getCategory(db: LocalDb, id: string): CategoryRow | undefined {
  return db.select().from(categories).where(eq(categories.id, id)).get();
}

/** Nombres de las categorías que comparten principal (o de las principales del mismo tipo). */
function siblingNames(db: LocalDb, kind: CategoryKind, parentId: string | null, exceptId?: string) {
  return db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(
      and(
        eq(categories.kind, kind),
        parentId ? eq(categories.parentId, parentId) : isNull(categories.parentId),
        notDeleted(categories),
      ),
    )
    .all()
    .filter((row) => row.id !== exceptId)
    .map((row) => row.name);
}

/** Crea una categoría (HU-07). Una principal nace con su «General» para que siempre haya dos niveles. */
export function createCategory(
  ctx: WriteContext,
  input: CategoryInput & { parentId: string | null },
): CategoryResult {
  const parent = input.parentId ? getCategory(ctx.db, input.parentId) : undefined;
  const errors = checkCategoryInput(input, {
    parent: parent ?? null,
    siblingNames: siblingNames(ctx.db, input.kind, input.parentId),
  });
  if (errors.length > 0) return { ok: false, errors };
  const values = { kind: input.kind, icon: input.icon, color: input.color, systemKey: null };
  const id = ctx.db.transaction((tx) => {
    const txCtx = { ...ctx, db: tx };
    const newId = insertRow(txCtx, categories, {
      ...values,
      name: input.name.trim(),
      parentId: input.parentId,
    });
    if (!input.parentId) {
      insertRow(
        txCtx,
        categories,
        { ...values, name: 'General', parentId: newId },
        { id: generalCategoryId(ctx.userId, { id: newId, systemKey: null }) },
      );
    }
    return newId;
  });
  return { ok: true, id };
}

/** Cambia nombre, ícono o color; el tipo, la principal y la clave no cambian. */
export function updateCategory(
  ctx: WriteContext,
  id: string,
  patch: Partial<Pick<CategoryInput, 'name' | 'icon' | 'color'>>,
): CategoryResult {
  const current = getCategory(ctx.db, id);
  if (!current) return { ok: false, errors: ['name_required'] };
  const next = { ...current, ...patch, name: (patch.name ?? current.name).trim() };
  const parent = current.parentId ? getCategory(ctx.db, current.parentId) : undefined;
  const errors = checkCategoryInput(next, {
    parent: parent ?? null,
    siblingNames: siblingNames(ctx.db, current.kind, current.parentId, id),
  });
  if (errors.length > 0) return { ok: false, errors };
  updateRow(ctx, categories, id, { name: next.name, icon: next.icon, color: next.color });
  return { ok: true, id };
}

/**
 * Archiva o desarchiva solo esa fila, nunca en cascada: la rama de una principal archivada se oculta al
 * leer, así una subcategoría archivada aparte sigue archivada al desarchivar su principal.
 */
export function setCategoryArchived(ctx: WriteContext, id: string, archived: boolean): void {
  updateRow(ctx, categories, id, { archivedAt: archived ? new Date(ctx.clock.now()) : null });
}

const byName = (a: CategoryRow, b: CategoryRow) => a.name.localeCompare(b.name, 'es');

/**
 * Árbol de dos niveles de un tipo, en orden alfabético y con el «General»/«Otros» al final. Sin
 * archivadas, una principal archivada oculta toda su rama.
 */
export function listCategories(
  db: LocalDb,
  kind: CategoryKind,
  { includeArchived }: { includeArchived: boolean },
): CategoryNode[] {
  const rows = db
    .select()
    .from(categories)
    .where(and(eq(categories.kind, kind), notDeleted(categories)))
    .all()
    .filter((row) => includeArchived || row.archivedAt === null);
  return rows
    .filter((row) => row.parentId === null)
    .sort(byName)
    .map((main) => {
      const generalId = generalCategoryId(main.userId, main);
      const children = rows.filter((row) => row.parentId === main.id).sort(byName);
      return {
        ...main,
        children: [
          ...children.filter((c) => c.id !== generalId),
          ...children.filter((c) => c.id === generalId),
        ],
      };
    });
}
