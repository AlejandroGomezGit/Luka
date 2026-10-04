/**
 * Etiquetas de un movimiento (HU-06, CU-11). Se guardan como las escribe la persona («Medellín»); solo
 * para buscar y para detectar repetidas se comparan normalizadas (sin mayúsculas ni tildes).
 */
import { normalizeText } from './search.js';

export const MAX_TAGS = 10;
export const MAX_TAG_LENGTH = 30;

export type TagError = 'too_many_tags' | 'tag_too_long';

/** Lo escrito en el campo, separado por comas: sin vacías, sin espacios de sobra y sin repetidas. */
export function parseTags(text: string): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const part of text.split(',')) {
    const tag = part.trim().replace(/\s+/g, ' ');
    const key = normalizeText(tag);
    if (key === '' || seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
  }
  return tags;
}

export function tagErrors(tags: readonly string[]): TagError[] {
  const errors: TagError[] = [];
  if (tags.length > MAX_TAGS) errors.push('too_many_tags');
  if (tags.some((tag) => tag.length > MAX_TAG_LENGTH)) errors.push('tag_too_long');
  return errors;
}

/** Las etiquetas como se muestran en el campo al editar: «Viaje, trabajo». */
export const tagsText = (tags: readonly string[]) => tags.join(', ');
