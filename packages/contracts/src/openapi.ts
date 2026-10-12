import { z } from 'zod';
import { LoginRequest, RefreshRequest, RegisterRequest, TokenPair } from './auth.js';
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

const body = (name: string) => ({ required: true, ...json(name) });
const problem = { $ref: '#/components/responses/Problem' };
const limited = { '429': { $ref: '#/components/responses/TooManyRequests' } };

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
      '/v1/auth/register': {
        post: {
          operationId: 'register',
          summary: 'Crea la cuenta con correo y contraseña y guarda las tres aceptaciones',
          requestBody: body('RegisterRequest'),
          responses: {
            '201': { description: 'Cuenta creada', ...json('TokenPair') },
            '400': problem,
            '409': problem,
            ...limited,
          },
        },
      },
      '/v1/auth/login': {
        post: {
          operationId: 'login',
          summary: 'Inicia sesión; la respuesta es la misma exista o no el correo',
          requestBody: body('LoginRequest'),
          responses: {
            '200': { description: 'Sesión iniciada', ...json('TokenPair') },
            '401': problem,
            ...limited,
            '503': { $ref: '#/components/responses/ServiceUnavailable' },
          },
        },
      },
      '/v1/auth/refresh': {
        post: {
          operationId: 'refresh',
          summary: 'Rota el token de refresco',
          requestBody: body('RefreshRequest'),
          responses: {
            '200': { description: 'Par nuevo', ...json('TokenPair') },
            '401': problem,
            ...limited,
          },
        },
      },
      '/v1/auth/logout': {
        post: {
          operationId: 'logout',
          summary: 'Revoca los tokens de refresco de este dispositivo',
          security: [{ bearerAuth: [] }],
          responses: { '204': { description: 'Sesión cerrada' }, '401': problem },
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
        RegisterRequest: schema(RegisterRequest),
        LoginRequest: schema(LoginRequest),
        RefreshRequest: schema(RefreshRequest),
        TokenPair: schema(TokenPair),
      },
    },
  };
}
