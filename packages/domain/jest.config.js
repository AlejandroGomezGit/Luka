import base from '@luka/config/jest';

/** @type {import('jest').Config} */
export default {
  ...base,
  // RNF-11: cobertura de 80 % o más en el dominio.
  coverageThreshold: { global: { branches: 80, functions: 80, lines: 80, statements: 80 } },
};
