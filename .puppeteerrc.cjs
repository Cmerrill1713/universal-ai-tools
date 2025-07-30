/**
 * Puppeteer configuration
 * This file configures Puppeteer to skip browser downloads in CI environments
 * and use a custom cache directory for better control.
 */

module.exports = {
  // Skip downloading Chrome during install
  skipDownload: true,
  
  // Custom cache directory (relative to project root)
  cacheDirectory: '.cache/puppeteer',
  
  // Configuration for CI environments
  ...(process.env.CI && {
    // Additional CI-specific settings
    skipDownload: true,
    // Disable GPU hardware acceleration
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  }),
};