import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { type DynamicModule, Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { LoggerModule } from 'nestjs-pino';
import type { DestinationStream } from 'pino';
import type { Options } from 'pino-http';
import { AttemptLimiter } from './attempts.js';
import { registerAccess } from './auth/access.js';
import { AuthController } from './auth/auth.controller.js';
import { AuthService } from './auth/auth.service.js';
import { BreachChecker } from './auth/breach.js';
import { PasswordHasher } from './auth/passwords.js';
import { AccessTokens } from './auth/tokens.js';
import type { Env } from './config.js';
import { Datastores } from './datastores.js';
import { Database } from './db/database.js';
import { HealthController } from './health.controller.js';
import { ProblemFilter } from './problem.filter.js';
import { registerRateLimit } from './rate-limit.js';
import { RedisClient } from './redis.js';
import { ENV } from './tokens.js';

const REQUEST_ID = /^[\w-]{1,64}$/;
const HEALTH_PATHS = new Set(['/healthz', '/readyz']);

// Cabeceras de seguridad (AM-06) de toda respuesta, también de los errores. La API solo sirve JSON.
const SECURITY_HEADERS = {
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'x-frame-options': 'DENY',
  'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
  'cross-origin-resource-policy': 'same-origin',
  'cache-control': 'no-store',
};

@Module({})
export class AppModule {
  /** `logStream` reemplaza la salida estándar de los logs; lo usan las pruebas. */
  static forRoot(env: Env, logStream?: DestinationStream): DynamicModule {
    const pinoHttp: Options = {
      level: env.APP_ENV === 'production' ? 'info' : 'debug',
      // Regla 10: los cuerpos nunca se registran y las credenciales se ocultan.
      redact: ['req.headers.authorization', 'req.headers.cookie'],
      // Dentro del middleware req.url es relativo a su montaje; originalUrl es la ruta completa.
      autoLogging: {
        ignore: (req) =>
          HEALTH_PATHS.has(
            'originalUrl' in req && typeof req.originalUrl === 'string'
              ? req.originalUrl
              : (req.url ?? ''),
          ),
      },
    };
    return {
      module: AppModule,
      imports: [LoggerModule.forRoot({ pinoHttp: logStream ? [pinoHttp, logStream] : pinoHttp })],
      controllers: [HealthController, AuthController],
      providers: [
        { provide: ENV, useValue: env },
        Database,
        RedisClient,
        Datastores,
        AttemptLimiter,
        PasswordHasher,
        AuthService,
        { provide: BreachChecker, useFactory: () => new BreachChecker() },
        { provide: AccessTokens, useFactory: (e: Env) => AccessTokens.create(e), inject: [ENV] },
        { provide: APP_FILTER, useClass: ProblemFilter },
      ],
      exports: [AttemptLimiter],
    };
  }
}

/**
 * Fastify asigna el id de cada petición (pino-http lo reutiliza): el X-Request-Id del cliente si es
 * seguro, si no un UUID nuevo. Vuelve en la respuesta para seguir un reporte de punta a punta.
 */
export function createAdapter(env: Env): FastifyAdapter {
  const adapter = new FastifyAdapter({
    trustProxy: env.TRUST_PROXY,
    // 1 MB: el tamaño máximo de un lote de sincronización (documento 04, AM-08).
    bodyLimit: 1_048_576,
    requestTimeout: env.REQUEST_TIMEOUT_MS,
    requestIdHeader: false,
    genReqId: (req: IncomingMessage) => {
      const incoming = req.headers['x-request-id'];
      return typeof incoming === 'string' && REQUEST_ID.test(incoming) ? incoming : randomUUID();
    },
  });
  const fastify = adapter.getInstance();
  fastify.addHook('onRequest', (request, reply, done) => {
    void reply.header('x-request-id', request.id);
    done();
  });
  fastify.addHook('onSend', (_request, reply, payload, done) => {
    void reply.headers(SECURITY_HEADERS);
    done(null, payload);
  });
  return adapter;
}

/** Ajustes comunes a la API real y a las pruebas; `extraPublic` solo lo usan rutas de prueba. */
export async function configureApp(
  app: NestFastifyApplication,
  extraPublic: readonly string[] = [],
): Promise<NestFastifyApplication> {
  app.setGlobalPrefix('v1', { exclude: ['healthz', 'readyz'] });
  app.enableShutdownHooks();
  await registerRateLimit(app);
  registerAccess(app, extraPublic);
  return app;
}
