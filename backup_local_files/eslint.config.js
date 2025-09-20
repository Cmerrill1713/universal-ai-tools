import js from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';

export default [
  js.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
      },
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
    },
    rules: {
      // TypeScript specific rules
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      'no-unused-vars': 'off', // Turn off base rule as it can report incorrect errors

      // General code quality
      'no-magic-numbers': ['warn', { ignore: [0, 1, -1] }],
      'max-statements': ['warn', { max: 25 }],
      
      // Formatting rules
      'prettier/prettier': 'off', // Disable prettier conflicts
      'max-len': ['warn', { code: 100, ignoreUrls: true }],
      'comma-dangle': ['warn', 'always-multiline'],
      'object-curly-spacing': ['warn', 'always'],
      'array-bracket-spacing': ['warn', 'never'],
      'indent': ['warn', 2],
      'quotes': ['warn', 'single'],
      'semi': ['warn', 'always'],
    },
  },
];
