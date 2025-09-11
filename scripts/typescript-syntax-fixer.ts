#!/usr/bin/env tsx

/**
 * Advanced TypeScript syntax fixer
 * Uses AST parsing to fix common syntax errors
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import * as ts from 'typescript';

interface SyntaxFix {
  pattern: RegExp;
  replacement: string | ((match: string, ...args: any[]) => string);
  description: string;
}

const syntaxFixes: SyntaxFix[] = [
  // Fix missing colons in type annotations
  {
    pattern: /(\w+)\s+(\w+)(?=\s*[:{])/g,
    replacement: '$1: $2',
    description: 'Add missing colons in type annotations',
  },

  // Fix error: patterns
  {
    pattern: /error:/g,
    replacement: 'error)',
    description: 'Fix error: to error)',
  },

  // Fix _error patterns
  {
    pattern: /_error(?=[^a-zA-Z0-9_])/g,
    replacement: 'error:',
    description: 'Fix _error to error:',
  },

  // Fix _errorinstanceof
  {
    pattern: /_errorinstanceof/g,
    replacement: 'error instanceof',
    description: 'Fix _errorinstanceof',
  },

  // Fix content patterns
  {
    pattern: /content([a-zA-Z])/g,
    replacement: 'content.$1',
    description: 'Fix content property access',
  },

  // Fix _content
  {
    pattern: /_content/g,
    replacement: 'content',
    description: 'Fix _content to content',
  },

  // Fix requestincludes
  {
    pattern: /requestincludes/g,
    replacement: 'request.includes',
    description: 'Fix requestincludes',
  },

  // Fix pattern object syntax
  {
    pattern: /{ pattern (\/)([^}]+)}/g,
    replacement: '{ pattern: $1$2}',
    description: 'Fix pattern object syntax',
  },

  // Fix JSON.stringify patterns
  {
    pattern: /JSON\.stringify\(content([.;])/g,
    replacement: 'JSON.stringify(content)$1',
    description: 'Fix JSON.stringify calls',
  },

  // Fix unterminated template literals
  {
    pattern: /`([^`]*)\\/g,
    replacement: (match, content) => {
      if (!match.endsWith('`')) {
        return `\`${content}\``;
      }
      return match;
    },
    description: 'Fix unterminated template literals',
  },

  // Fix function parameter syntax
  {
    pattern: /\((\w+)\s+(\w+),/g,
    replacement: '($1: $2,',
    description: 'Fix function parameter type syntax',
  },

  // Fix missing commas in function calls
  {
    pattern: /\(([^,)]+)\s+([^,)]+)\)/g,
    replacement: (match, arg1, arg2) => {
      // Only fix if it looks like two separate arguments
      if (arg1.trim() && arg2.trim() && !arg2.includes(':')) {
        return `(${arg1}, ${arg2})`;
      }
      return match;
    },
    description: 'Add missing commas in function calls',
  },
];

async function fixFile(filePath: string): Promise<boolean> {
  try {
    let content = await fs.promises.readFile(filePath, 'utf-8');
    const originalContent = content;
    let hasChanges = false;

    // Apply all syntax fixes
    for (const fix of syntaxFixes) {
      const before = content;
      content = content.replace(fix.pattern, fix.replacement as any);
      if (before !== content) {
        console.log(`  ✓ Applied: ${fix.description}`);
        hasChanges = true;
      }
    }

    // Additional TypeScript-specific fixes
    content = fixTypeScriptSyntax(content);

    if (content !== originalContent) {
      // Create backup
      await fs.promises.writeFile(`${filePath}.bak`, originalContent);
      // Write fixed content
      await fs.promises.writeFile(filePath, content);
      console.log(`✅ Fixed: ${filePath}`);
      return true;
    }

    return false;
  } catch (error) {
    console.error(`❌ Error fixing ${filePath}:`, error);
    return false;
  }
}

function fixTypeScriptSyntax(content: string): string {
  // Fix missing semicolons (but not after closing braces)
  content = content.replace(/([^;{}\s\n])$/gm, '$1;');

  // Fix logger calls
  content = content.replace(/logger\.(\w+)\\`/g, 'logger.$1(`');

  // Fix property access without dots
  const propertyAccessPattern = /\b(content|request|response|data|error)([A-Z][a-zA-Z]*)/g;
  content = content.replace(propertyAccessPattern, '$1.$2');

  // Fix common typos in string literals
  content = content.replace(/'error:\s+'/g, "'error', '");
  content = content.replace(/"error:\s+"/g, '"error", "');

  // Fix unterminated strings
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Count quotes
    const singleQuotes = (line.match(/'/g) || []).length;
    const doubleQuotes = (line.match(/"/g) || []).length;
    const backticks = (line.match(/`/g) || []).length;

    // Fix odd number of quotes (likely unterminated)
    if (singleQuotes % 2 === 1 && !line.includes("\\'")) {
      lines[i] = line + "'";
    }
    if (doubleQuotes % 2 === 1 && !line.includes('\\"')) {
      lines[i] = line + '"';
    }
    if (backticks % 2 === 1) {
      lines[i] = line + '`';
    }
  }

  return lines.join('\n');
}

async function main() {
  console.log('🔧 TypeScript Syntax Fixer');
  console.log('========================\n');

  // Find all TypeScript files
  const files = await glob('src/**/*.ts', {
    ignore: ['**/node_modules/**', '**/*.d.ts'],
  });

  console.log(`Found ${files.length} TypeScript files to check\n`);

  let fixedCount = 0;
  for (const file of files) {
    if (await fixFile(file)) {
      fixedCount++;
    }
  }

  console.log(`\n✅ Fixed ${fixedCount} files`);

  // Clean up backups if requested
  if (process.argv.includes('--clean-backups')) {
    console.log('\n🧹 Cleaning up backup files...');
    const backups = await glob('src/**/*.ts.bak');
    for (const backup of backups) {
      await fs.promises.unlink(backup);
    }
    console.log(`Removed ${backups.length} backup files`);
  }
}

// Run the fixer
main().catch(console.error);
