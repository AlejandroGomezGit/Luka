import { z } from 'zod';

const Env = z.object({
  APP_ENV: z.enum(['local', 'ci', 'staging', 'production']).default('local'),
  PORT: z.coerce.number().int().positive().default(3000),
  // La API se conecta como luka_app (RLS); el dueño de las tablas solo aplica migraciones.
  DATABASE_URL: z.url(),
  DATABASE_POOL_SIZE: z.coerce.number().int().positive().default(10),
  REDIS_URL: z.url(),
});

export type Env = z.infer<typeof Env>;

/** Valida las variables de entorno al arrancar; el mensaje nombra las variables, nunca sus valores. */
export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const result = Env.safeParse(source);
  if (!result.success) {
    throw new Error(`Variables de entorno inválidas:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
