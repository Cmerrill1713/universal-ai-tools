#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

class ClaudeContextGenerator {
  constructor() {
    this.context = {
      timestamp: new Date().toISOString(),
      disabledServices: [],
      mockImplementations: [],
      securityVulnerabilities: [],
      databaseMigrations: {
        total: 0,
        potentialDuplicates: [],
        securityDefinerFunctions: [],
      },
      testCoverage: {
        testFiles: 0,
        untestedDirectories: [],
        coverageAvailable: false,
      },
      todos: [],
      warnings: [],
    };
  }

  log(message, color = colors.reset) {
    process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.log(`${color}${message}${colors.reset}`);
  }

  progress(step, total, message) {
    const percentage = Math.round((step / total) * 100);
    const bar = '█'.repeat(Math.floor(percentage / 5)).padEnd(20, '░');
    process.stdout.write(`\r${colors.cyan}[${bar}] ${percentage}% - ${message}${colors.reset}`);
  }

  async scanDisabledServices() {
    this.log('\n📋 Scanning for disabled services...', colors.bright);

    try {
      const serverPath = path.join(rootDir, 'src/server.ts');
      const content = await fs.readFile(serverPath, 'utf-8');

      // Find commented out imports and services
      const commentedImports = content.match(/\/\/\s*import.*$/gm) || [];
      const commentedMiddleware = content.match(/\/\/\s*app\.use.*$/gm) || [];
      const todoComments = content.match(/\/\/\s*(TODO|FIXME):.*$/gm) || [];

      this.context.disabledServices = [
        ...commentedImports.map((line) => ({
          type: 'import',
          line: line.trim(),
          file: 'src/server.ts',
        })),
        ...commentedMiddleware.map((line) => ({
          type: 'middleware',
          line: line.trim(),
          file: 'src/server.ts',
        })),
      ];

      // Add TODOs from server.ts
      todoComments.forEach((todo) => {
        this.context.todos.push({
          file: 'src/server.ts',
          comment: todo.trim(),
        });
      });

      this.log(`  ✓ Found ${this.context.disabledServices.length} disabled services`, colors.green);
    } catch (error) {
      this.context.warnings.push(`Failed to scan server.ts: ${error.message}`);
    }
  }

  async findMockImplementations() {
    this.log('\n🎭 Finding mock implementations...', colors.bright);

    const patterns = [
      'src/agents/cognitive/**/*.ts',
      'src/services/**/*.ts',
      'src/middleware/**/*.ts',
    ];

    for (const pattern of patterns) {
      const files = await glob(pattern, { cwd: rootDir });

      for (const file of files) {
        try {
          const content = await fs.readFile(path.join(rootDir, file), 'utf-8');

          // Check for mock patterns
          if (
            content.includes('mock') ||
            content.includes('Mock') ||
            content.includes('// TODO: Implement') ||
            content.includes('return Promise.resolve(')
          ) {
            // Extract mock indicators
            const mockImports = content.match(/import.*mock.*from/gi) || [];
            const mockFunctions = content.match(/(?:const|function)\s+\w*mock\w*/gi) || [];
            const todoImplements = content.match(/\/\/\s*TODO:\s*Implement.*$/gm) || [];

            if (mockImports.length > 0 || mockFunctions.length > 0 || todoImplements.length > 0) {
              this.context.mockImplementations.push({
                file,
                imports: mockImports.length,
                functions: mockFunctions.length,
                todos: todoImplements.length,
              });
            }
          }
        } catch (error) {
          // Skip files that can't be read
        }
      }
    }

    this.log(
      `  ✓ Found ${this.context.mockImplementations.length} files with mock implementations`,
      colors.green
    );
  }

