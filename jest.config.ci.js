/** @type {import('jest').Config} */
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      useESM: true,
      isolatedModules: true, // Faster transpilation
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
    '/dist/',
    '/coverage/',
    '/electron-frontend/', // Skip electron tests
    '/rust-services/', // Skip rust tests
    '/analyze/', // Skip Python venv
    '/nari-dia-implementation/', // Skip Python projects
    '/.venv/', // Skip virtual environments
    '/venv/', // Skip virtual environments
  ],
  
  // Skip Python directories
  modulePathIgnorePatterns: [
    '<rootDir>/analyze/',
    '<rootDir>/nari-dia-implementation/',
    '<rootDir>/.venv/',
    '<rootDir>/venv/',
  ],
  
  // CI optimizations
  bail: 1, // Stop on first test failure
  maxWorkers: 1, // Single worker for CI
  testTimeout: 5000, // Short timeout for CI
  verbose: false, // Less output
  silent: true, // No console logs
  
  // Force exit and no open handles detection
  detectOpenHandles: false,
  detectLeaks: false,
  forceExit: true,
  
  // No coverage in CI pre-push
  collectCoverage: false,
  
  // Simple setup
  setupFilesAfterEnv: [],
  globalSetup: undefined,
  globalTeardown: undefined,
  
  // Performance
  cache: false,
  clearMocks: true,
  restoreMocks: true,
  resetMocks: true,
  
  // Minimal reporters
  reporters: [['default', { summaryOnly: true }]],
};