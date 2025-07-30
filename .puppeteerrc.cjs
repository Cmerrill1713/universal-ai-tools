/**
 * Puppeteer configuration file
 * This configuration prevents Puppeteer from downloading Chromium during npm install
 * which is causing issues in GitHub Actions workflows
 */

const { join } = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Skip downloading Chromium during install
  skipDownload: true,
  
  // Alternative: Use system Chrome if available
  // executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable',
  
  // Cache directory configuration (if we decide to enable downloads later)
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
  
  // Configuration for CI environments
  ...(process.env.CI && {
    skipDownload: true,
    // In CI, we might want to use a pre-installed Chrome
    executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome-stable'
  })
};