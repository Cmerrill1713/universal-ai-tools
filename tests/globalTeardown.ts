/**
 * Global Jest Teardown
 * Runs once after all test suites complete
 */

export default async function globalTeardown() {
  console.log('🧹 Cleaning up test environment...');

  // Add any global cleanup logic here
  // e.g., stop test databases, clean temp directories, etc.

  console.log('✅ Test environment cleaned up');
}
