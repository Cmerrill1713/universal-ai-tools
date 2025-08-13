const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 Debugging Cursor TypeScript Errors for knowledge-monitoring.ts\n');

const kmPath = path.join(__dirname, '..', 'src', 'routers', 'knowledge-monitoring.ts');

// Test 1: Basic file compilation
console.log('1️⃣ Basic TypeScript Compilation:');
try {
  execSync(`npx tsc --noEmit ${kmPath}`, { encoding: 'utf8', cwd: path.join(__dirname, '..') });
  console.log('✅ Basic compilation: SUCCESS');
} catch (error) {
  const lines = error.stdout.split('\n').filter(line => line.includes('knowledge-monitoring.ts'));
  if (lines.length === 0) {
    console.log('✅ No knowledge-monitoring.ts specific errors in basic compilation');
  } else {
    console.log('❌ Basic compilation errors:');
    lines.forEach(line => console.log(`   ${line}`));
  }
}

// Test 2: Strict mode compilation
console.log('\n2️⃣ Strict Mode TypeScript Compilation:');
try {
  execSync(`npx tsc --noEmit --strict ${kmPath}`, { encoding: 'utf8', cwd: path.join(__dirname, '..') });
  console.log('✅ Strict mode compilation: SUCCESS');
} catch (error) {
  const lines = error.stdout.split('\n').filter(line => line.includes('knowledge-monitoring.ts'));
  if (lines.length === 0) {
    console.log('✅ No knowledge-monitoring.ts specific errors in strict mode');
  } else {
    console.log('❌ Strict mode compilation errors:');
    lines.forEach(line => console.log(`   ${line}`));
  }
}

// Test 3: ESLint check
console.log('\n3️⃣ ESLint Check:');
try {
  const result = execSync(`npx eslint ${kmPath} --format=compact`, { 
    encoding: 'utf8', 
    cwd: path.join(__dirname, '..') 
  });
  console.log('✅ ESLint: No errors');
} catch (error) {
  if (error.stdout.trim()) {
    console.log('❌ ESLint errors:');
    console.log(error.stdout);
  } else {
    console.log('✅ ESLint: No errors');
  }
}

// Test 4: Check for common Cursor/Pylance issues
console.log('\n4️⃣ Common Cursor Issues Check:');
const content = fs.readFileSync(kmPath, 'utf8');

// Check for async without await
const hasUnawaitedAsync = /async.*=>\s*{[^}]*(?<!await)[^}]*}/.test(content);
console.log(`   Unawaited async functions: ${hasUnawaitedAsync ? '⚠️' : '✅'}`);

// Check for unused imports
const imports = content.match(/^import.*from.*$/gm) || [];
const importedNames = [];
imports.forEach(imp => {
  const match = imp.match(/import\s+(?:{([^}]+)}|(\w+))/);
  if (match) {
    if (match[1]) {
      // Named imports
      importedNames.push(...match[1].split(',').map(n => n.trim()));
    } else if (match[2]) {
      // Default imports
      importedNames.push(match[2]);
    }
  }
});

const unusedImports = importedNames.filter(name => {
  const regex = new RegExp(`\\b${name}\\b`, 'g');
  const matches = content.match(regex) || [];
  return matches.length <= 1; // Only appears in import statement
});

console.log(`   Potentially unused imports: ${unusedImports.length > 0 ? unusedImports.join(', ') : 'None'}`);

// Check for any type assertions that might be problematic
const typeAssertions = content.match(/\s+as\s+\w+/g) || [];
console.log(`   Type assertions: ${typeAssertions.length} found`);

// Test 5: Check workspace TypeScript version
console.log('\n5️⃣ TypeScript Version Check:');
try {
  const version = execSync('npx tsc --version', { encoding: 'utf8', cwd: path.join(__dirname, '..') });
  console.log(`✅ Workspace TypeScript: ${version.trim()}`);
} catch (error) {
  console.log('❌ Could not get workspace TypeScript version');
}

console.log('\n📋 Summary:');
console.log('If Cursor still shows 2 errors, they might be:');
console.log('1. Cache-related (try restarting TS server)');
console.log('2. Related to Cursor-specific type checking');
console.log('3. Import resolution issues');
console.log('4. Extension conflicts');
console.log('\n🔧 Try these steps in Cursor:');
console.log('1. Cmd+Shift+P → "TypeScript: Restart TS Server"');
console.log('2. Cmd+Shift+P → "Developer: Reload Window"');
console.log('3. Check status bar for TypeScript version');
console.log('4. Verify "Use Workspace Version" is selected');
console.log('5. Disable other TypeScript extensions temporarily');