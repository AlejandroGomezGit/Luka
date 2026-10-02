import base from '@luka/config/jest';

/** @type {import('jest').Config} */
export default {
  ...base,
  // PGlite carga su WASM con import() dinámico, que Jest solo permite en modo ESM nativo.
  extensionsToTreatAsEsm: ['.ts'],
  // La primera instancia de PGlite compila su WASM: unos 25 s en los runners de CI.
  testTimeout: 60_000,
};
