import { createHmac } from 'node:crypto';
import fastifyRateLimit, { normalizeIP, type RateLimitPluginOptions } from '@fastify/rate-limit';
import type { RateLimitProblem } from '@luka/contracts';
import { Logger } from '@nestjs/common';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Env } from './config.js';
import { RedisClient } from './redis.js';
import { ENV } from './tokens.js';

declare module 'fastify' {
  interface FastifyRequest {
    /** Usuario autenticado; lo fija la autenticación (T-019) antes de preHandler. */
    userId?: string;
  }
}

/** HMAC del valor: los correos y las IP nunca quedan en claro en las claves de Redis (AM-09). */
export const keyHash = (secret: string, value: string): string =>
  createHmac('sha256', secret).update(value).digest('base64url');

/** La IPv4 tal cual; la IPv6, por su prefijo /64, que suele ser de una sola persona u hogar. */
export const ipBucket = (ip: string): string => normalizeIP(ip, 64);

const UNLIMITED = new Set(['/healthz', '/readyz']);
const logger = new Logger('LimiteDeTasa');

type Limiter = ReturnType<FastifyInstance['createRateLimit']>;

/**
 * Límite de tasa (AM-08, ADR-015): por IP al recibir la petición, más estricto en /v1/auth/*, y por
 * usuario después de la autenticación. Responde 429 rate_limited con Retry-After.
 */
export async function registerRateLimit(app: NestFastifyApplication): Promise<void> {
  const env = app.get<Env>(ENV);
  const redis = app.get(RedisClient);
  const isAuth = (req: FastifyRequest): boolean => req.url.startsWith('/v1/auth/');
  const byIp = await createLimiter(app, {
    redis,
    nameSpace: 'luka:tasa:',
    timeWindow: env.RATE_LIMIT_WINDOW_MS,
    max: (req) => (isAuth(req) ? env.AUTH_RATE_LIMIT_PER_IP : env.RATE_LIMIT_PER_IP),
    // Prefijos distintos: el contador general y el estricto de /v1/auth/* no se comparten.
    keyGenerator: (req) =>
      `${isAuth(req) ? 'auth' : 'ip'}:${keyHash(env.RATE_LIMIT_KEY_SECRET, ipBucket(req.ip))}`,
    allowList: (req) => UNLIMITED.has(req.url.split('?')[0] ?? ''),
  });
  const byUser = await createLimiter(app, {
    redis,
    nameSpace: 'luka:tasa:usuario:',
    timeWindow: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_PER_USER,
    keyGenerator: (req) => req.userId ?? '',
    allowList: (req) => req.userId === undefined,
  });
  const fastify = app.getHttpAdapter().getInstance();
  fastify.addHook('onRequest', (req, reply) => enforce(byIp, req, reply));
  fastify.addHook('preHandler', (req, reply) => enforce(byUser, req, reply));
}

/**
 * Un limitador con su propio espacio de nombres. Se registra en un contexto aparte porque
 * createRateLimit(opciones) antepone a la clave un método y una ruta vacíos («undefinedundefined-»);
 * sin opciones usa el almacén del registro tal cual.
 */
async function createLimiter(
  app: NestFastifyApplication,
  options: RateLimitPluginOptions,
): Promise<Limiter> {
  let limiter: Limiter | undefined;
  await app.register(async (scope: FastifyInstance) => {
    await scope.register(fastifyRateLimit, { ...options, global: false });
    limiter = scope.createRateLimit();
  });
  if (!limiter) throw new Error('El límite de tasa no se registró');
  return limiter;
}

async function enforce(
  limiter: Limiter,
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply | undefined> {
  let result: Awaited<ReturnType<Limiter>>;
  try {
    result = await limiter(req);
  } catch {
    // Sin Redis no se limita: un corte no debe tumbar la API ni la sincronización (ADR-015).
    logger.warn('Límite de tasa sin Redis: la petición pasa sin contar.');
    return undefined;
  }
  if (result.isAllowed || !result.isExceeded) return undefined;
  const problem: RateLimitProblem = {
    type: 'about:blank',
    title: 'Too Many Requests',
    status: 429,
    code: 'rate_limited',
  };
  return reply
    .code(429)
    .header('retry-after', Math.max(1, result.ttlInSeconds))
    .header('content-type', 'application/problem+json')
    .send(problem);
}
