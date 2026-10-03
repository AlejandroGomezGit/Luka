/** Búsqueda de movimientos (HU-05): texto normalizado y patrones LIKE seguros. */

/** Minúsculas, sin tildes y con un solo espacio: «  Café   ÉXITO » → «cafe exito». */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/** Carácter de escape de los patrones LIKE: las consultas usan `like ? escape '\\'`. */
export const LIKE_ESCAPE = '\\';

/**
 * Patrón LIKE que busca el texto normalizado en cualquier parte. Escapa `%`, `_` y `\\` para que lo
 * escrito se busque tal cual: «50%» no coincide con todo. Un texto vacío no filtra (null).
 */
export function containsPattern(text: string): string | null {
  const normalized = normalizeText(text);
  if (normalized === '') return null;
  return `%${normalized.replace(/[\\%_]/g, (char) => LIKE_ESCAPE + char)}%`;
}
