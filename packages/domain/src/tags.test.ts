import { describe, expect, it } from '@jest/globals';
import { MAX_TAG_LENGTH, MAX_TAGS, parseTags, tagErrors, tagsText } from './tags.js';

describe('HU-06 etiquetas', () => {
  it('HU-06 se separan por comas y se guardan como las escribe la persona, sin espacios de sobra', () => {
    expect(parseTags('  Viaje a  Medellín , trabajo,, ')).toEqual(['Viaje a Medellín', 'trabajo']);
    expect(parseTags('')).toEqual([]);
  });

  it('HU-06 una repetida sin importar mayúsculas ni tildes se quita y queda la primera forma', () => {
    expect(parseTags('Medellín, medellin, MEDELLÍN, viaje')).toEqual(['Medellín', 'viaje']);
  });

  it('HU-06 hasta 10 etiquetas de hasta 30 caracteres', () => {
    const ten = Array.from({ length: MAX_TAGS }, (_, i) => `e${String(i)}`);
    expect(tagErrors(ten)).toEqual([]);
    expect(tagErrors([...ten, 'once'])).toEqual(['too_many_tags']);
    expect(tagErrors(['a'.repeat(MAX_TAG_LENGTH)])).toEqual([]);
    expect(tagErrors(['a'.repeat(MAX_TAG_LENGTH + 1)])).toEqual(['tag_too_long']);
  });

  it('HU-06 al editar se muestran separadas por comas', () => {
    expect(tagsText(['Viaje', 'trabajo'])).toBe('Viaje, trabajo');
    expect(parseTags(tagsText(['Viaje', 'trabajo']))).toEqual(['Viaje', 'trabajo']);
  });
});
