import { z } from 'zod';
import { Health, Readiness } from './health.js';
import { Problem, RateLimitProblem, UnavailableProblem } from './problem.js';

// OpenAPI 3.1 usa JSON Schema 2020-12, el destino por defecto de z.toJSONSchema.
const schema = (zodSchema: z.ZodType) => {
  const { $schema: _, ...jsonSchema } = z.toJSONSchema(zodSchema);
  return jsonSchema;
};

const json = (name: string) => ({
  content: { 'application/json': { schema: { $ref: `#/components/schemas/${name}` } } },
});

const problemJson = (name: string) => ({
  content: { 'application/problem+json': { schema: { $ref: `#/components/schemas/${name}` } } },
});

const retryAfter = {
  'Retry-After': {
    description: 'Segundos que hay que esperar antes de reintentar',
    schema: { type: 'integer', minimum: 1 },
  },
};

/** Documento OpenAPI de la API, generado desde los esquemas Zod. */
export function buildOpenApi() {
  return {
    openapi: '3.1.0',
    info: { title: 'Luka API', version: '1.0.0' },
    paths: {
      '/healthz': {
        get: {
          operationId: 'health',
          summary: 'El proceso vive',
          responses: { '200': { description: 'Proceso activo', ...json('Health') } },
        },
      },
      '/readyz': {
        get: {
          operationId: 'readiness',
          summary: 'PostgreSQL y Redis responden',
          responses: {
            '200': { description: 'Listo para recibir tráfico', ...json('Readiness') },
            '503': { description: 'Alguna dependencia no responde', ...json('Readiness') },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
      responses: {
        Problem: {
          description: 'Error con formato problem+json (RFC 9457)',
          ...problemJson('Problem'),
        },
        TooManyRequests: {
          description: 'Demasiados intentos de credenciales o demasiadas peticiones',
          headers: retryAfter,
          ...problemJson('RateLimitProblem'),
        },
        ServiceUnavailable: {
          description: 'No se pueden comprobar los intentos de credenciales; reintentar más tarde',
          headers: retryAfter,
          ...problemJson('UnavailableProblem'),
        },
      },
      schemas: {
        Problem: schema(Problem),
        RateLimitProblem: schema(RateLimitProblem),
        UnavailableProblem: schema(UnavailableProblem),
        Health: schema(Health),
        Readiness: schema(Readiness),
      },
    },
  };
}
