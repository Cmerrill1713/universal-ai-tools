#!/usr/bin/env node

/**
 * Full System Integration Test Runner
 *
 * This script runs the comprehensive integration test that demonstrates
 * the complete Universal AI Tools system working together.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Universal AI Tools - Full System Integration Test');
console.log('===================================================');
console.log();

// Check if we're in the right directory
const packagePath = path.join(__dirname, 'package.json');
if (!fs.existsSync(packagePath)) {
  console.error('❌ Error: package.json not found. Please run this script from the project root.');
  process.exit(1);
}

// Check if the test file exists
const testFile = path.join(__dirname, 'tests', 'browser', 'full-system-integration.test.ts');
if (!fs.existsSync(testFile)) {
  console.error('❌ Error: Integration test file not found at:', testFile);
  process.exit(1);
}

console.log('📋 Test Configuration:');
console.log('  • Test File: tests/browser/full-system-integration.test.ts');
console.log('  • Environment: test');
console.log('  • Browser: Chromium (Puppeteer)');
console.log('  • Components: KnowledgeManager, IntelligentExtractor, OnlineResearchAgent');
console.log('  • Test Scenario: TypeScript import error resolution');
console.log();

// Set up test environment
const testEnv = {
  ...process.env,
  NODE_ENV: 'test',
  LOG_LEVEL: 'info',
  CI: process.env.CI || 'false',
};

// Don't require real services for the integration test
if (!testEnv.SUPABASE_URL) {
  console.log('💡 Note: Using mock Supabase configuration (no real database needed)');
  testEnv.SUPABASE_URL = 'http://localhost:54321';
  testEnv.SUPABASE_SERVICE_KEY = 'test-key';
}

if (!testEnv.SEARXNG_URL) {
  console.log('💡 Note: Using mock SearXNG configuration (no real search engine needed)');
  testEnv.SEARXNG_URL = 'http://localhost:8080';
}

console.log();
console.log('🎯 Starting integration test...');
console.log('   This test will demonstrate:');
console.log('   ✓ Online research with SearXNG integration');
console.log('   ✓ Intelligent content extraction');
console.log('   ✓ Knowledge management and storage');
console.log('   ✓ Multi-agent coordination');
console.log('   ✓ Browser automation tasks');
console.log('   ✓ System learning and evolution');
console.log('   ✓ Error handling and recovery');
console.log();

// Run the test
const jestArgs = [
  'npx',
  'jest',
  'tests/browser/full-system-integration.test.ts',
  '--verbose',
  '--maxWorkers=1',
  '--testTimeout=300000',
  '--detectOpenHandles',
  '--forceExit',
];

console.log('🔧 Running command:', jestArgs.join(' '));
console.log();

const testProcess = spawn(jestArgs[0], jestArgs.slice(1), {
  stdio: 'inherit',
  env: testEnv,
  cwd: __dirname,
});

testProcess.on('close', (code) => {
  console.log();
  console.log('================================================');

  if (code === 0) {
    console.log('🎉 Full System Integration Test PASSED!');
    console.log();
    console.log('✅ The system successfully demonstrated:');
    console.log('   • End-to-end TypeScript error resolution');
    console.log('   • Online research and content extraction');
    console.log('   • Knowledge management and learning');
    console.log('   • Multi-agent coordination');
    console.log('   • Browser automation and validation');
    console.log('   • Error handling and recovery');
    console.log();
    console.log('🚀 The Universal AI Tools system is working correctly!');
  } else {
    console.log('❌ Full System Integration Test FAILED');
    console.log();
    console.log('🔍 Possible issues:');
    console.log('   • Missing dependencies (run: npm install)');
    console.log('   • TypeScript compilation errors (run: npm run build)');
    console.log('   • Browser launch issues (check Chrome/Chromium)');
    console.log('   • Network connectivity problems');
    console.log('   • Memory or resource constraints');
    console.log();
    console.log('📚 See tests/browser/README.md for troubleshooting help');
  }

  console.log('================================================');
  process.exit(code);
});

// Handle interruption
process.on('SIGINT', () => {
  console.log();
  console.log('🛑 Test interrupted by user');
  testProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log();
  console.log('🛑 Test terminated');
  testProcess.kill('SIGTERM');
});
