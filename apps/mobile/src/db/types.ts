import type * as schema from '@luka/schema-sqlite';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

/** Base local síncrona: expo-sqlite en la app y sql.js en las pruebas comparten este tipo. */
export type LocalDb = BaseSQLiteDatabase<'sync', unknown, typeof schema>;
