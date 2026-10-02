const normalize = (name: string) =>
  name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

/** Dos nombres son el mismo si solo cambian mayúsculas, tildes o espacios (categorías y cuentas). */
export function sameName(a: string, b: string): boolean {
  return normalize(a) === normalize(b);
}
