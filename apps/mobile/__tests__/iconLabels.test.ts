import { ICON_TOKENS } from '@luka/domain';
import { ICON_LABELS } from '../src/ui/symbols';

test('cada token de ícono tiene un nombre en español para VoiceOver', () => {
  for (const token of ICON_TOKENS) expect(ICON_LABELS[token].length).toBeGreaterThan(0);
  expect(new Set(Object.values(ICON_LABELS)).size).toBe(ICON_TOKENS.length);
});
