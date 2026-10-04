import { Inject, Injectable, type OnApplicationShutdown } from '@nestjs/common';
import postgres from 'postgres';
import type { Env } from '../config.js';
import { ENV } from '../tokens.js';

/** Transacción con el contexto de un usuario: la RLS solo deja ver y escribir sus filas (AM-03). */
export type UserTransaction = postgres.TransactionSql;

/**
 * Fija el usuario de la transacción con set_config local: vale solo hasta que la transacción termine,
 * así otra petición en la misma conexión del pool no lo hereda. Las pruebas usan esta misma función.
 */
export async function setUserContext(tx: postgres.TransactionSql, userId: string): Promise<void> {
  await tx`select set_config('app.user_id', ${userId}, true)`;
}

/**
 * Única puerta a PostgreSQL (T-026). La API se conecta como luka_app, sin BYPASSRLS; el cliente queda
 * privado y una regla de lint impide importar `postgres` fuera de src/db.
 */
@Injectable()
export class Database implements OnApplicationShutdown {
  readonly #sql: postgres.Sql;

  constructor(@Inject(ENV) env: Env) {
    this.#sql = postgres(env.DATABASE_URL, { max: env.DATABASE_POOL_SIZE });
  }

  /** Corre `work` en una transacción con el contexto de `userId` (setUserContext). */
  withUser<T>(userId: string, work: (tx: UserTransaction) => Promise<T>): Promise<T> {
    return this.#sql.begin(async (tx) => {
      await setUserContext(tx, userId);
      return work(tx);
    }) as Promise<T>;
  }

  async ping(): Promise<void> {
    await this.#sql`select 1`;
  }

  async onApplicationShutdown(): Promise<void> {
    await this.#sql.end({ timeout: 5 });
  }
}
