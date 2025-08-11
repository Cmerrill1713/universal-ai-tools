// Minimal Flat config (CJS) to enable TS parsing and basic rules for ESLint v9
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');
const js = require('@eslint/js');

module.exports = [
  {
    ignores: [
      'dist/',
      'build/',
      'coverage/',
      'node_modules/',
      'ui/**',
      'archive/**',
      'backups/**',
      'claude-flow/**',
      'serena/**',
      'installer/**',
      'mcp-servers/**',
      'public/**',
      'examples/**',
      'venv/**',
      'worktrees/**',
      'temp/**',
      'uploads/**',
      'iOS Working App/**',
      'macOS-App/**',
      'Universal AI Tools Native/**',
      'src/components/ui-showcase/**',
      'src/tests/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: ['./tsconfig.eslint.json'],
      },
      globals: {
        fetch: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        Headers: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-duplicate-imports': 'error',
      eqeqeq: ['error', 'always'],
      curly: ['error', 'all'],
    },
  },
];
