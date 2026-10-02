import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { AppModule, configureApp, createAdapter } from './app.module.js';
import { loadEnv } from './config.js';
import { Datastores } from './datastores.js';

/** Levanta la API en memoria; `datastores` reemplaza las conexiones reales si se indica. */
export async function createTestApp(
  env: Record<string, string>,
  datastores?: Pick<Datastores, 'pingPostgres' | 'pingRedis' | 'onApplicationShutdown'>,
): Promise<NestFastifyApplication> {
  let builder = Test.createTestingModule({ imports: [AppModule.forRoot(loadEnv(env))] });
  if (datastores) builder = builder.overrideProvider(Datastores).useValue(datastores);
  const moduleRef = await builder.compile();
  const app = configureApp(
    moduleRef.createNestApplication<NestFastifyApplication>(createAdapter(), {
      logger: false,
    }),
  );
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}
