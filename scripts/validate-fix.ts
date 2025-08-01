#!/usr/bin/env tsx

/**
 * Production Validation Auto-Fix
 * Attempts to automatically fix common issues
 */

import { execSync } from 'child_process';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs/promises';
import path from 'path';

class ProductionFixer {
  async run() {
    console.log(chalk.bold.cyan('\n🔧 UNIVERSAL AI TOOLS - AUTO-FIX PRODUCTION ISSUES\n'));
    
    await this.fixTypeScript();
    await this.fixLinting();
    await this.fixSecurity();
    await this.fixDependencies();
    
    console.log(chalk.green('\n✅ Auto-fix complete! Run npm run validate:production to check status.\n'));
  }

  private async fixTypeScript() {
    const spinner = ora('Fixing TypeScript configuration...').start();
    
    try {
      // Read current tsconfig
      const tsconfigPath = 'tsconfig.json';
      const tsconfig = JSON.parse(await fs.readFile(tsconfigPath, 'utf-8'));
      
      // Fix common Map iteration issues
      if (!tsconfig.compilerOptions.downlevelIteration) {
        tsconfig.compilerOptions.downlevelIteration = true;
        await fs.writeFile(tsconfigPath, JSON.stringify(tsconfig, null, 2));
        spinner.succeed('Fixed TypeScript Map iteration config');
      } else {
        spinner.succeed('TypeScript config already optimized');
      }
      
      // Fix common import issues
      if (!tsconfig.compilerOptions.esModuleInterop) {
        tsconfig.compilerOptions.esModuleInterop = true;
        await fs.writeFile(tsconfigPath, JSON.stringify(tsconfig, null, 2));
      }
      
    } catch (error) {
      spinner.fail('Could not fix TypeScript config automatically');
    }
  }

  private async fixLinting() {
    const spinner = ora('Fixing ESLint issues...').start();
    
    try {
      // Run ESLint autofix
      execSync('npm run lint:fix', { stdio: 'pipe' });
      spinner.succeed('Fixed auto-fixable ESLint issues');
    } catch (error) {
      // Check how many errors remain
      try {
        const output = execSync('npm run lint 2>&1 || true', { encoding: 'utf-8' });
        const errorMatch = output.match(/(\d+) errors?/);
        const errors = errorMatch ? parseInt(errorMatch[1]) : 0;
        
        if (errors > 0) {
          spinner.warn(`Fixed some issues, ${errors} errors remain (manual fix needed)`);
        } else {
          spinner.succeed('All ESLint issues fixed');
        }
      } catch {
        spinner.warn('Some ESLint issues remain');
      }
    }
  }

  private async fixSecurity() {
    const spinner = ora('Fixing security vulnerabilities...').start();
    
    try {
      // Try npm audit fix
      execSync('npm audit fix', { stdio: 'pipe' });
      
      // Check if any remain
      try {
        execSync('npm audit --json', { stdio: 'pipe' });
        spinner.succeed('All security vulnerabilities fixed');
      } catch (error) {
        const auditOutput = JSON.parse(error.stdout?.toString() || '{}');
        const vulns = auditOutput.metadata?.vulnerabilities || {};
        
        if (vulns.critical > 0 || vulns.high > 0) {
          spinner.fail('Critical/high vulnerabilities remain - manual fix needed');
          console.log(chalk.yellow('   Try: npm audit fix --force (use with caution)'));
        } else if (vulns.moderate > 0) {
          spinner.warn(`${vulns.moderate} moderate vulnerabilities remain`);
        }
      }
    } catch (error) {
      spinner.fail('Could not fix security issues automatically');
    }
  }

  private async fixDependencies() {
    const spinner = ora('Updating dependencies...').start();
    
    try {
      // Update dependencies
      execSync('npm update', { stdio: 'pipe' });
      spinner.succeed('Dependencies updated');
      
      // Dedupe
      execSync('npm dedupe', { stdio: 'pipe' });
      
    } catch (error) {
      spinner.warn('Some dependencies could not be updated');
    }
  }
}

// Run fixer
const fixer = new ProductionFixer();
fixer.run().catch(console.error);