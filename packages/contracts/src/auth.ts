import { z } from 'zod';

/**
 * Versión vigente de los términos y de la política de tratamiento de datos. La app y la API leen la
 * misma constante; un registro con otra versión se rechaza (consent_required). Borrador hasta el H6.
 */
export const CONSENT_VERSION = '2026-10-borrador-1';

/** Las tres casillas de la pantalla de aceptación, separadas y sin marcar de antemano (T-019). */
export const RegisterConsents = z.object({
  version: z.string().min(1).max(40),
  terms: z.boolean(),
  privacy: z.boolean(),
  adult: z.boolean(),
});

const Credentials = {
  email: z.email().max(254),
  // El mínimo (10) lo comprueba la API con su propio code; aquí solo el tope.
  password: z.string().max(256),
  deviceId: z.uuid(),
  appVersion: z.string().min(1).max(32),
};

/** POST /v1/auth/register: la app adopta su user_id local (ADR-008). */
export const RegisterRequest = z.object({
  ...Credentials,
  userId: z.uuid(),
  displayName: z.string().trim().max(80).default(''),
  consents: RegisterConsents,
});
export type RegisterRequest = z.infer<typeof RegisterRequest>;

/** POST /v1/auth/login. */
export const LoginRequest = z.object(Credentials);
export type LoginRequest = z.infer<typeof LoginRequest>;

/** POST /v1/auth/refresh. */
export const RefreshRequest = z.object({ refreshToken: z.string().min(1).max(200) });
export type RefreshRequest = z.infer<typeof RefreshRequest>;

/** Respuesta de registro, inicio de sesión y refresco. */
export const TokenPair = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  /** Segundos de vida del token de acceso. */
  expiresIn: z.int().positive(),
});
export type TokenPair = z.infer<typeof TokenPair>;
