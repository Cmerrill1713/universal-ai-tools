/** @type {import('jest').Config} */
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      useESM: true,
    }],
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  testMatch: [
    '**/src/**/*.test.ts',
    '**/tests/**/*.test.ts',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/tests/dspy/e2e/',
    '/tests/browser/',
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  globalSetup: '<rootDir>/tests/globalSetup.ts',
  globalTeardown: '<rootDir>/tests/globalTeardown.ts',
  verbose: true,
  maxWorkers: 1,
  testTimeout: 30000,
};