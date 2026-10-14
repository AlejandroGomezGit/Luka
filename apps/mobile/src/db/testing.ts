/** Solo para pruebas: base SQLite en memoria (sql.js) con las migraciones reales de @luka/schema-sqlite. */
import type { Clock } from '@luka/domain';
import * as schema from '@luka/schema-sqlite';
import { drizzle } from 'drizzle-orm/sql-js';
import { migrate } from 'drizzle-orm/sql-js/migrator';
import path from 'node:path';
import initSqlJs from 'sql.js';
import type { LocalDb } from './types';

export const migrationsFolder = path.join(__dirname, '../../../../packages/schema-sqlite/drizzle');

export async function createTestDb(): Promise<LocalDb> {
  const SQL = await initSqlJs();
  const db = drizzle(new SQL.Database(), { schema });
  migrate(db, { migrationsFolder });
  return db;
}

/** Reloj que avanza solo cuando la prueba lo pide. */
export function testClock(start = Date.UTC(2026, 9, 2, 12)): Clock & { advance(ms: number): void } {
  let time = start;
  return {
    now: () => time,
    advance: (ms) => {
      time += ms;
    },
  };
}

/** Azar determinista: cada llamada devuelve bytes distintos. */
export function testRandom(): () => Uint8Array {
  let seed = 0;
  return () => Uint8Array.from({ length: 16 }, (_, i) => (seed++ * 31 + i) % 256);
}

/**
 * Milisegundos de la corrida más rápida de varias. Una sola medida de reloj incluye las pausas del
 * sistema (otras tareas, memoria), que no son el costo de la consulta: con todo el monorepo en
 * paralelo una consulta de 1 ms llegó a medir 1288 ms (#108).
 */
export function bestTimeMs(run: () => unknown, attempts = 3): number {
  let best = Infinity;
  for (let i = 0; i < attempts; i++) {
    const start = performance.now();
    run();
    best = Math.min(best, performance.now() - start);
  }
  return best;
}
