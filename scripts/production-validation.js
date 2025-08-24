import React from 'react';
#!/usr/bin/env node


import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

class ProductionValidator {
  constructor() {
    this.issues = [];
    this.warnings = [];
  }

  async findFiles(pattern, excludeDirs = ['node_modules', '.git', 'dist', 'build']) {
    const { glob } = await import('glob');
    const excludePattern = excludeDirs.map((dir) => `!**/${dir}/**`).join(' ');
    return glob(pattern, {
      cwd: rootDir,
      ignore: excludeDirs.map((dir) => `**/${dir}/**`),
    });
  }

  async searchInFiles(pattern, fileGlob = '**/*.{ts,tsx,js,jsx}') {
    const files = await this.findFiles(fileGlob);
    const results = [];

    for (const file of files) {
      const content = await fs.readFile(path.join(rootDir, file), 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        if (pattern.test(line)) {
          results.push({
            file,
            line: index + 1,
            content: line.trim(),
          });
        }
      });
    }

    return results;
  }

  async checkMocks() {
    process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.log(chalk.blue('\n🔍 Checking for mock implementations...'));

    const mockPatterns = [
      /\.mock\(/i,
      /jest\.mock/i,
      /mockImplementation/i,
      /mockReturnValue/i,
      /MOCK_/,
      /mock:/,
      /isMock\s*:/,
      /useMock/,
      /enableMocks/,
    ];

    const results = [];
    for (const pattern of mockPatterns) {
      const found = await this.searchInFiles(pattern, '**/*.{ts,tsx,js,jsx}');
      results.push(...found);
    }

    const uniqueFiles = [...new Set(results.map((r) => r.file))];

    if (uniqueFiles.length > 0) {
      this.issues.push({
        type: 'mocks',
        message: `Found ${results.length} mock references in ${uniqueFiles.length} files`,
        files: uniqueFiles,
      });
    }

    return results;
  }

  async checkDisabledCode() {
    console.log(chalk.blue('\n🔍 Checking for disabled/commented code...'));

    const disabledPatterns = [
      /^\s*\/\/.*\.(get|post|put|delete|use|listen)/i,
      /\/\*[\s\S]*?\*\/.*\.(get|post|put|delete)/,
      /\.disabled/,
      /skip\s*:/,
      /disabled\s*:\s*true/,
      /DISABLED/,
      /if\s*\(\s*false\s*\)/,
    ];

    const results = [];
    for (const pattern of disabledPatterns) {
      const found = await this.searchInFiles(pattern);
      results.push(...found);
    }

    if (results.length > 0) {
      this.warnings.push({
        type: 'disabled-code',
        message: `Found ${results.length} instances of disabled code`,
        items: results,
      });
    }

    return results;
  }

  async checkDevKeys() {
    console.log(chalk.blue('\n🔍 Checking for hardcoded development keys...'));

    const keyPatterns = [
      /localhost:(?!80|443)\d+/,
      /127\.0\.0\.1/,
      /0\.0\.0\.0/,
      /test.*key/i,
      /dev.*key/i,
      /demo.*key/i,
      /sample.*key/i,
      /password\s*[:=]\s*["'](?!process\.env)/,
      /secret\s*[:=]\s*["'](?!process\.env)/,
      /api[_-]?key\s*[:=]\s*["'](?!process\.env)/,
    ];

    const results = [];
    for (const pattern of keyPatterns) {
      const found = await this.searchInFiles(pattern);
      results.push(...found);
    }

    if (results.length > 0) {
      this.issues.push({
        type: 'dev-keys',
        message: `Found ${results.length} potential hardcoded development keys`,
        items: results,
      });
    }

    return results;
  }

  async checkTodos() {
    console.log(chalk.blue('\n🔍 Checking for TODO/FIXME comments...'));

    const todoPattern = /\b(TODO|FIXME|HACK|XXX|BUG|OPTIMIZE|REFACTOR)(:|\s)/i;
    const results = await this.searchInFiles(todoPattern);

    if (results.length > 0) {
      this.warnings.push({
        type: 'todos',
        message: `Found ${results.length} TODO/FIXME comments`,
        items: results,
      });
    }

    return results;
  }

  async checkMigrations() {
    console.log(chalk.blue('\n🔍 Checking migration files...'));

    const migrationsDir = path.join(rootDir, 'supabase', 'migrations');
    const files = await fs.readdir(migrationsDir);
    const sqlFiles = files.filter((f) => f.endsWith('.sql'));

    // Check for disabled migrations
    const disabledFiles = sqlFiles.filter((f) => f.endsWith('.disabled'));

    // Check for potential conflicts (same timestamp prefix)
    const timestamps = {};
    sqlFiles.forEach((file) => {
      const match = file.match(/^(\d+)_/);
      if (match) {
        const timestamp = match[1];
        if (!timestamps[timestamp]) {
          timestamps[timestamp] = [];
        }
        timestamps[timestamp].push(file);
      }
    });

    const conflicts = Object.entries(timestamps).filter(([_, files]) => files.length > 1);

    if (disabledFiles.length > 0 || conflicts.length > 0) {
      this.warnings.push({
        type: 'migrations',
        message: `Migration issues: ${disabledFiles.length} disabled files, ${conflicts.length} timestamp conflicts`,
        disabled: disabledFiles,
        conflicts: conflicts.map(([timestamp, files]) => ({ timestamp, files })),
      });
    }

    return { disabledFiles, conflicts };
  }

  async checkSecurity() {
    console.log(chalk.blue('\n🔍 Running security checks...'));

    try {
      // Check for known vulnerabilities
      execSync('npm audit --json', { cwd: rootDir, stdio: 'pipe' });
    } catch (error) {
      const output = error.stdout?.toString() || '';
      try {
        const audit = JSON.parse(output);
        if (audit.metadata && audit.metadata.vulnerabilities) {
          const vulns = audit.metadata.vulnerabilities;
          const total = vulns.total || 0;

          if (total > 0) {
            this.issues.push({
              type: 'security',
              message: `Found ${total} vulnerabilities (${vulns.critical || 0} critical, ${vulns.high || 0} high)`,
              details: vulns,
            });
          }
        }
      } catch (parseError) {
        this.warnings.push({
          type: 'security',
          message: 'Could not parse npm audit results',
        });
      }
    }

    // Check for insecure patterns
    const insecurePatterns = [
      /eval\s*\(/,
      /new\s+Function\s*\(/,
      /innerHTML\s*=/,
      /dangerouslySetInnerHTML/,
      /process\.env\.NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*['"]0['"]/,
    ];

    const results = [];
    for (const pattern of insecurePatterns) {
      const found = await this.searchInFiles(pattern);
      results.push(...found);
    }

    if (results.length > 0) {
      this.warnings.push({
        type: 'insecure-patterns',
        message: `Found ${results.length} potentially insecure code patterns`,
        items: results,
      });
    }
  }

  async generateReport() {
    console.log(chalk.yellow('\n📊 Production Readiness Report\n'));

    if (this.issues.length === 0 && this.warnings.length === 0) {
      console.log(chalk.green('✅ No issues found! The codebase appears to be production ready.'));
      return true;
    }

    if (this.issues.length > 0) {
      console.log(chalk.red(`❌ Found ${this.issues.length} critical issues:\n`));
      this.issues.forEach((issue) => {
        console.log(chalk.red(`  • ${issue.type}: ${issue.message}`));
        if (issue.files) {
          issue.files.slice(0, 5).forEach((file) => {
            console.log(chalk.gray(`    - ${file}`));
          });
          if (issue.files.length > 5) {
            console.log(chalk.gray(`    ... and ${issue.files.length - 5} more files`));
          }
        }
      });
    }

    if (this.warnings.length > 0) {
      console.log(chalk.yellow(`\n⚠️  Found ${this.warnings.length} warnings:\n`));
      this.warnings.forEach((warning) => {
        console.log(chalk.yellow(`  • ${warning.type}: ${warning.message}`));
        if (warning.items && warning.items.length > 0) {
          warning.items.slice(0, 3).forEach((item) => {
            console.log(chalk.gray(`    - ${item.file}:${item.line}`));
          });
          if (warning.items.length > 3) {
            console.log(chalk.gray(`    ... and ${warning.items.length - 3} more`));
          }
        }
      });
    }

    return this.issues.length === 0;
  }

  async runAllChecks() {
    console.log(chalk.bold('\n🚀 Starting Production Validation...\n'));

    await this.checkMocks();
    await this.checkDisabledCode();
    await this.checkDevKeys();
    await this.checkTodos();
    await this.checkMigrations();
    await this.checkSecurity();

    const isReady = await this.generateReport();

    if (!isReady) {
      console.log(chalk.red('\n❌ Production validation failed!'));
      process.exit(1);
    } else {
      console.log(chalk.green('\n✅ Production validation passed!'));
    }
  }

  async runSpecificCheck(checkType) {
    const checkMap = {
      mocks: () => this.checkMocks(),
      disabled: () => this.checkDisabledCode(),
      'dev-keys': () => this.checkDevKeys(),
      todos: () => this.checkTodos(),
      migrations: () => this.checkMigrations(),
      security: () => this.checkSecurity(),
    };

    const checkFn = checkMap[checkType];
    if (!checkFn) {
      process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.error(chalk.red(`Unknown check type: ${checkType}`));
      process.exit(1);
    }

    await checkFn();
    await this.generateReport();
  }
}

// CLI handling
const validator = new ProductionValidator();
const args = process.argv.slice(2);

if (args.length === 0 || args[0] === 'all') {
  validator.runAllChecks();
} else {
  validator.runSpecificCheck(args[0]);
}
