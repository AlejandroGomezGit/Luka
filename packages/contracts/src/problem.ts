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
