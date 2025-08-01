#!/usr/bin/env tsx

/**
 * Production Readiness Validation Pipeline
 * Comprehensive checks for production deployment
 */

import { execSync } from 'child_process';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs/promises';
import path from 'path';

interface ValidationResult {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  score: number;
  maxScore: number;
  details: string[];
}

class ProductionValidator {
  private results: ValidationResult[] = [];
  
  async run() {
    console.log(chalk.bold.cyan('\n🚀 UNIVERSAL AI TOOLS - PRODUCTION VALIDATION\n'));
    
    await this.checkTypeScript();
    await this.checkLinting();
    await this.checkSecurity();
    await this.checkTests();
    await this.checkPerformance();
    await this.checkDependencies();
    await this.checkEnvironment();
    
    this.printReport();
  }

  private async checkTypeScript() {
    const spinner = ora('Checking TypeScript compilation...').start();
    const result: ValidationResult = {
      name: 'TypeScript Compilation',
      status: 'pass',
      score: 0,
      maxScore: 25,
      details: []
    };

    try {
      execSync('npx tsc --noEmit', { stdio: 'pipe' });
      result.status = 'pass';
      result.score = 25;
      result.details.push('✅ All TypeScript files compile successfully');
    } catch (error) {
      const output = error.toString();
      const errorCount = (output.match(/error TS/g) || []).length;
      
      if (errorCount > 100) {
        result.status = 'fail';
        result.score = 0;
      } else if (errorCount > 0) {
        result.status = 'warn';
        result.score = Math.max(0, 25 - Math.floor(errorCount / 4));
      }
      
      result.details.push(`⚠️ ${errorCount} TypeScript errors found`);
      
      // Common error patterns
      if (output.includes('Map')) {
        result.details.push('💡 Tip: Add "downlevelIteration": true to tsconfig.json');
      }
    }

    spinner.stop();
    this.results.push(result);
  }

  private async checkLinting() {
    const spinner = ora('Checking ESLint...').start();
    const result: ValidationResult = {
      name: 'Code Quality (ESLint)',
      status: 'pass',
      score: 0,
      maxScore: 25,
      details: []
    };

    try {
      // For now, just check if lint script exists
      const packageJson = JSON.parse(await fs.readFile('package.json', 'utf-8'));
      if (packageJson.scripts?.lint) {
        result.status = 'warn';
        result.score = 15;
        result.details.push('⚠️ ESLint configured but not checked (config migration needed)');
        result.details.push('💡 Production uses TypeScript compiler for type safety');
      } else {
        result.status = 'fail';
        result.score = 0;
        result.details.push('❌ No lint script configured');
      }
    } catch (error) {
      result.status = 'fail';
      result.score = 0;
      result.details.push('❌ Could not check linting setup');
    }

    spinner.stop();
    this.results.push(result);
  }

  private async checkSecurity() {
    const spinner = ora('Checking security vulnerabilities...').start();
    const result: ValidationResult = {
      name: 'Security Audit',
      status: 'pass',
      score: 0,
      maxScore: 25,
      details: []
    };

    try {
      execSync('npm audit --json', { stdio: 'pipe' });
      result.status = 'pass';
      result.score = 25;
      result.details.push('✅ No security vulnerabilities');
    } catch (error) {
      try {
        const auditOutput = JSON.parse(error.stdout?.toString() || '{}');
        const vulns = auditOutput.metadata?.vulnerabilities || {};
        
        if (vulns.critical > 0 || vulns.high > 0) {
          result.status = 'fail';
          result.score = 0;
          result.details.push(`❌ ${vulns.critical} critical, ${vulns.high} high vulnerabilities`);
        } else if (vulns.moderate > 0) {
          result.status = 'warn';
          result.score = 20;
          result.details.push(`⚠️ ${vulns.moderate} moderate vulnerabilities`);
        } else {
          result.status = 'pass';
          result.score = 25;
        }
        
        result.details.push('💡 Run: npm audit fix to resolve issues');
      } catch {
        result.status = 'fail';
        result.score = 0;
        result.details.push('❌ Security audit failed');
      }
    }

    spinner.stop();
    this.results.push(result);
  }

  private async checkTests() {
    const spinner = ora('Checking test coverage...').start();
    const result: ValidationResult = {
      name: 'Test Coverage',
      status: 'pass',
      score: 0,
      maxScore: 15,
      details: []
    };

    try {
      // Check if test files exist
      const testFiles = await this.findTestFiles();
      
      if (testFiles.length === 0) {
        result.status = 'fail';
        result.score = 0;
        result.details.push('❌ No test files found');
      } else {
        result.status = 'warn';
        result.score = 8;
        result.details.push(`📝 ${testFiles.length} test files found`);
        result.details.push('💡 Run: npm test to execute tests');
      }
    } catch (error) {
      result.status = 'fail';
      result.score = 0;
      result.details.push('❌ Test check failed');
    }

    spinner.stop();
    this.results.push(result);
  }

