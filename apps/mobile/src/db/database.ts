import * as schema from '@luka/schema-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';
import type { LocalDb } from './types';

/** Base local de la app; vive en el contenedor de la app, protegido por el cifrado de iOS (RNF-08). */
export const expoDb = drizzle(openDatabaseSync('luka.db'), { schema });

/** La misma base con el tipo que comparten la app y las pruebas. */
export const localDb: LocalDb = expoDb;
