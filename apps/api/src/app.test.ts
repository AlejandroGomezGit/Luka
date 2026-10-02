import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { Problem, Readiness } from '@luka/contracts';
import { HttpException, NotFoundException } from '@nestjs/common';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { toProblem } from './problem.filter.js';
import { createTestApp } from './test-app.js';

const env = {
  DATABASE_URL: 'postgres://luka:luka@localhost:5432/luka',
  REDIS_URL: 'redis://localhost:6379',
};

const healthy = { ok: true };
const fakeDatastores = {
  pingPostgres: () => Promise.resolve(),
  pingRedis: () => (healthy.ok ? Promise.resolve() : Promise.reject(new Error('caído'))),
  onApplicationShutdown: () => Promise.resolve(),
};

let app: NestFastifyApplication;
beforeAll(async () => {
  app = await createTestApp(env, fakeDatastores);
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
