/**
 * Foto del recibo en el dispositivo (HU-06, CU-11): se reduce, se guarda dentro de la app sin metadatos
 * de ubicación (la reducción vuelve a codificar la imagen; verificado en la prueba de concepto de T-018)
 * y se borra cuando su foto deja de estar vigente. Las operaciones de archivo llegan en `ReceiptIO`
 * (expoReceiptIO.ts en la app, uno en memoria en las pruebas).
 */
import { attachments } from '@luka/schema-sqlite';
import { and, eq, isNotNull } from 'drizzle-orm';
import type { ReceiptFile } from '../db/attachments';
import { liveReceiptIds } from '../db/attachments';
import type { LocalDb } from '../db/types';

/** Lado largo de la foto guardada: un recibo sigue legible y pesa unos 100 KB. */
export const RECEIPT_MAX_SIDE = 1600;
/** Por debajo de este espacio libre no se guarda la foto. */
export const MIN_FREE_BYTES = 20 * 1024 * 1024;

export type ReceiptSource = 'camera' | 'library';
export type ReceiptError =
  'cancelled' | 'camera_denied' | 'no_space' | 'resize_failed' | 'save_failed';

export interface ReceiptIO {
  /** Abre la cámara o la galería; el archivo elegido queda en la caché del selector. */
  pick: (source: ReceiptSource) => Promise<{ uri: string } | 'cancelled' | 'camera_denied'>;
  /** Reduce la imagen a `maxSide` en su lado largo y la guarda como JPEG temporal; devuelve su ruta. */
  shrink: (uri: string, maxSide: number) => Promise<string>;
  freeBytes: () => number;
  /** Mueve el temporal a la carpeta de la app con el id de la foto; devuelve tamaño y sha256. */
  save: (tempUri: string, id: string) => Promise<Pick<ReceiptFile, 'sizeBytes' | 'sha256'>>;
  fileUri: (id: string) => string;
  /** Borra un archivo; no falla si no existe. */
  remove: (uri: string) => void;
  /** Ids de las fotos guardadas en la carpeta de la app. */
  savedIds: () => string[];
}

export type CaptureResult = { ok: true; receipt: ReceiptFile } | { ok: false; error: ReceiptError };

/** Toma o elige la foto y la deja lista para guardarla con el movimiento; nunca deja archivos a medias. */
export async function captureReceipt(
  io: ReceiptIO,
  source: ReceiptSource,
  id: string,
): Promise<CaptureResult> {
  const picked = await io.pick(source);
  if (typeof picked === 'string') return { ok: false, error: picked };
  let temp: string | null = null;
  try {
    if (io.freeBytes() < MIN_FREE_BYTES) return { ok: false, error: 'no_space' };
    try {
      temp = await io.shrink(picked.uri, RECEIPT_MAX_SIDE);
    } catch {
      return { ok: false, error: 'resize_failed' };
    }
    try {
      return { ok: true, receipt: { id, ...(await io.save(temp, id)) } };
    } catch {
      io.remove(io.fileUri(id));
      return { ok: false, error: 'save_failed' };
    }
  } finally {
    // El archivo que deja el selector en caché y el temporal de la reducción nunca se quedan.
    io.remove(picked.uri);
    if (temp) io.remove(temp);
  }
}

/** Al abrir la app: borra los archivos cuya foto no está vigente (quitada, de un movimiento borrado o sin fila). */
export async function purgeReceiptFiles(db: LocalDb, io: ReceiptIO): Promise<void> {
  const live = liveReceiptIds(db);
  for (const id of io.savedIds()) {
    if (!live.has(id)) io.remove(io.fileUri(id));
    // Entre archivo y archivo se cede el turno para no trabar la pantalla.
    await Promise.resolve();
  }
}

/** Al desaparecer «Deshacer»: borra los archivos de las fotos borradas de ese movimiento. */
export function removeDeletedReceiptFiles(db: LocalDb, io: ReceiptIO, transactionId: string): void {
  const rows = db
    .select({ id: attachments.id })
    .from(attachments)
    .where(and(eq(attachments.transactionId, transactionId), isNotNull(attachments.deletedAt)))
    .all();
  for (const { id } of rows) io.remove(io.fileUri(id));
}
