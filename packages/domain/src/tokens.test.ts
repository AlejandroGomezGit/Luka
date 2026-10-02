import { describe, expect, it } from '@jest/globals';
import { PREDEFINED_CATEGORIES } from './categories.js';
import { COLOR_TOKENS, isColorToken, isEmoji, lastEmoji } from './tokens.js';

describe('ícono: un solo emoji del teclado (documento 02)', () => {
  it('acepta un emoji, incluidos los compuestos, banderas y teclas', () => {
    for (const emoji of ['🛒', '🍽️', '☕', '🅿️', '🧑‍💻', '👍🏽', '🇨🇴', '1️⃣', '↩️']) {
      expect({ emoji, ok: isEmoji(emoji) }).toEqual({ emoji, ok: true });
    }
  });

  it('rechaza texto, varios emojis y vacío', () => {
    for (const value of ['', 'a', 'cart', '🛒🛒', '🛒 ', '1', '#']) {
      expect({ value, ok: isEmoji(value) }).toEqual({ value, ok: false });
    }
  });

  it('lastEmoji toma el último emoji escrito, para reemplazar el anterior en el campo', () => {
    expect(lastEmoji('🛒🍽️')).toBe('🍽️');
    expect(lastEmoji('🛒a')).toBe('🛒');
    expect(lastEmoji('abc')).toBeNull();
  });
});

describe('colores (documento 02)', () => {
  it('hay 12 colores únicos, cada uno con su nombre en español para VoiceOver', () => {
    expect(COLOR_TOKENS).toHaveLength(12);
    expect(new Set(COLOR_TOKENS.map((c) => c.token)).size).toBe(12);
    for (const color of COLOR_TOKENS) expect(color.name.length).toBeGreaterThan(0);
  });

  it('isColorToken reconoce solo los colores de la lista', () => {
    expect(isColorToken('teal')).toBe(true);
    expect(isColorToken('#00ff00')).toBe(false);
  });
});

describe('catálogo con emoji', () => {
  it('cada categoría predefinida tiene un emoji y un color válidos, y hereda el color de su principal', () => {
    for (const category of PREDEFINED_CATEGORIES) {
      expect({ key: category.key, ok: isEmoji(category.icon) }).toEqual({
        key: category.key,
        ok: true,
      });
      expect(isColorToken(category.color)).toBe(true);
      const parent = PREDEFINED_CATEGORIES.find((c) => c.key === category.parent);
      if (parent) expect(category.color).toBe(parent.color);
    }
  });
});
