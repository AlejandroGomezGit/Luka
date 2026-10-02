import { z } from 'zod';
import { Health, Readiness } from './health.js';
import { Problem } from './problem.js';

// OpenAPI 3.1 usa JSON Schema 2020-12, el destino por defecto de z.toJSONSchema.
const schema = (zodSchema: z.ZodType) => {
  const { $schema: _, ...jsonSchema } = z.toJSONSchema(zodSchema);
  return jsonSchema;
};

const json = (name: string) => ({
  content: { 'application/json': { schema: { $ref: `#/components/schemas/${name}` } } },
});

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
          content: {
            'application/problem+json': { schema: { $ref: '#/components/schemas/Problem' } },
          },
        },
      },
      schemas: {
        Problem: schema(Problem),
        Health: schema(Health),
        Readiness: schema(Readiness),
      },
    },
  };
}
