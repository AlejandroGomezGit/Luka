import { z } from 'zod';

/**
 * Error de la API en `application/problem+json` (RFC 9457, ADR-013). `code` es obligatorio y estable:
 * la app decide qué hacer leyendo `code`, nunca `title` ni `detail` (regla 9 de CLAUDE.md).
 */
// looseObject: RFC 9457 permite miembros de extensión (por ejemplo `errors`).
export const Problem = z.looseObject({
  type: z.url(),
  title: z.string(),
  status: z.int().min(400).max(599),
  detail: z.string().optional(),
  code: z.string().min(1),
});

export type Problem = z.infer<typeof Problem>;

/** 429: `too_many_attempts` por intentos fallidos de credenciales (AM-01), `rate_limited` por exceso de peticiones (AM-08). */
export const RateLimitProblem = Problem.extend({
  status: z.literal(429),
  code: z.enum(['too_many_attempts', 'rate_limited']),
});

export type RateLimitProblem = z.infer<typeof RateLimitProblem>;

/** 503 de los intentos de credenciales cuando Redis no responde: se niegan en vez de quedar sin límite. */
export const UnavailableProblem = Problem.extend({
  status: z.literal(503),
  code: z.literal('temporarily_unavailable'),
});

export type UnavailableProblem = z.infer<typeof UnavailableProblem>;
