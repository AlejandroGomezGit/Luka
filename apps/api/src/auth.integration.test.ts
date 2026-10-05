import { Writable } from 'node:stream';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { CONSENT_VERSION, Problem, TokenPair } from '@luka/contracts';
import { Controller, Get, Req } from '@nestjs/common';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';
import type { FastifyRequest } from 'fastify';
import { SignJWT, exportPKCS8, exportSPKI, generateKeyPair, type CryptoKey } from 'jose';
import { BreachChecker } from './auth/breach.js';
import { registrationSteps } from './auth/auth.service.js';
import { Database } from './db/database.js';
import { startDatabase, type TestDatabase } from './db/testing.js';
import { createTestApp } from './test-app.js';

// Una ruta nueva sin marcar como pública: debe pedir sesión.
@Controller('prueba')
class PrivateProbe {
  @Get('privada')
  me(@Req() req: FastifyRequest): { userId: string | undefined; deviceId: string | undefined } {
    return { userId: req.userId, deviceId: req.deviceId };
  }
}

const logs: string[] = [];
const logStream = new Writable({
  write(chunk: Buffer, _encoding, done) {
    logs.push(chunk.toString());
    done();
  },
});

let db: TestDatabase;
let redis: StartedRedisContainer;
let app: NestFastifyApplication;
let privateKey: CryptoKey;

beforeAll(async () => {
  [db, redis] = await Promise.all([startDatabase(), new RedisContainer('redis:8-alpine').start()]);
  const keys = await generateKeyPair('EdDSA', { crv: 'Ed25519', extractable: true });
  privateKey = keys.privateKey;
  app = await createTestApp(
    {
      APP_ENV: 'ci',
      DATABASE_URL: db.appUrl,
      REDIS_URL: redis.getConnectionUrl(),
      RATE_LIMIT_KEY_SECRET: 'falso-solo-para-pruebas-0123456789',
      REFRESH_TOKEN_PEPPER: 'falso-solo-para-pruebas-pepper-0123',
      JWT_PRIVATE_KEY: await exportPKCS8(keys.privateKey),
      JWT_PUBLIC_KEY: await exportSPKI(keys.publicKey),
      AUTH_RATE_LIMIT_PER_IP: '10000',
      RATE_LIMIT_PER_IP: '10000',
      LOGIN_ATTEMPTS_MAX: '3',
      LOGIN_ACCOUNT_ATTEMPTS_MAX: '10',
    },
    {
      controllers: [PrivateProbe],
      logStream,
      // Sin red en las pruebas: Have I Been Pwned se prueba aparte con un fetch falso.
      overrides: [
        {
          provide: BreachChecker,
          useValue: {
            isCompromised: (password: string) => Promise.resolve(password.includes('filtrada')),
          },
        },
      ],
    },
  );
});

afterAll(async () => {
  try {
    await app.close();
  } finally {
    await Promise.all([db.stop(), redis.stop()]);
  }
});

const signup = (over: Record<string, unknown> = {}) => ({
  userId: randomUUID(),
  deviceId: randomUUID(),
  appVersion: '1.0.0',
  email: `${randomUUID()}@ejemplo.co`,
  password: 'una-contraseña-larga',
  consents: { version: CONSENT_VERSION, terms: true, privacy: true, adult: true },
  ...over,
});

const post = (url: string, payload?: object, headers: Record<string, string> = {}) =>
  app.inject({ method: 'POST', url, headers, ...(payload ? { payload } : {}) });

const tokens = (res: Awaited<ReturnType<typeof post>>) => TokenPair.parse(res.json());

const refresh = (refreshToken: string) => post('/v1/auth/refresh', { refreshToken });

const rowsOf = async (userId: string) => {
  const [row] = await db.owner<
    { users: number; consents: number; devices: number; refresh: number }[]
  >`
    select (select count(*) from users where id = ${userId})::int as users,
           (select count(*) from consents where user_id = ${userId})::int as consents,
           (select count(*) from devices where user_id = ${userId})::int as devices,
           (select count(*) from refresh_tokens where user_id = ${userId})::int as refresh`;
  return row;
};

