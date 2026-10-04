import { act, fireEvent, screen } from '@testing-library/react-native';
import { Stack } from 'expo-router';
import { renderRouter } from 'expo-router/testing-library';
import type { ReactNode } from 'react';
import { Linking, StyleSheet } from 'react-native';
import { predefinedCategoryId } from '@luka/domain';
import { attachments, transactions } from '@luka/schema-sqlite';
import Home from '../src/app/(tabs)/index';
import EditTransactionScreen from '../src/app/transactions/[id]';
import NewTransactionScreen from '../src/app/transactions/new';
import { createAccount } from '../src/db/accounts';
import { getReceipt } from '../src/db/attachments';
import { seedPredefinedCategories } from '../src/db/categories';
import { LocalSessionProvider, type LocalSession } from '../src/db/session';
import { createTestDb, testClock, testRandom } from '../src/db/testing';
import * as transactionsModule from '../src/db/transactions';
import { blockNetwork } from '../src/testing';
import { UNDO_SECONDS } from '../src/ui/UndoBar';
import { UndoProvider } from '../src/undo';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 393, height: 852, scale: 3, fontScale: 1 }),
}));

// Cámara, galería y archivos en memoria: `mockFiles` son las rutas que existen.
const mockFiles = new Set<string>();
const mockIO: {
  pick: { uri: string } | 'cancelled' | 'camera_denied';
  freeBytes: number;
  failShrink: boolean;
  pickCalls: number;
} = { pick: { uri: 'cache/ImagePicker/IMG.jpg' }, freeBytes: 1e9, failShrink: false, pickCalls: 0 };

// Hoja inferior como en iOS: al cerrarse, `onDismiss` llega después, cuando termina la animación.
// `finishClosing` la termina; mientras tanto iOS no presenta otra pantalla (el selector de fotos).
const mockDismissals: (() => void)[] = [];
jest.mock('../src/ui/BottomSheet', () => {
  const { useEffect, useRef } = jest.requireActual<typeof import('react')>('react');
  return {
    BottomSheet: (props: { visible: boolean; onDismiss?: () => void; children: ReactNode }) => {
      const wasVisible = useRef(props.visible);
      useEffect(() => {
        if (wasVisible.current && !props.visible && props.onDismiss) {
          mockDismissals.push(props.onDismiss);
        }
        wasVisible.current = props.visible;
      }, [props.visible, props.onDismiss]);
      return props.visible ? props.children : null;
    },
  };
});
const finishClosing = () =>
  act(async () => {
    for (let dismiss = mockDismissals.shift(); dismiss; dismiss = mockDismissals.shift()) {
      dismiss();
    }
    await Promise.resolve();
  });
jest.mock('../src/files/expoReceiptIO', () => ({
  expoReceiptIO: {
    pick: () => {
      mockIO.pickCalls++;
      if (typeof mockIO.pick !== 'string') mockFiles.add(mockIO.pick.uri);
      return Promise.resolve(mockIO.pick);
    },
    shrink: () => {
      if (mockIO.failShrink) return Promise.reject(new Error('imagen dañada'));
      mockFiles.add('cache/ImageManipulator/out.jpg');
      return Promise.resolve('cache/ImageManipulator/out.jpg');
    },
    freeBytes: () => mockIO.freeBytes,
    save: (temp: string, id: string) => {
      mockFiles.delete(temp);
      mockFiles.add(`attachments/${id}.jpg`);
      return Promise.resolve({ sizeBytes: 108_691, sha256: 'b386b799' });
    },
    fileUri: (id: string) => `attachments/${id}.jpg`,
    remove: (uri: string) => {
      mockFiles.delete(uri);
    },
    savedIds: () => [],
  },
}));

const networkAttempts = blockNetwork();
const userId = '0199a6f0-0000-7000-8000-000000000001';
const row = 'Gasto, -$ 12.500, Supermercado, Alimentación, Efectivo, hoy';

