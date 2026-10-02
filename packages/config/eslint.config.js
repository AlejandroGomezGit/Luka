// Configuración compartida de ESLint. Cada paquete la reexporta en su eslint.config.js.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/', 'coverage/'] },
  js.configs.recommended,
  // strictTypeChecked incluye no-explicit-any como error (regla «sin any» de CLAUDE.md).
  tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true },
    },
    rules: {
      // Permite descartar campos con desestructuración: const { a: _, ...resto } = objeto.
      '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true }],
    },
  },
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    extends: [tseslint.configs.disableTypeChecked],
  },
);
