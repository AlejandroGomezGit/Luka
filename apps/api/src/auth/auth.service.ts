import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import {
  CONSENT_VERSION,
  type LoginRequest,
  type RegisterRequest,
  type TokenPair,
} from '@luka/contracts';
import { HttpException, Inject, Injectable, Logger } from '@nestjs/common';
import { AttemptLimiter } from '../attempts.js';
import type { Env } from '../config.js';
import { Database, type UserTransaction } from '../db/database.js';
import { ENV } from '../tokens.js';
import { BreachChecker } from './breach.js';
import { PasswordHasher } from './passwords.js';
import { AccessTokens } from './tokens.js';

const MIN_PASSWORD = 10;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** Reemisiones de un mismo token permitidas dentro del margen (ADR-016). */
const MAX_REISSUES = 3;

const fail = (status: number, code: string) => new HttpException({ code }, status);

/** Caracteres que ve la persona: una letra con tilde o un emoji cuentan como uno. */
const characters = (text: string) => [...new Intl.Segmenter('es').segment(text)].length;

export interface RegistrationInput {
  userId: string;
  deviceId: string;
  appVersion: string;
  consentVersion: string;
  refreshTokenId: string;
  refreshTokenHash: string;
  refreshExpiresAt: Date;
}

/** Inserta el dispositivo, o lo reusa si ya es de este usuario; si es de otro, 409 device_unavailable. */
async function claimDevice(
  tx: UserTransaction,
  userId: string,
  deviceId: string,
  appVersion: string,
) {
  const inserted = await tx`
    insert into devices (id, user_id, platform, app_version, last_seen_at)
    values (${deviceId}, ${userId}, 'ios', ${appVersion}, now()) on conflict (id) do nothing returning id`;
  if (inserted.length) return;
  const own =
    await tx`update devices set app_version = ${appVersion}, last_seen_at = now(), revoked_at = null
    where id = ${deviceId} returning id`;
  if (!own.length) throw fail(409, 'device_unavailable');
}

const insertRefresh = (
  tx: UserTransaction,
  row: {
    id: string;
    userId: string;
    deviceId: string;
    familyId: string;
    parentId: string | null;
    hash: string;
    expiresAt: Date;
  },
) => tx`
  insert into refresh_tokens (id, user_id, device_id, family_id, parent_id, token_hash, expires_at)
  values (${row.id}, ${row.userId}, ${row.deviceId}, ${row.familyId}, ${row.parentId}, ${row.hash}, ${row.expiresAt})`;

/**
 * Los pasos del registro después de auth.create_user, en la transacción de Database.createUser: las tres
 * aceptaciones, el dispositivo y el primer token de refresco. Exportados para probar que, si falla
 * cualquiera, no queda nada (T-019, condición 5).
 */
