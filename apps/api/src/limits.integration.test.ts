import { Writable } from 'node:stream';
import { setTimeout as sleep } from 'node:timers/promises';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import { RateLimitProblem, UnavailableProblem } from '@luka/contracts';
import { Body, Controller, Get, HttpCode, HttpException, Post, Req } from '@nestjs/common';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { Redis } from 'ioredis';
import { AttemptLimiter } from './attempts.js';
import { createTestApp } from './test-app.js';

// Hace de inicio de sesión hasta T-019: usa el limitador de intentos como lo usará el login real.
const USERS = new Map([['ana@ejemplo.co', 'correcta-123']]);

@Controller('prueba')
class ProbeController {
  constructor(private readonly attempts: AttemptLimiter) {}

  @Get('yo')
  me(@Req() req: FastifyRequest): { ip: string } {
    return { ip: req.ip };
  }

  @Post('login')
  @HttpCode(204)
  async login(
    @Body() body: { email: string; password: string },
    @Req() req: FastifyRequest,
  ): Promise<void> {
    await this.attempts.assertAllowed(body.email, req.ip);
    if (USERS.get(body.email.trim().toLowerCase()) !== body.password) {
      await this.attempts.recordFailure(body.email, req.ip);
      throw new HttpException({ code: 'invalid_credentials' }, 401);
    }
    await this.attempts.recordSuccess(body.email, req.ip);
  }
}

// Hasta T-019 nadie identifica al usuario: la prueba lo fija con una cabecera.
const testUser = (fastify: FastifyInstance): void => {
  fastify.addHook('onRequest', (req, _reply, done) => {
    const user = req.headers['x-usuario-prueba'];
    if (typeof user === 'string') req.userId = user;
    done();
  });
};

const logs: string[] = [];
const logStream = new Writable({
  write(chunk: Buffer, _encoding, done) {
    logs.push(chunk.toString());
    done();
  },
});

// Solo Redis desechable: estas pruebas no usan PostgreSQL y su URL apunta a un puerto sin servidor.
const base = {
  APP_ENV: 'local',
  DATABASE_URL: 'postgres://nadie:nada@127.0.0.1:9/nada',
  RATE_LIMIT_KEY_SECRET: 'falso-solo-para-pruebas-0123456789',
};

let container: StartedRedisContainer;
let redis: Redis;
let strict: NestFastifyApplication;
let proxied: NestFastifyApplication;

beforeAll(async () => {
  container = await new RedisContainer('redis:8-alpine').start();
  const REDIS_URL = container.getConnectionUrl();
  // Al final Redis está detenido: sin disconnectTimeout corto, ioredis retiene el proceso 2 s (DT-10).
  redis = new Redis(REDIS_URL, { disconnectTimeout: 200 });
  const controllers = [ProbeController];
  // Hasta T-019c la prueba fija el usuario con una cabecera: sus rutas no piden token.
  const publicRoutes = ['GET /v1/prueba/yo', 'POST /v1/prueba/login'];
  strict = await createTestApp(
    {
      ...base,
      REDIS_URL,
      RATE_LIMIT_PER_IP: '5',
      AUTH_RATE_LIMIT_PER_IP: '2',
      RATE_LIMIT_PER_USER: '3',
    },
    { controllers, logStream, configure: testUser, publicRoutes },
  );
  proxied = await createTestApp(
    {
      ...base,
      REDIS_URL,
      // inject llega desde 127.0.0.1: con él como proxy de confianza, la IP sale de X-Forwarded-For.
      TRUST_PROXY: '127.0.0.1',
      LOGIN_ATTEMPTS_MAX: '3',
      LOGIN_ACCOUNT_ATTEMPTS_MAX: '5',
      LOGIN_LOCK_BASE_MS: '1000',
      LOGIN_LOCK_MAX_MS: '4000',
    },
    { controllers, logStream, publicRoutes },
  );
});

beforeEach(async () => {
  await redis.flushall();
});

afterAll(async () => {
  await Promise.all([strict.close(), proxied.close()]);
  redis.disconnect();
  await container.stop().catch(() => undefined);
});

const me = (headers: Record<string, string> = {}) =>
  strict.inject({ method: 'GET', url: '/v1/prueba/yo', headers });

const login = (email: string, password: string, ip: string) =>
  proxied.inject({
    method: 'POST',
    url: '/v1/prueba/login',
    headers: { 'x-forwarded-for': ip },
    payload: { email, password },
  });

/** Lo que ve el cliente de una respuesta, sin lo que cambia en cada petición. */
const visible = (res: Awaited<ReturnType<typeof login>>) => ({
  status: res.statusCode,
  body: res.body,
  retryAfter: res.headers['retry-after'],
  contentType: res.headers['content-type'],
});

