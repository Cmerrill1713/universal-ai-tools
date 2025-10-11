import js from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import prettier from 'eslint-config-prettier';

export default [
  // Base JavaScript recommendations
  js.configs.recommended,
  
  // TypeScript files configuration
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: './tsconfig.json',
      },
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        global: 'readonly',
        NodeJS: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
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
      // TypeScript-specific rules
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-inferrable-types': 'error',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/consistent-type-imports': 'error',
      
      // General JavaScript rules
      'no-console': 'warn',
      'no-debugger': 'error',
      'no-unused-vars': 'off', // Disabled in favor of TypeScript version
      'prefer-const': 'error',
      'no-var': 'error',
      'object-shorthand': 'error',
      'prefer-arrow-callback': 'error',
      'prefer-template': 'error',
      'template-curly-spacing': 'error',
      'arrow-spacing': 'error',
      'comma-dangle': ['error', 'always-multiline'],
      'semi': ['error', 'always'],
      'quotes': ['error', 'single', { allowTemplateLiterals: true }],
      'indent': ['error', 2, { SwitchCase: 1 }],
      'max-len': ['warn', { code: 120, ignoreComments: true, ignoreStrings: true }],
      
      // Import rules
      'no-duplicate-imports': 'error',
      'sort-imports': ['error', { ignoreDeclarationSort: true }],
      
      // Code quality rules
      'complexity': ['warn', 15],
      'max-depth': ['warn', 4],
      'max-nested-callbacks': ['warn', 3],
      'max-params': ['warn', 5],
      'max-statements': ['warn', 25],
      'max-statements-per-line': ['error', { max: 1 }],
      'no-magic-numbers': ['warn', { ignore: [0, 1, -1], ignoreArrayIndexes: true }],
      'no-mixed-operators': 'error',
      'no-multi-assign': 'error',
      'no-nested-ternary': 'error',
      'no-unneeded-ternary': 'error',
      'no-useless-return': 'error',
      'prefer-object-spread': 'error',
      'prefer-destructuring': ['error', { object: true, array: false }],
      'prefer-rest-params': 'error',
      'prefer-spread': 'error',
      'radix': 'error',
      'yoda': 'error',
    },
  },
  
  // Test files configuration
  {
    files: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'src/tests/**/*.ts'],
    rules: {
      // Relax some rules for test files
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      'no-magic-numbers': 'off',
      'max-statements': 'off',
      'max-len': 'off',
    },
  },
  
  // Configuration files
  {
    files: ['*.config.js', '*.config.ts', 'scripts/**/*.js', 'scripts/**/*.ts'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  
  // Prettier compatibility (must be last)
  prettier,
  
  // Global ignores
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      'build/**',
      '*.d.ts',
      'ui/node_modules/**',
      'ui/dist/**',
      'ui/build/**',
      '.next/**',
      '.turbo/**',
      '.cache/**',
      '.temp/**',
      'temp/**',
      'tmp/**',
      'logs/**',
      '*.log',
      '.env*',
      '.DS_Store',
      'Thumbs.db',
      '.cursor/**',
      '.continue/**',
      '.vscode/**',
      '.idea/**',
      '*.swp',
      '*.swo',
      '*.tmp',
      '*.bak',
      '*.backup',
      '*.orig',
      '*.rej',
    ],
  },
];