#!/usr/bin/env tsx
/**
 * Enhanced Error Diagnostics Tool
 * Provides comprehensive error analysis and auto-fix suggestions
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import chalk from 'chalk';

interface ErrorInfo {
  file: string;
  line: number;
  column: number;
  message: string;
  code?: string;
  severity: 'error' | 'warning';
  category: string;
  suggestion?: string;
}

interface DiagnosticResult {
  totalErrors: number;
  totalWarnings: number;
  fileCount: number;
  categories: Record<string, number>;
  errors: ErrorInfo[];
  fixableErrors: ErrorInfo[];
}

class EnhancedErrorDiagnostics {
  private errors: ErrorInfo[] = [];
  private fixPatterns = new Map<string, (error: ErrorInfo) => string>();

  constructor() {
    this.initializeFixPatterns();
  }

  private initializeFixPatterns() {
    // Common TypeScript error patterns and their fixes
    this.fixPatterns.set('TS2339', (error) => {
      // Property does not exist
      return `Consider adding type annotation or interface definition`;
    });

    this.fixPatterns.set('TS2345', (error) => {
      // Argument type mismatch
      return `Check argument types and consider type assertion or conversion`;
    });

    this.fixPatterns.set('TS7006', (error) => {
      // Parameter implicitly has 'any' type
      return `Add explicit type annotation to parameter`;
    });

    this.fixPatterns.set('ParseError', (error) => {
      if (error.message.includes('Unexpected token')) {
        return `Check for missing brackets, parentheses, or semicolons`;
      }
      if (error.message.includes('Unterminated string')) {
        return `Check for missing closing quotes in strings`;
      }
      return `Syntax error - check code structure`;
    });
  }

  async runDiagnostics(): Promise<DiagnosticResult> {
    console.log(chalk.blue('🔍 Running Enhanced Error Diagnostics...\n'));

    // Clear previous errors
    this.errors = [];

    // Run multiple diagnostic checks
    await this.runTypeScriptCheck();
    await this.runESLintCheck();
    await this.runSyntaxCheck();
    await this.runImportCheck();

    // Analyze and categorize errors
    const result = this.analyzeErrors();

    // Generate report
    this.generateReport(result);

    return result;
  }

  private async runTypeScriptCheck() {
    console.log(chalk.yellow('📘 Running TypeScript diagnostics...'));

    try {
      execSync('npx tsc --noEmit --pretty false', {
        encoding: 'utf8',
        stdio: 'pipe',
      });
    } catch (error: any) {
      const output = error.stdout || error.message;
      this.parseTypeScriptErrors(output);
    }
  }

  private async runESLintCheck() {
    console.log(chalk.yellow('🔧 Running ESLint diagnostics...'));

    try {
      const output = execSync('npx eslint src --format json', {
        encoding: 'utf8',
        stdio: 'pipe',
      });
      this.parseESLintErrors(output);
    } catch (error: any) {
      if (error.stdout) {
        this.parseESLintErrors(error.stdout);
      }
    }
  }

  private async runSyntaxCheck() {
    console.log(chalk.yellow('🔍 Running syntax analysis...'));

    const files = glob.sync('src/**/*.{ts,tsx,js,jsx}');

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf8');
        this.analyzeSyntax(file, content);
      } catch (error) {
        this.errors.push({
          file,
          line: 0,
          column: 0,
          message: `Failed to read file: ${error}`,
          severity: 'error',
          category: 'FileSystem',
        });
      }
    }
  }

  private async runImportCheck() {
    console.log(chalk.yellow('📦 Checking imports...'));

    const files = glob.sync('src/**/*.{ts,tsx}');

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf8');
        this.analyzeImports(file, content);
      } catch (error) {
        // Skip files that can't be read
      }
    }
  }

  private parseTypeScriptErrors(output: string) {
    const lines = output.split('\n');
    const errorRegex = /^(.+)\((\d+),(\d+)\): error (TS\d+): (.+)$/;

    for (const line of lines) {
      const match = line.match(errorRegex);
      if (match) {
        const [, file, lineStr, colStr, code, message] = match;
        this.errors.push({
          file,
          line: parseInt(lineStr),
          column: parseInt(colStr),
          message,
          code,
          severity: 'error',
          category: 'TypeScript',
          suggestion: this.fixPatterns.get(code)?.(null as any),
        });
      }
    }
  }

  private parseESLintErrors(output: string) {
    try {
      const results = JSON.parse(output);

      for (const result of results) {
        for (const message of result.messages) {
          this.errors.push({
            file: result.filePath,
            line: message.line || 0,
            column: message.column || 0,
            message: message.message,
            code: message.ruleId,
            severity: message.severity === 2 ? 'error' : 'warning',
            category: 'ESLint',
            suggestion: message.fix ? 'Auto-fixable with --fix' : undefined,
          });
        }
      }
    } catch (error) {
      // Invalid JSON output
    }
  }

  private analyzeSyntax(file: string, content: string) {
    // Check for common syntax issues
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      // Unterminated strings
      const stringMatches = line.match(/['"`]([^'"`]*?)$/);
      if (stringMatches && !line.includes('//')) {
        this.errors.push({
          file,
          line: index + 1,
          column: stringMatches.index || 0,
          message: 'Possibly unterminated string literal',
          severity: 'error',
          category: 'Syntax',
          suggestion: 'Add closing quote',
        });
      }

      // Missing semicolons (for statements that typically need them)
      if (
        line.match(/^[^/]*\b(const|let|var|return|throw|break|continue)\b[^;]*$/) &&
        !line.includes('{') &&
        !line.trim().endsWith(',') &&
        !line.includes('//')
      ) {
        this.errors.push({
          file,
          line: index + 1,
          column: line.length,
          message: 'Missing semicolon',
          severity: 'warning',
          category: 'Style',
          suggestion: 'Add semicolon at end of line',
        });
      }

      // Unmatched brackets
      const openBrackets = (line.match(/[\[{(]/g) || []).length;
      const closeBrackets = (line.match(/[\]})]/g) || []).length;

      if (openBrackets !== closeBrackets && !line.includes('//')) {
        this.errors.push({
          file,
          line: index + 1,
          column: 0,
          message: `Unmatched brackets: ${openBrackets} open, ${closeBrackets} close`,
          severity: 'error',
          category: 'Syntax',
          suggestion: 'Check bracket matching',
        });
      }
    });
  }

  private analyzeImports(file: string, content: string) {
    const importRegex =
      /import\s+(?:(?:\{[^}]*\})|(?:\*\s+as\s+\w+)|(?:\w+))\s+from\s+['"]([^'"]+)['"]/g;
    const matches = [...content.matchAll(importRegex)];

    for (const match of matches) {
      const importPath = match[1];

      // Check for duplicate imports
      const duplicates = matches.filter((m) => m[1] === importPath);
      if (duplicates.length > 1) {
        this.errors.push({
          file,
          line: 0, // Would need to calculate actual line
          column: 0,
          message: `Duplicate import from '${importPath}'`,
          severity: 'warning',
          category: 'Import',
          suggestion: 'Combine imports from same module',
        });
      }

      // Check for missing file extensions in relative imports
      if (importPath.startsWith('.') && !importPath.match(/\.(ts|tsx|js|jsx|json)$/)) {
        const resolvedPath = path.resolve(path.dirname(file), importPath);
        if (
          !fs.existsSync(resolvedPath + '.ts') &&
          !fs.existsSync(resolvedPath + '.tsx') &&
          !fs.existsSync(resolvedPath + '/index.ts')
        ) {
          this.errors.push({
            file,
            line: 0,
            column: 0,
            message: `Cannot resolve import '${importPath}'`,
            severity: 'error',
            category: 'Import',
            suggestion: 'Check import path and file extension',
          });
        }
      }
    }
  }

  private analyzeErrors(): DiagnosticResult {
    const categories: Record<string, number> = {};
    const fileSet = new Set<string>();
    let totalErrors = 0;
    let totalWarnings = 0;

    for (const error of this.errors) {
      fileSet.add(error.file);
      categories[error.category] = (categories[error.category] || 0) + 1;

      if (error.severity === 'error') {
        totalErrors++;
      } else {
        totalWarnings++;
      }
    }

    const fixableErrors = this.errors.filter((e) => e.suggestion);

    return {
      totalErrors,
      totalWarnings,
      fileCount: fileSet.size,
      categories,
      errors: this.errors,
      fixableErrors,
    };
  }

  private generateReport(result: DiagnosticResult) {
    console.log(chalk.blue('\n📊 Diagnostic Report\n'));

    console.log(chalk.white('Summary:'));
    console.log(`  Total Errors: ${chalk.red(result.totalErrors)}`);
    console.log(`  Total Warnings: ${chalk.yellow(result.totalWarnings)}`);
    console.log(`  Files with Issues: ${chalk.cyan(result.fileCount)}`);
    console.log(`  Fixable Issues: ${chalk.green(result.fixableErrors.length)}\n`);

    console.log(chalk.white('Categories:'));
    for (const [category, count] of Object.entries(result.categories)) {
      console.log(`  ${category}: ${count}`);
    }

    // Show top errors
    console.log(chalk.white('\nTop Issues:'));
    const topErrors = result.errors.filter((e) => e.severity === 'error').slice(0, 10);

    for (const error of topErrors) {
      console.log(`\n${chalk.red('❌')} ${chalk.cyan(error.file)}:${error.line}:${error.column}`);
      console.log(`   ${error.message}`);
      if (error.suggestion) {
        console.log(`   ${chalk.green('💡')} ${error.suggestion}`);
      }
    }

    // Save detailed report
    const reportPath = path.join(process.cwd(), 'error-diagnostic-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(result, null, 2));
    console.log(`\n${chalk.blue('📄')} Detailed report saved to: ${chalk.cyan(reportPath)}`);

    // Generate fix script if there are fixable errors
    if (result.fixableErrors.length > 0) {
      this.generateFixScript(result.fixableErrors);
    }
  }

  private generateFixScript(fixableErrors: ErrorInfo[]) {
    const fixScriptPath = path.join(process.cwd(), 'auto-fix-errors.sh');

    let script = `#!/bin/bash
# Auto-generated fix script for common errors
# Generated on ${new Date().toISOString()}

echo "🔧 Starting auto-fix process..."

# ESLint auto-fix
echo "Running ESLint auto-fix..."
npx eslint src --fix

# Prettier formatting
echo "Running Prettier..."
npx prettier --write "src/**/*.{ts,tsx,js,jsx}"

# Custom fixes
`;

    // Group errors by file for efficient fixing
    const errorsByFile = new Map<string, ErrorInfo[]>();
    for (const error of fixableErrors) {
      if (!errorsByFile.has(error.file)) {
        errorsByFile.set(error.file, []);
      }
      errorsByFile.get(error.file)!.push(error);
    }

    // Add file-specific fixes
    for (const [file, errors] of errorsByFile) {
      script += `\n# Fixes for ${file}\n`;
      script += `echo "Fixing ${file}..."\n`;

      // Add sed commands for common fixes
      for (const error of errors) {
        if (error.message.includes('Missing semicolon')) {
          script += `sed -i '' '${error.line}s/$/;/' "${file}"\n`;
        }
      }
    }

    script += `\necho "✅ Auto-fix complete!"`;

    fs.writeFileSync(fixScriptPath, script);
    fs.chmodSync(fixScriptPath, '755');

    console.log(`\n${chalk.green('🔧')} Fix script generated: ${chalk.cyan(fixScriptPath)}`);
    console.log(`   Run ${chalk.yellow('./auto-fix-errors.sh')} to apply fixes`);
  }
}

// Run diagnostics
const diagnostics = new EnhancedErrorDiagnostics();
diagnostics.runDiagnostics().then((result) => {
  console.log(chalk.blue('\n✨ Diagnostics complete!\n'));

  if (result.totalErrors === 0) {
    console.log(chalk.green('🎉 No errors found!'));
  } else {
    console.log(chalk.yellow(`Found ${result.totalErrors} errors to fix.`));
    console.log(chalk.cyan('Run npm run dev to see real-time errors.'));
  }
});
