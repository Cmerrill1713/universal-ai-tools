#!/usr/bin/env tsx

/**
 * Fix specific parsing errors in TypeScript files
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

interface ParseError {
  file: string;
  line: number;
  column: number;
  message: string;
}

function getParsingErrors(): ParseError[] {
  try {
    execSync('npm run lint --silent', { stdio: 'pipe' });
    return [];
  } catch (error: unknown) {
    const output = error.stdout?.toString() || '';
    const errors: ParseError[] = [];

    const lines = output.split('\n');
    let currentFile = '';

    for (const line of lines) {
      if (line.includes('.ts') && !line.includes('error')) {
        currentFile = line.trim();
      } else if (line.includes('Parsing error')) {
        const match = line.match(/\s*(\d+):(\d+)\s+error\s+Parsing error: (.+)/);
        if (match && currentFile) {
          errors.push({
            file: currentFile,
            line: parseInt(match[1]),
            column: parseInt(match[2]),
            message: match[3],
          });
        }
      }
    }

    return errors;
  }
}

async function fixFile(filePath: string, errors: ParseError[]): Promise<boolean> {
  const fileErrors = errors.filter((e) => e.file === filePath);
  if (fileErrors.length === 0) return false;

  process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.log(`🔧 Fixing ${fileErrors.length} errors in ${filePath}`);

  let content = await fs.promises.readFile(filePath, 'utf-8');
  const lines = content.split('\n');
  let hasChanges = false;

  // Sort errors by line number in reverse order to fix from bottom to top
  fileErrors.sort((a, b) => b.line - a.line);

  for (const error of fileErrors) {
    const lineIndex = error.line - 1;
    if (lineIndex >= 0 && lineIndex < lines.length) {
      const line = lines[lineIndex];
      let fixed = line;

      // Fix based on error message
      if (error.message.includes("',' expected")) {
        // Fix missing comma in function parameters
        fixed = line.replace(/\((\w+)\s+(\w+)([):])/g, '($1: $2$3');
        fixed = fixed.replace(/,\s*(\w+)\s+(\w+)([),])/g, ', $1: $2$3');

        // Fix missing comma in object properties
        fixed = fixed.replace(/(\w+):\s*(\w+)\s+(\w+)/g, '$1: $2, $3');
      } else if (error.message.includes("':' expected")) {
        // Fix missing colon in type annotations
        fixed = line.replace(/(\w+)\s+(\w+)(\s*[=),;{])/g, '$1: $2$3');
      } else if (error.message.includes("';' expected")) {
        // Add missing semicolon if line doesn't end with one
        if (
          !line.trim().endsWith(';') &&
          !line.trim().endsWith('{') &&
          !line.trim().endsWith('}') &&
          !line.trim().endsWith(',')
        ) {
          fixed = line + ';';
        }

        // Fix throw statements
        fixed = fixed.replace(/throw error:/g, 'throw error;');
      } else if (error.message.includes('Unterminated string literal')) {
        // Fix unterminated strings
        const singleQuotes = (fixed.match(/'/g) || []).length;
        const doubleQuotes = (fixed.match(/"/g) || []).length;

        if (singleQuotes % 2 === 1) {
          fixed = fixed + "'";
        } else if (doubleQuotes % 2 === 1) {
          fixed = fixed + '"';
        }
      } else if (error.message.includes("')' expected")) {
        // Count parentheses
        const openParens = (fixed.match(/\(/g) || []).length;
        const closeParens = (fixed.match(/\)/g) || []).length;

        if (openParens > closeParens) {
          fixed = fixed + ')'.repeat(openParens - closeParens);
        }
      } else if (error.message.includes('Property or signature expected')) {
        // Fix interface/type issues
        fixed = fixed.replace(/^\s*}\s*(\w+)/g, '  $1');
      }

      if (fixed !== line) {
        lines[lineIndex] = fixed;
        hasChanges = true;
        console.log(`  ✓ Line ${error.line}: ${error.message}`);
      }
    }
  }

  if (hasChanges) {
    await fs.promises.writeFile(filePath, lines.join('\n'));
    return true;
  }

  return false;
}

async function main() {
  console.log('🚀 Fixing Specific Parsing Errors');
  console.log('================================\n');

  let iteration = 0;
  let totalFixed = 0;

  while (iteration < 5) {
    // Maximum 5 iterations
    iteration++;
    console.log(`\n🔄 Iteration ${iteration}`);

    const errors = getParsingErrors();

    if (errors.length === 0) {
      console.log('✅ No parsing errors found!');
      break;
    }

    console.log(`Found ${errors.length} parsing errors\n`);

    // Group errors by file
    const errorsByFile = new Map<string, ParseError[]>();
    for (const error of errors) {
      if (!errorsByFile.has(error.file)) {
        errorsByFile.set(error.file, []);
      }
      errorsByFile.get(error.file)!.push(error);
    }

    // Fix each file
    let fixedInIteration = 0;
    for (const [file, fileErrors] of errorsByFile) {
      if (await fixFile(file, fileErrors)) {
        fixedInIteration++;
      }
    }

    totalFixed += fixedInIteration;

    if (fixedInIteration === 0) {
      console.log('\n⚠️  No errors could be fixed automatically');
      break;
    }

    console.log(`\n✅ Fixed ${fixedInIteration} files in this iteration`);
  }

  console.log(`\n🎉 Total files fixed: ${totalFixed}`);

  // Run final lint check
  console.log('\n📊 Final check...');
  const finalErrors = getParsingErrors();
  console.log(`Remaining parsing errors: ${finalErrors.length}`);

  if (finalErrors.length > 0) {
    console.log('\n⚠️  Some errors require manual intervention:');
    const sample = finalErrors.slice(0, 5);
    for (const error of sample) {
      console.log(`  ${error.file}:${error.line} - ${error.message}`);
    }
  }
}

main().catch(console.error);
