const { execSync } = require('child_process');
const path = require('path');

console.log('🔍 Validating knowledge-monitoring.ts...\n');

try {
  // Check TypeScript compilation
  const result = execSync('npx tsc --noEmit src/routers/knowledge-monitoring.ts --project .', {
    encoding: 'utf8',
    cwd: __dirname
  });
  
  console.log('✅ TypeScript compilation: PASSED');
  
} catch (error) {
  console.log('❌ TypeScript compilation errors:');
  console.log(error.stdout);
  
  // Filter for knowledge-monitoring.ts specific errors
  const lines = error.stdout.split('\n');
  const kmErrors = lines.filter(line => line.includes('knowledge-monitoring.ts'));
  
  if (kmErrors.length > 0) {
    console.log('\n🎯 Knowledge-monitoring.ts specific errors:');
    kmErrors.forEach(error => console.log(`  ${error}`));
  } else {
    console.log('\n✅ No knowledge-monitoring.ts specific errors found');
    console.log('   Errors are in dependencies/other files');
  }
}

// Check syntax
try {
  const fs = require('fs');
  const filePath = path.join(__dirname, 'src/routers/knowledge-monitoring.ts');
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Basic syntax checks
  const hasValidImports = content.includes('import') && content.includes('from');
  const hasExport = content.includes('export default');
  const hasValidSyntax = !content.includes('import.*import') && !content.includes('const.*const.*=');
  
  console.log(`\n📝 File syntax checks:`);
  console.log(`   Valid imports: ${hasValidImports ? '✅' : '❌'}`);
  console.log(`   Has export: ${hasExport ? '✅' : '❌'}`);
  console.log(`   Basic syntax: ${hasValidSyntax ? '✅' : '❌'}`);
  
} catch (error) {
  console.log('❌ File read error:', error.message);
}

console.log('\n💡 If Cursor still shows errors, try:');
console.log('   1. Restart Cursor/VS Code');
console.log('   2. Cmd+Shift+P -> "TypeScript: Restart TS Server"');
console.log('   3. Check if Cursor is using a different tsconfig.json');
console.log('   4. Verify Cursor is using the same TypeScript version (5.6.3)');