/**
 * Foto del recibo de un movimiento (HU-06, CU-11): una fila de `attachments` por movimiento. El archivo
 * vive solo en el dispositivo (files/receipts.ts) y la fila queda pendiente de subir (`storage_key` y
 * `uploaded_at` nulos) hasta T-035.
 */
import { attachments, transactions } from '@luka/schema-sqlite';
import { and, eq, isNull } from 'drizzle-orm';
import type { LocalDb } from './types';
import { insertRow, notDeleted, softDelete, type WriteContext } from './write';

/** El archivo ya guardado en el dispositivo; su id es también el de la fila. */
export interface ReceiptFile {
  id: string;
  sizeBytes: number;
  sha256: string;
}

export function getReceipt(db: LocalDb, transactionId: string) {
  return db
    .select()
    .from(attachments)
    .where(
      and(
        eq(attachments.transactionId, transactionId),
        eq(attachments.kind, 'receipt'),
        notDeleted(attachments),
      ),
    )
    .get();
}

/** Fotos vigentes: ni la fila ni su movimiento están borrados. Los demás archivos sobran. */
export function liveReceiptIds(db: LocalDb): Set<string> {
  const rows = db
    .select({ id: attachments.id })
    .from(attachments)
    .innerJoin(transactions, eq(transactions.id, attachments.transactionId))
    .where(and(isNull(attachments.deletedAt), isNull(transactions.deletedAt)))
    .all();
  return new Set(rows.map((row) => row.id));
}

/** Pone, reemplaza (una foto por movimiento) o quita la foto, dentro de la transacción que lo guarda. */
export function setReceipt(ctx: WriteContext, transactionId: string, receipt: ReceiptFile | null) {
  const current = getReceipt(ctx.db, transactionId);
  if (current?.id === receipt?.id) return;
  if (current) softDelete(ctx, attachments, current.id);
  if (receipt) {
    insertRow(
      ctx,
      attachments,
      {
        transactionId,
        kind: 'receipt',
        mimeType: 'image/jpeg',
        sizeBytes: receipt.sizeBytes,
        sha256: receipt.sha256,
        storageKey: null,
        uploadedAt: null,
      },
      { id: receipt.id },
    );
  }
}