  async scanSecurityVulnerabilities() {
    this.log('\n🔒 Scanning for security vulnerabilities...', colors.bright);

    const securityPatterns = [
      { pattern: /["']local-dev-key["']/g, type: 'hardcoded-key' },
      { pattern: /["']test-key["']/g, type: 'hardcoded-key' },
      { pattern: /localhost:\d+/g, type: 'localhost-cors' },
      { pattern: /cors\s*:\s*{\s*origin\s*:\s*true/g, type: 'permissive-cors' },
      { pattern: /process\.env\.\w+\s*\|\|\s*["'][^"']+["']/g, type: 'development-fallback' },
      { pattern: /disable.*security/gi, type: 'disabled-security' },
    ];

    const files = await glob('src/**/*.{ts,js}', { cwd: rootDir });

    for (const file of files) {
      try {
        const content = await fs.readFile(path.join(rootDir, file), 'utf-8');

        for (const { pattern, type } of securityPatterns) {
          const matches = content.match(pattern);
          if (matches) {
            this.context.securityVulnerabilities.push({
              file,
              type,
              matches: matches.length,
              sample: matches[0].substring(0, 50),
            });
          }
        }
      } catch (error) {
        // Skip files that can't be read
      }
    }

    this.log(
      `  ⚠️  Found ${this.context.securityVulnerabilities.length} potential security issues`,
      colors.yellow
    );
  }

  async analyzeDatabaseMigrations() {
    this.log('\n🗄️  Analyzing database migrations...', colors.bright);

    const migrationsDir = path.join(rootDir, 'supabase/migrations');

    try {
      const files = await fs.readdir(migrationsDir);
      const sqlFiles = files.filter((f) => f.endsWith('.sql'));

      this.context.databaseMigrations.total = sqlFiles.length;

      // Group by similar names to find potential duplicates
      const nameGroups = {};

      for (const file of sqlFiles) {
        const content = await fs.readFile(path.join(migrationsDir, file), 'utf-8');

        // Check for SECURITY DEFINER
        if (content.includes('SECURITY DEFINER')) {
          this.context.databaseMigrations.securityDefinerFunctions.push(file);
        }

        // Extract base name for duplicate detection
        const baseName = file.replace(/^\d+_/, '').replace(/\.sql$/, '');
        if (!nameGroups[baseName]) {
          nameGroups[baseName] = [];
        }
        nameGroups[baseName].push(file);
      }

      // Find potential duplicates
      for (const [baseName, files] of Object.entries(nameGroups)) {
        if (files.length > 1) {
          this.context.databaseMigrations.potentialDuplicates.push({
            baseName,
            files,
          });
        }
      }

      this.log(`  ✓ Found ${this.context.databaseMigrations.total} migrations`, colors.green);
      if (this.context.databaseMigrations.potentialDuplicates.length > 0) {
        this.log(
          `  ⚠️  ${this.context.databaseMigrations.potentialDuplicates.length} potential duplicate migrations`,
          colors.yellow
        );
      }
    } catch (error) {
      this.context.warnings.push(`Failed to analyze migrations: ${error.message}`);
    }
  }

  async analyzeTestCoverage() {
    this.log('\n🧪 Analyzing test coverage...', colors.bright);

    // Check for coverage report
    try {
      const coverageExists = await fs
        .access(path.join(rootDir, 'coverage'))
        .then(() => true)
        .catch(() => false);
      this.context.testCoverage.coverageAvailable = coverageExists;

      // Count test files
      const testPatterns = [
        'src/**/*.test.{ts,js}',
        'src/**/*.spec.{ts,js}',
        'tests/**/*.{ts,js}',
        '__tests__/**/*.{ts,js}',
      ];

      let totalTests = 0;
      for (const pattern of testPatterns) {
        const files = await glob(pattern, { cwd: rootDir });
        totalTests += files.length;
      }

      this.context.testCoverage.testFiles = totalTests;

      // Find directories without tests
      const srcDirs = await glob('src/*/', { cwd: rootDir });

      for (const dir of srcDirs) {
        const testFiles = await glob(`${dir}**/*.{test,spec}.{ts,js}`, { cwd: rootDir });
        if (testFiles.length === 0) {
          this.context.testCoverage.untestedDirectories.push(dir);
        }
      }

      this.log(`  ✓ Found ${totalTests} test files`, colors.green);
      if (this.context.testCoverage.untestedDirectories.length > 0) {
        this.log(
          `  ⚠️  ${this.context.testCoverage.untestedDirectories.length} directories without tests`,
          colors.yellow
        );
      }
    } catch (error) {
      this.context.warnings.push(`Failed to analyze test coverage: ${error.message}`);
    }
  }

  async scanAllTodos() {
    this.log('\n📝 Scanning for TODOs and FIXMEs...', colors.bright);

    const files = await glob('src/**/*.{ts,js}', { cwd: rootDir });
    let todoCount = 0;

    for (const file of files) {
      try {
        const content = await fs.readFile(path.join(rootDir, file), 'utf-8');
        const todos = content.match(/\/\/\s*(TODO|FIXME):.*$/gm) || [];

        todos.forEach((todo) => {
          this.context.todos.push({
            file,
            comment: todo.trim(),
          });
          todoCount++;
        });
      } catch (error) {
        // Skip files that can't be read
      }
    }

    this.log(`  ✓ Found ${todoCount} TODOs/FIXMEs`, colors.green);
  }

  generateMarkdown() {
    const md = [];

    md.push('# Claude Context Summary');
    md.push(`\nGenerated: ${new Date(this.context.timestamp).toLocaleString()}\n`);

    // Executive Summary
    md.push('## Executive Summary\n');
    md.push(`- **Disabled Services**: ${this.context.disabledServices.length}`);
    md.push(`- **Mock Implementations**: ${this.context.mockImplementations.length} files`);
    md.push(`- **Security Issues**: ${this.context.securityVulnerabilities.length}`);
    md.push(
      `- **Database Migrations**: ${this.context.databaseMigrations.total} (${this.context.databaseMigrations.potentialDuplicates.length} potential duplicates)`
    );
    md.push(`- **Test Files**: ${this.context.testCoverage.testFiles}`);
    md.push(`- **TODOs/FIXMEs**: ${this.context.todos.length}\n`);

    // Disabled Services
    if (this.context.disabledServices.length > 0) {
      md.push('## Disabled Services\n');
      this.context.disabledServices.forEach((service) => {
        md.push(`- **${service.type}** in \`${service.file}\`: ${service.line}`);
      });
      md.push('');
    }

    // Mock Implementations
    if (this.context.mockImplementations.length > 0) {
      md.push('## Mock Implementations\n');
      this.context.mockImplementations.forEach((mock) => {
        md.push(
          `- \`${mock.file}\`: ${mock.imports} imports, ${mock.functions} functions, ${mock.todos} TODOs`
        );
      });
      md.push('');
    }

    // Security Vulnerabilities
    if (this.context.securityVulnerabilities.length > 0) {
      md.push('## Security Vulnerabilities\n');
      const grouped = {};
      this.context.securityVulnerabilities.forEach((vuln) => {
        if (!grouped[vuln.type]) grouped[vuln.type] = [];
        grouped[vuln.type].push(vuln);
      });

      for (const [type, vulns] of Object.entries(grouped)) {
        md.push(`### ${type}\n`);
        vulns.forEach((vuln) => {
          md.push(`- \`${vuln.file}\`: ${vuln.matches} occurrences (e.g., "${vuln.sample}...")`);
        });
        md.push('');
      }
    }

    // Database Migrations
    md.push('## Database Migrations\n');
    md.push(`Total migrations: ${this.context.databaseMigrations.total}\n`);

    if (this.context.databaseMigrations.potentialDuplicates.length > 0) {
      md.push('### Potential Duplicates\n');
      this.context.databaseMigrations.potentialDuplicates.forEach((dup) => {
        md.push(`- **${dup.baseName}**: ${dup.files.join(', ')}`);
      });
      md.push('');
    }

    if (this.context.databaseMigrations.securityDefinerFunctions.length > 0) {
      md.push('### SECURITY DEFINER Functions\n');
      this.context.databaseMigrations.securityDefinerFunctions.forEach((func) => {
        md.push(`- ${func}`);
      });
      md.push('');
    }

    // Test Coverage
    md.push('## Test Coverage\n');
    md.push(`- Test files: ${this.context.testCoverage.testFiles}`);
    md.push(
      `- Coverage report available: ${this.context.testCoverage.coverageAvailable ? 'Yes' : 'No'}`
    );

    if (this.context.testCoverage.untestedDirectories.length > 0) {
      md.push('\n### Untested Directories\n');
      this.context.testCoverage.untestedDirectories.forEach((dir) => {
        md.push(`- ${dir}`);
      });
      md.push('');
    }

    // Top TODOs (limit to 10)
    if (this.context.todos.length > 0) {
      md.push('## Top TODOs/FIXMEs\n');
      this.context.todos.slice(0, 10).forEach((todo) => {
        md.push(`- \`${todo.file}\`: ${todo.comment}`);
      });
      if (this.context.todos.length > 10) {
        md.push(`\n... and ${this.context.todos.length - 10} more`);
      }
      md.push('');
    }

    // Warnings
    if (this.context.warnings.length > 0) {
      md.push('## Warnings\n');
      this.context.warnings.forEach((warning) => {
        md.push(`- ⚠️  ${warning}`);
      });
    }

    return md.join('\n');
  }

  async saveContext() {
    const contextDir = path.join(rootDir, '.claude-context');

    // Create directory if it doesn't exist
    await fs.mkdir(contextDir, { recursive: true });

    // Save JSON
    const jsonPath = path.join(contextDir, 'context.json');
    await fs.writeFile(jsonPath, JSON.stringify(this.context, null, 2));

    // Save Markdown
    const mdPath = path.join(contextDir, 'context.md');
    const markdown = this.generateMarkdown();
    await fs.writeFile(mdPath, markdown);

    // Also save timestamped versions
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await fs.writeFile(
      path.join(contextDir, `context-${timestamp}.json`),
      JSON.stringify(this.context, null, 2)
    );
    await fs.writeFile(path.join(contextDir, `context-${timestamp}.md`), markdown);

    return { jsonPath, mdPath, markdown };
  }

  async run() {
    const startTime = Date.now();

    console.log(`${colors.bright}${colors.cyan}🤖 Claude Context Generator${colors.reset}\n`);

    const steps = [
      { name: 'Scanning disabled services', fn: () => this.scanDisabledServices() },
      { name: 'Finding mock implementations', fn: () => this.findMockImplementations() },
      { name: 'Scanning security vulnerabilities', fn: () => this.scanSecurityVulnerabilities() },
      { name: 'Analyzing database migrations', fn: () => this.analyzeDatabaseMigrations() },
      { name: 'Analyzing test coverage', fn: () => this.analyzeTestCoverage() },
      { name: 'Scanning TODOs/FIXMEs', fn: () => this.scanAllTodos() },
    ];

    for (let i = 0; i < steps.length; i++) {
      await steps[i].fn();
    }

    // Save context
    this.log('\n💾 Saving context...', colors.bright);
    const { jsonPath, mdPath, markdown } = await this.saveContext();

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    // Output summary
    console.log(
      `\n${colors.bright}${colors.green}✨ Context generation complete in ${duration}s${colors.reset}\n`
    );
    console.log(`Files saved:`);
    console.log(`  - JSON: ${colors.cyan}${jsonPath}${colors.reset}`);
    console.log(`  - Markdown: ${colors.cyan}${mdPath}${colors.reset}\n`);

    // Display markdown summary
    console.log(
      `${colors.bright}${colors.magenta}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`
    );
    console.log(markdown);
    console.log(
      `\n${colors.bright}${colors.magenta}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`
    );
  }
}

// Run the generator
const generator = new ClaudeContextGenerator();
generator.run().catch((error) => {
  process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.error(`${colors.red}Error: ${error.message}${colors.reset}`);
  process.exit(1);
});
