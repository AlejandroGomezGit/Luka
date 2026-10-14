// Comprobación de versiones del SDK de Expo (T-048). expo-doctor exige el último parche publicado, pero
// pnpm no instala una versión hasta que cumple minimumReleaseAge. Aquí se exige el parche más nuevo que
// ya cumplió esa espera: un desfase real falla; un parche demasiado reciente solo se avisa.
// Uso (desde la raíz): node scripts/expo-versions.mjs
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REGISTRY = 'https://registry.npmjs.org';
const TIMEOUT_MS = 10_000;
const ATTEMPTS = 2;

/** La espera de pnpm, en minutos, tal como está en pnpm-workspace.yaml: una sola fuente. */
export function minimumReleaseAgeMinutes(workspaceYaml) {
  const match = /^minimumReleaseAge:\s*(\d+)\s*$/m.exec(workspaceYaml);
  if (!match) throw new Error('pnpm-workspace.yaml no declara minimumReleaseAge');
  return Number(match[1]);
}

/** [mayor, menor, parche] de una versión estable; null si no lo es (rangos, canary, workspace:*). */
const parse = (version) => {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  return match ? match.slice(1).map(Number) : null;
};

/**
 * Fechas de publicación de un paquete. Solo lee los metadatos del registro (nunca descarga ni ejecuta
 * el paquete), con tiempo límite y un reintento.
 */
export async function publishTimes(name, fetchImpl = fetch) {
  const url = `${REGISTRY}/${name.replace('/', '%2F')}`;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      const response = await fetchImpl(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!response.ok) throw new Error(`HTTP ${String(response.status)}`);
      const { time } = await response.json();
      if (time && typeof time === 'object') return time;
      throw new Error('sin fechas');
    } catch {
      // Se reintenta una vez; si vuelve a fallar, se informa abajo.
    }
  }
  throw new Error(
    `No se pudo leer el registro de npm para ${name} tras ${String(ATTEMPTS)} intentos; sin fechas de publicación no se puede saber si el desfase es real.`,
  );
}

/**
 * Decide cada desfase que reporta `expo install --check --json`. `times` es { paquete: fechas }.
 * Falla si existe una versión de la misma línea (X.Y) con la espera cumplida y la instalada es menor.
 */
export function evaluate(mismatches, times, now, minAgeMs) {
  const failures = [];
  const notices = [];
  for (const { packageName: name, expectedVersionOrRange: range, actualVersion } of mismatches) {
    const expected = parse(range.replace(/^~/, ''));
    const actual = parse(actualVersion);
    const published = times[name];
    if (!expected) {
      failures.push(`${name}: no entiendo el rango esperado «${range}» (solo ~X.Y.Z).`);
    } else if (!actual) {
      failures.push(`${name}: no entiendo la versión instalada «${actualVersion}».`);
    } else if (!published?.[expected.join('.')]) {
      failures.push(
        `${name}: no hay fecha de publicación de ${expected.join('.')}; no se puede saber si el desfase es real.`,
      );
    } else {
      // El parche más nuevo de esa línea que ya cumplió la espera.
      const mature = Object.keys(published)
        .map((version) => ({ version, parts: parse(version) }))
        .filter(
          ({ version, parts }) =>
            parts &&
            parts[0] === expected[0] &&
            parts[1] === expected[1] &&
            now.getTime() - new Date(published[version]).getTime() >= minAgeMs,
        )
        .sort((a, b) => b.parts[2] - a.parts[2])[0];
      if (mature && mature.parts[2] > actual[2]) {
        failures.push(
          `${name}: instalada ${actualVersion}; instala ${mature.version} (publicada el ${published[mature.version]}).`,
        );
      } else {
        const due = new Date(new Date(published[expected.join('.')]).getTime() + minAgeMs);
        notices.push(
          `${name}: ${expected.join('.')} aún no cumple la espera de pnpm; se exigirá desde ${due.toISOString()}.`,
        );
      }
    }
  }
  return { failures, notices };
}

/** Los desfases según la CLI de Expo ya instalada en el proyecto; sale con 1 cuando hay alguno. */
function expoMismatches(mobileDir) {
  let output;
  try {
    output = execFileSync('npx', ['expo', 'install', '--check', '--json'], {
      cwd: mobileDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch (error) {
    output = error.stdout;
  }
  return JSON.parse(output).dependencies ?? [];
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const root = new URL('..', import.meta.url);
  const minutes = minimumReleaseAgeMinutes(
    readFileSync(new URL('pnpm-workspace.yaml', root), 'utf8'),
  );
  const mismatches = expoMismatches(fileURLToPath(new URL('apps/mobile', root)));
  const times = {};
  const failures = [];
  for (const name of new Set(mismatches.map((item) => item.packageName))) {
    try {
      times[name] = await publishTimes(name);
    } catch (error) {
      failures.push(error.message);
    }
  }
  const result = evaluate(
    mismatches.filter((item) => times[item.packageName]),
    times,
    new Date(),
    minutes * 60_000,
  );
  for (const notice of result.notices) console.log(`Aviso: ${notice}`);
  for (const failure of [...failures, ...result.failures]) console.error(`::error::${failure}`);
  if (failures.length + result.failures.length) process.exit(1);
  console.log(`Versiones del SDK de Expo al día (espera de pnpm: ${String(minutes)} min).`);
}
