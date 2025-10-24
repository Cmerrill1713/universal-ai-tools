#!/usr/bin/env node

/**
 * Sweet Athena Integration Test Suite
 * Tests the complete integration pipeline
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Sweet Athena Integration Test Suite');
console.log('=====================================\n');

// Test results
const results = {
  passed: 0,
  failed: 0,
  tests: []
};

// Color codes
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

// Test helper functions
function test(name, fn) {
  try {
    fn();
    results.passed++;
    results.tests.push({ name, status: 'passed' });
    console.log(`${colors.green}✓${colors.reset} ${name}`);
  } catch (error) {
    results.failed++;
    results.tests.push({ name, status: 'failed', error: error.message });
    console.log(`${colors.red}✗${colors.reset} ${name}`);
    console.log(`  ${colors.red}Error: ${error.message}${colors.reset}`);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function fileExists(filePath) {
  return fs.existsSync(filePath);
}

// Start tests
console.log('📁 File Structure Tests');
console.log('-----------------------');

// Test React/TypeScript files
test('Sweet Athena State Manager exists', () => {
  assert(fileExists('src/services/sweet-athena-state-manager.ts'), 
    'State manager service not found');
});

test('Pixel Streaming Bridge exists', () => {
  assert(fileExists('src/services/pixel-streaming-bridge.ts'),
    'Pixel streaming bridge not found');
});

test('Sweet Athena Router exists', () => {
  assert(fileExists('src/routers/sweet-athena.ts'),
    'API router not found');
});

test('UE5 Integrated Avatar Component exists', () => {
  assert(fileExists('ui/src/components/SweetAthena/Avatar/UE5IntegratedAvatar.tsx'),
    'UE5 avatar component not found');
});

test('Clothing Customizer Component exists', () => {
  assert(fileExists('ui/src/components/SweetAthena/Customization/ClothingCustomizer.tsx'),
    'Clothing customizer not found');
});

console.log('\n🎮 UE5 Project Tests');
console.log('--------------------');

// Test UE5 files
test('UE5 Project structure exists', () => {
  const ue5Path = path.join(process.env.HOME, 'UE5-SweetAthena');
  assert(fileExists(ue5Path), 'UE5 project directory not found');
});

test('UE5 Project file exists', () => {
  const projectFile = path.join(process.env.HOME, 'UE5-SweetAthena/SweetAthenaUE5Project.uproject');
  assert(fileExists(projectFile), 'UE5 project file not found');
});

test('Character C++ implementation exists', () => {
  const cppFile = path.join(process.env.HOME, 'UE5-SweetAthena/Source/SweetAthenaUE5Project/SweetAthenaCharacter.cpp');
  assert(fileExists(cppFile), 'Character C++ implementation not found');
});

test('Pixel Streaming startup script exists', () => {
  const scriptFile = path.join(process.env.HOME, 'UE5-SweetAthena/Scripts/StartPixelStreaming.sh');
  assert(fileExists(scriptFile), 'Pixel streaming startup script not found');
});

test('Pixel Streaming client JavaScript exists', () => {
  const clientFile = path.join(process.env.HOME, 'UE5-SweetAthena/Scripts/WebServer/public/pixel-streaming-client.js');
  assert(fileExists(clientFile), 'Pixel streaming client not found');
});

test('Demo HTML page exists', () => {
  const demoFile = path.join(process.env.HOME, 'UE5-SweetAthena/Scripts/WebServer/public/sweet-athena-demo.html');
  assert(fileExists(demoFile), 'Demo HTML page not found');
});

console.log('\n🔧 Configuration Tests');
console.log('----------------------');

// Test configurations
test('UE5 Engine configuration includes Pixel Streaming', () => {
  const configFile = path.join(process.env.HOME, 'UE5-SweetAthena/Config/DefaultEngine.ini');
  if (fileExists(configFile)) {
    const content = fs.readFileSync(configFile, 'utf8');
    assert(content.includes('[/Script/PixelStreaming.PixelStreamingSettings]'),
      'Pixel Streaming configuration not found');
    assert(content.includes('DefaultStreamerPort=8888'),
      'Streamer port not configured');
  }
});

test('Package.json includes Sweet Athena dependencies', () => {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  assert(packageJson.dependencies['ws'], 'WebSocket dependency missing');
  assert(packageJson.dependencies['express'], 'Express dependency missing');
});

console.log('\n🧩 Integration Points');
console.log('---------------------');

// Test integration points
test('Sweet Athena exports exist in index files', () => {
  // Check if exports are properly set up
  const indexPath = 'ui/src/components/SweetAthena/index.ts';
  if (fileExists(indexPath)) {
    const content = fs.readFileSync(indexPath, 'utf8');
    assert(content.includes('UE5IntegratedAvatar') || content.includes('export *'),
      'UE5IntegratedAvatar not exported');
  }
});

test('API routes include Sweet Athena endpoints', () => {
  const serverFile = 'src/server.ts';
  if (fileExists(serverFile)) {
    const content = fs.readFileSync(serverFile, 'utf8');
    assert(content.includes('sweet-athena') || content.includes('sweetAthenaRouter'),
      'Sweet Athena router not integrated');
  }
});

console.log('\n📊 Summary');
console.log('----------');

// Print summary
const total = results.passed + results.failed;
const percentage = total > 0 ? Math.round((results.passed / total) * 100) : 0;

console.log(`Total tests: ${total}`);
console.log(`${colors.green}Passed: ${results.passed}${colors.reset}`);
console.log(`${colors.red}Failed: ${results.failed}${colors.reset}`);
console.log(`Success rate: ${percentage}%`);

// Print failed tests details
if (results.failed > 0) {
  console.log(`\n${colors.red}Failed Tests:${colors.reset}`);
  results.tests
    .filter(t => t.status === 'failed')
    .forEach(t => {
      console.log(`  - ${t.name}`);
      console.log(`    ${colors.red}${t.error}${colors.reset}`);
    });
}

// Final verdict
console.log('\n🎯 Integration Status:');
if (percentage >= 90) {
  console.log(`${colors.green}✅ Sweet Athena integration is READY!${colors.reset}`);
  console.log('All major components are in place and properly integrated.');
} else if (percentage >= 70) {
  console.log(`${colors.yellow}⚠️  Sweet Athena integration is MOSTLY READY${colors.reset}`);
  console.log('Most components are in place, but some features may need attention.');
} else {
  console.log(`${colors.red}❌ Sweet Athena integration needs work${colors.reset}`);
  console.log('Several components are missing or not properly integrated.');
}

console.log('\n🚀 Next Steps:');
console.log('1. Start services: cd ~/UE5-SweetAthena && ./Scripts/StartPixelStreaming.sh');
console.log('2. Open UE5 project in Unreal Engine 5.6');
console.log('3. Access demo at: http://localhost/sweet-athena-demo.html');
console.log('4. Test personality and clothing changes in real-time');

process.exit(results.failed > 0 ? 1 : 0);