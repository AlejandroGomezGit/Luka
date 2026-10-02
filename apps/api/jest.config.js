import base from '@luka/config/jest';

const swc = {
  jsc: {
    target: 'es2022',
    parser: { syntax: 'typescript', decorators: true },
    // NestJS necesita los metadatos de tipos de los decoradores para inyectar dependencias.
    transform: { legacyDecorator: true, decoratorMetadata: true },
  },
};

/** @type {import('jest').Config} */
export default {
  ...base,
  // Los paquetes de NestJS 12 son ESM: Jest corre en modo ESM nativo.
  extensionsToTreatAsEsm: ['.ts'],
  transform: { '^.+\\.[jt]s$': ['@swc/jest', swc] },
  // Las pruebas de integración descargan e inician contenedores.
  testTimeout: 120_000,
};
