// Pruebas de la configuración compartida con el ejecutor de pruebas de Node (sin compilar ni Jest).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { ESLint } from 'eslint';
import config from './eslint.config.js';

const eslint = new ESLint({
  cwd: import.meta.dirname,
  overrideConfigFile: true,
  overrideConfig: [
    ...config,
    // Permite revisar un archivo .ts en memoria sin un tsconfig propio.
    {
      languageOptions: {
        parserOptions: {
          projectService: { allowDefaultProject: ['*.ts'] },
          tsconfigRootDir: import.meta.dirname,
        },
      },
    },
  ],
});

async function ruleIds(code) {
  const [result] = await eslint.lintText(code, { filePath: 'ejemplo.ts' });
  return result.messages.map((message) => message.ruleId);
}

test('ESLint rechaza any (regla «sin any» de CLAUDE.md)', async () => {
  const ids = await ruleIds('export const f = (x: any): unknown => x;\n');
  assert.ok(ids.includes('@typescript-eslint/no-explicit-any'), `reglas: ${ids.join(', ')}`);
});

test('ESLint permite descartar campos con desestructuración', async () => {
  const code = 'const o = { a: 1, b: 2 };\nconst { a: _, ...rest } = o;\nexport { rest };\n';
  assert.deepEqual(await ruleIds(code), []);
});

test('el tsconfig base es estricto', () => {
  const { compilerOptions } = JSON.parse(
    readFileSync(`${import.meta.dirname}/tsconfig.base.json`, 'utf8'),
  );
  for (const option of ['strict', 'noUncheckedIndexedAccess', 'exactOptionalPropertyTypes']) {
    assert.equal(compilerOptions[option], true, option);
  }
});
