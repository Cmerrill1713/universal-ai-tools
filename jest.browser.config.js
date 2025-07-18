module.exports = {
  displayName: 'Browser Tests',
  testEnvironment: 'node',
  testMatch: ['**/tests/browser/**/*.test.ts'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/',
    '/ui/node_modules/',
    '/ui/dist/',
    '/ui/build/'
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest'
  },
  collectCoverageFrom: [
    'tests/browser/**/*.ts',
    '!tests/browser/**/*.d.ts',
    '!tests/browser/**/*.test.ts'
  ],
  coverageDirectory: 'coverage/browser',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/tests/browser/setup.ts'],
  testTimeout: 60000, // 60 seconds for browser tests
  maxWorkers: 1, // Run browser tests sequentially to avoid conflicts
  verbose: true,
  detectOpenHandles: true,
  forceExit: true
};