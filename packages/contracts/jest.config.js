/** @type {import('jest').Config} */
export default {
  testEnvironment: 'node',
  transform: { '^.+\\.ts$': '@swc/jest' },
  // Los imports de NodeNext llevan .js; en las pruebas apuntan al .ts.
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.test.ts', '!src/index.ts'],
  coverageThreshold: { global: { branches: 80, functions: 80, lines: 80, statements: 80 } },
};
