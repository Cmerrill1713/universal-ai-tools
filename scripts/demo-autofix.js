#\!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 Universal AI Tools - Autofix Demo\n');

// Function to fix common issues in a file
function autofix(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let fixes = 0;
  
  // Fix 1: Missing radix in parseInt
  const parseIntRegex = /parseInt\(([^,)]+)\)/g;
  const newContent1 = content.replace(parseIntRegex, (match, p1) => {
    fixes++;
    return `parseInt(${p1}, 10)`;
  });
  
  // Fix 2: Comment out console statements (except in test files)
  let newContent2 = newContent1;
  if (\!filePath.includes('test') && \!filePath.includes('debug')) {
    newContent2 = newContent1.replace(/^(\s*)console\.(log|error|warn|info)\(/gm, '$1// console.$2(');
    if (newContent2 \!== newContent1) fixes++;
  }
  
  // Fix 3: Add explicit return types for simple functions
  const newContent3 = newContent2.replace(/(\w+)\s*\(\s*\)\s*{(\s*return\s+[^;]+;?\s*)}/g, 
    (match, funcName, returnStmt) => {
      fixes++;
      return `${funcName}(): any {${returnStmt}}`;
    });
  
  if (newContent3 \!== content) {
    fs.writeFileSync(filePath, newContent3);
    console.log(`✅ Fixed ${fixes} issues in ${path.relative(process.cwd(), filePath)}`);
  }
  
  return fixes;
}

// Demo on a few files
const demoFiles = [
  'src/utils/smart-port-manager.ts',
  'src/services/ollama_service.ts'
].filter(file => fs.existsSync(file));

let totalFixes = 0;
demoFiles.forEach(file => {
  totalFixes += autofix(file);
});

console.log(`\n🎉 Demo complete\! Fixed ${totalFixes} issues across ${demoFiles.length} files`);
console.log('\n📋 Available Autofix Commands:');
console.log('• npm run lint:fix         - ESLint autofix');
console.log('• npm run format          - Prettier formatting');
console.log('• npm run fix:all         - Combined autofix + type check');
console.log('• ./scripts/smart-autofix.sh - Advanced fixes');
console.log('• node scripts/demo-autofix.js - This demo');
