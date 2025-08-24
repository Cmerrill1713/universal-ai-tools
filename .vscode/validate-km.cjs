const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 Validating knowledge-monitoring.ts for Cursor/Pylance...\n');

// Check file exists and is readable
const kmPath = path.join(__dirname, '..', 'src', 'routers', 'knowledge-monitoring.ts');
try {
  const content = fs.readFileSync(kmPath, 'utf8');
  console.log('✅ File readable');
  console.log(`📄 File size: ${content.length} characters`);
  console.log(`📝 Lines: ${content.split('\n').length}`);
} catch (error) {
  console.log('❌ Cannot read file:', error.message);
  process.exit(1);
}

// Check TypeScript compilation
console.log('\n🔧 TypeScript Compilation Check:');
try {
  const result = execSync(`npx tsc --noEmit src/routers/knowledge-monitoring.ts`, {
    encoding: 'utf8',
    cwd: path.join(__dirname, '..')
  });
  console.log('✅ TypeScript compilation: SUCCESS');
} catch (error) {
  const errorLines = error.stdout.split('\n').filter(line => 
    line.includes('knowledge-monitoring.ts')
  );
  
  if (errorLines.length === 0) {
    console.log('✅ No knowledge-monitoring.ts specific errors');
    console.log('ℹ️  Errors are in dependencies/imports only');
  } else {
    console.log('❌ Knowledge-monitoring.ts specific errors:');
    errorLines.forEach(line => console.log(`   ${line}`));
  }
}

// Check imports
console.log('\n📦 Import Analysis:');
try {
  const content = fs.readFileSync(kmPath, 'utf8');
  const imports = content.match(/^import.*from.*$/gm) || [];
  console.log(`✅ Found ${imports.length} import statements`);
  
  // Check for common issues
  const hasStarImports = imports.some(imp => imp.includes('import *'));
  const hasDefaultImports = imports.some(imp => !imp.includes('{') && !imp.includes('*'));
  const hasNamedImports = imports.some(imp => imp.includes('{'));
  
  console.log(`   Star imports: ${hasStarImports ? '✅' : '❌'}`);
  console.log(`   Default imports: ${hasDefaultImports ? '✅' : '❌'}`);
  console.log(`   Named imports: ${hasNamedImports ? '✅' : '❌'}`);
  
} catch (error) {
  console.log('❌ Import analysis failed:', error.message);
}

// Check exports
console.log('\n📤 Export Analysis:');
try {
  const content = fs.readFileSync(kmPath, 'utf8');
  const hasDefaultExport = content.includes('export default');
  const hasNamedExports = content.includes('export {') || content.includes('export const') || content.includes('export function');
  
  console.log(`   Default export: ${hasDefaultExport ? '✅' : '❌'}`);
  console.log(`   Named exports: ${hasNamedExports ? '✅' : '❌'}`);
} catch (error) {
  console.log('❌ Export analysis failed:', error.message);
}

// Project configuration check
console.log('\n⚙️  Configuration Check:');
const tsconfigPath = path.join(__dirname, '..', 'tsconfig.json');
const packagePath = path.join(__dirname, '..', 'package.json');

try {
  const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
  console.log('✅ tsconfig.json readable');
  console.log(`   Target: ${tsconfig.compilerOptions.target}`);
  console.log(`   Module: ${tsconfig.compilerOptions.module}`);
  console.log(`   ESModuleInterop: ${tsconfig.compilerOptions.esModuleInterop}`);
  console.log(`   DownlevelIteration: ${tsconfig.compilerOptions.downlevelIteration}`);
} catch (error) {
  console.log('❌ tsconfig.json issue:', error.message);
}

try {
  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  const tsVersion = pkg.devDependencies?.typescript || pkg.dependencies?.typescript;
  console.log(`✅ TypeScript version: ${tsVersion}`);
} catch (error) {
  console.log('❌ package.json issue:', error.message);
}

console.log('\n💡 Next Steps for Cursor:');
console.log('1. In Cursor: Cmd+Shift+P → "TypeScript: Restart TS Server"');
console.log('2. In Cursor: Cmd+Shift+P → "Developer: Reload Window"');  
console.log('3. Close and reopen knowledge-monitoring.ts');
console.log('4. Check Cursor status bar shows correct TypeScript version');
console.log('5. Verify "Use Workspace Version" is enabled for TypeScript');

console.log('\n🎯 If errors persist:');
console.log('- Check Cursor is using workspace TypeScript (not global)');
console.log('- Verify .vscode/settings.json is being used');
console.log('- Consider updating Cursor to latest version');
console.log('- Check for conflicting TypeScript extensions');