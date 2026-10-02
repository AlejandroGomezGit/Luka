import { PREDEFINED_CATEGORIES, predefinedCategoryId } from '@luka/domain';
import { categories } from '@luka/schema-sqlite';
import { eq } from 'drizzle-orm';
import { seedPredefinedCategories } from '../src/db/categories';
import { prepareLocalData } from '../src/db/prepare';
import { createTestDb, testClock, testRandom } from '../src/db/testing';
import { updateRow, type WriteContext } from '../src/db/write';

const userId = '0199a6f0-0000-7000-8000-000000000001';

async function context(): Promise<WriteContext> {
  return { db: await createTestDb(), userId, clock: testClock(), random: testRandom() };
}

const ids = (ctx: WriteContext) =>
  ctx.db
    .select({ id: categories.id })
    .from(categories)
    .all()
    .map((row) => row.id)
    .sort();

describe('HU-07 categorías predefinidas', () => {
  it('HU-07 al empezar ya hay categorías: el primer arranque siembra las 75', async () => {
    const db = await createTestDb();
    const { userId: localUser } = prepareLocalData(db, testClock(), testRandom());
    const rows = db.select().from(categories).all();
    expect(rows).toHaveLength(PREDEFINED_CATEGORIES.length);
    const groceries = rows.find((row) => row.systemKey === 'food.groceries');
    expect(groceries).toMatchObject({
      id: predefinedCategoryId(localUser, 'food.groceries'),
      parentId: predefinedCategoryId(localUser, 'food'),
      name: 'Supermercado',
      kind: 'expense',
      icon: '🛒',
      color: 'orange',
      userId: localUser,
      version: 0,
    });
  });

  it('HU-07 sembrar de nuevo es idempotente: no duplica ni cambia nada', async () => {
    const ctx = await context();
    seedPredefinedCategories(ctx);
    const before = ctx.db.select().from(categories).all();
    seedPredefinedCategories(ctx);
    expect(ctx.db.select().from(categories).all()).toEqual(before);
  });

  it('HU-07 un segundo dispositivo del mismo usuario genera exactamente los mismos ids', async () => {
    const deviceA = await context();
    const deviceB = await context();
    seedPredefinedCategories(deviceA);
    seedPredefinedCategories(deviceB);
    expect(ids(deviceB)).toEqual(ids(deviceA));
    expect(ids(deviceA)).toHaveLength(PREDEFINED_CATEGORIES.length);
  });

  it('HU-07 conserva las categorías renombradas o archivadas al volver a sembrar', async () => {
    const ctx = await context();
    seedPredefinedCategories(ctx);
    const groceriesId = predefinedCategoryId(userId, 'food.groceries');
    const petsId = predefinedCategoryId(userId, 'pets.other');
    updateRow(ctx, categories, groceriesId, { name: 'Mercado' });
    updateRow(ctx, categories, petsId, { archivedAt: new Date(ctx.clock.now()) });
    seedPredefinedCategories(ctx);
    const byId = (id: string) =>
      ctx.db.select().from(categories).where(eq(categories.id, id)).get();
    expect(byId(groceriesId)?.name).toBe('Mercado');
    expect(byId(petsId)?.archivedAt).toEqual(new Date(ctx.clock.now()));
    expect(ids(ctx)).toHaveLength(PREDEFINED_CATEGORIES.length);
  });
});
