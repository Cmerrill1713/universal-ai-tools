#!/usr/bin/env tsx

/**
 * Quick Production Validation
 * Fast checks for critical issues only
 */

import { execSync } from 'child_process';
import chalk from 'chalk';

console.log(chalk.bold.cyan('\n⚡ QUICK PRODUCTION VALIDATION\n'));

const checks = [
  {
    name: 'TypeScript',
    command: 'npx tsc --noEmit --pretty false 2>&1 | grep -c "error TS" || echo "0"',
    evaluate: (output: string) => {
      const errors = parseInt(output.trim());
      return {
        status: errors === 0 ? 'pass' : errors < 50 ? 'warn' : 'fail',
        message: errors === 0 ? 'No errors' : `${errors} errors`
      };
    }
  },
  {
    name: 'ESLint',
    command: 'npm run lint 2>&1 | grep -E "\\d+ errors?" | head -1 || echo "0 errors"',
    evaluate: (output: string) => {
      const match = output.match(/(\d+) errors?/);
      const errors = match ? parseInt(match[1]) : 0;
      return {
        status: errors === 0 ? 'pass' : errors < 100 ? 'warn' : 'fail',
        message: output.trim()
      };
    }
  },
  {
    name: 'Security',
    command: 'npm audit --production 2>&1 | grep -E "(critical|high|moderate)" | head -1 || echo "No vulnerabilities"',
    evaluate: (output: string) => {
      const hasCritical = output.includes('critical') || output.includes('high');
      return {
        status: hasCritical ? 'fail' : output.includes('moderate') ? 'warn' : 'pass',
        message: output.trim()
      };
    }
  }
];

let allPassed = true;

for (const check of checks) {
  try {
    const output = execSync(check.command, { encoding: 'utf-8' });
    const result = check.evaluate(output);
    
    const icon = result.status === 'pass' ? '✅' : 
                 result.status === 'warn' ? '⚠️' : '❌';
    
    console.log(`${icon} ${check.name}: ${result.message}`);
    
    if (result.status === 'fail') {
      allPassed = false;
    }
  } catch (error) {
    console.log(`❌ ${check.name}: Check failed`);
    allPassed = false;
  }
}

console.log(chalk.gray('\n━'.repeat(40)));

if (allPassed) {
  console.log(chalk.green('\n✅ All critical checks passed!\n'));
  process.exit(0);
} else {
  console.log(chalk.red('\n❌ Some checks failed. Run npm run validate:production for details.\n'));
  process.exit(1);
}