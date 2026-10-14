// Pruebas de la comprobación de versiones del SDK de Expo (T-048): node --test scripts/
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { evaluate, minimumReleaseAgeMinutes, publishTimes } from './expo-versions.mjs';

const workspace = readFileSync(new URL('../pnpm-workspace.yaml', import.meta.url), 'utf8');
const DAY = 24 * 60 * 60 * 1000;
const now = new Date('2026-10-13T00:30:00Z');
// El caso real del 2026-10-12: 57.0.27 lleva 6 días publicada y 57.0.28, 10 horas.
const times = {
  expo: {
    created: '2015-01-01T00:00:00.000Z',
    modified: '2026-10-12T14:29:00.000Z',
    '57.0.26': '2026-09-29T12:00:00.000Z',
    '57.0.27': '2026-10-06T12:10:00.000Z',
    '57.0.28': '2026-10-12T14:28:59.784Z',
    '57.0.29-canary-1': '2026-10-01T00:00:00.000Z',
    // Otra línea del SDK, con un parche más alto y antiguo: no se exige a quien está en 57.0.
    '58.0.99': '2026-10-01T00:00:00.000Z',
    '57.1.99': '2026-10-01T00:00:00.000Z',
  },
};
const mismatch = (actualVersion, expectedVersionOrRange = '~57.0.28') => [
  { packageName: 'expo', packageType: 'dependencies', expectedVersionOrRange, actualVersion },
];
const check = (mismatches, at = now, registry = times) => evaluate(mismatches, registry, at, DAY);

test('T-048 la espera sale de pnpm-workspace.yaml y es la que pnpm aplica de verdad', () => {
  const minutes = minimumReleaseAgeMinutes(workspace);
  const applied = execFileSync('pnpm', ['config', 'get', 'minimumReleaseAge'], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
  }).trim();
  assert.equal(String(minutes), applied);
  assert.throws(() => minimumReleaseAgeMinutes('packages:\n  - apps/*\n'), /minimumReleaseAge/);
});

test('T-048 con un desfase real falla y pide la versión exigible, no la que aún no se puede instalar', () => {
  const { failures, notices } = check(mismatch('57.0.26'));
  assert.equal(failures.length, 1);
  assert.match(failures[0], /expo.*57\.0\.26.*57\.0\.27/);
  assert.doesNotMatch(failures[0], /57\.0\.28|58\.0\.99|57\.1\.99|canary/);
  assert.deepEqual(notices, []);
});

test('T-048 si solo falta un parche con menos tiempo que la espera, pasa y lo avisa', () => {
  const { failures, notices } = check(mismatch('57.0.27'));
  assert.deepEqual(failures, []);
  assert.equal(notices.length, 1);
  assert.match(notices[0], /expo.*57\.0\.28.*2026-10-13T14:28:59/);
});

test('T-048 cuando ese parche cumple la espera, vuelve a fallar', () => {
  const later = new Date('2026-10-13T14:29:00Z');
  const { failures } = check(mismatch('57.0.27'), later);
  assert.match(failures.join(), /expo.*57\.0\.27.*57\.0\.28/);
});

test('T-048 sin fecha de publicación falla: no supone que la versión es reciente', () => {
  const { '57.0.28': _, ...withoutDate } = times.expo;
  assert.match(
    check(mismatch('57.0.27'), now, { expo: withoutDate }).failures.join(),
    /fecha de publicación/,
  );
  assert.match(check(mismatch('57.0.27'), now, {}).failures.join(), /fecha de publicación/);
});

test('T-048 un rango que no es ~X.Y.Z o una versión ilegible falla', () => {
  assert.match(check(mismatch('57.0.27', '>=57 <58')).failures.join(), /rango/);
  assert.match(check(mismatch('workspace:*')).failures.join(), /versión instalada/);
});

test('T-048 el registro de npm: solo metadatos, con tiempo límite y un reintento', async () => {
  const calls = [];
  const flaky = (url, init) => {
    calls.push({ url, signal: init.signal instanceof AbortSignal });
    return calls.length === 1
      ? Promise.reject(new Error('timeout'))
      : Promise.resolve(new Response(JSON.stringify({ time: times.expo })));
  };
  assert.deepEqual(await publishTimes('@expo/cli', flaky), times.expo);
  assert.deepEqual(calls, [
    { url: 'https://registry.npmjs.org/@expo%2Fcli', signal: true },
    { url: 'https://registry.npmjs.org/@expo%2Fcli', signal: true },
  ]);
});

test('T-048 si el registro sigue sin responder tras el reintento, falla con un mensaje claro', async () => {
  let attempts = 0;
  const down = () => {
    attempts++;
    return Promise.resolve(new Response('error', { status: 503 }));
  };
  await assert.rejects(publishTimes('expo', down), /registro de npm.*expo.*2 intentos/);
  assert.equal(attempts, 2);
});
