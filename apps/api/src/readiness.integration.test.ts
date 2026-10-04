import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';
import { createTestApp } from './test-app.js';

// PostgreSQL y Redis reales, con las mismas imágenes que infra/docker-compose.yml.
let postgres: StartedPostgreSqlContainer;
let redis: StartedRedisContainer;
let app: NestFastifyApplication;

beforeAll(async () => {
  [postgres, redis] = await Promise.all([
    new PostgreSqlContainer('postgres:18-alpine').start(),
    new RedisContainer('redis:8-alpine').start(),
  ]);
  app = await createTestApp({
    DATABASE_URL: postgres.getConnectionUri(),
    REDIS_URL: redis.getConnectionUrl(),
    RATE_LIMIT_KEY_SECRET: 'falso-solo-para-pruebas-0123456789',
  });
});

afterAll(async () => {
  await app.close();
  await postgres.stop();
});

describe('/readyz contra PostgreSQL y Redis reales', () => {
  it('responde 200 cuando ambos responden', async () => {
    const res = await app.inject({ method: 'GET', url: '/readyz' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok', checks: { postgres: 'ok', redis: 'ok' } });
  });

  it('responde 503 cuando Redis se cae', async () => {
    await redis.stop();
    const res = await app.inject({ method: 'GET', url: '/readyz' });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ status: 'error', checks: { postgres: 'ok', redis: 'error' } });
  });
});
