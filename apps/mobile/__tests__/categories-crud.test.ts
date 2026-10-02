import { generalCategoryId, predefinedCategoryId } from '@luka/domain';
import { transactions } from '@luka/schema-sqlite';
import { eq } from 'drizzle-orm';
import {
  createCategory,
  getCategory,
  listCategories,
  seedPredefinedCategories,
  setCategoryArchived,
  updateCategory,
} from '../src/db/categories';
import { createTestDb, testClock, testRandom } from '../src/db/testing';
import { insertRow, type WriteContext } from '../src/db/write';
import { accounts } from '@luka/schema-sqlite';

const userId = '0199a6f0-0000-7000-8000-000000000001';
const foodId = predefinedCategoryId(userId, 'food');
const groceriesId = predefinedCategoryId(userId, 'food.groceries');

async function context(): Promise<WriteContext> {
  const ctx = { db: await createTestDb(), userId, clock: testClock(), random: testRandom() };
  seedPredefinedCategories(ctx);
  return ctx;
}

const names = (ctx: WriteContext, kind: 'expense' | 'income', includeArchived = false) =>
  listCategories(ctx.db, kind, { includeArchived }).map((main) => [
    main.name,
    main.children.map((child) => child.name),
  ]);

const created = (result: ReturnType<typeof createCategory>): string => {
  if (!result.ok) throw new Error(result.errors.join(', '));
  return result.id;
};

describe('HU-07 crear categorías propias con ícono y color', () => {
  it('HU-07 una categoría principal nueva nace con su «General», con id estable', async () => {
    const ctx = await context();
    const id = created(
      createCategory(ctx, {
        name: 'Bebé',
        kind: 'expense',
        icon: '👶',
        color: 'pink',
        parentId: null,
      }),
    );
    const main = listCategories(ctx.db, 'expense', { includeArchived: false }).find(
      (c) => c.id === id,
    );
    expect(main).toMatchObject({ name: 'Bebé', icon: '👶', color: 'pink', systemKey: null });
    expect(main?.children).toEqual([
      expect.objectContaining({
        id: generalCategoryId(userId, { id, systemKey: null }),
        name: 'General',
      }),
    ]);
  });

  it('HU-07 una subcategoría nueva queda bajo su principal', async () => {
    const ctx = await context();
    created(
      createCategory(ctx, {
        name: 'Panadería',
        kind: 'expense',
        icon: '🥖',
        color: 'orange',
        parentId: foodId,
      }),
    );
    expect(names(ctx, 'expense').find(([name]) => name === 'Alimentación')?.[1]).toContain(
      'Panadería',
    );
  });

  it('HU-07 rechaza nombres repetidos y un tercer nivel, y no guarda nada', async () => {
    const ctx = await context();
    const before = names(ctx, 'expense');
    expect(
      createCategory(ctx, {
        name: 'supermércado',
        kind: 'expense',
        icon: '🥖',
        color: 'orange',
        parentId: foodId,
      }),
    ).toEqual({ ok: false, errors: ['name_duplicate'] });
    expect(
      createCategory(ctx, {
        name: 'Orgánicos',
        kind: 'expense',
        icon: '🥬',
        color: 'green',
        parentId: groceriesId,
      }),
    ).toEqual({ ok: false, errors: ['parent_not_main'] });
    expect(names(ctx, 'expense')).toEqual(before);
  });
});

describe('HU-07 renombrar', () => {
  it('HU-07 se puede renombrar una predefinida y cambiarle ícono y color; la clave no cambia', async () => {
    const ctx = await context();
    expect(
      updateCategory(ctx, groceriesId, { name: 'Mercado', icon: '🧺', color: 'green' }),
    ).toEqual({
      ok: true,
      id: groceriesId,
    });
    expect(getCategory(ctx.db, groceriesId)).toMatchObject({
      name: 'Mercado',
      icon: '🧺',
      color: 'green',
      systemKey: 'food.groceries',
    });
  });

  it('HU-07 renombrar a un nombre que ya usa una hermana falla, pero a su propio nombre no', async () => {
    const ctx = await context();
    expect(updateCategory(ctx, groceriesId, { name: 'Restaurantes' })).toEqual({
      ok: false,
      errors: ['name_duplicate'],
    });
    expect(updateCategory(ctx, groceriesId, { name: 'SUPERMERCADO' }).ok).toBe(true);
  });
});

describe('HU-07 archivar', () => {
  it('HU-07 archivar no altera movimientos antiguos: siguen con su categoría y se puede mostrar', async () => {
    const ctx = await context();
    const accountId = insertRow(ctx, accounts, {
      name: 'Efectivo',
      type: 'cash',
      currency: 'COP',
      color: 'green',
      icon: '💵',
    });
    const txId = insertRow(ctx, transactions, {
      accountId,
      kind: 'expense',
      amountMinor: -1_250_000,
      currency: 'COP',
      occurredOn: '2026-10-01',
      categoryId: groceriesId,
    });
    const before = ctx.db.select().from(transactions).where(eq(transactions.id, txId)).get();
    setCategoryArchived(ctx, groceriesId, true);
    expect(names(ctx, 'expense').find(([n]) => n === 'Alimentación')?.[1]).not.toContain(
      'Supermercado',
    );
    expect(ctx.db.select().from(transactions).where(eq(transactions.id, txId)).get()).toEqual(
      before,
    );
    expect(getCategory(ctx.db, groceriesId)).toMatchObject({ name: 'Supermercado', icon: '🛒' });
  });

  it('HU-07 archivar una principal oculta toda su rama; con «mostrar archivadas» vuelve a verse', async () => {
    const ctx = await context();
    setCategoryArchived(ctx, foodId, true);
    expect(names(ctx, 'expense').map(([n]) => n)).not.toContain('Alimentación');
    expect(names(ctx, 'expense', true).map(([n]) => n)).toContain('Alimentación');
  });

  it('una subcategoría archivada aparte sigue archivada tras archivar y desarchivar su principal', async () => {
    const ctx = await context();
    setCategoryArchived(ctx, groceriesId, true);
    setCategoryArchived(ctx, foodId, true);
    setCategoryArchived(ctx, foodId, false);
    const food = names(ctx, 'expense').find(([n]) => n === 'Alimentación');
    expect(food?.[1]).toEqual(['Café y snacks', 'Domicilios', 'Restaurantes', 'Otros']);
    expect(getCategory(ctx.db, groceriesId)?.archivedAt).not.toBeNull();
  });
});
