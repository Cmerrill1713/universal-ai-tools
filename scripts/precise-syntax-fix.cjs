#!/usr/bin/env node
/**
 * Precise Syntax Fix Script
 * Reverses problematic changes and applies targeted fixes
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔧 Starting precise syntax fix...');

// Files that need specific attention
const criticalFiles = [
  'src/server-working.ts',
  'src/agents/cognitive/evaluation_agent.ts',
  'src/agents/cognitive/ethics_agent.ts',
  'src/routers/memory.ts',
  'src/mcp-server/universal-ai-tools-mcp.ts'
];

// Common problematic patterns to fix
const fixes = [
  // Fix semicolons in object literals
  { pattern: /\{;/g, replacement: '{' },
  { pattern: /\};/g, replacement: '}' },
  
  // Fix interface definitions
  { pattern: /:\s*\|\s*([^;\n]+);\s*\|/g, replacement: ': | $1 |' },
  
  // Fix array/object syntax
  { pattern: /\[\s*;/g, replacement: '[' },
  { pattern: /,\s*;/g, replacement: ',' },
  
  // Fix string literals
  { pattern: /"([^"]*)","/g, replacement: '"$1"' },
  { pattern: /'([^']*)','/g, replacement: "'$1'" },
  
  // Fix function parameters
  { pattern: /\(\s*;/g, replacement: '(' },
  { pattern: /;\s*\)/g, replacement: ')' },
  
  // Fix template literal issues
  { pattern: /`([^`]*);([^`]*)`/g, replacement: '`$1$2`' },
  
  // Fix type annotations
  { pattern: /:\s*([^;,\n}]+);\s*([,}\n])/g, replacement: ': $1$2' },
  
  // Fix missing commas in objects
  { pattern: /([^,{]\s*)\n(\s*[a-zA-Z_$][a-zA-Z0-9_$]*\s*:)/g, replacement: '$1,\n$2' }
];

function fixFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  File not found: ${filePath}`);
      return false;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    let changesCount = 0;

    // Apply targeted fixes
    fixes.forEach(fix => {
      const matches = content.match(fix.pattern);
      if (matches) {
        content = content.replace(fix.pattern, fix.replacement);
        changesCount += matches.length;
      }
    });

    // Special fixes for specific files
    if (filePath.includes('server-working.ts')) {
      // Fix SocketIO server config
      content = content.replace(/new SocketIOServer\(server, \{;/, 'new SocketIOServer(server, {');
    }

    if (filePath.includes('evaluation_agent.ts')) {
      // Fix interface definitions
      content = content.replace(/safety: number,\s*;/, 'safety: number');
      content = content.replace(/\}\s*;/g, '}');
    }

    if (filePath.includes('ethics_agent.ts')) {
      // Fix union type definitions
      content = content.replace(/category:\s*\|\s*'([^']+)'\s*;/g, "category: '$1'");
    }

    if (filePath.includes('memory.ts')) {
      // Fix destructuring and type issues
      content = content.replace(/const\s*{\s*content:\s*metadata,/, 'const { content, metadata,');
      content = content.replace(/let:\s*embedding/, 'let embedding');
      content = content.replace(/const:\s*memory/, 'const memory');
      content = content.replace(/const:\s*memories/, 'const memories');
    }

    // Only write if changes were made
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Fixed ${changesCount} issues in ${filePath}`);
      return true;
    } else {
      console.log(`✨ No changes needed in ${filePath}`);
      return false;
    }

  } catch (error) {
    console.error(`❌ Error fixing ${filePath}:`, error.message);
    return false;
  }
}

// Process critical files first
let totalFixed = 0;
criticalFiles.forEach(file => {
  const fullPath = path.join(process.cwd(), file);
  if (fixFile(fullPath)) {
    totalFixed++;
  }
});

console.log(`\n🎯 Precise fixes applied to ${totalFixed} files`);

// Test syntax by trying to parse TypeScript
try {
  console.log('\n🔍 Testing syntax...');
  execSync('npx tsc --noEmit --skipLibCheck src/server-working.ts', { stdio: 'pipe' });
  console.log('✅ server-working.ts syntax is valid');
} catch (error) {
  console.log('❌ server-working.ts still has syntax errors:');
  console.log(error.stdout?.toString() || error.message);
}

console.log('\n✨ Precise syntax fix completed');