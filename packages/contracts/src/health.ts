import { z } from 'zod';

/** `GET /healthz`: el proceso vive. */
export const Health = z.object({ status: z.literal('ok') });
export type Health = z.infer<typeof Health>;

const CheckStatus = z.enum(['ok', 'error']);

/** `GET /readyz`: PostgreSQL y Redis responden. Con `status: error` la respuesta es 503. */
export const Readiness = z.object({
  status: CheckStatus,
  checks: z.object({ postgres: CheckStatus, redis: CheckStatus }),
});
export type Readiness = z.infer<typeof Readiness>;
