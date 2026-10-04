import { predefinedCategoryId } from '@luka/domain';
import { createAccount } from '../src/db/accounts';
import { seedPredefinedCategories } from '../src/db/categories';
import { createTestDb, testClock, testRandom } from '../src/db/testing';
import { createTransaction, deleteTransaction, updateTransaction } from '../src/db/transactions';
import type { WriteContext } from '../src/db/write';
import {
  captureReceipt,
  MIN_FREE_BYTES,
  purgeReceiptFiles,
  type ReceiptIO,
  RECEIPT_MAX_SIDE,
  removeDeletedReceiptFiles,
} from '../src/files/receipts';

const userId = '0199a6f0-0000-7000-8000-000000000001';
const BOGOTA = 'America/Bogota';

/** Sistema de archivos en memoria: `files` son las rutas que existen. */
function fakeIO(overrides: Partial<ReceiptIO> = {}) {
  const files = new Set<string>();
  const io: ReceiptIO = {
    pick: () => {
      files.add('cache/ImagePicker/IMG_0001.jpg');
      return Promise.resolve({ uri: 'cache/ImagePicker/IMG_0001.jpg' });
    },
    shrink: (uri, maxSide) => {
      expect(maxSide).toBe(RECEIPT_MAX_SIDE);
      expect(files.has(uri)).toBe(true);
      files.add('cache/ImageManipulator/out.jpg');
      return Promise.resolve('cache/ImageManipulator/out.jpg');
    },
    freeBytes: () => 10 * MIN_FREE_BYTES,
    save: (temp, id) => {
      files.delete(temp);
      files.add(`attachments/${id}.jpg`);
      return Promise.resolve({ sizeBytes: 108_691, sha256: 'b386b799' });
    },
    fileUri: (id) => `attachments/${id}.jpg`,
    remove: (uri) => {
      files.delete(uri);
    },
    savedIds: () =>
      [...files].filter((f) => f.startsWith('attachments/')).map((f) => f.slice(12, -4)),
    ...overrides,
  };
  return { io, files };
}

describe('HU-06 tomar o elegir la foto del recibo', () => {
  it('HU-06 la foto se reduce, se guarda en la app con su tamaño y sha256, y no quedan temporales', async () => {
    const { io, files } = fakeIO();
    const result = await captureReceipt(io, 'library', 'foto-1');
    expect(result).toEqual({
      ok: true,
      receipt: { id: 'foto-1', sizeBytes: 108_691, sha256: 'b386b799' },
    });
    // Ni el archivo que deja el selector en caché ni el de la reducción quedan.
    expect([...files]).toEqual(['attachments/foto-1.jpg']);
  });

  it('HU-06 cancelar el selector o negar la cámara no deja archivos', async () => {
    for (const outcome of ['cancelled', 'camera_denied'] as const) {
      const { io, files } = fakeIO({ pick: () => Promise.resolve(outcome) });
      expect(await captureReceipt(io, 'camera', 'foto-1')).toEqual({ ok: false, error: outcome });
      expect([...files]).toEqual([]);
    }
  });

  it('HU-06 sin espacio suficiente no reduce ni guarda, y borra el temporal del selector', async () => {
    const { io, files } = fakeIO({ freeBytes: () => MIN_FREE_BYTES - 1 });
    expect(await captureReceipt(io, 'library', 'foto-1')).toEqual({
      ok: false,
      error: 'no_space',
    });
    expect([...files]).toEqual([]);
  });

  it('HU-06 si falla la reducción o el guardado, no queda ningún archivo', async () => {
    const failing = fakeIO({ shrink: () => Promise.reject(new Error('imagen dañada')) });
    expect(await captureReceipt(failing.io, 'library', 'foto-1')).toEqual({
      ok: false,
      error: 'resize_failed',
    });
    expect([...failing.files]).toEqual([]);

    const half = fakeIO();
    const save = half.io.save;
    // Guarda a medias y falla: el archivo parcial también se borra.
    half.io.save = async (temp, id) => {
      await save(temp, id);
      throw new Error('disco lleno');
    };
    expect(await captureReceipt(half.io, 'library', 'foto-1')).toEqual({
      ok: false,
      error: 'save_failed',
    });
    expect([...half.files]).toEqual([]);
  });
});

describe('HU-06 archivos que sobran', () => {
  async function setup() {
    const clock = testClock(Date.UTC(2026, 9, 3, 17));
    const ctx: WriteContext = { db: await createTestDb(), userId, clock, random: testRandom() };
    seedPredefinedCategories(ctx);
    const account = createAccount(ctx, {
      name: 'Efectivo',
      type: 'cash',
      currency: 'COP',
      openingAmountMinor: 0,
      icon: '💵',
      color: 'green',
    });
    if (!account.ok) throw new Error(account.errors.join());
    const expense = {
      kind: 'expense' as const,
      amountMinor: 1_000_00,
      accountId: account.id,
      categoryId: predefinedCategoryId(userId, 'food.groceries'),
      occurredOn: '2026-10-03',
    };
    const withReceipt = (id: string) => {
      const result = createTransaction(
        ctx,
        { ...expense, receipt: { id, sizeBytes: 1, sha256: 'x' } },
        BOGOTA,
      );
      if (!result.ok) throw new Error(result.errors.join());
      return result.id;
    };
    return { ctx, expense, withReceipt };
  }

  it('HU-06 al abrir la app se borran los archivos sin foto vigente: quitada, de un movimiento borrado o sin fila', async () => {
    const { ctx, expense, withReceipt } = await setup();
    withReceipt('vigente');
    const removed = withReceipt('quitada');
    updateTransaction(ctx, removed, { ...expense, receipt: null }, BOGOTA);
    deleteTransaction(ctx, withReceipt('de-borrado'));
    const { io, files } = fakeIO();
    for (const id of ['vigente', 'quitada', 'de-borrado', 'sin-fila']) {
      files.add(`attachments/${id}.jpg`);
    }
    await purgeReceiptFiles(ctx.db, io);
    expect([...files]).toEqual(['attachments/vigente.jpg']);
    await purgeReceiptFiles(ctx.db, io);
    expect([...files]).toEqual(['attachments/vigente.jpg']);
  });

  it('HU-06 al desaparecer «Deshacer» se borra el archivo de ese movimiento y nada más', async () => {
    const { ctx, withReceipt } = await setup();
    const deleted = withReceipt('borrada');
    deleteTransaction(ctx, deleted);
    const { io, files } = fakeIO();
    // Una foto recién elegida en un formulario abierto todavía no tiene fila: no se toca.
    for (const id of ['borrada', 'pendiente']) files.add(`attachments/${id}.jpg`);
    removeDeletedReceiptFiles(ctx.db, io, deleted);
    expect([...files]).toEqual(['attachments/pendiente.jpg']);
  });
});
