import { describe, expect, it } from '@jest/globals';
import versioned from '../openapi.json' with { type: 'json' };
import { Problem, RateLimitProblem, Readiness, UnavailableProblem, buildOpenApi } from './index.js';

const problem: Record<string, unknown> = {
  type: 'about:blank',
  title: 'Datos inválidos',
  status: 400,
  code: 'validation_failed',
};

describe('Problem (ADR-013, RFC 9457)', () => {
  it('acepta un error problem+json con code estable', () => {
    expect(Problem.parse({ ...problem, detail: 'amount_minor no puede ser cero' })).toEqual({
      ...problem,
      detail: 'amount_minor no puede ser cero',
    });
  });

  it('rechaza un error sin code, con status fuera de 4xx y 5xx o con type que no es URI', () => {
    const { code: _code, ...withoutCode } = problem;
    expect(Problem.safeParse(withoutCode).success).toBe(false);
    expect(Problem.safeParse({ ...problem, status: 200 }).success).toBe(false);
    expect(Problem.safeParse({ ...problem, type: 'error' }).success).toBe(false);
  });
});

describe('Readiness', () => {
  it('describe el estado de PostgreSQL y Redis', () => {
    const ready = { status: 'error', checks: { postgres: 'ok', redis: 'error' } };
    expect(Readiness.parse(ready)).toEqual(ready);
    expect(Readiness.safeParse({ status: 'ok', checks: { postgres: 'ok' } }).success).toBe(false);
  });
});

describe('OpenAPI', () => {
  it('el openapi.json versionado coincide con los esquemas (regenerar con pnpm --filter @luka/contracts openapi)', () => {
    expect(buildOpenApi()).toEqual(versioned);
  });

  it('genera OpenAPI 3.1 con Problem como respuesta de error reutilizable', () => {
    const doc = buildOpenApi();
    expect(doc.openapi).toBe('3.1.0');
    expect(doc.components.schemas.Problem.required).toEqual(['type', 'title', 'status', 'code']);
    expect(doc.paths['/readyz'].get.responses['503']).toBeDefined();
  });
});

describe('Problem con extensiones', () => {
  it('conserva los miembros de extensión que permite RFC 9457', () => {
    const withErrors = { ...problem, errors: [{ field: 'amountMinor' }] };
    expect(Problem.parse(withErrors)).toEqual(withErrors);
  });
});

describe('429 y 503 de los límites (AM-01, AM-08)', () => {
  const base = { type: 'about:blank', title: 'Too Many Requests', status: 429 };

  it('el 429 lleva too_many_attempts (credenciales) o rate_limited (peticiones)', () => {
    expect(RateLimitProblem.parse({ ...base, code: 'too_many_attempts' }).code).toBe(
      'too_many_attempts',
    );
    expect(RateLimitProblem.parse({ ...base, code: 'rate_limited' }).code).toBe('rate_limited');
    expect(RateLimitProblem.safeParse({ ...base, code: 'not_found' }).success).toBe(false);
    expect(RateLimitProblem.safeParse({ ...base, status: 503, code: 'rate_limited' }).success).toBe(
      false,
    );
  });

  it('el 503 de los intentos de credenciales lleva temporarily_unavailable', () => {
    const unavailable = { ...base, title: 'Service Unavailable', status: 503 };
    expect(
      UnavailableProblem.parse({ ...unavailable, code: 'temporarily_unavailable' }).status,
    ).toBe(503);
    expect(UnavailableProblem.safeParse({ ...unavailable, code: 'rate_limited' }).success).toBe(
      false,
    );
  });

  it('OpenAPI describe el 429 y el 503 con Retry-After en segundos', () => {
    const { responses } = buildOpenApi().components;
    for (const name of ['TooManyRequests', 'ServiceUnavailable'] as const) {
      expect(responses[name].headers['Retry-After'].schema).toEqual({
        type: 'integer',
        minimum: 1,
      });
    }
    expect(buildOpenApi().components.schemas.RateLimitProblem).toMatchObject({
      properties: { code: { enum: ['too_many_attempts', 'rate_limited'] } },
    });
  });
});
