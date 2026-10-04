// Comprobación de T-047: un cambio que no toca la app no debe cambiar lo que resuelve apps/mobile en
// pnpm-lock.yaml (versiones ni variantes de pares). Uso:
//   node scripts/app-lock-closure.mjs <lockfile-base> <lockfile-rama>
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const unquote = (text) => text.trim().replace(/^'(.*)'$/, '$1');
const withoutPeers = (key) => key.replace(/\(.*$/, '');

/** Entradas del lockfile (nombre@versión con sus pares) que alcanza `importer`, sin enlaces del workspace. */
export function appClosure(lockText, importer = 'apps/mobile') {
  // pnpm 12 escribe dos documentos YAML; el de las dependencias del proyecto es el último.
  const doc = lockText.split('\n---\n').at(-1) ?? '';
  const importers = doc.split('\nimporters:\n')[1]?.split('\npackages:\n')[0] ?? '';
  const block =
    new RegExp(`^  ${importer}:\\n((?:    .*\\n|\\n)*)`, 'm').exec(importers)?.[1] ?? '';
  const roots = [...block.matchAll(/^ {6}(\S+):\n {8}specifier: .*\n {8}version: (.*)$/gm)]
    .map(([, name = '', version = '']) => [unquote(name), unquote(version)])
    .filter(([, version]) => !version.startsWith('link:'))
    .map(([name, version]) => `${name}@${version}`);
  const edges = new Map();
  for (const [, key = '', body = ''] of (doc.split('\nsnapshots:\n')[1] ?? '').matchAll(
    /^ {2}(\S.*?):(?: \{\})?\n((?: {4}.*\n)*)/gm,
  )) {
    const deps = [];
    for (const [, section = ''] of body.matchAll(
      /^ {4}(?:dependencies|optionalDependencies):\n((?: {6}.*\n)*)/gm,
    )) {
      for (const [, name = '', version = ''] of section.matchAll(/^ {6}(\S+): (.*)$/gm)) {
        deps.push(`${unquote(name)}@${unquote(version)}`);
      }
    }
    edges.set(unquote(key), deps);
  }
  const seen = new Set();
  const pending = [...roots];
  while (pending.length > 0) {
    const key = pending.pop() ?? '';
    if (seen.has(key)) continue;
    seen.add(key);
    pending.push(...(edges.get(key) ?? []));
  }
  return seen;
}

/** Variantes y versiones (sin pares) que entran y salen de lo que alcanza la app. */
export function compareClosures(baseText, headText) {
  const before = appClosure(baseText);
  const after = appClosure(headText);
  const diff = (a, b) => [...a].filter((key) => !b.has(key)).sort();
  const versions = (set) => new Set([...set].map(withoutPeers));
  return {
    added: diff(after, before),
    removed: diff(before, after),
    versionsAdded: diff(versions(after), versions(before)),
    versionsRemoved: diff(versions(before), versions(after)),
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [base = '', head = ''] = process.argv.slice(2);
  const result = compareClosures(readFileSync(base, 'utf8'), readFileSync(head, 'utf8'));
  const total = appClosure(readFileSync(head, 'utf8')).size;
  if (result.added.length === 0 && result.removed.length === 0) {
    console.log(`apps/mobile resuelve lo mismo (${String(total)} entradas).`);
  } else {
    console.error(
      `::error::Este cambio altera lo que resuelve apps/mobile: ${String(result.added.length)} variantes entran y ${String(result.removed.length)} salen. ` +
        'Si es a propósito, describe las versiones en el PR y pide la etiqueta cambia-dependencias-app (CLAUDE.md).',
    );
    for (const key of result.versionsAdded) console.error(`  + ${key}`);
    for (const key of result.versionsRemoved) console.error(`  - ${key}`);
    process.exit(1);
  }
}
