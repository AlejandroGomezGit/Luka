/* global console, process, URL */
// Solo macOS: lee la tabla de disponibilidad de SF Symbols que trae el sistema y escribe, para cada
// símbolo que usa la app, la versión de iOS en la que apareció. La prueba de símbolos la usa en CI.
// Uso: pnpm --filter @luka/mobile symbols:check
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const PLIST =
  '/System/Library/CoreServices/CoreGlyphs.bundle/Contents/Resources/name_availability.plist';
const table = JSON.parse(
  execFileSync('plutil', ['-convert', 'json', '-o', '-', PLIST], { encoding: 'utf8' }),
);

// Los símbolos son los valores entre comillas de src/ui/symbols.ts (mapa y símbolo de respaldo).
const source = readFileSync(new URL('../src/ui/symbols.ts', import.meta.url), 'utf8');
const names = [
  ...new Set([...source.matchAll(/'([a-z0-9]+(?:\.[a-z0-9]+)*)';?,?$/gm)].map((m) => m[1])),
];

const result = {};
const missing = [];
for (const name of names.sort()) {
  const year = table.symbols[name];
  if (year) result[name] = table.year_to_release[year].iOS;
  else missing.push(name);
}
if (missing.length > 0) {
  console.error(`Símbolos que no están en la tabla de Apple: ${missing.join(', ')}`);
  process.exit(1);
}
writeFileSync(
  new URL('../src/ui/symbol-availability.json', import.meta.url),
  `${JSON.stringify(result, null, 2)}\n`,
);
console.log(`${Object.keys(result).length} símbolos revisados`);
