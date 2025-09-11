#!/usr/bin/env node
/**
 * Fix import statement syntax errors introduced by automated fixes
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob').sync;

// Define patterns to fix
const IMPORT_FIXES = [
  // Fix double quotes in import statements
  {
    pattern: /from\s*"([^"]+)";"/g,
    replacement: 'from "$1"',
    description: 'Fix double quotes in import statements'
  },
  {
    pattern: /from\s*'([^']+)';'/g,
    replacement: "from '$1'",
    description: 'Fix double quotes in import statements (single quotes)'
  },
  // Fix semicolons after import names
  {
    pattern: /}\s*from\s*'([^']+)';'/g,
    replacement: "} from '$1'",
    description: 'Fix semicolons in import destructuring'
  },
  {
    pattern: /}\s*from\s*"([^"]+)";"/g,
    replacement: '} from "$1"',
    description: 'Fix semicolons in import destructuring (double quotes)'
  },
  // Fix line-ending semicolons
  {
    pattern: /^(.*);\s*$/gm,
    replacement: '$1',
    description: 'Remove trailing semicolons on lines'
  },
  // Fix comments with semicolons
  {
    pattern: /\/\*\*;/g,
    replacement: '/**',
    description: 'Fix comment openings'
  },
  {
    pattern: /\*\/;/g,
    replacement: '*/',
    description: 'Fix comment closings'
  },
  // Fix specific patterns
  {
    pattern: /\s+;\s+/g,
    replacement: ', ',
    description: 'Replace semicolons with commas in certain contexts'
  },
  // Fix array/object literal issues from the previous fix
  {
    pattern: /,\s*,/g,
    replacement: ',',
    description: 'Fix double commas'
  },
  {
    pattern: /{\s*,/g,
    replacement: '{',
    description: 'Fix leading commas in objects'
  },
  {
    pattern: /\[\s*,/g,
    replacement: '[',
    description: 'Fix leading commas in arrays'
  },
  {
    pattern: /,\s*}/g,
    replacement: '}',
    description: 'Fix trailing commas before closing brace'
  },
  {
    pattern: /,\s*\]/g,
    replacement: ']',
    description: 'Fix trailing commas before closing bracket'
  }
];

function fixFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let fixCount = 0;
    let originalContent = content;

    // Apply each fix pattern
    for (const fix of IMPORT_FIXES) {
      const before = content;
      content = content.replace(fix.pattern, fix.replacement);
      
      if (before !== content) {
        const matches = before.match(fix.pattern);
        if (matches) {
          fixCount += matches.length;
          console.log(`  Applied: ${fix.description} (${matches.length} instances)`);
        }
      }
    }

    // Restore proper semicolons at end of statements
    content = content
      // Restore semicolons at end of statements
      .replace(/^(\s*(?:const|let|var|import|export|return|throw|break|continue)\s+.+)$/gm, '$1;')
      // Restore semicolons after closing braces for assignments
      .replace(/^(\s*(?:const|let|var)\s+\w+\s*=\s*{[^}]+})$/gm, '$1;')
      // Restore semicolons after function calls
      .replace(/^(\s*\w+\([^)]*\))$/gm, '$1;')
      // Restore semicolons after property assignments
      .replace(/^(\s*\w+\.\w+\s*=\s*[^;]+)$/gm, '$1;')
      // Fix interface properties
      .replace(/:\s*([^,;}]+),$/gm, ': $1;')
      // Fix interface properties at end of block
      .replace(/:\s*([^,;}]+)\s*}$/gm, ': $1;\n}');

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

function main() {
  console.log('🔧 Fixing import statement syntax errors...\n');

  // Get project root
  const projectRoot = path.join(__dirname, '..');

  // Target all TypeScript files
  const patterns = [
    'src/**/*.ts',
    'src/**/*.tsx'
  ];

  let totalFixes = 0;
  let filesProcessed = 0;

  for (const pattern of patterns) {
    const files = glob(pattern, {
      cwd: projectRoot,
      absolute: true
    });

    console.log(`\nProcessing ${files.length} files matching ${pattern}:`);

    for (const file of files) {
      const fixes = fixFile(file);
      totalFixes += fixes;
      filesProcessed++;
      
      // Only show files with fixes
      if (fixes > 0) {
        console.log('');
      }
    }
  }

  console.log(`\n✅ Completed! Fixed ${totalFixes} syntax issues across ${filesProcessed} files.`);
}

main();