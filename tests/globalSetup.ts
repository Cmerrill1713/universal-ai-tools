/**
 * Global Jest Setup
 * Runs once before all test suites
 */

export default async function globalSetup() {
  console.log('🧪 Setting up test environment...');

  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error';
  process.env.SUPPRESS_NO_CONFIG_WARNING = 'true';
  
  // Memory optimization environment variables
  process.env.NODE_OPTIONS = '--max-old-space-size=512 --max-semi-space-size=32';
  
  // Disable resource-intensive features during testing
  process.env.DISABLE_HEAVY_SERVICES = 'true';
  process.env.SKIP_STARTUP_CONTEXT = 'true';
  process.env.ENABLE_CONTEXT_MIDDLEWARE = 'false';
  process.env.DISABLE_MONITORING = 'true';
  process.env.DISABLE_HEALTH_CHECKS = 'true';
  process.env.DISABLE_TIMERS = 'true';
  process.env.DISABLE_BACKGROUND_SERVICES = 'true';

  // Database and external service mocking
  process.env.USE_MOCK_SERVICES = 'true';
  process.env.MOCK_DATABASE = 'true';
  process.env.MOCK_REDIS = 'true';
  process.env.MOCK_NEO4J = 'true';

  // Clean up any existing test artifacts
  try {
    const fs = await import('fs');
    const path = await import('path');
    const testArtifactsDir = path.join(process.cwd(), '.jest-cache');
    if (fs.existsSync(testArtifactsDir)) {
      fs.rmSync(testArtifactsDir, { recursive: true, force: true });
    }
  } catch (error) {
    // Ignore cleanup errors
  }

  console.log('✅ Test environment ready');
}
