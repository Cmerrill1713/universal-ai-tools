#!/usr/bin/env tsx

/**
 * Test the syntax fixer to ensure it doesn't break code
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as ts from 'typescript';
import { fixFile, fixPatterns } from './auto-fix-syntax';

// Test cases with expected fixes
const testCases = [
  {
    name: 'Octal literals',
    input: `const perms = 0755;\nconst mask = 0644;\nconst neg = -0777;`,
    expected: `const perms = 0o755;\nconst mask = 0o644;\nconst neg = -0o777;`,
  },
  {
    name: 'Decimals (should NOT change)',
    input: `const a = 0.1;\nconst b = 0.2;\nconst c = 0.5;`,
    expected: `const a = 0.1;\nconst b = 0.2;\nconst c = 0.5;`,
  },
  {
    name: 'Mixed numbers',
    input: `const oct = 0777;\nconst dec = 0.777;\nconst normal = 999;`,
    expected: `const oct = 0o777;\nconst dec = 0.777;\nconst normal = 999;`,
  },
  {
    name: 'Type annotations (should NOT break)',
    input: `interface Foo {\n  bar: string;\n  baz: number;\n}`,
    expected: `interface Foo {\n  bar: string;\n  baz: number;\n}`,
  },
  {
    name: 'String literals (should NOT break)',
    input: `const msg = 'error: something went wrong';\nconst template = \`status: \${value}\`;`,
    expected: `const msg = 'error: something went wrong';\nconst template = \`status: \${value}\`;`,
  }
];

async function validateTypeScript(content: string): Promise<{ valid: boolean; errors: string[] }> {
  try {
    const sourceFile = ts.createSourceFile(
      'test.ts',
      content,
      ts.ScriptTarget.Latest,
      true
    );

    const errors: string[] = [];
    const diagnostics = (sourceFile as any).parseDiagnostics || [];
    
    diagnostics.forEach((diag: ts.Diagnostic) => {
      const message = ts.flattenDiagnosticMessageText(diag.messageText, '\n');
      errors.push(message);
    });

    return { valid: errors.length === 0, errors };
  } catch (error) {
    return { valid: false, errors: [error.message] };
  }
}

async function testFixPatterns() {
  console.log('🧪 Testing syntax fix patterns...\n');

  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    console.log(`Testing: ${testCase.name}`);
    
    // Apply fix patterns
    let result = testCase.input;
    for (const pattern of fixPatterns) {
      result = result.replace(pattern.pattern, pattern.replacement as any);
    }

    // Check if result matches expected
    if (result === testCase.expected) {
      console.log('✅ PASSED');
      passed++;
    } else {
      console.log('❌ FAILED');
      console.log('  Input:    ', JSON.stringify(testCase.input));
      console.log('  Expected: ', JSON.stringify(testCase.expected));
      console.log('  Got:      ', JSON.stringify(result));
      failed++;
    }

    // Validate TypeScript syntax
    const validation = await validateTypeScript(result);
    if (!validation.valid) {
      console.log('⚠️  Result has syntax errors:', validation.errors);
    }

    console.log('');
  }

  console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed\n`);

  if (failed > 0) {
    console.error('❌ Some tests failed. The syntax fixer may cause issues.');
    process.exit(1);
  } else {
    console.log('✅ All tests passed! The syntax fixer appears safe to use.');
  }
}

// Test on a real file
async function testRealFile() {
  console.log('\n🔍 Testing on a real file with known issues...\n');
  
  const testFile = 'src/core/self-improvement/integrated-self-improvement-system.ts';
  const fullPath = path.join(process.cwd(), testFile);

  try {
    const content = await fs.readFile(fullPath, 'utf-8');
    
    // Check for octal literals
    const octalMatches = content.match(/\b0[0-7]+\b(?![\d.])/g);
    if (octalMatches) {
      console.log(`Found ${octalMatches.length} octal literals to fix:`, octalMatches.slice(0, 5));
    }

    // Validate before fix
    console.log('\nValidating original file...');
    const beforeValidation = await validateTypeScript(content);
    console.log(`Original file valid: ${beforeValidation.valid}`);
    if (!beforeValidation.valid) {
      console.log(`Original errors: ${beforeValidation.errors.length}`);
    }

    // Apply fixes
    let fixed = content;
    for (const pattern of fixPatterns) {
      fixed = fixed.replace(pattern.pattern, pattern.replacement as any);
    }

    // Validate after fix
    console.log('\nValidating fixed file...');
    const afterValidation = await validateTypeScript(fixed);
    console.log(`Fixed file valid: ${afterValidation.valid}`);
    if (!afterValidation.valid) {
      console.log(`Fixed errors: ${afterValidation.errors.length}`);
      
      // Compare error counts
      if (afterValidation.errors.length > beforeValidation.errors.length) {
        console.error('⚠️  WARNING: Fix introduced MORE errors!');
      }
    }

  } catch (error) {
    console.error('Error testing real file:', error);
  }
}

async function main() {
  await testFixPatterns();
  await testRealFile();
}

main().catch(console.error);