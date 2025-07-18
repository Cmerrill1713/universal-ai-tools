/** @type {import('jest').Config} */
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  globals: {
    'ts-jest': {
      useESM: true,
    },
  },
  moduleNameMapping: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      useESM: true,
    }],
  },
  testMatch: [
    '**/src/**/*.test.ts',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/tests/dspy/',
    '/tests/browser/',
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  verbose: true,
};