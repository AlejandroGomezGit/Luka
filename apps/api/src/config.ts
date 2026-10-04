import { z } from 'zod';

const ms = z.coerce.number().int().positive();
const count = z.coerce.number().int().positive();

/** APP_ENV o NODE_ENV en production. */
function isProduction(env: { APP_ENV: string; NODE_ENV?: string | undefined }): boolean {
  return env.APP_ENV === 'production' || env.NODE_ENV === 'production';
}

const Env = z
  .object({
    APP_ENV: z.enum(['local', 'ci', 'staging', 'production']).default('local'),
    NODE_ENV: z.string().optional(),
    PORT: z.coerce.number().int().positive().default(3000),
    // La API se conecta como luka_app (RLS); el dueño de las tablas solo aplica migraciones.
    DATABASE_URL: z.url(),
    DATABASE_POOL_SIZE: z.coerce.number().int().positive().default(10),
    REDIS_URL: z.url(),
    // De quién se fía Fastify para X-Forwarded-For: false (la IP del socket), true o las direcciones y
    // rangos del balanceador separados por comas. Un número de saltos no sirve: Fastify lo ignora desde
    // 5.12.1 (CVE-2026-16732), porque un cliente directo podría falsificar la cabecera. En producción
    // true tampoco: confía en cualquier X-Forwarded-*. El valor real se decide en T-040.
    TRUST_PROXY: z
      .string()
      .default('false')
      .refine((value) => !/^\d+$/.test(value), 'usa false, true o las direcciones del balanceador')
      .transform((value) => (value === 'false' ? false : value === 'true' ? true : value)),
    REQUEST_TIMEOUT_MS: ms.default(30_000),
    // Clave del HMAC que esconde correos e IP en las claves de Redis; en producción, del gestor de secretos.
    RATE_LIMIT_KEY_SECRET: z.string().min(16),
    // Límite de tasa (AM-08): peticiones por ventana.
    RATE_LIMIT_WINDOW_MS: ms.default(60_000),
    RATE_LIMIT_PER_IP: count.default(300),
    AUTH_RATE_LIMIT_PER_IP: count.default(20),
    RATE_LIMIT_PER_USER: count.default(300),
    // Intentos fallidos de credenciales (AM-01, ADR-015).
    LOGIN_ATTEMPTS_WINDOW_MS: ms.default(15 * 60_000),
    LOGIN_ATTEMPTS_MAX: count.default(5),
    LOGIN_ACCOUNT_ATTEMPTS_MAX: count.default(20),
    LOGIN_IP_ATTEMPTS_MAX: count.default(50),
    LOGIN_LOCK_BASE_MS: ms.default(60_000),
    LOGIN_LOCK_MAX_MS: ms.default(60 * 60_000),
  })
  .refine((env) => env.LOGIN_ACCOUNT_ATTEMPTS_MAX > env.LOGIN_ATTEMPTS_MAX, {
    path: ['LOGIN_ACCOUNT_ATTEMPTS_MAX'],
    message: 'debe ser mayor que LOGIN_ATTEMPTS_MAX',
  })
  .refine((env) => !(isProduction(env) && env.TRUST_PROXY === true), {
    path: ['TRUST_PROXY'],
    message: 'en producción usa las direcciones o rangos del balanceador, no true',
  });

export type Env = z.infer<typeof Env>;

/** Valida las variables de entorno al arrancar; el mensaje nombra las variables, nunca sus valores. */
export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  // Sin APP_ENV, NODE_ENV=production cuenta como producción: nunca se cae a local por omisión.
  const result = Env.safeParse({
    ...source,
    APP_ENV: source['APP_ENV'] ?? (source['NODE_ENV'] === 'production' ? 'production' : undefined),
  });
  if (!result.success) {
    throw new Error(`Variables de entorno inválidas:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

/** Avisos que la API registra al arrancar. */
export function startupWarnings(env: Env): string[] {
  return isProduction(env) && env.TRUST_PROXY === false
    ? [
        'TRUST_PROXY=false en producción: detrás de un balanceador todas las peticiones tendrían su IP y compartirían el límite de tasa (T-040).',
      ]
    : [];
}