describe('límite de tasa (AM-08)', () => {
  it('AM-08: por IP, al pasar el tope responde 429 rate_limited con Retry-After; X-Forwarded-For no lo evade sin TRUST_PROXY', async () => {
    for (let i = 1; i <= 5; i++) {
      expect((await me({ 'x-forwarded-for': `198.51.100.${String(i)}` })).statusCode).toBe(200);
    }
    const res = await me({ 'x-forwarded-for': '198.51.100.99' });
    expect(res.statusCode).toBe(429);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(RateLimitProblem.parse(res.json()).code).toBe('rate_limited');
    const retryAfter = Number(res.headers['retry-after']);
    expect(retryAfter).toBeGreaterThanOrEqual(1);
    expect(retryAfter).toBeLessThanOrEqual(60);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('AM-08: /v1/auth/* tiene un tope más estricto y separado del general', async () => {
    const auth = () => strict.inject({ method: 'GET', url: '/v1/auth/inexistente' });
    expect((await auth()).statusCode).toBe(404);
    expect((await auth()).statusCode).toBe(404);
    const limited = await auth();
    expect(limited.statusCode).toBe(429);
    expect(RateLimitProblem.parse(limited.json()).code).toBe('rate_limited');
    expect((await me()).statusCode).toBe(200);
  });

  it('AM-08: por usuario; el tope de uno no afecta a otro desde la misma IP', async () => {
    for (let i = 0; i < 3; i++)
      expect((await me({ 'x-usuario-prueba': 'a' })).statusCode).toBe(200);
    expect((await me({ 'x-usuario-prueba': 'a' })).statusCode).toBe(429);
    expect((await me({ 'x-usuario-prueba': 'b' })).statusCode).toBe(200);
  });

  it('AM-08: el contador general y el estricto de /v1/auth/* no comparten clave', async () => {
    await me();
    await strict.inject({ method: 'GET', url: '/v1/auth/inexistente' });
    const keys = await redis.keys('luka:tasa:*');
    expect(keys.map((key) => key.split(':').slice(0, 3).join(':')).sort()).toEqual([
      'luka:tasa:auth',
      'luka:tasa:ip',
    ]);
    for (const key of keys) expect(await redis.get(key)).toBe('1');
  });

  it('AM-08: /healthz no cuenta para el límite', async () => {
    for (let i = 0; i < 8; i++) {
      expect((await strict.inject({ method: 'GET', url: '/healthz' })).statusCode).toBe(200);
    }
  });

  it('AM-08: con el proxy en TRUST_PROXY la IP sale de X-Forwarded-For; sin él, del socket', async () => {
    const headers = { 'x-forwarded-for': '203.0.113.7' };
    const viaProxy = await proxied.inject({ method: 'GET', url: '/v1/prueba/yo', headers });
    expect(viaProxy.json()).toEqual({ ip: '203.0.113.7' });
    expect((await me(headers)).json()).toEqual({ ip: '127.0.0.1' });
  });

  it('AM-08 y AM-09: toda clave de Redis expira y ninguna lleva el correo ni la IP en claro', async () => {
    await me();
    await me({ 'x-usuario-prueba': 'a' });
    await login('ana@ejemplo.co', 'mala', '203.0.113.9');
    await login('ana@ejemplo.co', 'mala', '2001:db8:1:2::a');
    const keys = await redis.keys('*');
    expect(keys.length).toBeGreaterThanOrEqual(6);
    for (const key of keys) {
      expect(key).toMatch(/^luka:(tasa:(ip|auth|usuario)|intentos|bloqueo):/);
      expect(key).not.toContain('undefined');
      expect(key).not.toMatch(/ana|ejemplo|203\.0\.113|127\.0\.0\.1|2001/);
      expect(await redis.pttl(key)).toBeGreaterThan(0);
    }
  });
});

describe('intentos de credenciales (AM-01)', () => {
  it('AM-01: tras 3 fallos bloquea con 429 too_many_attempts, aun con la contraseña correcta, y la espera crece', async () => {
    const ip = '203.0.113.1';
    for (let i = 0; i < 3; i++) {
      const res = await login('ana@ejemplo.co', 'mala', ip);
      expect(res.statusCode).toBe(401);
      expect(res.json()).toMatchObject({ code: 'invalid_credentials' });
    }
    const locked = await login('ana@ejemplo.co', 'correcta-123', ip);
    expect(locked.statusCode).toBe(429);
    expect(RateLimitProblem.parse(locked.json()).code).toBe('too_many_attempts');
    expect(locked.headers['retry-after']).toBe('1');
    await sleep(1_100);
    expect((await login('ana@ejemplo.co', 'mala', ip)).statusCode).toBe(401);
    const longer = await login('ana@ejemplo.co', 'correcta-123', ip);
    expect(longer.statusCode).toBe(429);
    expect(longer.headers['retry-after']).toBe('2');
  });

  it('AM-01: un acierto antes del tope reinicia el contador de esa cuenta e IP', async () => {
    const ip = '203.0.113.2';
    await login('ana@ejemplo.co', 'mala', ip);
    await login('ana@ejemplo.co', 'mala', ip);
    expect((await login('ana@ejemplo.co', 'correcta-123', ip)).statusCode).toBe(204);
    await login('ana@ejemplo.co', 'mala', ip);
    expect((await login('ana@ejemplo.co', 'mala', ip)).statusCode).toBe(401);
  });

  it('AM-01 (b): un correo inexistente cuenta y se bloquea igual; las respuestas son indistinguibles', async () => {
    for (let i = 0; i < 4; i++) {
      const real = await login('ana@ejemplo.co', 'mala', '203.0.113.3');
      const ghost = await login('nadie@ejemplo.co', 'mala', '203.0.113.4');
      expect(visible(ghost)).toEqual(visible(real));
      expect(real.statusCode).toBe(i < 3 ? 401 : 429);
    }
  });

  it('AM-01 (c): el correo se normaliza (minúsculas y sin espacios) antes de contar', async () => {
    const ip = '203.0.113.5';
    for (const email of [' Ana@Ejemplo.CO ', 'ANA@ejemplo.co', 'ana@ejemplo.co\t']) {
      expect((await login(email, 'mala', ip)).statusCode).toBe(401);
    }
    expect((await login('ana@ejemplo.co', 'correcta-123', ip)).statusCode).toBe(429);
  });

  it('AM-01 (d): las IPv6 cuentan por su prefijo /64', async () => {
    for (const ip of ['2001:db8:1:2::a', '2001:db8:1:2::b', '2001:db8:1:2:ffff::1']) {
      expect((await login('ana@ejemplo.co', 'mala', ip)).statusCode).toBe(401);
    }
    expect((await login('ana@ejemplo.co', 'correcta-123', '2001:db8:1:2::c')).statusCode).toBe(429);
    expect((await login('ana@ejemplo.co', 'correcta-123', '2001:db8:1:3::a')).statusCode).toBe(204);
  });

  it('AM-01 (a): tope por cuenta desde todas las IP, más alto que el de cuenta e IP y con la misma respuesta', async () => {
    for (let i = 1; i <= 5; i++) {
      expect((await login('ana@ejemplo.co', 'mala', `198.51.100.${String(i)}`)).statusCode).toBe(
        401,
      );
    }
    const byAccount = await login('ana@ejemplo.co', 'correcta-123', '198.51.100.50');
    expect(byAccount.statusCode).toBe(429);
    await redis.flushall();
    for (let i = 0; i < 3; i++) await login('ana@ejemplo.co', 'mala', '198.51.100.60');
    const byAccountAndIp = await login('ana@ejemplo.co', 'correcta-123', '198.51.100.60');
    expect(visible(byAccount)).toEqual(visible(byAccountAndIp));
  });

  it('AM-01 (e): 20 fallos simultáneos cuentan exactamente 20', async () => {
    const limiter = proxied.get(AttemptLimiter);
    await Promise.all(
      Array.from({ length: 20 }, () => limiter.recordFailure('carla@ejemplo.co', '203.0.113.20')),
    );
    const counters = await redis.keys('luka:intentos:*');
    expect(counters).toHaveLength(3);
    for (const key of counters) expect(await redis.get(key)).toBe('20');
  });
});

// Va al final: detiene Redis.
describe('Redis caído (AM-01, AM-08, AM-09)', () => {
  it('el límite de tasa deja pasar y los intentos responden 503 con Retry-After; ambos avisan y los logs no llevan correos, contraseñas ni tokens', async () => {
    await container.stop();
    const secrets = { authorization: 'Bearer token-secreto-xyz', cookie: 'sesion=cookie-secreta' };
    expect((await me(secrets)).statusCode).toBe(200);
    const res = await proxied.inject({
      method: 'POST',
      url: '/v1/prueba/login',
      headers: secrets,
      payload: { email: 'ana@ejemplo.co', password: 'correcta-123' },
    });
    expect(res.statusCode).toBe(503);
    expect(UnavailableProblem.parse(res.json()).code).toBe('temporarily_unavailable');
    expect(res.headers['retry-after']).toBe('30');
    const warnings = logs
      .map((line) => JSON.parse(line) as { level: number; msg: string })
      .filter((line) => line.level === 40)
      .map((line) => line.msg);
    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Límite de tasa sin Redis'),
        expect.stringContaining('Intentos de credenciales sin Redis'),
      ]),
    );
    const all = logs.join('\n');
    for (const secret of [
      'ana@ejemplo.co',
      'correcta-123',
      'token-secreto-xyz',
      'cookie-secreta',
    ]) {
      expect(all).not.toContain(secret);
    }
  });
});
