// Pruebas de la comprobación de dependencias de la app (T-047): node --test scripts/*.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { appClosure, compareClosures } from './app-lock-closure.mjs';

/** Lockfile mínimo con el formato de pnpm 12: dos documentos YAML, el segundo con las dependencias. */
const lock = ({ expo = '1.0.0', jest = '29.0.0', apiDeps = '', extraSnapshots = '' } = {}) => `---
lockfileVersion: '9.0'
importers:
  .:
    dependencies:
      pnpm:
        specifier: 12.8.1
        version: 12.8.1
---
lockfileVersion: '9.0'

importers:

  apps/api:
    dependencies:
      '@luka/contracts':
        specifier: workspace:*
        version: link:../../packages/contracts${apiDeps}

  apps/mobile:
    dependencies:
      '@luka/domain':
        specifier: workspace:*
        version: link:../../packages/domain
      expo:
        specifier: ~1.0.0
        version: ${expo}

packages:

  expo@1.0.0:
    resolution: {integrity: sha512-x}

snapshots:

  expo@${expo}:
    dependencies:
      react: 19.0.0
      '@testing-library/react-native': 14.0.0(jest@${jest})

  react@19.0.0: {}

  '@testing-library/react-native@14.0.0(jest@29.0.0)':
    dependencies:
      jest: 29.0.0

  '@testing-library/react-native@14.0.0(jest@30.0.0)':
    dependencies:
      jest: 30.0.0

  jest@29.0.0: {}

  jest@30.0.0: {}
${extraSnapshots}`;

test('T-047 recorre lo que alcanza apps/mobile en el segundo documento, sin enlaces del workspace', () => {
  assert.deepEqual([...appClosure(lock())].sort(), [
    '@testing-library/react-native@14.0.0(jest@29.0.0)',
    'expo@1.0.0',
    'jest@29.0.0',
    'react@19.0.0',
  ]);
});

test('T-047 una dependencia nueva de la API que no toca la app no da diferencias', () => {
  const api = `\n      jose:\n        specifier: ^6.0.0\n        version: 6.0.0`;
  const result = compareClosures(
    lock(),
    lock({ apiDeps: api, extraSnapshots: '\n  jose@6.0.0: {}\n' }),
  );
  assert.deepEqual(result, { added: [], removed: [], versionsAdded: [], versionsRemoved: [] });
});

test('T-047 si la app pasa a otra variante con jest 30, se informan las variantes y las versiones que cambian', () => {
  const result = compareClosures(lock(), lock({ expo: '1.0.0(x)', jest: '30.0.0' }));
  assert.deepEqual(result.versionsAdded, ['jest@30.0.0']);
  assert.deepEqual(result.versionsRemoved, ['jest@29.0.0']);
  assert.ok(result.added.includes('expo@1.0.0(x)'));
  assert.ok(result.removed.includes('expo@1.0.0'));
});