export function registrationSteps(
  input: RegistrationInput,
): ((tx: UserTransaction) => Promise<unknown>)[] {
  return [
    (tx) =>
      tx`insert into consents ${tx(
        ['terms', 'privacy', 'adult'].map((purpose) => ({
          id: randomUUID(),
          user_id: input.userId,
          purpose,
          version: input.consentVersion,
          granted_at: new Date(),
        })),
      )}`,
    (tx) => claimDevice(tx, input.userId, input.deviceId, input.appVersion),
    (tx) =>
      insertRefresh(tx, {
        id: input.refreshTokenId,
        userId: input.userId,
        deviceId: input.deviceId,
        familyId: input.refreshTokenId,
        parentId: null,
        hash: input.refreshTokenHash,
        expiresAt: input.refreshExpiresAt,
      }),
  ];
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  readonly #pepper: string;

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly db: Database,
    private readonly hasher: PasswordHasher,
    private readonly breach: BreachChecker,
    private readonly tokens: AccessTokens,
    private readonly attempts: AttemptLimiter,
  ) {
    // Fuera de local la config exige la pimienta; en local, sin ella, una temporal.
    this.#pepper = env.REFRESH_TOKEN_PEPPER ?? randomBytes(32).toString('hex');
  }

  async register(input: RegisterRequest): Promise<TokenPair> {
    const { consents } = input;
    if (consents.version !== CONSENT_VERSION || !consents.terms || !consents.privacy) {
      throw fail(400, 'consent_required');
    }
    if (!consents.adult) throw fail(400, 'age_confirmation_required');
    if (characters(input.password) < MIN_PASSWORD) throw fail(400, 'password_too_short');
    // Fuera de la transacción: Argon2 y la consulta externa no retienen una conexión ni bloqueos.
    if (await this.breach.isCompromised(input.password)) throw fail(400, 'password_compromised');
    const passwordHash = await this.hasher.hash(input.password);
    const refresh = this.newRefresh();
    const steps = registrationSteps({
      userId: input.userId,
      deviceId: input.deviceId,
      appVersion: input.appVersion,
      consentVersion: CONSENT_VERSION,
      refreshTokenId: refresh.id,
      refreshTokenHash: refresh.hash,
      refreshExpiresAt: refresh.expiresAt,
    });
    const result = await this.db.createUser(
      { id: input.userId, email: input.email, passwordHash, displayName: input.displayName },
      async (tx) => {
        for (const step of steps) await step(tx);
      },
    );
    // email_taken revela que el correo existe; se acepta por el límite de intentos (doc 05).
    if (result.status === 'email_taken') throw fail(409, 'email_taken');
    if (result.status === 'id_taken') throw fail(409, 'user_id_unavailable');
    return this.pair(input.userId, input.deviceId, refresh.token);
  }

  async login(input: LoginRequest, ip: string): Promise<TokenPair> {
    await this.attempts.assertAllowed(input.email, ip);
    const account = await this.db.loginLookup(input.email);
    const valid = await this.hasher.verify(account?.passwordHash ?? null, input.password);
    if (!account || !valid) {
      await this.attempts.recordFailure(input.email, ip);
      throw fail(401, 'invalid_credentials');
    }
    await this.attempts.recordSuccess(input.email, ip);
    const refresh = this.newRefresh();
    await this.db.withUser(account.userId, async (tx) => {
      await claimDevice(tx, account.userId, input.deviceId, input.appVersion);
      await insertRefresh(tx, {
        id: refresh.id,
        userId: account.userId,
        deviceId: input.deviceId,
        familyId: refresh.id,
        parentId: null,
        hash: refresh.hash,
        expiresAt: refresh.expiresAt,
      });
    });
    return this.pair(account.userId, input.deviceId, refresh.token);
  }

  /**
   * Rota el token de refresco (AM-02, ADR-016). El primer uso lo marca con un UPDATE atómico. Un token
   * ya usado vuelve a valer dentro del margen (respuesta perdida o refrescos simultáneos), hasta
   * MAX_REISSUES veces; fuera del margen, o pasado el tope, revoca la familia entera con sus ramas.
   */
  async refresh(refreshToken: string): Promise<TokenPair> {
    const row = await this.db.refreshLookup(this.hash(refreshToken));
    if (!row || row.revokedAt !== null || row.expiresAt.getTime() <= Date.now()) {
      throw fail(401, 'refresh_invalid');
    }
    const next = this.newRefresh();
    const outcome = await this.db.withUser(row.userId, async (tx) => {
      // FOR UPDATE: dos refrescos del mismo token se atienden uno detrás del otro.
      const [current] = await tx<{ revoked: boolean }[]>`
        select revoked_at is not null as revoked from refresh_tokens where id = ${row.id} for update`;
      if (!current || current.revoked) return 'revoked' as const;
      const claimed = await tx`
        update refresh_tokens set used_at = now() where id = ${row.id} and used_at is null returning id`;
      if (!claimed.length) {
        const [reuse] = await tx<{ age_ms: number; children: number }[]>`
          select extract(epoch from now() - used_at) * 1000 as age_ms,
                 (select count(*) from refresh_tokens where parent_id = ${row.id})::int as children
            from refresh_tokens where id = ${row.id}`;
        const reissue = reuse?.children ?? Infinity;
        if (
          (reuse?.age_ms ?? Infinity) > this.env.REFRESH_REUSE_GRACE_MS ||
          reissue > MAX_REISSUES
        ) {
          await tx`update refresh_tokens set revoked_at = now()
            where family_id = ${row.familyId} and revoked_at is null`;
          return 'reused' as const;
        }
        this.logger.log(
          { familia: row.familyId, reemision: reissue },
          'Reemisión del refresco dentro del margen',
        );
      }
      await insertRefresh(tx, {
        id: next.id,
        userId: row.userId,
        deviceId: row.deviceId,
        familyId: row.familyId,
        parentId: row.id,
        hash: next.hash,
        expiresAt: next.expiresAt,
      });
      return 'issued' as const;
    });
    // Fuera de la transacción, para que la revocación quede guardada antes de responder 401.
    if (outcome !== 'issued') throw fail(401, 'refresh_invalid');
    return this.pair(row.userId, row.deviceId, next.token);
  }

  /** Revoca los tokens de refresco del dispositivo; el de acceso vale hasta vencer (doc 05). */
  async logout(userId: string, deviceId: string): Promise<void> {
    await this.db.withUser(
      userId,
      (tx) => tx`
      update refresh_tokens set revoked_at = now() where device_id = ${deviceId} and revoked_at is null`,
    );
  }

  private hash(token: string): string {
    return createHmac('sha256', this.#pepper).update(token).digest('hex');
  }

  private newRefresh() {
    const token = randomBytes(32).toString('base64url');
    return {
      id: randomUUID(),
      token,
      hash: this.hash(token),
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    };
  }

  private async pair(userId: string, deviceId: string, refreshToken: string): Promise<TokenPair> {
    return {
      accessToken: await this.tokens.sign(userId, deviceId),
      refreshToken,
      expiresIn: AccessTokens.TTL_SECONDS,
    };
  }
}
