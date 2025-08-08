#!/usr/bin/env tsx

/**
 * Comprehensive Syntax Restoration Script
 * Fixes all syntax corruption patterns introduced by the faulty auto-fix script
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

const restorationPatterns: FixPattern[] = [
  // Fix corrupted interface properties with extra commas and quotes
  {
    name: 'interface_property_corruption',
    pattern: /(\w+):\s*string;,/g,
    replacement: '$1: string;',
    description: 'Remove extra comma after semicolon in interface properties',
  },
  {
    name: 'interface_property_extra_quotes',
    pattern: /(\w+):\s*'([^']+)';'/g,
    replacement: '$1: \'$2\';',
    description: 'Fix extra quotes on interface property types',
  },
  {
    name: 'interface_property_comma_quote',
    pattern: /(\w+):\s*string;,'/g,
    replacement: '$1: string;',
    description: 'Remove comma and trailing quote from interface properties',
  },
  
  // Fix function Object() { [native code] }() corruption
  {
    name: 'constructor_corruption',
    pattern: /function Object\(\) \{ \[native code\] \}\(\)/g,
    replacement: 'constructor',
    description: 'Fix corrupted constructor syntax',
  },
  
  // Fix optional chaining corruption
  {
    name: 'optional_chaining_corruption',
    pattern: /this\?\./g,
    replacement: 'this.',
    description: 'Remove invalid optional chaining on this',
  },
  {
    name: 'property_optional_chaining',
    pattern: /(\w+)\?\./g,
    replacement: (match, prop) => {
      // Only fix if it's clearly a property access, not a variable
      if (['this', 'self', 'window', 'document', 'console', 'Math', 'Date', 'Array', 'Object'].includes(prop)) {
        return `${prop}.`;
      }
      return match; // Keep optional chaining for variables
    },
    description: 'Fix optional chaining on known objects',
  },
  
  // Fix numeric literal corruption
  {
    name: 'decimal_corruption',
    pattern: /(\d+)\?\.(\d+)/g,
    replacement: '$1.$2',
    description: 'Fix corrupted decimal numbers',
  },
  {
    name: 'octal_notation',
    pattern: /\b0(\d+)\b(?![\d.])/g,
    replacement: (match, digits) => {
      // Only convert if all digits are 0-7 (valid octal)
      if (/^[0-7]+$/.test(digits)) {
        return `0o${digits}`;
      }
      return match;
    },
    description: 'Convert octal literals to 0o notation',
  },
  
  // Fix object literal corruption
  {
    name: 'object_property_corruption',
    pattern: /(\w+):\s*(\d+),;/g,
    replacement: '$1: $2,',
    description: 'Remove semicolon after comma in object literals',
  },
  {
    name: 'object_extra_comma',
    pattern: /},\s*,/g,
    replacement: '},',
    description: 'Remove double commas after objects',
  },
  
  // Fix array corruption
  {
    name: 'array_extra_quote',
    pattern: /\[([\w\s,]+)\];\s*'/g,
    replacement: '[$1];',
    description: 'Remove trailing quote after array',
  },
  
  // Fix function call corruption
  {
    name: 'function_call_corruption',
    pattern: /(\w+)\?\.(toString|valueOf|charAt|slice|substr|substring)\(\) \{ \[native code\] \}\(\)/g,
    replacement: '$1.$2()',
    description: 'Fix corrupted native function calls',
  },
  {
    name: 'function_native_code',
    pattern: /\.function (function \w+\(\)) \{ \[native code\] \}\(\) \{ \[native code\] \}\(\)/g,
    replacement: '.$1()',
    description: 'Fix double native code corruption',
  },
  
  // Fix error handling corruption
  {
    name: 'catch_error_colon',
    pattern: /catch \(error\) \}/g,
    replacement: 'catch (error) {}',
    description: 'Fix catch block missing opening brace',
  },
  {
    name: 'error_handling',
    pattern: /\{ error\) \}/g,
    replacement: '{ error }',
    description: 'Fix error object corruption',
  },
  
  // Fix log statement corruption
  {
    name: 'log_statement_corruption',
    pattern: /log\?\.(\w+)\('([^']+)', LogContext\?\.(\w+), \{'\)/g,
    replacement: 'log.$1(\'$2\', LogContext.$3, {',
    description: 'Fix corrupted log statements',
  },
  {
    name: 'log_closing_corruption',
    pattern: /\}\);'/g,
    replacement: '});',
    description: 'Remove trailing quote after log statement',
  },
  
  // Fix string literal corruption
  {
    name: 'string_semicolon_comma',
    pattern: /'([^']+)';,'/g,
    replacement: '\'$1\',',
    description: 'Fix string with semicolon and comma corruption',
  },
  {
    name: 'string_extra_quote',
    pattern: /'([^']+)';'/g,
    replacement: '\'$1\';',
    description: 'Remove extra quote after string',
  },
  
  // Fix return statement corruption
  {
    name: 'return_object_corruption',
    pattern: /return \{,;/g,
    replacement: 'return {',
    description: 'Fix corrupted return object',
  },
  {
    name: 'return_object_property',
    pattern: /return \{\s*(\w+),\s*,/g,
    replacement: 'return {\n    $1,',
    description: 'Fix return object with double comma',
  },
  
  // Fix arrow function corruption
  {
    name: 'arrow_function_corruption',
    pattern: /\}\);'\s*$/gm,
    replacement: '});',
    description: 'Remove trailing quote after arrow function',
  },
  
  // Fix method chain corruption
  {
    name: 'method_chain_corruption',
    pattern: /(\w+)\?\.(map|filter|reduce|forEach|find|some|every)\(/g,
    replacement: '$1.$2(',
    description: 'Fix optional chaining on array methods',
  },
  
  // Fix promise chain corruption  
  {
    name: 'promise_chain_corruption',
    pattern: /(\w+)\?\.(then|catch|finally)\(/g,
    replacement: '$1.$2(',
    description: 'Fix optional chaining on promise methods',
  },
  
  // Fix export corruption
  {
    name: 'export_corruption',
    pattern: /export \{,\s*(\w+)/g,
    replacement: 'export { $1',
    description: 'Fix export statement with comma',
  },
  
  // Fix import corruption
  {
    name: 'import_corruption',
    pattern: /import \{,\s*(\w+)/g,
    replacement: 'import { $1',
    description: 'Fix import statement with comma',
  },
  
  // Fix conditional corruption
  {
    name: 'ternary_corruption',
    pattern: /(\w+)\s*\?\s*(\d+)\s*;\s*(\d+)/g,
    replacement: '$1 ? $2 : $3',
    description: 'Fix ternary operator with semicolon instead of colon',
  },
  
  // Fix type annotation corruption
  {
    name: 'type_union_corruption',
    pattern: /'([^']+)'\s*\|\s*'([^']+)';,'/g,
    replacement: '\'$1\' | \'$2\'',
    description: 'Fix type union with extra punctuation',
  },
  
  // Fix async/await corruption
  {
    name: 'async_await_corruption',
    pattern: /await\s+this\?\./g,
    replacement: 'await this.',
    description: 'Fix await with optional chaining on this',
  },
  
  // Fix spread operator corruption
  {
    name: 'spread_corruption',
    pattern: /\.\.\.([\w]+)\?\./g,
    replacement: '...$1.',
    description: 'Fix spread operator with optional chaining',
  },
  
  // Fix template literal corruption
  {
    name: 'template_literal_corruption',
    pattern: /\$\{([^}]+)\}\s*;'/g,
    replacement: '${$1}',
    description: 'Fix template literal with extra punctuation',
  },
];

async function restoreFile(filePath: string): Promise<{ fixed: boolean; changes: string[] }> {
  try {
    let content = await fs.readFile(filePath, 'utf-8');
    const originalContent = content;
    const changes: string[] = [];

    for (const pattern of restorationPatterns) {
      const matches = content.match(pattern.pattern);
      if (matches && matches.length > 0) {
        content = content.replace(pattern.pattern, pattern.replacement as any);
        changes.push(`Applied ${pattern.name}: ${matches.length} fixes (${pattern.description})`);
      }
    }

    if (content !== originalContent) {
      // Create backup
      const backupPath = filePath + '.corrupted';
      await fs.writeFile(backupPath, originalContent);
      
      // Write fixed content
      await fs.writeFile(filePath, content);
      
      return { fixed: true, changes };
    }

    return { fixed: false, changes: [] };
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error);
    return { fixed: false, changes: [] };
  }
}

async function validateSyntax(filePath: string): Promise<boolean> {
  try {
    const { execSync } = await import('child_process');
    execSync(`npx tsc --noEmit --skipLibCheck "${filePath}"`, { stdio: 'pipe' });
    return true;
  } catch (error) {
    return false;
  }
}

async function main() {
  console.log('🔧 Running Comprehensive Syntax Restoration...\n');
  console.log('This will fix the corruption caused by the faulty auto-fix script.\n');

  // Target files that were corrupted
  const patterns = [
    'src/**/*.ts',
    'src/**/*.tsx',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
  ];

  const files = await glob(patterns[0], {
    ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', ...patterns.slice(1).filter(p => p.startsWith('!'))],
  });

  console.log(`Found ${files.length} TypeScript files to check.\n`);

  let totalFixed = 0;
  let totalValidated = 0;
  const allChanges: { file: string; changes: string[]; validated: boolean }[] = [];

  // Process files in batches
  const batchSize = 10;
  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    
    await Promise.all(batch.map(async (file) => {
      const result = await restoreFile(file);
      if (result.fixed) {
        totalFixed++;
        
        // Validate the fixed file
        const isValid = await validateSyntax(file);
        if (isValid) {
          totalValidated++;
        }
        
        allChanges.push({ 
          file, 
          changes: result.changes,
          validated: isValid 
        });
        
        console.log(`✅ Fixed ${file} ${isValid ? '(validated)' : '(needs manual review)'}`);
        result.changes.forEach((change) => console.log(`   - ${change}`));
      }
    }));
    
    // Progress update
    console.log(`\nProgress: ${Math.min(i + batchSize, files.length)}/${files.length} files processed`);
  }

  console.log(`\n📊 Restoration Summary:`);
  console.log(`- Files checked: ${files.length}`);
  console.log(`- Files fixed: ${totalFixed}`);
  console.log(`- Files validated: ${totalValidated}`);
  console.log(`- Files needing manual review: ${totalFixed - totalValidated}`);

  if (allChanges.length > 0) {
    console.log('\n📝 Detailed restoration log:');
    
    // Group by change type
    const changeStats = new Map<string, number>();
    allChanges.forEach(({ changes }) => {
      changes.forEach((change) => {
        const match = change.match(/Applied (\w+):/);
        if (match) {
          const changeType = match[1];
          changeStats.set(changeType, (changeStats.get(changeType) || 0) + 1);
        }
      });
    });
    
    console.log('\n🔍 Change Statistics:');
    Array.from(changeStats.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([changeType, count]) => {
        console.log(`   ${changeType}: ${count} occurrences`);
      });
  }

  console.log('\n✨ Syntax restoration complete!');
  
  if (totalFixed - totalValidated > 0) {
    console.log(`\n⚠️  ${totalFixed - totalValidated} files still have syntax errors and need manual review.`);
    console.log('Run "npm run type-check" to see remaining errors.');
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { restoreFile, restorationPatterns };