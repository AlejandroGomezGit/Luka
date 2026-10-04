// Excepciones de osv-scanner (T-043): cada una con motivo y con ignoreUntil a 90 días o menos, y el CI
// avisa cuando una caduca. Uso: node scripts/osv-ignores.mjs [osv-scanner.toml]
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const MAX_DAYS = 90;
const DAY = 24 * 60 * 60 * 1000;

/** Errores de las excepciones del archivo; vacío si todas son válidas. */
export function checkIgnores(text, today = new Date()) {
  const errors = [];
  for (const block of text.split('[[IgnoredVulns]]').slice(1)) {
    const id = /^id\s*=\s*"([^"]*)"/m.exec(block)?.[1] ?? '(sin id)';
    const reason = /^reason\s*=\s*"([^"]*)"/m.exec(block)?.[1] ?? '';
    const until = /^ignoreUntil\s*=\s*(\S+)/m.exec(block)?.[1];
    if (reason.trim() === '') errors.push(`${id}: excepción sin motivo`);
    if (!until) {
      errors.push(`${id}: excepción sin ignoreUntil`);
      continue;
    }
    const days = (new Date(until).getTime() - today.getTime()) / DAY;
    if (Number.isNaN(days)) errors.push(`${id}: ignoreUntil no es una fecha (${until})`);
    else if (days < 0) errors.push(`${id}: la excepción caducó el ${until}; revisa el aviso`);
    else if (days > MAX_DAYS) errors.push(`${id}: ignoreUntil está a más de ${MAX_DAYS} días`);
  }
  return errors;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const errors = checkIgnores(readFileSync(process.argv[2] ?? 'osv-scanner.toml', 'utf8'));
  for (const error of errors) console.error(`::error::${error}`);
  process.exit(errors.length > 0 ? 1 : 0);
}