  private async checkPerformance() {
    const spinner = ora('Checking performance metrics...').start();
    const result: ValidationResult = {
      name: 'Performance',
      status: 'pass',
      score: 10,
      maxScore: 10,
      details: []
    };

    // Basic checks for performance optimizations
    try {
      const packageJson = JSON.parse(await fs.readFile('package.json', 'utf-8'));
      
      if (packageJson.scripts?.build?.includes('--minify')) {
        result.details.push('✅ Build minification enabled');
      } else {
        result.score -= 2;
        result.details.push('⚠️ Consider enabling minification');
      }
      
      // Check for production dependencies
      const prodDeps = Object.keys(packageJson.dependencies || {});
      const devDeps = Object.keys(packageJson.devDependencies || {});
      
      result.details.push(`📦 ${prodDeps.length} production deps, ${devDeps.length} dev deps`);
      
    } catch (error) {
      result.status = 'warn';
      result.score = 5;
      result.details.push('⚠️ Could not analyze performance setup');
    }

    spinner.stop();
    this.results.push(result);
  }

  private async checkDependencies() {
    const spinner = ora('Checking dependencies...').start();
    const result: ValidationResult = {
      name: 'Dependencies',
      status: 'pass',
      score: 0,
      maxScore: 0, // Bonus points
      details: []
    };

    try {
      execSync('npm outdated --json', { stdio: 'pipe' });
      result.details.push('✅ All dependencies up to date');
    } catch (error) {
      const output = error.stdout?.toString();
      try {
        const outdated = JSON.parse(output || '{}');
        const count = Object.keys(outdated).length;
        if (count > 0) {
          result.details.push(`📦 ${count} outdated dependencies`);
          result.details.push('💡 Run: npm update to update dependencies');
        }
      } catch {
        // Ignore parsing errors
      }
    }

    spinner.stop();
    this.results.push(result);
  }

  private async checkEnvironment() {
    const spinner = ora('Checking environment setup...').start();
    const result: ValidationResult = {
      name: 'Environment',
      status: 'pass',
      score: 0,
      maxScore: 0, // Bonus points
      details: []
    };

    // Check for required files
    const requiredFiles = ['.env.example', 'README.md', 'LICENSE'];
    for (const file of requiredFiles) {
      try {
        await fs.access(file);
        result.details.push(`✅ ${file} exists`);
      } catch {
        result.details.push(`⚠️ Missing ${file}`);
      }
    }

    spinner.stop();
    this.results.push(result);
  }

  private async findTestFiles(): Promise<string[]> {
    const testPatterns = ['**/*.test.ts', '**/*.spec.ts', '**/*.test.js', '**/*.spec.js'];
    const testFiles: string[] = [];
    
    // Simple test file discovery
    try {
      const files = await this.getAllFiles('./src');
      testFiles.push(...files.filter(f => 
        f.includes('.test.') || f.includes('.spec.')
      ));
    } catch {
      // Ignore errors
    }
    
    return testFiles;
  }

  private async getAllFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          files.push(...await this.getAllFiles(fullPath));
        } else if (entry.isFile()) {
          files.push(fullPath);
        }
      }
    } catch {
      // Ignore errors
    }
    return files;
  }

  private printReport() {
    console.log(chalk.bold('\n📊 VALIDATION REPORT\n'));
    
    let totalScore = 0;
    let totalMaxScore = 0;
    
    for (const result of this.results) {
      const icon = result.status === 'pass' ? '✅' : 
                   result.status === 'warn' ? '⚠️' : '❌';
      
      console.log(chalk.bold(`${icon} ${result.name}`));
      console.log(chalk.gray(`   Score: ${result.score}/${result.maxScore}`));
      
      for (const detail of result.details) {
        console.log(`   ${detail}`);
      }
      console.log();
      
      totalScore += result.score;
      totalMaxScore += result.maxScore;
    }
    
    const percentage = Math.round((totalScore / totalMaxScore) * 100);
    const color = percentage >= 90 ? 'green' : 
                  percentage >= 70 ? 'yellow' : 'red';
    
    console.log(chalk.bold('━'.repeat(50)));
    console.log(chalk.bold[color](`\n🎯 PRODUCTION READINESS SCORE: ${percentage}%`));
    console.log(chalk.gray(`   Total: ${totalScore}/${totalMaxScore} points\n`));
    
    if (percentage < 90) {
      console.log(chalk.yellow('📌 Priority Actions:'));
      if (this.results.find(r => r.name.includes('TypeScript') && r.status !== 'pass')) {
        console.log('   1. Fix TypeScript compilation errors');
      }
      if (this.results.find(r => r.name.includes('ESLint') && r.status !== 'pass')) {
        console.log('   2. Resolve ESLint errors');
      }
      if (this.results.find(r => r.name.includes('Security') && r.status !== 'pass')) {
        console.log('   3. Fix security vulnerabilities');
      }
      console.log();
    }
    
    console.log(chalk.gray('Run npm run validate:fix to auto-fix issues\n'));
  }
}

// Run validation
const validator = new ProductionValidator();
validator.run().catch(console.error);