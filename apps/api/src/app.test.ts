import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { Problem, Readiness } from '@luka/contracts';
import { Controller, HttpCode, HttpException, NotFoundException, Post } from '@nestjs/common';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { loadEnv, startupWarnings } from './config.js';
import { toProblem } from './problem.filter.js';
import { createTestApp } from './test-app.js';

// Sin servidores: las comprobaciones de /readyz y Redis son falsos. El límite de tasa y los intentos
// contra un Redis real se prueban en limits.integration.test.ts.
const env = {
  DATABASE_URL: 'postgres://nadie:nada@127.0.0.1:9/nada',
  REDIS_URL: 'redis://127.0.0.1:9',
  RATE_LIMIT_KEY_SECRET: 'falso-solo-para-pruebas-0123456789',
};

/**
 * Redis falso: @fastify/rate-limit define su comando con defineCommand y lo llama con un callback al
 * final; aquí cada petición es la primera de su ventana, así que nunca se limita y no hay red.
 */
class FakeRedis {
  [command: string]: unknown;

  defineCommand(name: string): void {
    this[name] = (...args: unknown[]) => {
      const done = args.at(-1) as (error: null, result: [number, number]) => void;
      done(null, [1, Number(args[1])]);
    };
  }
}

@Controller('prueba')
class EchoController {
  @Post('eco')
  @HttpCode(204)
  echo(): void {
    // Solo recibe el cuerpo.
  }
}

const healthy = { ok: true };
const fakeDatastores = {
  pingPostgres: () => Promise.resolve(),
  pingRedis: () => (healthy.ok ? Promise.resolve() : Promise.reject(new Error('caído'))),
};

let app: NestFastifyApplication;
beforeAll(async () => {
  app = await createTestApp(env, {
    datastores: fakeDatastores,
    redis: new FakeRedis(),
    controllers: [EchoController],
  });
});
afterAll(() => app.close());

describe('salud (RNF-10)', () => {
  it('/healthz responde 200 fuera de /v1', async () => {
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });

  it('/readyz responde 200 cuando PostgreSQL y Redis responden', async () => {
    healthy.ok = true;
    const res = await app.inject({ method: 'GET', url: '/readyz' });
    expect(res.statusCode).toBe(200);
    expect(Readiness.parse(res.json())).toEqual({
      status: 'ok',
      checks: { postgres: 'ok', redis: 'ok' },
    });
  });

  it('/readyz responde 503 e indica qué dependencia falla', async () => {
    healthy.ok = false;
    const res = await app.inject({ method: 'GET', url: '/readyz' });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ status: 'error', checks: { postgres: 'ok', redis: 'error' } });
  });
});

