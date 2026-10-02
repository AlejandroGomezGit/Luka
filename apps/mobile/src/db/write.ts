/**
 * Única ruta de escritura de las tablas sincronizables (ADR-003, regla 6 de CLAUDE.md): aquí se llenan
 * las columnas comunes del documento 02 y aquí T-029 agregará el outbox.
 */
import { newId, type Clock, type RandomBytes } from '@luka/domain';
import { accounts, attachments, categories, transactions } from '@luka/schema-sqlite';
import { eq, isNull, type SQL } from 'drizzle-orm';
import type { SQLiteUpdateSetSource } from 'drizzle-orm/sqlite-core';
import type { LocalDb } from './types';

export type SyncTable =
  typeof accounts | typeof categories | typeof transactions | typeof attachments;

type CommonColumn =
  'id' | 'userId' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'version' | 'fieldClocks';
export type NewValues<T extends SyncTable> = Omit<T['$inferInsert'], CommonColumn>;

export interface WriteContext {
  db: LocalDb;
  userId: string;
  clock: Clock;
  random: RandomBytes;
}

export interface InsertOptions {
  /** Id fijo, por ejemplo el UUID v5 de una categoría predefinida; por defecto, un UUID v7 nuevo. */
  id?: string;
  /** Si ya existe un registro con ese id, no lo toca (sembrar de forma idempotente). */
  ifAbsent?: boolean;
}

/** Crea un registro y devuelve su id. `version` queda en 0 hasta que el servidor lo aplique. */
export function insertRow<T extends SyncTable>(
  ctx: WriteContext,
  table: T,
  values: NewValues<T>,
  options: InsertOptions = {},
): string {
  const id = options.id ?? newId(ctx.clock, ctx.random);
  const now = new Date(ctx.clock.now());
  const insert = ctx.db.insert(table).values({
    ...values,
    id,
    userId: ctx.userId,
    createdAt: now,
    updatedAt: now,
  } as T['$inferInsert']);
  (options.ifAbsent ? insert.onConflictDoNothing() : insert).run();
  return id;
}

export function updateRow<T extends SyncTable>(
  ctx: WriteContext,
  table: T,
  id: string,
  patch: Partial<NewValues<T>>,
): void {
  ctx.db
    .update(table)
    .set({ ...patch, updatedAt: new Date(ctx.clock.now()) } as SQLiteUpdateSetSource<T>)
    .where(eq(table.id, id))
    .run();
}

/** Borrado lógico (regla 5 de CLAUDE.md): el registro se conserva y deja de aparecer en las lecturas. */
export function softDelete(ctx: WriteContext, table: SyncTable, id: string): void {
  const now = new Date(ctx.clock.now());
  ctx.db.update(table).set({ deletedAt: now, updatedAt: now }).where(eq(table.id, id)).run();
}

/** Deshace un borrado lógico (HU-04). */
export function restore(ctx: WriteContext, table: SyncTable, id: string): void {
  ctx.db
    .update(table)
    .set({ deletedAt: null, updatedAt: new Date(ctx.clock.now()) })
    .where(eq(table.id, id))
    .run();
}

/** Filtro para toda lectura que muestra datos: excluye lo borrado. */
export const notDeleted = (table: SyncTable): SQL => isNull(table.deletedAt);

/** Registros que el servidor nunca confirmó (`version` 0): T-029 los pondrá en la cola de envío. */
export const pendingUpload = (table: SyncTable): SQL => eq(table.version, 0);
