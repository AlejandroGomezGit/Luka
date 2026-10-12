import type { Type } from '@nestjs/common';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import type { FastifyInstance } from 'fastify';
import { Logger } from 'nestjs-pino';
import type { DestinationStream } from 'pino';
import { AppModule, configureApp, createAdapter } from './app.module.js';
import { loadEnv } from './config.js';
import { Datastores } from './datastores.js';
import { RedisClient } from './redis.js';

interface TestAppOptions {
  /** Reemplaza las comprobaciones reales de /readyz. */
  datastores?: Pick<Datastores, 'pingPostgres' | 'pingRedis'>;
  /** Reemplaza la conexión a Redis (las pruebas unitarias usan uno falso, sin red). */
  redis?: object;
  /** Otros proveedores reemplazados por dobles (por ejemplo, el de contraseñas filtradas). */
  overrides?: { provide: Type | symbol; useValue: unknown }[];
  /** Rutas de prueba que no piden sesión, como «GET /v1/prueba/yo» (toda ruta es privada por defecto). */
  publicRoutes?: string[];
  /** Controladores solo de prueba, montados bajo /v1. */
  controllers?: Type[];
  /** Recibe los logs (JSON por línea) en vez de descartarlos. */
  logStream?: DestinationStream;
  /** Ganchos de Fastify propios de la prueba, antes de registrar las rutas. */
  configure?: (fastify: FastifyInstance) => void;
}

/** Levanta la API en memoria con las mismas piezas que main.ts. */
export async function createTestApp(
  env: Record<string, string>,
  {
    datastores,
    redis,
    overrides = [],
    publicRoutes = [],
    controllers = [],
    logStream,
    configure,
  }: TestAppOptions = {},
): Promise<NestFastifyApplication> {
  const parsed = loadEnv(env);
  let builder = Test.createTestingModule({
    imports: [AppModule.forRoot(parsed, logStream)],
    controllers,
  });
  if (datastores) builder = builder.overrideProvider(Datastores).useValue(datastores);
  if (redis) builder = builder.overrideProvider(RedisClient).useValue(redis);
  for (const { provide, useValue } of overrides) {
    builder = builder.overrideProvider(provide).useValue(useValue);
  }
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication<NestFastifyApplication>(createAdapter(parsed), {
    logger: false,
  });
  if (logStream) app.useLogger(app.get(Logger));
  configure?.(app.getHttpAdapter().getInstance());
  await configureApp(app, publicRoutes);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}
