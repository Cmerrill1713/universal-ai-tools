#!/usr/bin/env node

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🧪 Universal AI Tools - Integration Test Runner');
console.log('================================================');

// Check if required dependencies are installed
const requiredPackages = [
  'jest',
  'ts-jest',
  '@jest/globals',
  'puppeteer',
  '@supabase/supabase-js'
];

console.log('📦 Checking required packages...');
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
const installedPackages = {
  ...packageJson.dependencies,
  ...packageJson.devDependencies
};

const missingPackages = requiredPackages.filter(pkg => !installedPackages[pkg]);
if (missingPackages.length > 0) {
  console.error('❌ Missing required packages:', missingPackages.join(', '));
  console.log('💡 Please install missing packages with: npm install');
  process.exit(1);
}

console.log('✅ All required packages are installed');

// Check if TypeScript is compiled
const distPath = path.join(__dirname, '..', 'dist');
if (!fs.existsSync(distPath)) {
  console.log('📦 Compiling TypeScript...');
  exec('npm run build', (error, stdout, stderr) => {
    if (error) {
      console.error('❌ TypeScript compilation failed:', error);
      process.exit(1);
    }
    console.log('✅ TypeScript compiled successfully');
    runTests();
  });
} else {
  runTests();
}

function runTests() {
  console.log('🚀 Starting integration tests...');
  console.log('');
  
  // Create test reports directory
  const reportsDir = path.join(__dirname, '..', 'test-reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  
  // Run Jest with specific configuration for integration tests
  const jestCommand = [
    'npx jest',
    '--config=jest.config.js',
    '--testPathPattern=tests/browser/full-system-integration.test.ts',
    '--verbose',
    '--detectOpenHandles',
    '--forceExit',
    '--coverage',
    '--coverageDirectory=test-reports/coverage',
    '--maxWorkers=1',
    '--runInBand'
  ].join(' ');
  
  console.log('🔧 Command:', jestCommand);
  console.log('');
  
  const testProcess = exec(jestCommand, { 
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      NODE_ENV: 'test',
      LOG_LEVEL: 'info'
    }
  });
  
  testProcess.stdout.on('data', (data) => {
    process.stdout.write(data);
  });
  
  testProcess.stderr.on('data', (data) => {
    process.stderr.write(data);
  });
  
  testProcess.on('close', (code) => {
    console.log('');
    if (code === 0) {
      console.log('✅ All integration tests passed!');
      console.log('📊 Test reports generated in: test-reports/');
      console.log('🎉 System integration verification complete!');
    } else {
      console.error('❌ Some integration tests failed');
      console.log('📊 Check test reports in: test-reports/');
      console.log('🔍 Review the test output above for details');
    }
    process.exit(code);
  });
}

// Handle script termination
process.on('SIGINT', () => {
  console.log('\n🛑 Integration tests interrupted by user');
  process.exit(130);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Integration tests terminated');
  process.exit(143);
});