describe('id de correlación', () => {
  it('devuelve el X-Request-Id recibido o genera uno', async () => {
    const own = await app.inject({
      method: 'GET',
      url: '/healthz',
      headers: { 'x-request-id': 'abc-123' },
    });
    expect(own.headers['x-request-id']).toBe('abc-123');
    const generated = await app.inject({
      method: 'GET',
      url: '/healthz',
      headers: { 'x-request-id': 'no válido\n' },
    });
    expect(generated.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('errores problem+json (ADR-013)', () => {
  it('una ruta inexistente de /v1 responde 404 con code estable', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/no-existe' });
    expect(res.statusCode).toBe(404);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(Problem.parse(res.json())).toMatchObject({ status: 404, code: 'not_found' });
  });

  it('respeta el code propio de una excepción', () => {
    const problem = toProblem(new HttpException({ code: 'cursor_expired' }, 410));
    expect(problem).toMatchObject({ status: 410, code: 'cursor_expired' });
    expect(toProblem(new NotFoundException()).code).toBe('not_found');
  });

  it('un error inesperado responde 500 sin exponer su mensaje', () => {
    const problem = toProblem(new Error('detalle interno con datos'));
    expect(Problem.parse(problem)).toMatchObject({ status: 500, code: 'internal_error' });
    expect(JSON.stringify(problem)).not.toContain('detalle interno');
  });
});

const SECURITY_HEADERS = {
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'x-frame-options': 'DENY',
  'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
  'cross-origin-resource-policy': 'same-origin',
  'cache-control': 'no-store',
};

describe('cabeceras de seguridad, tamaño y tiempos (AM-06, AM-08)', () => {
  it('AM-06: toda respuesta lleva las cabeceras de seguridad: 200, 404 y 413', async () => {
    const responses = await Promise.all([
      app.inject({ method: 'GET', url: '/healthz' }),
      app.inject({ method: 'GET', url: '/v1/no-existe' }),
      app.inject({
        method: 'POST',
        url: '/v1/prueba/eco',
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({ relleno: 'x'.repeat(1_048_576) }),
      }),
    ]);
    expect(responses.map((res) => res.statusCode)).toEqual([200, 404, 413]);
    for (const res of responses) expect(res.headers).toMatchObject(SECURITY_HEADERS);
  });

  it('AM-08: un cuerpo de más de 1 MB responde 413 payload_too_large en problem+json', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/prueba/eco',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ relleno: 'x'.repeat(1_048_576) }),
    });
    expect(res.statusCode).toBe(413);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(Problem.parse(res.json())).toMatchObject({ status: 413, code: 'payload_too_large' });
    const small = await app.inject({ method: 'POST', url: '/v1/prueba/eco', payload: { a: 1 } });
    expect(small.statusCode).toBe(204);
  });

  it('AM-08: el tiempo máximo de una petición sale de REQUEST_TIMEOUT_MS', () => {
    expect(app.getHttpAdapter().getInstance().server.requestTimeout).toBe(30_000);
    expect(loadEnv({ ...env, REQUEST_TIMEOUT_MS: '5000' }).REQUEST_TIMEOUT_MS).toBe(5_000);
  });
});

describe('configuración de los límites', () => {
  it('TRUST_PROXY es false por defecto, acepta true o direcciones y rechaza un número de saltos', () => {
    expect(loadEnv(env).TRUST_PROXY).toBe(false);
    expect(loadEnv({ ...env, TRUST_PROXY: 'true' }).TRUST_PROXY).toBe(true);
    expect(loadEnv({ ...env, TRUST_PROXY: '10.0.0.0/8,127.0.0.1' }).TRUST_PROXY).toBe(
      '10.0.0.0/8,127.0.0.1',
    );
    // Fastify ignora los saltos (un cliente directo falsificaría X-Forwarded-For): mejor fallar al arrancar.
    expect(() => loadEnv({ ...env, TRUST_PROXY: '1' })).toThrow(/TRUST_PROXY/);
  });

  it('AM-08: en producción TRUST_PROXY=true no arranca: confiaría en cualquier X-Forwarded-*', () => {
    for (const production of [{ APP_ENV: 'production' }, { NODE_ENV: 'production' }]) {
      expect(() => loadEnv({ ...env, ...production, TRUST_PROXY: 'true' })).toThrow(/TRUST_PROXY/);
      expect(loadEnv({ ...env, ...production, TRUST_PROXY: '10.0.0.0/8' }).TRUST_PROXY).toBe(
        '10.0.0.0/8',
      );
    }
    expect(loadEnv({ ...env, APP_ENV: 'staging', TRUST_PROXY: 'true' }).TRUST_PROXY).toBe(true);
  });

  it('con NODE_ENV=production y sin APP_ENV, el entorno es producción y no local', () => {
    expect(loadEnv({ ...env, NODE_ENV: 'production' }).APP_ENV).toBe('production');
    expect(loadEnv(env).APP_ENV).toBe('local');
    expect(loadEnv({ ...env, NODE_ENV: 'production', APP_ENV: 'staging' }).APP_ENV).toBe('staging');
  });

  it('RATE_LIMIT_KEY_SECRET es obligatoria y el error no muestra valores', () => {
    const { RATE_LIMIT_KEY_SECRET: _, ...withoutSecret } = env;
    expect(() => loadEnv(withoutSecret)).toThrow(/RATE_LIMIT_KEY_SECRET/);
    expect(() => loadEnv({ ...env, RATE_LIMIT_KEY_SECRET: 'corta' })).toThrow(
      /RATE_LIMIT_KEY_SECRET/,
    );
  });

  it('el tope por cuenta desde todas las IP debe ser mayor que el de cuenta e IP', () => {
    expect(() =>
      loadEnv({ ...env, LOGIN_ATTEMPTS_MAX: '5', LOGIN_ACCOUNT_ATTEMPTS_MAX: '5' }),
    ).toThrow(/LOGIN_ACCOUNT_ATTEMPTS_MAX/);
  });

  it('avisa al arrancar si TRUST_PROXY es false en producción (el valor real se decide en T-040)', () => {
    expect(startupWarnings(loadEnv({ ...env, APP_ENV: 'production' }))).toEqual([
      expect.stringContaining('TRUST_PROXY'),
    ]);
    expect(startupWarnings(loadEnv({ ...env, NODE_ENV: 'production' }))).toHaveLength(1);
    expect(
      startupWarnings(loadEnv({ ...env, APP_ENV: 'production', TRUST_PROXY: '10.0.0.0/8' })),
    ).toEqual([]);
    expect(startupWarnings(loadEnv(env))).toEqual([]);
  });
});
