#!/usr/bin/env node

/**
 * Test script to verify Puppeteer configuration
 * This helps ensure the skip download configuration is working correctly
 */

const path = require('path');
const fs = require('fs');

console.log('🔍 Testing Puppeteer Configuration...\n');

// Check for .puppeteerrc.cjs
const puppeteerRcPath = path.join(__dirname, '..', '.puppeteerrc.cjs');
if (fs.existsSync(puppeteerRcPath)) {
  console.log('✅ .puppeteerrc.cjs found');
  try {
    const config = require(puppeteerRcPath);
    console.log('   - Skip download:', config.skipDownload ? 'YES' : 'NO');
    console.log('   - Cache directory:', config.cacheDirectory || 'default');
  } catch (error) {
    console.error('❌ Error loading .puppeteerrc.cjs:', error.message);
  }
} else {
  console.log('❌ .puppeteerrc.cjs not found');
}

// Check for puppeteer.config.js
const puppeteerConfigPath = path.join(__dirname, '..', 'puppeteer.config.js');
if (fs.existsSync(puppeteerConfigPath)) {
  console.log('\n✅ puppeteer.config.js found');
} else {
  console.log('\n❌ puppeteer.config.js not found');
}

// Check if Puppeteer is installed
try {
  const puppeteerPackage = require('puppeteer/package.json');
  console.log('\n✅ Puppeteer version:', puppeteerPackage.version);
} catch (error) {
  console.log('\n❌ Puppeteer not found in node_modules');
}

// Check for Chromium binary
const chromiumPath = path.join(__dirname, '..', '.cache', 'puppeteer');
if (fs.existsSync(chromiumPath)) {
  console.log('\n✅ Puppeteer cache directory exists');
  const files = fs.readdirSync(chromiumPath);
  console.log('   - Files:', files.length > 0 ? files.join(', ') : 'empty');
} else {
  console.log('\n✅ Puppeteer cache directory does not exist (expected with skipDownload)');
}

console.log('\n✨ Configuration test complete');