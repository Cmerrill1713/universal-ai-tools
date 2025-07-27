#!/usr/bin/env ts-node
/**
 * Fix syntax errors in cognitive agent files
 * Targets specific patterns found in the codebase
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

// Define patterns to fix
const SYNTAX_FIXES = [
  // Fix semicolons in array literals
  {
    pattern: /\[\s*;/g,
    replacement: '[',
    description: 'Remove leading semicolons in array literals'
  },
  {
    pattern: /;\s*\]/g,
    replacement: ']',
    description: 'Remove trailing semicolons in array literals'
  },
  {
    pattern: /,\s*;/g,
    replacement: ',',
    description: 'Remove semicolons after commas in arrays'
  },
  // Fix semicolons in template literals and string concatenation
  {
    pattern: /\$\{[^}]+\}`;`;/g,
    replacement: (match: string) => match.replace('`;`;', '`;'),
    description: 'Fix semicolons after template literal closures'
  },
  {
    pattern: /\}```;/g,
    replacement: '}`;',
    description: 'Fix triple backticks in template literals'
  },
  // Fix case statement semicolons
  {
    pattern: /case\s+'[^']+'\s*:;/g,
    replacement: (match: string) => match.replace(':;', ':'),
    description: 'Remove semicolons after case statements'
  },
  {
    pattern: /default\s*:;/g,
    replacement: 'default:',
    description: 'Remove semicolons after default statements'
  },
  // Fix specific patterns from cognitive agents
  {
    pattern: /_content\s+to\s+/g,
    replacement: '_content to ',
    description: 'Fix _content spacing'
  },
  {
    pattern: /_content\s*to\s*evaluate/g,
    replacement: 'content to evaluate',
    description: 'Fix _content to evaluate'
  },
  {
    pattern: /_contentdetected/g,
    replacement: 'content detected',
    description: 'Fix _contentdetected'
  },
  {
    pattern: /_contentshould/g,
    replacement: 'content should',
    description: 'Fix _contentshould'
  },
  {
    pattern: /_contentthat/g,
    replacement: 'content that',
    description: 'Fix _contentthat'
  },
  {
    pattern: /_contentacross/g,
    replacement: 'content across',
    description: 'Fix _contentacross'
  },
  {
    pattern: /_contentmeets/g,
    replacement: 'content meets',
    description: 'Fix _contentmeets'
  },
  {
    pattern: /_contentrequires/g,
    replacement: 'content requires',
    description: 'Fix _contentrequires'
  },
  {
    pattern: /_contenthas/g,
    replacement: 'content has',
    description: 'Fix _contenthas'
  },
  {
    pattern: /_contentpolicy/g,
    replacement: 'content policy',
    description: 'Fix _contentpolicy'
  },
  // Fix arrow function syntax errors
  {
    pattern: /\)\s*=>\s*;/g,
    replacement: ') =>',
    description: 'Remove semicolons after arrow function arrows'
  },
  // Fix object literal semicolons
  {
    pattern: /\{\s*;/g,
    replacement: '{',
    description: 'Remove leading semicolons in object literals'
  },
  // Fix async/await patterns
  {
    pattern: /private async (\w+)\(;/g,
    replacement: 'private async $1(',
    description: 'Remove semicolons after async method declarations'
  },
  // Fix conditional operator patterns
  {
    pattern: /\s+&&;\s+/g,
    replacement: ' && ',
    description: 'Remove semicolons in AND operators'
  },
  {
    pattern: /\s+\|\|;\s+/g,
    replacement: ' || ',
    description: 'Remove semicolons in OR operators'
  },
  // Fix multi-line comment issues
  {
    pattern: /\/\*\*;/g,
    replacement: '/**',
    description: 'Fix comment opening with semicolon'
  },
  {
    pattern: /\s+\*;/g,
    replacement: ' *',
    description: 'Fix comment lines with semicolon'
  },
  // Fix specific template literal patterns
  {
    pattern: /`([^`]*)``;/g,
    replacement: '`$1`;',
    description: 'Fix double backtick closures'
  },
  // Fix nested template literal issues
  {
    pattern: /\$\{`([^`]+)`\}/g,
    replacement: (match: string) => {
      // Ensure proper nesting
      return match;
    },
    description: 'Validate nested template literals'
  }
];

async function fixFile(filePath: string): Promise<number> {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let fixCount = 0;
    let originalContent = content;

    // Apply each fix pattern
    for (const fix of SYNTAX_FIXES) {
      const before = content;
      if (typeof fix.replacement === 'string') {
        content = content.replace(fix.pattern, fix.replacement);
      } else {
        content = content.replace(fix.pattern, fix.replacement);
      }
      
      if (before !== content) {
        const matches = before.match(fix.pattern);
        if (matches) {
          fixCount += matches.length;
          console.log(`  Applied: ${fix.description} (${matches.length} instances)`);
        }
      }
    }

    // Additional complex fixes
    // Fix array literal semicolons with context
    content = content.replace(/(\[[^\]]*);([^\]]*\])/g, '$1,$2');
    
    // Fix object literal semicolons with context
    content = content.replace(/(\{[^}]*);([^}]*\})/g, '$1,$2');
    
    // Fix template literal line continuations
    content = content.replace(/\${([^}]+)}\s*\+\s*`/g, '${$1}`');
    
    // Fix const declarations with semicolons
    content = content.replace(/const\s+(\w+)\s*=\s*;/g, 'const $1 = ');

    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Fixed ${fixCount} syntax issues in ${path.basename(filePath)}`);
      return fixCount;
    } else {
      console.log(`✓ No fixes needed for ${path.basename(filePath)}`);
      return 0;
    }
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error);
    return 0;
  }
}

async function main() {
  console.log('🔧 Fixing syntax errors in cognitive agent files...\n');

  // Target cognitive agent files
  const patterns = [
    'src/agents/cognitive/*.ts',
    'src/agents/*.ts',
    'src/memory/*.ts',
    'src/services/*.ts'
  ];

  let totalFixes = 0;
  let filesProcessed = 0;

  for (const pattern of patterns) {
    const files = await glob(pattern, {
      cwd: path.join(__dirname, '..'),
      absolute: true
    });

    console.log(`\nProcessing ${files.length} files matching ${pattern}:`);

    for (const file of files) {
      console.log(`\nProcessing: ${path.basename(file)}`);
      const fixes = await fixFile(file);
      totalFixes += fixes;
      filesProcessed++;
    }
  }

  console.log(`\n✅ Completed! Fixed ${totalFixes} syntax issues across ${filesProcessed} files.`);
  
  // Run TypeScript compiler to check for remaining errors
  console.log('\n🔍 Running TypeScript check...');
  const { execSync } = require('child_process');
  try {
    execSync('npx tsc --noEmit', { 
      stdio: 'pipe',
      cwd: path.join(__dirname, '..')
    });
    console.log('✅ TypeScript check passed!');
  } catch (error: any) {
    console.log('⚠️  TypeScript still reports errors. Check the output above.');
    // Log first few errors
    const output = error.stdout?.toString() || '';
    const lines = output.split('\n').slice(0, 10);
    if (lines.length > 0) {
      console.log('\nFirst few errors:');
      lines.forEach((line: string) => console.log(line));
    }
  }
}

main().catch(console.error);