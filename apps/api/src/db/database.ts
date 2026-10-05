import { Inject, Injectable, type OnApplicationShutdown } from '@nestjs/common';
import postgres from 'postgres';
import type { Env } from '../config.js';
import { ENV } from '../tokens.js';

/** Transacción con el contexto de un usuario: la RLS solo deja ver y escribir sus filas (AM-03). */
export type UserTransaction = postgres.TransactionSql;

export interface NewUser {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
}

export type CreateUserResult<T> =
  { status: 'created'; value: T } | { status: 'email_taken' | 'id_taken' };

export interface RefreshRow {
  id: string;
  userId: string;
  deviceId: string;
  familyId: string;
  expiresAt: Date;
  usedAt: Date | null;
  revokedAt: Date | null;
}

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

  /**
   * Registro en una sola transacción (T-019): auth.create_user y, solo si la cuenta es nueva, el
   * contexto de ese id para `work`. Si `work` falla, la transacción entera se deshace, usuario incluido.
   * Nunca se fija el contexto con un id que manda el cliente antes de saber que es suyo.
   */
  createUser<T>(
    user: NewUser,
    work: (tx: UserTransaction) => Promise<T>,
  ): Promise<CreateUserResult<T>> {
    return this.#sql.begin(async (tx) => {
      const [row] = await tx<{ status: 'created' | 'email_taken' | 'id_taken' }[]>`
        select auth.create_user(${user.id}, ${user.email}, ${user.passwordHash}, ${user.displayName}) as status`;
      if (row?.status !== 'created') return { status: row?.status ?? 'id_taken' };
      await setUserContext(tx, user.id);
      return { status: 'created', value: await work(tx) };
    });
  }

  /** El id y el hash de un correo, sin contexto de usuario (auth.login_lookup). */
  async loginLookup(
    email: string,
  ): Promise<{ userId: string; passwordHash: string | null } | undefined> {
    const [row] = await this.#sql<{ user_id: string; password_hash: string | null }[]>`
      select user_id, password_hash from auth.login_lookup(${email})`;
    return row && { userId: row.user_id, passwordHash: row.password_hash };
  }

  /** El token de refresco de un hash, sin contexto de usuario (auth.refresh_lookup). */
  async refreshLookup(tokenHash: string): Promise<RefreshRow | undefined> {
    const [row] = await this.#sql<
      {
        id: string;
        user_id: string;
        device_id: string;
        family_id: string;
        expires_at: Date;
        used_at: Date | null;
        revoked_at: Date | null;
      }[]
    >`select * from auth.refresh_lookup(${tokenHash})`;
    return (
      row && {
        id: row.id,
        userId: row.user_id,
        deviceId: row.device_id,
        familyId: row.family_id,
        expiresAt: row.expires_at,
        usedAt: row.used_at,
        revokedAt: row.revoked_at,
      }
    );
  }

  async ping(): Promise<void> {
    await this.#sql`select 1`;
  }

  async onApplicationShutdown(): Promise<void> {
    await this.#sql.end({ timeout: 5 });
  }
}
