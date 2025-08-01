const config = {
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
    testTimeout: 60000,
    maxWorkers: '50%',
    globals: {
        'ts-jest': {
            tsconfig: {
                esModuleInterop: true,
                allowSyntheticDefaultImports: true,
            },
        },
    },
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
            testTimeout: 120000,
        },
        {
            displayName: 'performance',
            testMatch: ['<rootDir>/performance/**/*.test.ts'],
            testEnvironment: 'node',
            setupFilesAfterEnv: ['<rootDir>/setup.ts'],
            testTimeout: 300000,
        },
        {
            displayName: 'e2e',
            testMatch: ['<rootDir>/e2e/**/*.test.ts'],
            testEnvironment: 'node',
            setupFilesAfterEnv: ['<rootDir>/setup.ts'],
            testTimeout: 180000,
        },
    ],
};
export default config;
//# sourceMappingURL=jest.config.js.map