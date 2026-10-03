import { COLOR_TOKENS } from '@luka/domain';
import { themeColors } from '../src/theme';
import { contrast } from '../src/ui/contrast';
import { colorFor, SERIES_COLORS } from '../src/ui/palette';

const schemes = [
  ['claro', 'light'],
  ['oscuro', 'dark'],
] as const;

describe('T-044 tokens de color (RNF-13)', () => {
  it('modo claro usa los valores de la maqueta', () => {
    expect(themeColors.light).toMatchObject({
      background: '#F2F2F7',
      card: '#FFFFFF',
      text: '#1C1C1E',
      muted: '#6C6C70',
      accent: '#0E7C66',
      accentText: '#0B6350',
      alert: '#B3261E',
    });
  });

  for (const [name, scheme] of schemes) {
    const c = themeColors[scheme];

    it(`modo ${name}: texto, secundario, enlaces y alerta tienen 4,5:1 o más sobre el fondo y la tarjeta (WCAG 1.4.3)`, () => {
      for (const surface of ['background', 'card'] as const) {
        for (const fg of ['text', 'muted', 'accentText', 'alert'] as const) {
          const ratio = contrast(c[fg], c[surface]);
          expect({ fg, surface, ok: ratio >= 4.5 }).toEqual({ fg, surface, ok: true });
        }
      }
    });

    it(`modo ${name}: el texto de un control segmentado tiene 4,5:1 o más sobre su franja`, () => {
      expect(contrast(c.text, c.fill)).toBeGreaterThanOrEqual(4.5);
    });

    it(`modo ${name}: el texto de un botón relleno tiene 4,5:1 o más sobre el acento`, () => {
      expect(contrast(c.onAccent, c.accent)).toBeGreaterThanOrEqual(4.5);
    });

    it(`modo ${name}: el acento de botones y rellenos tiene 3:1 o más con el fondo y la tarjeta (WCAG 1.4.11)`, () => {
      expect(contrast(c.accent, c.background)).toBeGreaterThanOrEqual(3);
      expect(contrast(c.accent, c.card)).toBeGreaterThanOrEqual(3);
    });

    it(`modo ${name}: cada color de categoría tiene 3:1 o más con la tarjeta (WCAG 1.4.11)`, () => {
      for (const { token } of COLOR_TOKENS) {
        const ratio = contrast(colorFor(token, scheme), c.card);
        expect({ token, ok: ratio >= 3 }).toEqual({ token, ok: true });
      }
    });
  }
});

describe('HU-08 colores de la barra del resumen', () => {
  for (const [name, scheme] of schemes) {
    it(`modo ${name}: cada color tiene 3:1 o más con la tarjeta y se distingue del vecino también por luminosidad`, () => {
      const colors = SERIES_COLORS[scheme];
      expect(colors).toHaveLength(7);
      for (const color of colors) {
        expect({ color, ok: contrast(color, themeColors[scheme].card) >= 3 }).toEqual({
          color,
          ok: true,
        });
      }
      colors.slice(1).forEach((color, i) => {
        const previous = colors[i] ?? color;
        expect({ previous, color, ok: contrast(previous, color) >= 1.2 }).toEqual({
          previous,
          color,
          ok: true,
        });
      });
    });
  }
});
