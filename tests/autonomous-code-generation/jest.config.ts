/**
 * Jest Configuration for Autonomous Code Generation Tests
 * Specialized configuration for comprehensive testing of the autonomous coding system
 */

import type { Config } from 'jest';
import baseConfig from '../../jest.config';

const config: Config = {
  ...baseConfig,
  displayName: 'Autonomous Code Generation Tests',
  testMatch: [
    '<rootDir>/tests/autonomous-code-generation/**/*.test.ts',
    '<rootDir>/tests/autonomous-code-generation/**/*.spec.ts'
  ],
  collectCoverageFrom: [
    'src/services/autonomous-code-service.ts',
    'src/services/code-analysis-service.ts',
    'src/services/security-scanning-service.ts',
    'src/services/code-quality-service.ts',
    'src/services/repository-indexing-service.ts',
    'src/routers/code-generation.ts',
    'src/agents/specialized/enhanced-code-assistant-agent.ts',
    'src/utils/ast-parser.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 85,
      lines: 90,
      statements: 90,
    },
    // Specific thresholds for critical services
    'src/services/autonomous-code-service.ts': {
      branches: 85,
      functions: 90,
      lines: 95,
      statements: 95
    },
    'src/services/security-scanning-service.ts': {
      branches: 90,
      functions: 90,
      lines: 95,
      statements: 95
    }
  },
  setupFilesAfterEnv: [
    '<rootDir>/tests/autonomous-code-generation/fixtures/test-setup.ts'
  ],
  testEnvironment: 'node',
  verbose: true,
  // Extended timeout for comprehensive tests
  testTimeout: 30000,
  // Additional Jest configuration for autonomous code generation
  globals: {
    'ts-jest': {
      tsConfig: {
        compilerOptions: {
          // Allow dynamic imports for test fixtures
          module: 'ESNext',
          target: 'ES2020'
        }
      }
    }
  },
  // Custom reporters for detailed test reporting
  reporters: [
    'default',
    [
      'jest-html-reporter',
      {
        pageTitle: 'Autonomous Code Generation Test Report',
        outputPath: '<rootDir>/test-reports/autonomous-code-generation.html',
        includeFailureMsg: true,
        includeSuiteFailure: true,
        includeConsoleLog: true
      }
    ],
    [
      'jest-junit',
      {
        outputDirectory: '<rootDir>/test-reports/',
        outputName: 'autonomous-code-generation-junit.xml',
        suiteName: 'Autonomous Code Generation Tests'
      }
    ]
  ],
  // Performance monitoring
  slowTestThreshold: 10, // Tests slower than 10s are flagged
  // Module name mapping for test utilities
  moduleNameMapping: {
    '^@test/(.*)$': '<rootDir>/tests/autonomous-code-generation/fixtures/$1'
  }
};

export default config;