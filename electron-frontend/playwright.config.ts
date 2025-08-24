import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for Electron app testing
 * Optimized for 2025 best practices with accessibility and performance testing
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './src/tests/e2e',
  
  // Global test timeout
  timeout: 30 * 1000,
  
  // Test execution settings
  expect: {
    timeout: 5 * 1000,
  },
  
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  
  // Enhanced reporter configuration for 2025
  reporter: [
    ['html', { outputDir: 'test-results/playwright-report', open: 'never' }],
    ['json', { outputFile: 'test-results/playwright-results.json' }],
    ['junit', { outputFile: 'test-results/playwright-results.xml' }],
    process.env.CI ? ['github'] : ['list'],
  ],
  
  /* Shared settings for all the projects below. */
  use: {
    /* Base URL updated to match vite.config.ts port */
    baseURL: 'http://localhost:3007',
    /* Collect trace when retrying the failed test. */
    trace: 'on-first-retry',
    /* Take screenshot on failure */
    screenshot: 'only-on-failure',
    /* Record video on failure */
    video: 'retain-on-failure',
    
    // Enhanced settings for Electron testing
    viewport: { width: 1400, height: 900 },
    ignoreHTTPSErrors: true,
    colorScheme: 'dark', // Test dark mode by default
  },

  /* Configure projects for Electron testing */
  projects: [
    // Primary Electron testing (renderer process)
    {
      name: 'electron-app',
      testMatch: '**/e2e/app-*.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        // Electron-specific viewport matching main.ts configuration
        viewport: { width: 1400, height: 900 },
        colorScheme: 'dark',
      },
    },

    // Accessibility testing project
    {
      name: 'accessibility',
      testMatch: '**/e2e/accessibility.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        colorScheme: 'light', // Test both themes
        // Enable accessibility testing features
        // reducedMotion: 'reduce', // Not supported in current Playwright version
      },
    },

    // Performance testing project
    {
      name: 'performance',
      testMatch: '**/e2e/performance.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        // Performance monitoring settings
        video: 'on', // Record for performance analysis
        trace: 'on',
      },
    },

    // Cross-platform testing (CI only)
    ...(process.env.CI ? [
      {
        name: 'electron-cross-platform',
        testMatch: '**/e2e/cross-platform.spec.ts',
        use: { ...devices['Desktop Chrome'] },
      },
    ] : []),
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'npm run dev:renderer',
    url: 'http://localhost:3007', // Updated to match vite.config.ts port
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },

  // Output directories
  outputDir: 'test-results/playwright-artifacts',
  
  // Global setup for advanced features
  globalSetup: process.env.NODE_ENV === 'test' ? './src/tests/e2e/global-setup.ts' : undefined,

  // Metadata for reporting
  metadata: {
    project: 'Universal AI Tools Electron Frontend',
    framework: 'Electron + React + TypeScript + Vitest',
    testing_approach: 'E2E + Accessibility + Performance',
    updated: '2025-01-24',
  },
});