import { describe, expect, it } from '@jest/globals';
import versioned from '../openapi.json' with { type: 'json' };
import { Problem, Readiness, buildOpenApi } from './index.js';

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
