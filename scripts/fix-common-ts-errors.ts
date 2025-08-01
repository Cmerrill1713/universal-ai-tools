#!/usr/bin/env tsx

/**
 * Fix common TypeScript errors automatically
 */

import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';
import chalk from 'chalk';

interface Fix {
  pattern: RegExp;
  replacement: string | ((match: string, ...args: string[]) => string);
  description: string;
}

const fixes: Fix[] = [
  {
    // Fix implicit any parameters in Express routes
    pattern: /\(req, res\)/g,
    replacement: '(req: Request, res: Response)',
    description: 'Add Express types to route handlers'
  },
  {
    // Fix implicit any parameters with next
    pattern: /\(req, res, next\)/g,
    replacement: '(req: Request, res: Response, next: NextFunction)',
    description: 'Add Express types with NextFunction'
  },
  {
    // Add optional chaining for possibly undefined
    pattern: /(\w+)\.(\w+)\.(\w+)\s*&&\s*\1\.\2\.\3/g,
    replacement: '$1?.$2?.$3',
    description: 'Use optional chaining'
  },
  {
    // Fix missing return statements
    pattern: /^(\s*)(if\s*\([^)]+\)\s*{[^}]+})(\s*)$/gm,
    replacement: (match, indent, ifBlock, trailing) => {
      if (!ifBlock.includes('return') && !ifBlock.includes('throw')) {
        return `${indent}${ifBlock}\n${indent}return undefined;${trailing}`;
      }
      return match;
    },
    description: 'Add missing return statements'
  }
];

async function fixFile(filePath: string): Promise<number> {
  try {
    let content = await fs.readFile(filePath, 'utf-8');
    const originalContent = content;
    let fixCount = 0;

    // Skip if already has imports
    if (!content.includes('import { Request, Response') && 
        (content.includes('(req, res)') || content.includes('(req, res, next)'))) {
      // Add Express type imports
      const importStatement = "import { Request, Response, NextFunction } from 'express';\n";
      if (content.includes('import ')) {
        // Add after first import
        content = content.replace(/^(import .+)$/m, `$1\n${importStatement}`);
      } else {
        // Add at the beginning
        content = importStatement + '\n' + content;
      }
      fixCount++;
    }

    // Apply fixes
    for (const fix of fixes) {
      const matches = content.match(fix.pattern);
      if (matches) {
        content = content.replace(fix.pattern, fix.replacement as any);
        fixCount += matches.length;
      }
    }

    // Fix validateApiKey export in auth.ts
    if (filePath.endsWith('auth.ts')) {
      if (!content.includes('export { validateApiKey }') && 
          !content.includes('export const validateApiKey') &&
          content.includes('validateApiKey')) {
        content += '\nexport { validateApiKey };\n';
        fixCount++;
      }
    }

    // Write back if changed
    if (content !== originalContent) {
      await fs.writeFile(filePath, content);
      return fixCount;
    }
  } catch (error) {
    console.error(chalk.red(`Error fixing ${filePath}:`), error);
  }
  return 0;
}

async function main() {
  console.log(chalk.cyan('🔧 Fixing common TypeScript errors...\n'));

  // Find all TypeScript files
  const files = await glob('src/**/*.ts', { 
    ignore: ['node_modules/**', 'dist/**', '**/*.d.ts'] 
  });

  let totalFixes = 0;
  const fixedFiles: string[] = [];

  for (const file of files) {
    const fixes = await fixFile(file);
    if (fixes > 0) {
      totalFixes += fixes;
      fixedFiles.push(file);
    }
  }

  console.log(chalk.green(`\n✅ Fixed ${totalFixes} issues in ${fixedFiles.length} files\n`));

  if (fixedFiles.length > 0) {
    console.log(chalk.yellow('Fixed files:'));
    fixedFiles.forEach(file => console.log(`  - ${file}`));
  }

  // Check remaining errors
  const { execSync } = await import('child_process');
  try {
    execSync('npx tsc --noEmit', { stdio: 'pipe' });
    console.log(chalk.green('\n✅ No TypeScript errors remaining!'));
  } catch (error) {
    const output = error.stdout?.toString() || '';
    const errorCount = (output.match(/error TS/g) || []).length;
    console.log(chalk.yellow(`\n⚠️  ${errorCount} TypeScript errors remain`));
  }
}

main().catch(console.error);