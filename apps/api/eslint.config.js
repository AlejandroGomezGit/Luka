import config from '@luka/config/eslint';

export default [
  ...config,
  {
    rules: {
      // Los módulos de NestJS son clases vacías con decoradores.
      '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
    },
  },
  {
    // AM-03: withUser (src/db) es la única puerta a PostgreSQL; nadie más abre un cliente crudo.
    files: ['src/**/*.ts'],
    ignores: ['src/db/**', 'src/**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { paths: [{ name: 'postgres', message: 'Usa Database.withUser de src/db (AM-03).' }] },
      ],
    },
  },
];
