#!/usr/bin/env node

/**
 * Agent Validator Script
 * Validates that agents properly create files, run tests, and verify their work
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class AgentValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.successes = [];
    this.startTime = Date.now();
  }

  /**
   * Validate that a file was actually created
   */
  validateFileCreation(filePath) {
    console.log(`\n📁 Validating file: ${filePath}`);
    
    if (!fs.existsSync(filePath)) {
      this.errors.push(`❌ File not created: ${filePath}`);
      console.error(`❌ File does not exist: ${filePath}`);
      return false;
    }
    
    const stats = fs.statSync(filePath);
    if (stats.size === 0) {
      this.warnings.push(`⚠️ Empty file created: ${filePath}`);
      console.warn(`⚠️ File is empty: ${filePath}`);
      return false;
    }
    
    this.successes.push(`✅ File created: ${filePath} (${stats.size} bytes)`);
    console.log(`✅ File exists and has content (${stats.size} bytes)`);
    return true;
  }

  /**
   * Validate multiple files at once
   */
  validateFiles(filePaths) {
    console.log(`\n📦 Validating ${filePaths.length} files...`);
    let allValid = true;
    
    for (const filePath of filePaths) {
      if (!this.validateFileCreation(filePath)) {
        allValid = false;
      }
    }
    
    return allValid;
  }

  /**
   * Run TypeScript/JavaScript tests
   */
  validateJavaScriptTests(testPattern = '') {
    console.log(`\n🧪 Running JavaScript tests...`);
    
    try {
      const cmd = testPattern 
        ? `npm test -- ${testPattern}` 
        : 'npm test';
      
      const result = execSync(cmd, { 
        encoding: 'utf8',
        stdio: 'pipe' 
      });
      
      if (result.includes('PASS') || result.includes('passing')) {
        this.successes.push('✅ JavaScript tests passed');
        console.log('✅ Tests passed');
        return true;
      } else {
        this.warnings.push('⚠️ Tests ran but status unclear');
        console.warn('⚠️ Test status unclear');
        return false;
      }
    } catch (error) {
      this.errors.push(`❌ JavaScript tests failed: ${error.message}`);
      console.error('❌ Tests failed:', error.message);
      return false;
    }
  }

  /**
   * Validate TypeScript compilation
   */
  validateTypeScriptBuild() {
    console.log(`\n🔨 Validating TypeScript build...`);
    
    try {
      execSync('npm run build:ts', {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      this.successes.push('✅ TypeScript build successful');
      console.log('✅ TypeScript compilation successful');
      return true;
    } catch (error) {
      this.errors.push(`❌ TypeScript build failed: ${error.message}`);
      console.error('❌ TypeScript compilation failed');
      return false;
    }
  }

  /**
   * Validate Swift build
   */
  validateSwiftBuild(workspacePath, scheme = 'UniversalAITools') {
    console.log(`\n🍎 Validating Swift build...`);
    
    if (!fs.existsSync(workspacePath)) {
      this.errors.push(`❌ Workspace not found: ${workspacePath}`);
      console.error(`❌ Workspace does not exist: ${workspacePath}`);
      return false;
    }
    
    try {
      execSync(`xcodebuild -workspace ${workspacePath} -scheme ${scheme} -destination 'platform=iOS Simulator,name=iPhone 16' build`, {
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 120000 // 2 minute timeout
      });
      
      this.successes.push('✅ Swift build successful');
      console.log('✅ Swift build successful');
      return true;
    } catch (error) {
      this.errors.push(`❌ Swift build failed: ${error.message}`);
      console.error('❌ Swift build failed');
      return false;
    }
  }

  /**
   * Validate Swift tests
   */
  validateSwiftTests(packagePath) {
    console.log(`\n🧪 Running Swift tests...`);
    
    if (!fs.existsSync(packagePath)) {
      this.errors.push(`❌ Swift package not found: ${packagePath}`);
      console.error(`❌ Package does not exist: ${packagePath}`);
      return false;
    }
    
    try {
      const result = execSync('swift test', {
        cwd: packagePath,
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      if (result.includes('Test Suite') && result.includes('Passed')) {
        this.successes.push('✅ Swift tests passed');
        console.log('✅ Swift tests passed');
        return true;
      } else {
        this.warnings.push('⚠️ Swift tests status unclear');
        console.warn('⚠️ Test status unclear');
        return false;
      }
    } catch (error) {
      this.errors.push(`❌ Swift tests failed: ${error.message}`);
      console.error('❌ Swift tests failed');
      return false;
    }
  }

  /**
   * Validate Rust build
   */
  validateRustBuild() {
    console.log(`\n🦀 Validating Rust build...`);
    
    try {
      execSync('cargo check', {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      execSync('cargo build --release', {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      this.successes.push('✅ Rust build successful');
      console.log('✅ Rust build successful');
      return true;
    } catch (error) {
      this.errors.push(`❌ Rust build failed: ${error.message}`);
      console.error('❌ Rust build failed');
      return false;
    }
  }

  /**
   * Validate Go build
   */
  validateGoBuild() {
    console.log(`\n🐹 Validating Go build...`);
    
    try {
      execSync('go build ./...', {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      this.successes.push('✅ Go build successful');
      console.log('✅ Go build successful');
      return true;
    } catch (error) {
      this.errors.push(`❌ Go build failed: ${error.message}`);
      console.error('❌ Go build failed');
      return false;
    }
  }

  /**
   * Check for common agent mistakes
   */
  checkCommonMistakes() {
    console.log(`\n🔍 Checking for common mistakes...`);
    
    // Check for TODO/FIXME markers
    try {
      const todos = execSync('grep -r "TODO\\|FIXME\\|XXX" --include="*.ts" --include="*.js" --include="*.swift" src/ 2>/dev/null | wc -l', {
        encoding: 'utf8',
        stdio: 'pipe'
      }).trim();
      
      if (parseInt(todos) > 0) {
        this.warnings.push(`⚠️ Found ${todos} TODO/FIXME markers`);
        console.warn(`⚠️ Found ${todos} TODO/FIXME markers`);
      }
    } catch (error) {
      // Grep returns non-zero if no matches, that's OK
    }
    
    // Check for console.log statements
    try {
      const logs = execSync('grep -r "console\\.log" --include="*.ts" --include="*.js" src/ 2>/dev/null | wc -l', {
        encoding: 'utf8',
        stdio: 'pipe'
      }).trim();
      
      if (parseInt(logs) > 50) {
        this.warnings.push(`⚠️ Found ${logs} console.log statements (consider using proper logging)`);
        console.warn(`⚠️ Excessive console.log usage detected`);
      }
    } catch (error) {
      // Grep returns non-zero if no matches, that's OK
    }
  }

  /**
   * Generate validation report
   */
  generateReport() {
    const duration = Date.now() - this.startTime;
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 VALIDATION REPORT');
    console.log('='.repeat(60));
    
    if (this.successes.length > 0) {
      console.log('\n✅ Successes:');
      this.successes.forEach(s => console.log(`  ${s}`));
    }
    
    if (this.warnings.length > 0) {
      console.log('\n⚠️ Warnings:');
      this.warnings.forEach(w => console.log(`  ${w}`));
    }
    
    if (this.errors.length > 0) {
      console.log('\n❌ Errors:');
      this.errors.forEach(e => console.log(`  ${e}`));
    }
    
    const report = {
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`,
      successes: this.successes,
      warnings: this.warnings,
      errors: this.errors,
      passed: this.errors.length === 0,
      score: {
        successes: this.successes.length,
        warnings: this.warnings.length,
        errors: this.errors.length
      }
    };
    
    console.log('\n📈 Summary:');
    console.log(`  Duration: ${duration}ms`);
    console.log(`  Successes: ${this.successes.length}`);
    console.log(`  Warnings: ${this.warnings.length}`);
    console.log(`  Errors: ${this.errors.length}`);
    console.log(`  Status: ${report.passed ? '✅ PASSED' : '❌ FAILED'}`);
    console.log('='.repeat(60));
    
    // Save report to file
    const reportPath = path.join(__dirname, '..', 'validation-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Report saved to: ${reportPath}`);
    
    return report;
  }

  /**
   * Run full validation suite
   */
  async runFullValidation() {
    console.log('🚀 Starting full validation suite...\n');
    
    // Check common mistakes first
    this.checkCommonMistakes();
    
    // Validate TypeScript
    this.validateTypeScriptBuild();
    
    // Validate tests
    this.validateJavaScriptTests();
    
    // Check for Swift workspace
    const workspacePath = path.join(__dirname, '..', 'UniversalAITools.xcworkspace');
    if (fs.existsSync(workspacePath)) {
      this.validateSwiftBuild(workspacePath);
      
      const packagePath = path.join(__dirname, '..', 'UniversalAIToolsPackage');
      if (fs.existsSync(packagePath)) {
        this.validateSwiftTests(packagePath);
      }
    }
    
    // Check for Rust
    if (fs.existsSync('Cargo.toml')) {
      this.validateRustBuild();
    }
    
    // Check for Go
    if (fs.existsSync('go.mod')) {
      this.validateGoBuild();
    }
    
    return this.generateReport();
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const validator = new AgentValidator();
  const args = process.argv.slice(2);
  
  if (args.includes('--help')) {
    console.log(`
Agent Validator - Ensure agents properly test and validate their work

Usage:
  node agent-validator.js [options]

Options:
  --full           Run full validation suite
  --files <paths>  Validate specific files (comma-separated)
  --swift          Validate Swift build and tests
  --rust           Validate Rust build
  --go             Validate Go build
  --typescript     Validate TypeScript build
  --tests          Run all tests
  --help           Show this help message

Examples:
  node agent-validator.js --full
  node agent-validator.js --files "src/app.ts,src/config.ts"
  node agent-validator.js --swift --tests
    `);
    process.exit(0);
  }
  
  if (args.includes('--full') || args.length === 0) {
    validator.runFullValidation().then(report => {
      process.exit(report.passed ? 0 : 1);
    });
  } else {
    // Handle specific validation requests
    if (args.includes('--files')) {
      const fileIndex = args.indexOf('--files');
      const files = args[fileIndex + 1].split(',');
      validator.validateFiles(files);
    }
    
    if (args.includes('--typescript')) {
      validator.validateTypeScriptBuild();
    }
    
    if (args.includes('--swift')) {
      const workspacePath = path.join(__dirname, '..', 'UniversalAITools.xcworkspace');
      validator.validateSwiftBuild(workspacePath);
    }
    
    if (args.includes('--rust')) {
      validator.validateRustBuild();
    }
    
    if (args.includes('--go')) {
      validator.validateGoBuild();
    }
    
    if (args.includes('--tests')) {
      validator.validateJavaScriptTests();
    }
    
    const report = validator.generateReport();
    process.exit(report.passed ? 0 : 1);
  }
}

export default AgentValidator;