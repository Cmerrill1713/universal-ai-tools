#\!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 Universal AI Tools - Autofix Demo\n');

// Function to fix common issues in a file
function autofix(filePath) {
  if (\!fs.existsSync(filePath)) {
    console.log(`⚠️  File not found: ${filePath}`);
    return 0;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  let fixes = 0;
  
  // Fix 1: Missing radix in parseInt
  const parseIntRegex = /parseInt\(([^,)]+)\)/g;
  const matches = content.match(parseIntRegex);
  if (matches) {
    content = content.replace(parseIntRegex, (match, p1) => {
      fixes++;
      return `parseInt(${p1}, 10)`;
    });
  }
  
  if (fixes > 0) {
    // Don't actually write for demo, just show what would be fixed
    console.log(`✅ Would fix ${fixes} parseInt issues in ${path.relative(process.cwd(), filePath)}`);
  } else {
    console.log(`✨ No parseInt issues found in ${path.relative(process.cwd(), filePath)}`);
  }
  
  return fixes;
}

// Demo on a few files
const demoFiles = [
  'src/utils/smart-port-manager.ts',
  'src/services/ollama_service.ts',
  'src/server.ts'
];

let totalFixes = 0;
demoFiles.forEach(file => {
  totalFixes += autofix(file);
});

console.log(`\n🎉 Demo complete\! Would fix ${totalFixes} parseInt issues`);
console.log('\n📋 Available Autofix Commands:');
console.log('• npm run lint:fix         - ESLint autofix (WORKING)');
console.log('• npm run format          - Prettier formatting (WORKING)');
console.log('• npm run fix:all         - Combined autofix + type check (WORKING)');
console.log('• ./scripts/smart-autofix.sh - Advanced fixes (EXPERIMENTAL)');
console.log('• node scripts/demo-autofix.cjs - This demo');
