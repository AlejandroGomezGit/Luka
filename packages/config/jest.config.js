// Configuración compartida de Jest. Cada paquete la reexporta (o la extiende) en su jest.config.js.
/** @type {import('jest').Config} */
export default {
  testEnvironment: 'node',
  // También .js: los paquetes del monorepo se compilan a ESM y Jest corre en CommonJS.
  transform: { '^.+\\.[jt]s$': '@swc/jest' },
  // Los imports de NodeNext llevan .js; en las pruebas apuntan al .ts.
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.test.ts', '!src/index.ts'],
};
