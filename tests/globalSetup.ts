/**
 * Global Jest Setup
 * Runs once before all test suites
 */

export default async function globalSetup() {
  console.log('🧪 Setting up test environment...');

  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error';

  // Add any global setup logic here
  // e.g., start test databases, create temp directories, etc.

  console.log('✅ Test environment ready');
}
