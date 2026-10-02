import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { type DynamicModule, Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { LoggerModule } from 'nestjs-pino';
import type { Env } from './config.js';
import { Datastores } from './datastores.js';
import { HealthController } from './health.controller.js';
import { ProblemFilter } from './problem.filter.js';
import { ENV } from './tokens.js';

const REQUEST_ID = /^[\w-]{1,64}$/;
const HEALTH_PATHS = new Set(['/healthz', '/readyz']);

@Module({})
export class AppModule {
  static forRoot(env: Env): DynamicModule {
    return {
      module: AppModule,
      imports: [
        LoggerModule.forRoot({
          pinoHttp: {
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
          },
        }),
      ],
      controllers: [HealthController],
      providers: [
        { provide: ENV, useValue: env },
        Datastores,
        { provide: APP_FILTER, useClass: ProblemFilter },
      ],
    };
  }
}

/**
 * Fastify asigna el id de cada petición (pino-http lo reutiliza): el X-Request-Id del cliente si es
 * seguro, si no un UUID nuevo. Vuelve en la respuesta para seguir un reporte de punta a punta.
 */
export function createAdapter(): FastifyAdapter {
  const adapter = new FastifyAdapter({
    requestIdHeader: false,
    genReqId: (req: IncomingMessage) => {
      const incoming = req.headers['x-request-id'];
      return typeof incoming === 'string' && REQUEST_ID.test(incoming) ? incoming : randomUUID();
    },
  });
  adapter.getInstance().addHook('onRequest', (request, reply, done) => {
    void reply.header('x-request-id', request.id);
    done();
  });
  return adapter;
}

/** Ajustes comunes a la API real y a las pruebas. */
export function configureApp(app: NestFastifyApplication): NestFastifyApplication {
  app.setGlobalPrefix('v1', { exclude: ['healthz', 'readyz'] });
  app.enableShutdownHooks();
  return app;
}