beforeEach(() => {
  mockFiles.clear();
  mockIO.pick = { uri: 'cache/ImagePicker/IMG.jpg' };
  mockIO.freeBytes = 1e9;
  mockIO.failShrink = false;
  mockIO.pickCalls = 0;
  mockDismissals.length = 0;
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

/** Con `withReceipt`, ya hay un gasto de 12.500 con la foto «foto-1». */
async function app(withReceipt = false) {
  const session: LocalSession = {
    db: await createTestDb(),
    userId,
    deviceId: 'd1',
    clock: testClock(Date.UTC(2026, 9, 1, 17)),
    random: testRandom(),
  };
  seedPredefinedCategories(session);
  const account = createAccount(session, {
    name: 'Efectivo',
    type: 'cash',
    currency: 'COP',
    openingAmountMinor: 120_000_00,
    icon: '💵',
    color: 'green',
  });
  if (!account.ok) throw new Error(account.errors.join());
  if (withReceipt) {
    transactionsModule.createTransaction(
      session,
      {
        kind: 'expense',
        amountMinor: 12_500_00,
        accountId: account.id,
        categoryId: predefinedCategoryId(userId, 'food.groceries'),
        occurredOn: '2026-10-01',
        receipt: { id: 'foto-1', sizeBytes: 1, sha256: 'x' },
      },
      'America/Bogota',
    );
    mockFiles.add('attachments/foto-1.jpg');
  }
  const wrapper = ({ children }: { children: ReactNode }) => (
    <LocalSessionProvider value={session}>{children}</LocalSessionProvider>
  );
  await renderRouter(
    {
      _layout: () => (
        <UndoProvider>
          <Stack />
        </UndoProvider>
      ),
      index: Home,
      'transactions/new': NewTransactionScreen,
      'transactions/[id]': EditTransactionScreen,
    },
    { initialUrl: '/', wrapper },
  );
  return session;
}

async function addPhoto(option: 'Tomar foto' | 'Elegir de la galería' = 'Elegir de la galería') {
  await fireEvent.press(screen.getByRole('button', { name: 'Agregar foto del recibo' }));
  await fireEvent.press(screen.getByRole('button', { name: option }));
  await finishClosing();
}

test('HU-06 «Elegir de la galería» abre el selector cuando la hoja terminó de cerrarse, no antes (en el iPhone real no se abría)', async () => {
  await app();
  await fireEvent.press(screen.getByRole('button', { name: 'Agregar' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Agregar foto del recibo' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Elegir de la galería' }));
  // Con la hoja todavía cerrándose, iOS no presentaría el selector: no se debe abrir aún.
  expect(mockIO.pickCalls).toBe(0);
  await finishClosing();
  expect(mockIO.pickCalls).toBe(1);
  expect(await screen.findByRole('image', { name: 'Foto del recibo' })).toBeOnTheScreen();
});

const minHeight = (name: string) =>
  (
    StyleSheet.flatten(screen.getByRole('button', { name }).props.style as never) as {
      minHeight?: number;
    }
  ).minHeight;

test('HU-06 desde «Agregar» se elige la foto en la galería, se ve la miniatura y al guardar quedan la foto pendiente de subir y las etiquetas, sin red', async () => {
  const session = await app();
  await fireEvent.press(screen.getByRole('button', { name: 'Agregar' }));
  await fireEvent.changeText(screen.getByLabelText('Monto'), '25000');
  await addPhoto();
  expect(await screen.findByRole('image', { name: 'Foto del recibo' })).toBeOnTheScreen();
  expect(minHeight('Quitar')).toBeGreaterThanOrEqual(44);
  expect(minHeight('Reemplazar')).toBeGreaterThanOrEqual(44);
  await fireEvent.changeText(screen.getByLabelText('Etiquetas'), 'Viaje a Medellín, trabajo');
  // «Guardar» está en la barra superior: se alcanza aunque el teclado siga abierto.
  await fireEvent.press(screen.getByRole('button', { name: 'Guardar' }));

  const saved = session.db.select().from(transactions).get();
  expect(saved?.tags).toEqual(['Viaje a Medellín', 'trabajo']);
  const photo = session.db.select().from(attachments).get();
  expect(photo).toMatchObject({ transactionId: saved?.id, storageKey: null, uploadedAt: null });
  // Ni el temporal del selector ni el de la reducción quedan: solo la foto guardada.
  expect([...mockFiles]).toEqual([`attachments/${photo?.id ?? ''}.jpg`]);
  expect(networkAttempts).toEqual([]);
});

test('HU-06 cancelar, cámara sin permiso, falta de espacio y fallo al reducir muestran un mensaje y no dejan archivos ni filas', async () => {
  const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
  const session = await app();
  await fireEvent.press(screen.getByRole('button', { name: 'Agregar' }));

  mockIO.pick = 'cancelled';
  await addPhoto();
  expect(await screen.findByText('No elegiste ninguna foto.')).toBeOnTheScreen();

  mockIO.pick = 'camera_denied';
  await addPhoto('Tomar foto');
  expect(
    await screen.findByText('Luka no tiene permiso para usar la cámara. Puedes darlo en Ajustes.'),
  ).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Abrir Ajustes' }));
  expect(openSettings).toHaveBeenCalled();

  mockIO.pick = { uri: 'cache/ImagePicker/IMG.jpg' };
  mockIO.freeBytes = 0;
  await addPhoto();
  expect(
    await screen.findByText('No hay espacio suficiente en el iPhone para guardar la foto.'),
  ).toBeOnTheScreen();

  mockIO.freeBytes = 1e9;
  mockIO.failShrink = true;
  await addPhoto();
  expect(
    await screen.findByText('No se pudo procesar la foto. Prueba con otra.'),
  ).toBeOnTheScreen();

  expect(screen.queryByRole('image', { name: 'Foto del recibo' })).toBeNull();
  expect([...mockFiles]).toEqual([]);
  expect(session.db.select().from(attachments).all()).toEqual([]);
});

test('HU-06 salir sin guardar o reemplazar antes de guardar borra la foto recién elegida', async () => {
  await app();
  await fireEvent.press(screen.getByRole('button', { name: 'Agregar' }));
  await addPhoto();
  await screen.findByRole('image', { name: 'Foto del recibo' });
  const [first] = [...mockFiles];
  await fireEvent.press(screen.getByRole('button', { name: 'Reemplazar' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Elegir de la galería' }));
  await finishClosing();
  expect(mockFiles.size).toBe(1);
  expect(mockFiles.has(first ?? '')).toBe(false);

  await fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }));
  expect([...mockFiles]).toEqual([]);
});

test('HU-06 si la foto se guarda pero falla el movimiento, se borra la foto y se avisa', async () => {
  const session = await app();
  await fireEvent.press(screen.getByRole('button', { name: 'Agregar' }));
  await fireEvent.changeText(screen.getByLabelText('Monto'), '25000');
  await addPhoto();
  await screen.findByRole('image', { name: 'Foto del recibo' });
  jest.spyOn(transactionsModule, 'createTransaction').mockImplementationOnce(() => {
    throw new Error('disco lleno');
  });
  await fireEvent.press(screen.getByRole('button', { name: 'Guardar' }));
  expect(
    screen.getByText('No se pudo guardar el movimiento. Vuelve a intentarlo.'),
  ).toBeOnTheScreen();
  expect(screen.queryByRole('image', { name: 'Foto del recibo' })).toBeNull();
  expect([...mockFiles]).toEqual([]);
  expect(session.db.select().from(attachments).all()).toEqual([]);
});

test('HU-06 al editar se quita la foto: la fila queda borrada y el archivo se borra al guardar', async () => {
  const session = await app(true);
  await fireEvent.press(screen.getByRole('button', { name: row }));
  expect(screen.getByRole('image', { name: 'Foto del recibo' })).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Quitar' }));
  expect(mockFiles.has('attachments/foto-1.jpg')).toBe(true);
  await fireEvent.press(screen.getByRole('button', { name: 'Guardar' }));
  const id = session.db.select().from(transactions).get()?.id ?? '';
  expect(getReceipt(session.db, id)).toBeUndefined();
  expect([...mockFiles]).toEqual([]);
});

test('HU-06 al borrar el movimiento, Deshacer devuelve la foto; cuando desaparece el aviso, el archivo se borra', async () => {
  const session = await app(true);
  const id = session.db.select().from(transactions).get()?.id ?? '';
  await fireEvent.press(screen.getByRole('button', { name: row }));
  await fireEvent.press(screen.getByRole('button', { name: 'Eliminar movimiento' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Deshacer' }));
  expect(getReceipt(session.db, id)?.id).toBe('foto-1');
  expect(mockFiles.has('attachments/foto-1.jpg')).toBe(true);

  jest.useFakeTimers();
  await fireEvent.press(screen.getByRole('button', { name: row }));
  await fireEvent.press(screen.getByRole('button', { name: 'Eliminar movimiento' }));
  expect(mockFiles.has('attachments/foto-1.jpg')).toBe(true);
  await act(() => {
    jest.advanceTimersByTime(UNDO_SECONDS * 1000);
  });
  expect(screen.queryByRole('button', { name: 'Deshacer' })).toBeNull();
  expect([...mockFiles]).toEqual([]);
  // La fila sigue 30 días con su borrado lógico.
  expect(session.db.select().from(attachments).get()?.deletedAt).not.toBeNull();
});
