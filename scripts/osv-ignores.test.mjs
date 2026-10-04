// Pruebas de la verificación de excepciones de osv-scanner (T-043): node --test scripts/
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkIgnores } from './osv-ignores.mjs';

const today = new Date('2026-10-04T00:00:00Z');
const entry = (until, reason = 'Solo en herramientas de desarrollo; sin parche publicado.') =>
  `[[IgnoredVulns]]\nid = "GHSA-xxxx-yyyy-zzzz"\nignoreUntil = ${until}\nreason = "${reason}"\n`;

test('T-043 una excepción con motivo y fecha dentro de 90 días es válida', () => {
  assert.deepEqual(checkIgnores(entry('2026-12-31T00:00:00Z'), today), []);
  assert.deepEqual(checkIgnores(entry('2027-01-02T00:00:00Z'), today), []);
});

test('T-043 una excepción con más de 90 días por delante se rechaza', () => {
  assert.match(checkIgnores(entry('2027-01-03T00:00:00Z'), today).join(), /más de 90 días/);
});

test('T-043 una excepción caducada avisa en el CI', () => {
  assert.match(checkIgnores(entry('2026-10-03T00:00:00Z'), today).join(), /caducó/);
});

test('T-043 una excepción sin motivo o sin fecha se rechaza', () => {
  assert.match(checkIgnores(entry('2026-12-31T00:00:00Z', ''), today).join(), /sin motivo/);
  const sinFecha = '[[IgnoredVulns]]\nid = "GHSA-xxxx-yyyy-zzzz"\nreason = "algo"\n';
  assert.match(checkIgnores(sinFecha, today).join(), /sin ignoreUntil/);
});
