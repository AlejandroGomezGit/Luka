import config from '@luka/config/eslint';

export default [
  ...config,
  {
    rules: {
      // Los módulos de NestJS son clases vacías con decoradores.
      '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
    },
  },
];
