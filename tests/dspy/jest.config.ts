import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/../../src/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/setup.ts'],
  collectCoverage: true,
  collectCoverageFrom: [
    '../../src/services/dspy-service.ts',
    '../../src/services/dspy-orchestrator/**/*.ts',
    '../../src/core/coordination/dspy-*.ts',
    '../../src/core/coordination/enhanced-dspy-*.ts',
    '../../src/core/knowledge/dspy-*.ts',
  ],
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  testTimeout: 60000, // 60 seconds for complex integration tests
  maxWorkers: '50%', // Use half of available CPU cores
  globals: {
    'ts-jest': {
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      },
    },
  },
  // Separate test suites by type
  projects: [
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/unit/**/*.test.ts'],
      testEnvironment: 'node',
      setupFilesAfterEnv: ['<rootDir>/setup.ts'],
    },
    {
      displayName: 'integration',
      testMatch: ['<rootDir>/integration/**/*.test.ts'],
      testEnvironment: 'node',
      setupFilesAfterEnv: ['<rootDir>/setup.ts'],
      testTimeout: 120000, // 2 minutes for integration tests
    },
    {
      displayName: 'performance',
      testMatch: ['<rootDir>/performance/**/*.test.ts'],
      testEnvironment: 'node',
      setupFilesAfterEnv: ['<rootDir>/setup.ts'],
      testTimeout: 300000, // 5 minutes for performance tests
    },
    {
      displayName: 'e2e',
      testMatch: ['<rootDir>/e2e/**/*.test.ts'],
      testEnvironment: 'node',
      setupFilesAfterEnv: ['<rootDir>/setup.ts'],
      testTimeout: 180000, // 3 minutes for E2E tests
    },
  ],
};

export default config;