const asUser = (accessToken: string) =>
  app.inject({
    method: 'GET',
    url: '/v1/prueba/privada',
    headers: { authorization: `Bearer ${accessToken}` },
  });

describe('registro (HU-01)', () => {
  it('HU-01 crea la cuenta con un hash Argon2id, las tres aceptaciones, el dispositivo y un refresco guardado solo como hash', async () => {
    const input = signup();
    const res = await post('/v1/auth/register', input);
    expect(res.statusCode).toBe(201);
    const pair = tokens(res);
    expect(pair.expiresIn).toBe(900);
    const [user] = await db.owner<
      { password_hash: string }[]
    >`select password_hash from users where id = ${input.userId}`;
    expect(user?.password_hash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    expect(user?.password_hash).not.toContain(input.password);
    const consents =
      await db.owner`select purpose, version from consents where user_id = ${input.userId} order by purpose`;
    expect(consents).toEqual(
      ['adult', 'privacy', 'terms'].map((purpose) => ({ purpose, version: CONSENT_VERSION })),
    );
    expect(await rowsOf(input.userId)).toEqual({ users: 1, consents: 3, devices: 1, refresh: 1 });
    const stored = await db.owner<
      { token_hash: string }[]
    >`select token_hash from refresh_tokens where user_id = ${input.userId}`;
    expect(stored[0]?.token_hash).not.toBe(pair.refreshToken);
    expect((await asUser(pair.accessToken)).json()).toEqual({
      userId: input.userId,
      deviceId: input.deviceId,
    });
  });

  it.each([
    ['terms', 'consent_required'],
    ['privacy', 'consent_required'],
    ['adult', 'age_confirmation_required'],
  ])('HU-01 sin la casilla %s no se crea la cuenta (%s)', async (box, code) => {
    const input = signup();
    const res = await post('/v1/auth/register', {
      ...input,
      consents: { ...input.consents, [box]: false },
    });
    expect(res.statusCode).toBe(400);
    expect(Problem.parse(res.json()).code).toBe(code);
    expect(await rowsOf(input.userId)).toEqual({ users: 0, consents: 0, devices: 0, refresh: 0 });
  });

  it('HU-01 rechaza otra versión de los textos, una contraseña corta y una filtrada', async () => {
    const cases: [Record<string, unknown>, string][] = [
      [
        { consents: { version: 'vieja', terms: true, privacy: true, adult: true } },
        'consent_required',
      ],
      [{ password: 'corta' }, 'password_too_short'],
      [{ password: 'contraseña-filtrada-123' }, 'password_compromised'],
    ];
    for (const [change, code] of cases) {
      const res = await post('/v1/auth/register', signup(change));
      expect([res.statusCode, Problem.parse(res.json()).code]).toEqual([400, code]);
    }
  });

  it('HU-01 un correo existente (sin importar mayúsculas) da email_taken y un user_id usado da user_id_unavailable, sin revelar de quién es', async () => {
    const first = signup();
    await post('/v1/auth/register', first);
    const sameEmail = await post('/v1/auth/register', signup({ email: first.email.toUpperCase() }));
    expect([sameEmail.statusCode, Problem.parse(sameEmail.json()).code]).toEqual([
      409,
      'email_taken',
    ]);
    const sameId = await post('/v1/auth/register', signup({ userId: first.userId }));
    expect([sameId.statusCode, Problem.parse(sameId.json()).code]).toEqual([
      409,
      'user_id_unavailable',
    ]);
    expect(sameId.body).not.toContain(first.email);
  });

  it.each([
    ['el mismo correo', 'email', 'email_taken'],
    ['el mismo user_id', 'userId', 'user_id_unavailable'],
  ])(
    'HU-01 dos registros simultáneos con %s: uno se crea y el otro recibe el código, nunca un 500',
    async (_name, field, code) => {
      const shared = signup();
      const [a, b] = await Promise.all([
        post('/v1/auth/register', signup({ [field]: shared[field as keyof typeof shared] })),
        post('/v1/auth/register', signup({ [field]: shared[field as keyof typeof shared] })),
      ]);
      const statuses = [a.statusCode, b.statusCode].sort();
      expect(statuses).toEqual([201, 409]);
      const loser = a.statusCode === 409 ? a : b;
      expect(Problem.parse(loser.json()).code).toBe(code);
    },
  );

  it('HU-01 el registro es una sola transacción: si falla cualquier paso no queda nada en users, consents, devices ni refresh_tokens', async () => {
    const database = app.get(Database);
    const stepCount = registrationSteps({
      userId: randomUUID(),
      deviceId: randomUUID(),
      appVersion: '1.0.0',
      consentVersion: CONSENT_VERSION,
      refreshTokenId: randomUUID(),
      refreshTokenHash: 'x',
      refreshExpiresAt: new Date(),
    }).length;
    expect(stepCount).toBe(3);
    for (let failAt = 0; failAt <= stepCount; failAt++) {
      const userId = randomUUID();
      const steps = registrationSteps({
        userId,
        deviceId: randomUUID(),
        appVersion: '1.0.0',
        consentVersion: CONSENT_VERSION,
        refreshTokenId: randomUUID(),
        refreshTokenHash: `hash-${randomUUID()}`,
        refreshExpiresAt: new Date(Date.now() + 60_000),
      });
      await expect(
        database.createUser(
          { id: userId, email: `${userId}@ejemplo.co`, passwordHash: 'h', displayName: '' },
          async (tx) => {
            for (const [index, step] of steps.entries()) {
              if (index === failAt) break;
              await step(tx);
            }
            throw new Error('falla a propósito');
          },
        ),
      ).rejects.toThrow('falla a propósito');
      expect(await rowsOf(userId)).toEqual({ users: 0, consents: 0, devices: 0, refresh: 0 });
    }
  });
});

describe('inicio de sesión (HU-01, AM-01)', () => {
  it('HU-01 inicia sesión con el correo y la contraseña de la cuenta', async () => {
    const input = signup();
    await post('/v1/auth/register', input);
    const res = await post('/v1/auth/login', {
      email: input.email,
      password: input.password,
      deviceId: randomUUID(),
      appVersion: '1.0.0',
    });
    expect(res.statusCode).toBe(200);
    expect((await asUser(tokens(res).accessToken)).json()).toMatchObject({ userId: input.userId });
  });

  it('AM-01 la respuesta es idéntica con contraseña equivocada y con un correo inexistente, y bloquea tras los fallos', async () => {
    const input = signup();
    await post('/v1/auth/register', input);
    const attempt = (email: string) =>
      post('/v1/auth/login', {
        email,
        password: `${input.password}-no`,
        deviceId: randomUUID(),
        appVersion: '1.0.0',
      });
    for (let i = 0; i < 3; i++) {
      const [real, ghost] = await Promise.all([
        attempt(input.email),
        attempt(`nadie-${input.email}`),
      ]);
      expect(real.statusCode).toBe(401);
      expect(real.body).toBe(ghost.body);
      expect(Problem.parse(real.json()).code).toBe('invalid_credentials');
    }
    const locked = await post('/v1/auth/login', {
      email: input.email,
      password: input.password,
      deviceId: randomUUID(),
      appVersion: '1.0.0',
    });
    expect([locked.statusCode, Problem.parse(locked.json()).code]).toEqual([
      429,
      'too_many_attempts',
    ]);
  });
});

describe('dispositivos (HU-01)', () => {
  it('HU-01 un dispositivo de otra cuenta responde 409 device_unavailable y no deja tokens', async () => {
    const owner = signup();
    await post('/v1/auth/register', owner);
    const other = signup();
    await post('/v1/auth/register', other);
    const res = await post('/v1/auth/login', {
      email: other.email,
      password: other.password,
      deviceId: owner.deviceId,
      appVersion: '1.0.0',
    });
    expect([res.statusCode, Problem.parse(res.json()).code]).toEqual([409, 'device_unavailable']);
    expect(await rowsOf(other.userId)).toEqual({ users: 1, consents: 3, devices: 1, refresh: 1 });
    const taken = await post('/v1/auth/register', signup({ deviceId: owner.deviceId }));
    expect([taken.statusCode, Problem.parse(taken.json()).code]).toEqual([
      409,
      'device_unavailable',
    ]);
  });
});

describe('token de acceso (AM-02)', () => {
  it('AM-02 toda ruta es privada por defecto: una ruta nueva sin marcar responde 401 sin token', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/prueba/privada' });
    expect([res.statusCode, Problem.parse(res.json()).code]).toEqual([401, 'unauthorized']);
  });

  it('AM-02 rechaza alg none, HS256, un token vencido, un kid desconocido y una firma alterada', async () => {
    const pair = tokens(await post('/v1/auth/register', signup()));
    const [header = '', payload = '', signature = ''] = pair.accessToken.split('.');
    const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString()) as Record<
      string,
      unknown
    >;
    const kid = (JSON.parse(Buffer.from(header, 'base64url').toString()) as { kid: string }).kid;
    const forged = {
      'alg none': `${b64({ alg: 'none', typ: 'JWT' })}.${payload}.`,
      HS256: await new SignJWT(claims)
        .setProtectedHeader({ alg: 'HS256', kid })
        .sign(new TextEncoder().encode('una-clave-simetrica-cualquiera-0123')),
      vencido: await new SignJWT({ ...claims, exp: Math.floor(Date.now() / 1000) - 60 })
        .setProtectedHeader({ alg: 'EdDSA', kid })
        .sign(privateKey),
      'kid desconocido': await new SignJWT(claims)
        .setProtectedHeader({ alg: 'EdDSA', kid: 'otra-clave' })
        .sign(privateKey),
      'firma alterada': `${header}.${payload}.${signature.slice(0, -2)}${signature.endsWith('AA') ? 'BB' : 'AA'}`,
    };
    expect((await asUser(pair.accessToken)).statusCode).toBe(200);
    for (const [name, token] of Object.entries(forged)) {
      expect([name, (await asUser(token)).statusCode]).toEqual([name, 401]);
    }
  });
});

