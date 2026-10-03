import { predefinedCategoryId } from '@luka/domain';
import { attachments, transactions, transactionSearch } from '@luka/schema-sqlite';
import { count, eq } from 'drizzle-orm';
import { createAccount } from '../src/db/accounts';
import { getReceipt, liveReceiptIds } from '../src/db/attachments';
import { seedPredefinedCategories } from '../src/db/categories';
import { createTestDb, testClock, testRandom } from '../src/db/testing';
import {
  backfillTransactionSearch,
  countTransactions,
  createTransaction,
  deleteTransaction,
  fillSearchInBackground,
  getTransaction,
  restoreTransaction,
  transactionValues,
  updateTransaction,
} from '../src/db/transactions';
import { insertRow, type WriteContext } from '../src/db/write';

const userId = '0199a6f0-0000-7000-8000-000000000001';
const BOGOTA = 'America/Bogota';

async function setup() {
  const clock = testClock(Date.UTC(2026, 9, 3, 17));
  const ctx: WriteContext = { db: await createTestDb(), userId, clock, random: testRandom() };
  seedPredefinedCategories(ctx);
  const account = createAccount(ctx, {
    name: 'Efectivo',
    type: 'cash',
    currency: 'COP',
    openingAmountMinor: 100_000_00,
    icon: '💵',
    color: 'green',
  });
  if (!account.ok) throw new Error(account.errors.join());
  const expense = {
    kind: 'expense' as const,
    amountMinor: 12_000_00,
    accountId: account.id,
    categoryId: predefinedCategoryId(userId, 'food.groceries'),
    occurredOn: '2026-10-03',
  };
  const create = (extra: { tags?: string[]; receipt?: ReturnType<typeof receipt> }) => {
    const result = createTransaction(ctx, { ...expense, ...extra }, BOGOTA);
    if (!result.ok) throw new Error(result.errors.join());
    return result.id;
  };
  return { ctx, clock, expense, create, cash: account.id };
}

const receipt = (id: string) => ({ id, sizeBytes: 108_691, sha256: 'b386b799c4ff6abe' });

describe('HU-06 etiquetas', () => {
  it('HU-06 se guardan como se escriben y la búsqueda las encuentra sin mayúsculas ni tildes', async () => {
    const { ctx, create } = await setup();
    const id = create({ tags: ['Viaje a Medellín', 'trabajo'] });
    expect(getTransaction(ctx.db, id)?.tags).toEqual(['Viaje a Medellín', 'trabajo']);
    const row = getTransaction(ctx.db, id);
    if (!row) throw new Error('sin movimiento');
    expect(transactionValues(row).tags).toEqual(['Viaje a Medellín', 'trabajo']);
    expect(countTransactions(ctx.db, userId, { text: 'medellin' })).toBe(1);
    expect(countTransactions(ctx.db, userId, { text: 'TRABAJO' })).toBe(1);
    expect(countTransactions(ctx.db, userId, { text: 'playa' })).toBe(0);
  });

  it('HU-06 al editar cambian las etiquetas y la búsqueda', async () => {
    const { ctx, create, expense } = await setup();
    const id = create({ tags: ['trabajo'] });
    const result = updateTransaction(ctx, id, { ...expense, tags: ['Playa'] }, BOGOTA);
    expect(result.ok).toBe(true);
    expect(countTransactions(ctx.db, userId, { text: 'trabajo' })).toBe(0);
    expect(countTransactions(ctx.db, userId, { text: 'playa' })).toBe(1);
  });

  it('HU-06 más de 10 etiquetas o una de más de 30 caracteres no se guardan', async () => {
    const { ctx, expense } = await setup();
    const eleven = Array.from({ length: 11 }, (_, i) => `e${String(i)}`);
    expect(createTransaction(ctx, { ...expense, tags: eleven }, BOGOTA)).toEqual({
      ok: false,
      errors: ['too_many_tags'],
    });
    expect(createTransaction(ctx, { ...expense, tags: ['a'.repeat(31)] }, BOGOTA)).toEqual({
      ok: false,
      errors: ['tag_too_long'],
    });
    expect(ctx.db.select({ n: count() }).from(transactions).get()?.n).toBe(0);
  });
});

