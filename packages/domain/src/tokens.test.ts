import { describe, expect, it } from '@jest/globals';
import { PREDEFINED_CATEGORIES } from './categories.js';
import { COLOR_TOKENS, ICON_TOKENS, isColorToken, isIconToken } from './tokens.js';

describe('tokens de ícono y color (documento 02)', () => {
  it('hay entre 40 y 60 íconos, únicos y en inglés con guion bajo', () => {
    expect(ICON_TOKENS.length).toBeGreaterThanOrEqual(40);
    expect(ICON_TOKENS.length).toBeLessThanOrEqual(60);
    expect(new Set(ICON_TOKENS).size).toBe(ICON_TOKENS.length);
    for (const token of ICON_TOKENS) expect(token).toMatch(/^[a-z][a-z_]*$/);
  });

  it('hay 12 colores únicos, cada uno con su nombre en español para VoiceOver', () => {
    expect(COLOR_TOKENS).toHaveLength(12);
    expect(new Set(COLOR_TOKENS.map((c) => c.token)).size).toBe(12);
    for (const color of COLOR_TOKENS) expect(color.name.length).toBeGreaterThan(0);
  });

  it('isIconToken e isColorToken reconocen solo los tokens de la lista', () => {
    expect(isIconToken('cart')).toBe(true);
    expect(isIconToken('food')).toBe(false);
    expect(isColorToken('teal')).toBe(true);
    expect(isColorToken('#00ff00')).toBe(false);
  });

  it('cada categoría predefinida usa tokens válidos y hereda el color de su principal', () => {
    for (const category of PREDEFINED_CATEGORIES) {
      expect(isIconToken(category.icon)).toBe(true);
      expect(isColorToken(category.color)).toBe(true);
      const parent = PREDEFINED_CATEGORIES.find((c) => c.key === category.parent);
      if (parent) expect(category.color).toBe(parent.color);
    }
  });
});
