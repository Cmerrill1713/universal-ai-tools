/**
 * Test Coverage Configuration
 * Defines coverage thresholds and reporting for achieving 80%+ coverage
 */

export const coverageConfig = {
  // Global coverage thresholds (80%+ requirement)
  global: {
    branches: 80,
    functions: 80,
    lines: 80,
    statements: 80,
  },

  // Enhanced thresholds for critical components (90%+)
  critical: {
    'src/middleware/': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
    'src/services/auth*.ts': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95,
    },
    'src/services/security*.ts': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95,
    },
    'src/middleware/security*.ts': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95,
    },
    'src/routers/': {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85,
    },
  },

  // Moderate thresholds for less critical components (70%+)
  moderate: {
    'src/agents/': {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
    'src/utils/': {
      branches: 75,
      functions: 75,
      lines: 75,
      statements: 75,
    },
  },

  // Files to exclude from coverage
  exclude: [
    'src/**/*.d.ts',
    'src/**/*.test.ts',
    'src/**/*.spec.ts',
    'src/tests/**/*',
    'src/cli/**/*',
    'src/setup/**/*',
    'src/**/index.ts',
    'dist/**/*',
    'node_modules/**/*',
    'coverage/**/*',
    '**/*.config.js',
    '**/*.config.ts',
  ],

  // Coverage reporters
  reporters: ['text', 'text-summary', 'html', 'lcov', 'json', 'clover', 'cobertura'],

  // Coverage directory
  directory: 'coverage',

  // Test patterns for different coverage levels
  testPatterns: {
    unit: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    integration: [
      'tests/api/**/*.test.ts',
      'tests/database/**/*.test.ts',
      'tests/integration/**/*.test.ts',
    ],
    security: ['tests/middleware/security.test.ts', 'tests/middleware/auth.test.ts'],
    performance: ['tests/performance/**/*.test.ts'],
  },

  // Quality gates
  qualityGates: {
    // Minimum coverage for deployment
    deployment: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },

    // Target coverage for production readiness
    production: {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85,
    },

    // Excellent coverage target
    excellent: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },

  // Coverage collection settings
  collection: {
    // Collect coverage from source files
    from: [
      'src/**/*.{ts,tsx}',
      '!src/**/*.d.ts',
      '!src/**/*.test.ts',
      '!src/**/*.spec.ts',
      '!src/tests/**',
      '!src/**/index.ts',
      '!src/cli/**',
      '!src/setup/**',
    ],

    // Force coverage collection for specific files
    forceCoverageMatch: [
      'src/middleware/**/*.ts',
      'src/services/auth*.ts',
      'src/services/security*.ts',
      'src/routers/**/*.ts',
    ],
  },

  // Coverage analysis settings
  analysis: {
    // Uncovered line threshold (lines that should be covered)
    uncoveredLineThreshold: 20,

    // Branch coverage threshold
    branchCoverageThreshold: 80,

    // Function coverage threshold
    functionCoverageThreshold: 80,

    // Statement coverage threshold
    statementCoverageThreshold: 80,
  },
};

export default coverageConfig;