describe('refresco y cierre de sesión (AM-02)', () => {
  const ageUse = (userId: string) =>
    db.owner`update refresh_tokens set used_at = now() - interval '1 minute' where user_id = ${userId} and used_at is not null`;

  it('AM-02 rota el refresco: el nuevo funciona y el viejo ya usado, fuera del margen, revoca la familia entera con sus ramas', async () => {
    const input = signup();
    const first = tokens(await post('/v1/auth/register', input));
    const second = tokens(await refresh(first.refreshToken));
    const branch = tokens(await refresh(first.refreshToken)); // reemisión dentro del margen
    await ageUse(input.userId);
    const reused = await refresh(first.refreshToken);
    expect([reused.statusCode, Problem.parse(reused.json()).code]).toEqual([
      401,
      'refresh_invalid',
    ]);
    expect((await refresh(second.refreshToken)).statusCode).toBe(401);
    expect((await refresh(branch.refreshToken)).statusCode).toBe(401);
    const [open] = await db.owner<
      { n: number }[]
    >`select count(*)::int as n from refresh_tokens where user_id = ${input.userId} and revoked_at is null`;
    expect(open?.n).toBe(0);
  });

  it('AM-02 respuesta perdida: reintentar con el token viejo dentro del margen da un par nuevo sin revocar nada', async () => {
    const first = tokens(await post('/v1/auth/register', signup()));
    const lost = tokens(await refresh(first.refreshToken)); // la app nunca lo recibió
    const retry = await refresh(first.refreshToken);
    expect(retry.statusCode).toBe(200);
    expect((await refresh(tokens(retry).refreshToken)).statusCode).toBe(200);
    expect((await refresh(lost.refreshToken)).statusCode).toBe(200);
  });

  it('AM-02 dos refrescos simultáneos con el mismo token (PostgreSQL real): los dos responden 200 y la familia sigue viva', async () => {
    const input = signup();
    const first = tokens(await post('/v1/auth/register', input));
    const results = await Promise.all([refresh(first.refreshToken), refresh(first.refreshToken)]);
    expect(results.map((res) => res.statusCode)).toEqual([200, 200]);
    // Uno solo marcó el primer uso (UPDATE … WHERE used_at IS NULL); el otro es la reemisión 1.
    const [family] = await db.owner<
      { family_id: string }[]
    >`select distinct family_id from refresh_tokens where user_id = ${input.userId}`;
    const reissues = logs.filter((line) => line.includes(family?.family_id ?? 'sin-familia'));
    expect(reissues.map((line) => (JSON.parse(line) as { reemision: number }).reemision)).toEqual([
      1,
    ]);
    const [a, b] = results.map(tokens);
    expect(a?.refreshToken).not.toBe(b?.refreshToken);
    for (const pair of [a, b])
      expect((await refresh(pair?.refreshToken ?? '')).statusCode).toBe(200);
  });

  it('AM-02 el tope: tres reemisiones dentro del margen valen; la cuarta reutilización revoca la familia', async () => {
    const input = signup();
    const first = tokens(await post('/v1/auth/register', input));
    const issued = [];
    for (let i = 0; i < 4; i++) issued.push(await refresh(first.refreshToken)); // 1 rotación y 3 reemisiones
    expect(issued.map((res) => res.statusCode)).toEqual([200, 200, 200, 200]);
    const over = await refresh(first.refreshToken);
    expect(over.statusCode).toBe(401);
    expect(
      (await refresh(tokens(issued[0] as Awaited<ReturnType<typeof post>>).refreshToken))
        .statusCode,
    ).toBe(401);
  });

  it('AM-02 una reemisión se registra con el id de la familia y su número, nunca con valores de tokens', async () => {
    const input = signup();
    const first = tokens(await post('/v1/auth/register', input));
    const lost = tokens(await refresh(first.refreshToken));
    const retry = tokens(await refresh(first.refreshToken));
    const [family] = await db.owner<
      { family_id: string }[]
    >`select distinct family_id from refresh_tokens where user_id = ${input.userId}`;
    const lines = logs.filter((line) => line.includes(family?.family_id ?? 'sin-familia'));
    expect(lines.some((line) => line.includes('"reemision":1'))).toBe(true);
    const all = logs.join('\n');
    for (const secret of [
      first.refreshToken,
      lost.refreshToken,
      retry.refreshToken,
      retry.accessToken,
    ]) {
      expect(all).not.toContain(secret);
    }
  });

  it('AM-02 un refresco vencido responde 401 sin revocar la familia', async () => {
    const input = signup();
    const first = tokens(await post('/v1/auth/register', input));
    await db.owner`update refresh_tokens set expires_at = now() - interval '1 second' where user_id = ${input.userId}`;
    expect((await refresh(first.refreshToken)).statusCode).toBe(401);
    const [open] = await db.owner<
      { n: number }[]
    >`select count(*)::int as n from refresh_tokens where user_id = ${input.userId} and revoked_at is null`;
    expect(open?.n).toBe(1);
  });

  it('AM-02 cerrar sesión revoca el refresco del dispositivo; el token de acceso vale hasta su vencimiento (15 min, doc 05)', async () => {
    const first = tokens(await post('/v1/auth/register', signup()));
    const auth = { authorization: `Bearer ${first.accessToken}` };
    expect((await post('/v1/auth/logout', undefined, auth)).statusCode).toBe(204);
    expect((await refresh(first.refreshToken)).statusCode).toBe(401);
    expect((await asUser(first.accessToken)).statusCode).toBe(200);
    expect((await post('/v1/auth/logout')).statusCode).toBe(401);
  });
});
