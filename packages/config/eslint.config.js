// Configuración compartida de ESLint. Cada paquete la reexporta en su eslint.config.js.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/', 'coverage/', 'drizzle/'] },
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
      // Manejadores de React como onPress={() => setX(v)}: devuelven void y es claro.
      '@typescript-eslint/no-confusing-void-expression': ['error', { ignoreArrowShorthand: true }],
    },
  },
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    extends: [tseslint.configs.disableTypeChecked],
  },
);
