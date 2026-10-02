import { describe, expect, it } from '@jest/globals';
import { type Clock } from './dates.js';
import { deterministicId, newId } from './ids.js';

const clock: Clock = { now: () => Date.UTC(2026, 9, 2, 12) };
const zeros = () => new Uint8Array(16);

describe('newId (ADR-008)', () => {
  it('genera un UUID v7 en minúsculas con la hora del reloj inyectado', () => {
    const id = newId(clock, zeros);
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    // Los primeros 48 bits son los milisegundos del reloj.
    expect(parseInt(id.replaceAll('-', '').slice(0, 12), 16)).toBe(clock.now());
  });

  it('ordena por tiempo y no repite con azar distinto', () => {
    const later: Clock = { now: () => clock.now() + 1 };
    expect(newId(clock, zeros) < newId(later, zeros)).toBe(true);
    const random = () => Uint8Array.from({ length: 16 }, (_, i) => i * 7);
    expect(newId(clock, random)).not.toBe(newId(clock, zeros));
  });
});

describe('deterministicId (UUID v5)', () => {
  it('coincide con el vector de referencia de Python: uuid5(NAMESPACE_DNS, "python.org")', () => {
    expect(deterministicId('6ba7b810-9dad-11d1-80b4-00c04fd430c8', 'python.org')).toBe(
      '886313e1-3b8a-5372-9b90-0c9aee199e5d',
    );
  });

  it('el mismo espacio y nombre dan siempre el mismo id', () => {
    const userId = '0199a6f0-0000-7000-8000-000000000001';
    expect(deterministicId(userId, 'food.groceries')).toBe(
      deterministicId(userId, 'food.groceries'),
    );
    expect(deterministicId(userId, 'food')).not.toBe(deterministicId(userId, 'food.groceries'));
  });
});
