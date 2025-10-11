import { defineConfig } from '@playwright/test';

/**
 * Playwright MCP Configuration for Native macOS SwiftUI App
 * Tests the UniversalAIToolsMac native macOS application
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false, // Native apps should be tested sequentially
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker for native app testing
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/macos-native-results.json' }],
    ['junit', { outputFile: 'test-results/macos-native-results.xml' }],
  ],

  use: {
    // Native macOS app settings
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',

    // macOS specific settings
    viewport: { width: 1200, height: 800 }, // Default app size
    ignoreHTTPSErrors: true,

    // Enhanced debugging for native apps
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },

  projects: [
    {
      name: 'macos-native-app',
      use: {
        // Native macOS app testing
        launchOptions: {
          // Launch the native macOS app
          executablePath:
            '/Applications/UniversalAIToolsMac.app/Contents/MacOS/UniversalAIToolsMac',
          args: ['--test-mode'],
        },
        // macOS specific settings
        headless: false, // Native apps need to be visible
        slowMo: 1000, // Slow down for better visibility
      },
    },

    {
      name: 'macos-simulator',
      use: {
        // iOS Simulator testing (if available)
        launchOptions: {
          executablePath:
            '/Applications/Xcode.app/Contents/Developer/Applications/Simulator.app/Contents/MacOS/Simulator',
        },
        headless: false,
      },
    },
  ],

  // Global setup for native app testing
  globalSetup: require.resolve('./tests/macos-native-setup.ts'),
  globalTeardown: require.resolve('./tests/macos-native-teardown.ts'),

  // Test output directory
  outputDir: 'test-results/macos-native/',

  // Timeout settings for native apps
  timeout: 60000, // Longer timeout for native apps
  expect: {
    timeout: 15000,
  },

  // Test organization
  testMatch: [
    '**/macos-native-tests.spec.ts',
    '**/swiftui-tests.spec.ts',
    '**/macos-integration-tests.spec.ts',
  ],

  // Environment variables for native app testing
  use: {
    // Native app environment
    extraHTTPHeaders: {
      'X-Native-App': 'true',
      'X-Test-Mode': 'playwright-mcp-native',
    },
  },
});
