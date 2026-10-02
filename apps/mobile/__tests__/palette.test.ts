import { COLOR_TOKENS } from '@luka/domain';
import { CATEGORY_COLORS, colorFor } from '../src/ui/palette';
import { themeColors } from '../src/theme';

/** Contraste WCAG 2.x entre dos colores #RRGGBB. */
function contrast(a: string, b: string): number {
  const luminance = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

describe('paleta de categorías (RNF-13)', () => {
  it('cada token de color tiene un valor para modo claro y oscuro', () => {
    expect(Object.keys(CATEGORY_COLORS).sort()).toEqual(COLOR_TOKENS.map((c) => c.token).sort());
  });

  for (const scheme of ['light', 'dark'] as const) {
    it(`en modo ${scheme === 'light' ? 'claro' : 'oscuro'} cada color tiene contraste de 3:1 o más con el fondo (WCAG 1.4.11)`, () => {
      for (const { token } of COLOR_TOKENS) {
        const ratio = contrast(colorFor(token, scheme), themeColors[scheme].background);
        expect({ token, ok: ratio >= 3 }).toEqual({ token, ok: true });
      }
    });
  }

  it('un token desconocido usa el color de texto secundario', () => {
    expect(colorFor('lime', 'light')).toBe(themeColors.light.muted);
  });
});