describe('HU-06 texto de búsqueda por lotes (regla de tablas derivadas, DT-06)', () => {
  async function withoutSearch(n: number) {
    const { ctx, clock, cash } = await setup();
    ctx.db.transaction((tx) => {
      for (let i = 0; i < n; i++) {
        // Un milisegundo por movimiento: UUID v7 distintos con el azar determinista de las pruebas.
        clock.advance(1);
        insertRow({ ...ctx, db: tx }, transactions, {
          kind: 'expense',
          amountMinor: -1_00,
          accountId: cash,
          currency: 'COP',
          occurredOn: '2026-10-01',
          note: `nota ${String(i)}`,
          tags: i === 0 ? ['Mercado'] : [],
          categorySource: 'user',
          source: 'manual',
          reviewStatus: 'confirmed',
        });
      }
    });
    const filled = () => ctx.db.select({ n: count() }).from(transactionSearch).get()?.n;
    return { ctx, filled };
  }

  it('HU-06 rellena de a un lote, incluye las etiquetas y es idempotente', async () => {
    const { ctx, filled } = await withoutSearch(1_200);
    expect(backfillTransactionSearch(ctx.db, 500)).toBe(500);
    expect(filled()).toBe(500);
    expect(backfillTransactionSearch(ctx.db, 500)).toBe(500);
    expect(backfillTransactionSearch(ctx.db, 500)).toBe(200);
    expect(backfillTransactionSearch(ctx.db, 500)).toBe(0);
    expect(filled()).toBe(1_200);
    expect(countTransactions(ctx.db, userId, { text: 'mercado' })).toBe(1);
  });

  it('HU-06 en segundo plano no rellena nada antes del primer render y termina lote a lote', async () => {
    const { ctx, filled } = await withoutSearch(1_200);
    const pending: (() => void)[] = [];
    fillSearchInBackground(ctx.db, (task) => pending.push(task), 500);
    // Nada corre de forma síncrona: la pantalla se dibuja primero.
    expect(filled()).toBe(0);
    let batches = 0;
    while (pending.length > 0) {
      pending.shift()?.();
      batches++;
    }
    expect(filled()).toBe(1_200);
    expect(batches).toBe(3);
  });
});

describe('HU-06 foto del recibo', () => {
  it('HU-06 al guardar con foto queda una fila de adjunto pendiente de subir', async () => {
    const { ctx, create } = await setup();
    const id = create({ receipt: receipt('foto-1') });
    const row = ctx.db.select().from(attachments).where(eq(attachments.id, 'foto-1')).get();
    expect(row).toMatchObject({
      transactionId: id,
      kind: 'receipt',
      mimeType: 'image/jpeg',
      sizeBytes: 108_691,
      sha256: 'b386b799c4ff6abe',
      storageKey: null,
      uploadedAt: null,
      version: 0,
      deletedAt: null,
    });
    expect(getReceipt(ctx.db, id)?.id).toBe('foto-1');
  });

  it('HU-06 una foto por movimiento: reemplazarla borra la anterior y quitarla la borra', async () => {
    const { ctx, create, expense } = await setup();
    const id = create({ receipt: receipt('foto-1') });
    updateTransaction(ctx, id, { ...expense, receipt: receipt('foto-2') }, BOGOTA);
    expect(getReceipt(ctx.db, id)?.id).toBe('foto-2');
    expect(
      ctx.db.select().from(attachments).where(eq(attachments.id, 'foto-1')).get()?.deletedAt,
    ).not.toBeNull();
    // Sin `receipt` la foto no cambia; con null se quita.
    updateTransaction(ctx, id, { ...expense, note: 'otra' }, BOGOTA);
    expect(getReceipt(ctx.db, id)?.id).toBe('foto-2');
    updateTransaction(ctx, id, { ...expense, receipt: null }, BOGOTA);
    expect(getReceipt(ctx.db, id)).toBeUndefined();
    expect(liveReceiptIds(ctx.db)).toEqual(new Set());
  });

  it('HU-06 borrar el movimiento borra su foto y Deshacer devuelve las dos', async () => {
    const { ctx, clock, create } = await setup();
    const id = create({ receipt: receipt('foto-1') });
    clock.advance(1_000);
    deleteTransaction(ctx, id);
    expect(getTransaction(ctx.db, id)?.deletedAt).not.toBeNull();
    expect(getReceipt(ctx.db, id)).toBeUndefined();
    expect(liveReceiptIds(ctx.db)).toEqual(new Set());
    restoreTransaction(ctx, id);
    expect(getTransaction(ctx.db, id)?.deletedAt).toBeNull();
    expect(getReceipt(ctx.db, id)?.id).toBe('foto-1');
    expect(liveReceiptIds(ctx.db)).toEqual(new Set(['foto-1']));
  });

  it('HU-06 Deshacer no devuelve una foto que ya se había quitado antes de borrar el movimiento', async () => {
    const { ctx, clock, create, expense } = await setup();
    const id = create({ receipt: receipt('foto-1') });
    updateTransaction(ctx, id, { ...expense, receipt: null }, BOGOTA);
    clock.advance(1_000);
    deleteTransaction(ctx, id);
    restoreTransaction(ctx, id);
    expect(getReceipt(ctx.db, id)).toBeUndefined();
  });
});
