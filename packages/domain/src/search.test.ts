import { describe, expect, it } from '@jest/globals';
import { containsPattern, LIKE_ESCAPE, normalizeText } from './search.js';

describe('HU-05 texto de búsqueda', () => {
  it('HU-05 normalizeText quita tildes, mayúsculas y espacios de más', () => {
    expect(normalizeText('  Café   ÉXITO ')).toBe('cafe exito');
    expect(normalizeText('Peña')).toBe('pena');
  });

  it('HU-05 containsPattern busca en cualquier parte del texto normalizado', () => {
    expect(containsPattern('Mercado')).toBe('%mercado%');
    expect(LIKE_ESCAPE).toBe('\\');
  });

  it('HU-05 escapa %, _ y \\ para que «50%» no coincida con todo', () => {
    expect(containsPattern('50%')).toBe('%50\\%%');
    expect(containsPattern('a_b')).toBe('%a\\_b%');
    expect(containsPattern('c:\\x')).toBe('%c:\\\\x%');
  });

  it('HU-05 un texto vacío o solo con espacios no filtra', () => {
    expect(containsPattern('   ')).toBeNull();
  });
});
