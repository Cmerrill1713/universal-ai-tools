#!/usr/bin/env tsx

/**
 * Comprehensive syntax auto-fix script
 * Automatically fixes common TypeScript/JavaScript syntax errors
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';

interface FixPattern {
  name: string;
  pattern: RegExp;
  replacement: string | ((match: string, ...args: any[]) => string);
  description: string;
}

const fixPatterns: FixPattern[] = [
  // Fix _error patterns
  {
    name: 'error_colon',
    pattern: /(\w+):\s*error:/g,
    replacement: '$1: error)',
    description: 'Fix error: to error)',
  },
  {
    name: 'logger_error',
    pattern: /\.error\s*([`'"])([^`'"]*?)\1\s*,\s*error:/g,
    replacement: '.error($1$2$1, error)',
    description: 'Fix logger.error calls',
  },
  {
    name: 'throw_error',
    pattern: /throw\s+error:/g,
    replacement: 'throw error;',
    description: 'Fix throw statements',
  },
  {
    name: 'catch_error',
    pattern: /catch\s*\(\s*error:\s*\)/g,
    replacement: 'catch (error)',
    description: 'Fix catch blocks',
  },

  // Fix missing colons in function parameters
  {
    name: 'function_param_type',
    pattern: /\(([a-zA-Z_$][\w$]*)\s+([a-zA-Z_$][\w$<>\[\]|]*)\)/g,
    replacement: (match, param, type) => {
      // Skip if it's already typed or is a keyword
      if (match.includes(':') || ['async', 'const', 'let', 'var', 'function'].includes(param)) {
        return match;
      }
      return `(${param}: ${type})`;
    },
    description: 'Add missing colons in function parameters',
  },

  // Fix missing commas in object literals
  {
    name: 'object_comma',
    pattern: /(['}"\]])\s*\n\s*([a-zA-Z_$"'])/g,
    replacement: '$1,\n  $2',
    description: 'Add missing commas in objects',
  },

  // Fix pattern literals in objects
  {
    name: 'pattern_literal',
    pattern: /\{\s*pattern\s+\//g,
    replacement: '{ pattern: /',
    description: 'Fix pattern property syntax',
  },

  // Fix unterminated strings
  {
    name: 'unterminated_string',
    pattern: /([`'"])([^`'"]*?)_([a-zA-Z_$][\w$]*)\s*,/g,
    replacement: '$1$2_$3$1,',
    description: 'Fix unterminated string literals',
  },

  // Fix missing semicolons
  {
    name: 'missing_semicolon',
    pattern: /^(\s*(?:const|let|var|return)\s+.+?)(\s*)$/gm,
    replacement: (match, statement, whitespace) => {
      if (!statement.endsWith(';') && !statement.endsWith(',') && !statement.endsWith('{')) {
        return statement + ';' + whitespace;
      }
      return match;
    },
    description: 'Add missing semicolons',
  },

  // Fix concatenated identifiers
  {
    name: 'concatenated_identifiers',
    pattern: /([a-zA-Z_$][\w$]*)([a-zA-Z][a-zA-Z_$][\w$]*)/g,
    replacement: (match, first, second) => {
      // Common patterns to fix
      const patterns = {
        contentdataAccess: 'content.dataAccess',
        contentagentResponses: 'content.agentResponses',
        contenttargetAudience: 'content.targetAudience',
        contentproposedActions: 'content.proposedActions',
        requestincludes: 'request.includes',
        contenttoLowerCase: 'content).toLowerCase',
        _errorinstanceof: 'error instanceof',
        _content: 'content',
        _request: 'request',
        _input: 'input',
        _pattern: 'pattern',
      };

      const combined = first + second;
      if (patterns[combined]) {
        return patterns[combined];
      }

      // Don't split camelCase that's intentional
      if (first.length > 1 && second[0] === second[0].toLowerCase()) {
        return match;
      }

      return match;
    },
    description: 'Fix concatenated identifiers',
  },

  // Fix enum syntax
  {
    name: 'enum_syntax',
    pattern: /'error:\s+'/g,
    replacement: "'error', '",
    description: 'Fix enum value syntax',
  },

  // Fix function calls with wrong syntax
  {
    name: 'function_call_syntax',
    pattern: /\(([a-zA-Z_$][\w$]*)\s+([a-zA-Z_$][\w$]*)\s*([,)])/g,
    replacement: (match, arg1, arg2, end) => {
      // Check if it's a type annotation or function call
      if (['string', 'number', 'boolean', 'any', 'void', 'unknown'].includes(arg2)) {
        return `(${arg1}: ${arg2}${end}`;
      }
      return `(${arg1}, ${arg2}${end}`;
    },
    description: 'Fix function call syntax',
  },

  // Fix missing parentheses
  {
    name: 'missing_parenthesis',
    pattern: /(\.\w+\s*\([^)]*?)(\s*[;}])/g,
    replacement: (match, call, end) => {
      const openCount = (call.match(/\(/g) || []).length;
      const closeCount = (call.match(/\)/g) || []).length;
      if (openCount > closeCount) {
        return call + ')'.repeat(openCount - closeCount) + end;
      }
      return match;
    },
    description: 'Add missing closing parentheses',
  },
];

async function fixFile(filePath: string): Promise<{ fixed: boolean; changes: string[] }> {
  try {
    let content = await fs.readFile(filePath, 'utf-8');
    const originalContent = content;
    const changes: string[] = [];

    for (const pattern of fixPatterns) {
      const matches = content.match(pattern.pattern);
      if (matches && matches.length > 0) {
        content = content.replace(pattern.pattern, pattern.replacement as any);
        changes.push(`Applied ${pattern.name}: ${matches.length} fixes`);
      }
    }

    if (content !== originalContent) {
      await fs.writeFile(filePath, content);
      return { fixed: true, changes };
    }

    return { fixed: false, changes: [] };
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error);
    return { fixed: false, changes: [] };
  }
}

async function main() {
  console.log('🔧 Running comprehensive syntax auto-fix...\n');

  const files = await glob('src/**/*.{ts,tsx,js,jsx}', {
    ignore: ['**/node_modules/**', '**/dist/**', '**/build/**'],
  });

  let totalFixed = 0;
  const allChanges: { file: string; changes: string[] }[] = [];

  for (const file of files) {
    const result = await fixFile(file);
    if (result.fixed) {
      totalFixed++;
      allChanges.push({ file, changes: result.changes });
      console.log(`✅ Fixed ${file}`);
      result.changes.forEach((change) => console.log(`   - ${change}`));
    }
  }

  console.log(`\n📊 Summary: Fixed ${totalFixed} files out of ${files.length} total files`);

  if (allChanges.length > 0) {
    console.log('\n📝 Detailed changes:');
    allChanges.forEach(({ file, changes }) => {
      console.log(`\n${file}:`);
      changes.forEach((change) => console.log(`  - ${change}`));
    });
  }

  // Run prettier to ensure formatting
  console.log('\n💅 Running prettier...');
  const { execSync } = await import('child_process');
  try {
    execSync('npm run format', { stdio: 'inherit' });
  } catch (error) {
    console.error('Prettier formatting failed:', error);
  }
}

// Run if called directly
main().catch(console.error);

export { fixFile, fixPatterns };
