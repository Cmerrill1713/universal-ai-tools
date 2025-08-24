/**
 * Jest Configuration for Integration Tests
 * Specialized configuration for testing distributed system integration
 */

const baseConfig = require('../jest.config.js');

module.exports = {
  ...baseConfig,
  
  // Test environment
  testEnvironment: 'node',
  
  // Integration test patterns
  testMatch: [
    '<rootDir>/tests/integration/**/*.test.ts',
    '<rootDir>/tests/integration/**/*.spec.ts',
  ],
  
  // Longer timeouts for integration tests
  testTimeout: 60000, // 60 seconds
  
  // Setup and teardown
  globalSetup: '<rootDir>/tests/setup/global-setup.ts',
  globalTeardown: '<rootDir>/tests/setup/global-teardown.ts',
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup/integration-setup.ts'
  ],
  
  // Coverage settings for integration tests
  collectCoverageFrom: [
    'src/services/**/*.ts',
    '!src/services/**/*.d.ts',
    '!src/services/**/*.test.ts',
    '!src/services/**/*.spec.ts',
  ],
  
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 70,
      lines: 70,
      statements: 70,
    },
    './src/services/service-orchestrator.ts': {
      branches: 80,
      functions: 90,
      lines: 85,
      statements: 85,
    },
    './src/services/hybrid-ai-service.ts': {
      branches: 75,
      functions: 85,
      lines: 80,
      statements: 80,
    },
  },
  
  // Module resolution
  moduleNameMapping: {
    ...baseConfig.moduleNameMapping,
  },
  
  // Transform configuration
  transform: {
    ...baseConfig.transform,
  },
  
  // Additional test environment variables
  testEnvironmentOptions: {
    NODE_ENV: 'test',
    LOG_LEVEL: 'warn',
    RUST_AI_CORE_URL: 'http://localhost:8003',
    GO_WEBSOCKET_URL: 'http://localhost:8080',
    TYPESCRIPT_BACKEND_URL: 'http://localhost:9999',
    INTEGRATION_TEST_MODE: 'true',
  },
  
  // Reporters
  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: 'test-reports/integration',
        outputName: 'integration-test-results.xml',
        classNameTemplate: '{classname}',
        titleTemplate: '{title}',
        ancestorSeparator: ' › ',
        usePathForSuiteName: true,
      },
    ],
    [
      'jest-html-reporters',
      {
        publicPath: 'test-reports/integration',
        filename: 'integration-test-report.html',
        pageTitle: 'Integration Test Report',
        logoImgPath: undefined,
        hideIcon: false,
      },
    ],
  ],
  
  // Silent mode for cleaner output during CI
  silent: process.env.CI === 'true',
  verbose: process.env.CI !== 'true',
  
  // Fail fast in CI environments
  bail: process.env.CI === 'true' ? 1 : 0,
  
  // Maximum workers for integration tests (resource intensive)
  maxWorkers: process.env.CI === 'true' ? 2 : '50%',
  
  // Custom test result processor
  testResultsProcessor: '<rootDir>/tests/utils/integration-results-processor.js',
};