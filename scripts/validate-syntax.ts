import React from 'react';
#!/usr/bin/env tsx

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import chalk from 'chalk';
import { parse } from '@typescript-eslint/parser';
import * as typescript from 'typescript';

interface SyntaxError {
  file: string;
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning';
  code?: string;
}

interface ValidationResults {
  totalFiles: number;
  validFiles: number;
  filesWithErrors: number;
  errors: SyntaxError[];
  warnings: SyntaxError[];
  summary: {
    parseErrors: number;
    typeErrors: number;
    eslintErrors: number;
    criticalIssues: string[];
  };
}

class SyntaxValidator {
  private results: ValidationResults = {
    totalFiles: 0,
    validFiles: 0,
    filesWithErrors: 0,
    errors: [],
    warnings: [],
    summary: {
      parseErrors: 0,
      typeErrors: 0,
      eslintErrors: 0,
      criticalIssues: [],
    },
  };
  private verbose: boolean = false;

  constructor(options: { verbose?: boolean } = {}) {
    this.verbose = options.verbose || false;
  }

  public async validateDirectory(dirPath: string): Promise<ValidationResults> {
    process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.log(chalk.blue(`🔍 Validating syntax in: ${dirPath}`));

    let files: string[];

    // Check if the path is a file or directory
    const stat = fs.statSync(dirPath);
    if (stat.isFile() && this.isTargetFile(dirPath)) {
      files = [dirPath];
    } else if (stat.isDirectory()) {
      files = this.getAllFiles(dirPath);
    } else {
      process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.error(chalk.red(`Error: ${dirPath} is not a valid file or directory`));
      return this.results;
    }

    this.results.totalFiles = files.length;

    for (const file of files) {
      await this.validateFile(file);
    }

    this.generateReport();
    return this.results;
  }

  public async validateStagedFiles(): Promise<ValidationResults> {
    try {
      const stagedFiles = execSync('git diff --cached --name-only', { encoding: 'utf8' })
        .split('\n')
        .filter((file) => file.trim() && this.isTargetFile(file))
        .map((file) => path.resolve(file));

      console.log(chalk.blue(`🔍 Validating ${stagedFiles.length} staged files`));

      this.results.totalFiles = stagedFiles.length;

      for (const file of stagedFiles) {
        if (fs.existsSync(file)) {
          await this.validateFile(file);
        }
      }

      this.generateReport();
      return this.results;
    } catch (error) {
      console.error(chalk.red('Error getting staged files:'), error);
      return this.results;
    }
  }

  private getAllFiles(dirPath: string): string[] {
    const files: string[] = [];

    const traverse = (currentPath: string) => {
      try {
        const items = fs.readdirSync(currentPath);

        for (const item of items) {
          const fullPath = path.join(currentPath, item);
          const stat = fs.statSync(fullPath);

          if (stat.isDirectory()) {
            if (
              !['node_modules', '.git', 'dist', 'build', 'coverage', '__pycache__'].includes(item)
            ) {
              traverse(fullPath);
            }
          } else if (this.isTargetFile(fullPath)) {
            files.push(fullPath);
          }
        }
      } catch (error) {
        if (this.verbose) {
          process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.warn(chalk.yellow(`Warning: Could not read directory ${currentPath}`));
        }
      }
    };

    traverse(dirPath);
    return files;
  }

  private isTargetFile(filePath: string): boolean {
    const ext = path.extname(filePath);
    return ['.ts', '.tsx', '.js', '.jsx'].includes(ext);
  }

  private async validateFile(filePath: string): Promise<void> {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const fileExtension = path.extname(filePath);
      let hasErrors = false;

      // 1. Basic syntax validation
      await this.validateBasicSyntax(filePath, content);

      // 2. TypeScript/JavaScript parsing validation
      if (['.ts', '.tsx'].includes(fileExtension)) {
        hasErrors = (await this.validateTypeScript(filePath, content)) || hasErrors;
      } else {
        hasErrors = (await this.validateJavaScript(filePath, content)) || hasErrors;
      }

      // 3. Pattern-based validation
      hasErrors = (await this.validatePatterns(filePath, content)) || hasErrors;

      // 4. ESLint validation (if available)
      await this.validateWithESLint(filePath);

      if (!hasErrors) {
        this.results.validFiles++;
      } else {
        this.results.filesWithErrors++;
      }

      if (this.verbose && !hasErrors) {
        console.log(chalk.green(`  ✓ ${path.basename(filePath)} - Valid`));
      }
    } catch (error) {
      this.addError(filePath, 0, 0, `Validation error: ${error}`, 'error');
      this.results.filesWithErrors++;
    }
  }

  private async validateBasicSyntax(filePath: string, content: string): Promise<boolean> {
    let hasErrors = false;
    const lines = content.split('\n');

    // Check for common syntax issues
    const checks = [
      {
        pattern: /\berror\s+(?!instanceof|=>|:|\.|=|\?)/g,
        message: 'Missing colon after "error" in object property',
        severity: 'error' as const,
      },
      {
        pattern: /\berrorinstanceof\b/g,
        message: 'Missing space in "error instanceof"',
        severity: 'error' as const,
      },
      {
        pattern: /`[^`]*\\[^`]*`/g,
        message: 'Malformed template literal with backslash',
        severity: 'error' as const,
      },
      {
        pattern: /'[^']*$/gm,
        message: 'Unterminated single quote string',
        severity: 'error' as const,
      },
      {
        pattern: /"[^"]*$/gm,
        message: 'Unterminated double quote string',
        severity: 'error' as const,
      },
      {
        pattern: /\w+\.(log|error|warn|info|debug)\s+[^(]/g,
        message: 'Missing parentheses in logger call',
        severity: 'warning' as const,
      },
    ];

    for (const check of checks) {
      const matches = content.matchAll(check.pattern);
      for (const match of matches) {
        const lineNumber = content.substring(0, match.index).split('\n').length;
        const columnNumber = match.index! - content.lastIndexOf('\n', match.index! - 1);

        this.addError(filePath, lineNumber, columnNumber, check.message, check.severity);
        hasErrors = true;
      }
    }

    return hasErrors;
  }

  private async validateTypeScript(filePath: string, content: string): Promise<boolean> {
    try {
      // Use TypeScript compiler to check for syntax errors
      const sourceFile = typescript.createSourceFile(
        filePath,
        content,
        typescript.ScriptTarget.Latest,
        true
      );

      // Check for parse errors
      if (sourceFile.parseDiagnostics && sourceFile.parseDiagnostics.length > 0) {
        for (const diagnostic of sourceFile.parseDiagnostics) {
          const position = sourceFile.getLineAndCharacterOfPosition(diagnostic.start || 0);
          this.addError(
            filePath,
            position.line + 1,
            position.character + 1,
            typescript.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
            'error'
          );
          this.results.summary.parseErrors++;
        }
        return true;
      }

      // Additional TypeScript-specific checks
      const program = typescript.createProgram([filePath], {
        allowJs: true,
        checkJs: false,
        noEmit: true,
        skipLibCheck: true,
      });

      const diagnostics = typescript.getPreEmitDiagnostics(program, sourceFile);
      if (diagnostics.length > 0) {
        for (const diagnostic of diagnostics) {
          if (diagnostic.file) {
            const position = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start || 0);
            this.addError(
              filePath,
              position.line + 1,
              position.character + 1,
              typescript.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
              'warning'
            );
          }
          this.results.summary.typeErrors++;
        }
      }

      return false;
    } catch (error) {
      this.addError(filePath, 0, 0, `TypeScript validation error: ${error}`, 'error');
      return true;
    }
  }

  private async validateJavaScript(filePath: string, content: string): Promise<boolean> {
    try {
      // Use @typescript-eslint/parser to parse JavaScript
      parse(content, {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: {
          jsx: filePath.endsWith('.jsx'),
        },
      });
      return false;
    } catch (error: unknown) {
      if (error.lineNumber && error.column) {
        this.addError(filePath, error.lineNumber, error.column, error.message, 'error');
      } else {
        this.addError(filePath, 0, 0, `Parse error: ${error.message}`, 'error');
      }
      this.results.summary.parseErrors++;
      return true;
    }
  }

  private async validatePatterns(filePath: string, content: string): Promise<boolean> {
    let hasErrors = false;

    // Check for critical patterns that indicate syntax issues
    const criticalPatterns = [
      {
        pattern: /\w+\s+\w+(?!.*[:,=])/g,
        message: 'Potential missing operator or delimiter',
        context: 'object-property',
      },
      {
        pattern: /{\s*\w+\s+\w+/g,
        message: 'Missing colon in object literal',
        context: 'object-literal',
      },
      {
        pattern: /\)\s*{[^}]*$/gm,
        message: 'Unclosed block or missing closing brace',
        context: 'block',
      },
      {
        pattern: /\([^)]*$/gm,
        message: 'Unclosed parenthesis',
        context: 'parenthesis',
      },
    ];

    for (const pattern of criticalPatterns) {
      const matches = content.matchAll(pattern.pattern);
      for (const match of matches) {
        const lineNumber = content.substring(0, match.index).split('\n').length;
        const columnNumber = match.index! - content.lastIndexOf('\n', match.index! - 1);

        this.addError(
          filePath,
          lineNumber,
          columnNumber,
          `${pattern.message} (${pattern.context})`,
          'warning'
        );
        hasErrors = true;
      }
    }

    return hasErrors;
  }

  private async validateWithESLint(filePath: string): Promise<void> {
    try {
      // Try to run ESLint on the file
      const result = execSync(
        `npx eslint "${filePath}" --format json --no-eslintrc --config .eslintrc.json`,
        {
          encoding: 'utf8',
          stdio: 'pipe',
        }
      );

      const lintResults = JSON.parse(result);
      if (lintResults && lintResults.length > 0) {
        const fileResult = lintResults[0];
        if (fileResult.messages) {
          for (const message of fileResult.messages) {
            this.addError(
              filePath,
              message.line || 0,
              message.column || 0,
              `ESLint: ${message.message} (${message.ruleId || 'unknown'})`,
              message.severity === 2 ? 'error' : 'warning'
            );
            this.results.summary.eslintErrors++;
          }
        }
      }
    } catch (error) {
      // ESLint might not be configured or file might have syntax errors
      if (this.verbose) {
        console.log(chalk.yellow(`  ⚠ Could not run ESLint on ${path.basename(filePath)}`));
      }
    }
  }

  private addError(
    file: string,
    line: number,
    column: number,
    message: string,
    severity: 'error' | 'warning'
  ): void {
    const error: SyntaxError = { file, line, column, message, severity };

    if (severity === 'error') {
      this.results.errors.push(error);

      // Track critical issues
      if (
        message.includes('parse') ||
        message.includes('syntax') ||
        message.includes('unterminated')
      ) {
        this.results.summary.criticalIssues.push(`${path.basename(file)}:${line} - ${message}`);
      }
    } else {
      this.results.warnings.push(error);
    }

    if (this.verbose) {
      const icon = severity === 'error' ? '❌' : '⚠️';
      const color = severity === 'error' ? chalk.red : chalk.yellow;
      console.log(color(`  ${icon} ${path.basename(file)}:${line}:${column} - ${message}`));
    }
  }

  private generateReport(): void {
    console.log('\n' + chalk.bold('🔍 Syntax Validation Report'));
    console.log('═'.repeat(50));

    console.log(chalk.blue(`Files processed: ${this.results.totalFiles}`));
    console.log(chalk.green(`Valid files: ${this.results.validFiles}`));
    console.log(chalk.red(`Files with issues: ${this.results.filesWithErrors}`));
    console.log(chalk.red(`Total errors: ${this.results.errors.length}`));
    console.log(chalk.yellow(`Total warnings: ${this.results.warnings.length}`));

    if (this.results.summary.criticalIssues.length > 0) {
      console.log('\n' + chalk.bold.red('🚨 Critical Issues:'));
      for (const issue of this.results.summary.criticalIssues) {
        console.log(chalk.red(`  ${issue}`));
      }
    }

    if (this.results.errors.length > 0) {
      console.log('\n' + chalk.bold.red('❌ Errors by file:'));
      const errorsByFile = this.groupByFile(this.results.errors);
      for (const [file, errors] of Object.entries(errorsByFile)) {
        console.log(chalk.red(`  ${path.relative(process.cwd(), file)}: ${errors.length} errors`));
        if (this.verbose) {
          for (const error of errors.slice(0, 5)) {
            // Show first 5 errors
            console.log(chalk.gray(`    Line ${error.line}: ${error.message}`));
          }
          if (errors.length > 5) {
            console.log(chalk.gray(`    ... and ${errors.length - 5} more`));
          }
        }
      }
    }

    if (this.results.warnings.length > 0 && this.verbose) {
      console.log('\n' + chalk.bold.yellow('⚠️ Warnings by file:'));
      const warningsByFile = this.groupByFile(this.results.warnings);
      for (const [file, warnings] of Object.entries(warningsByFile)) {
        console.log(
          chalk.yellow(`  ${path.relative(process.cwd(), file)}: ${warnings.length} warnings`)
        );
      }
    }

    console.log('\n' + chalk.bold('📊 Summary:'));
    console.log(chalk.blue(`  Parse errors: ${this.results.summary.parseErrors}`));
    console.log(chalk.blue(`  Type errors: ${this.results.summary.typeErrors}`));
    console.log(chalk.blue(`  ESLint errors: ${this.results.summary.eslintErrors}`));

    const validationScore = ((this.results.validFiles / this.results.totalFiles) * 100).toFixed(1);
    console.log('\n' + chalk.bold(`🎯 Validation Score: ${validationScore}%`));

    if (this.results.errors.length === 0) {
      console.log('\n' + chalk.green('✅ All files passed syntax validation!'));
    } else {
      console.log('\n' + chalk.red('❌ Syntax validation failed. Please fix the errors above.'));
    }

    // Save detailed report to file
    const reportPath = path.join(process.cwd(), 'syntax-validation-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
    console.log(chalk.gray(`📄 Detailed report saved to: ${reportPath}`));
  }

  private groupByFile(items: SyntaxError[]): Record<string, SyntaxError[]> {
    return items.reduce(
      (acc, item) => {
        if (!acc[item.file]) {
          acc[item.file] = [];
        }
        acc[item.file].push(item);
        return acc;
      },
      {} as Record<string, SyntaxError[]>
    );
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const options = {
    verbose: args.includes('--verbose') || args.includes('-v'),
    staged: args.includes('--staged') || args.includes('-s'),
    help: args.includes('--help') || args.includes('-h'),
  };

  if (options.help) {
    console.log(`
${chalk.bold('Syntax Validator')}

Usage: tsx scripts/validate-syntax.ts [options] [directory]

Options:
  -v, --verbose     Show detailed output including warnings
  -s, --staged      Only validate git staged files
  -h, --help        Show this help message

Examples:
  tsx scripts/validate-syntax.ts                # Validate all files in src/
  tsx scripts/validate-syntax.ts --staged       # Validate only staged files
  tsx scripts/validate-syntax.ts --verbose src/ # Validate src/ with detailed output
`);
    process.exit(0);
  }

  const validator = new SyntaxValidator(options);

  try {
    let results: ValidationResults;

    if (options.staged) {
      results = await validator.validateStagedFiles();
    } else {
      const targetDir = args.find((arg) => !arg.startsWith('-')) || './src';
      results = await validator.validateDirectory(path.resolve(targetDir));
    }

    // Exit with error code if there are critical issues
    const hasCriticalIssues =
      results.errors.length > 0 || results.summary.criticalIssues.length > 0;
    process.exit(hasCriticalIssues ? 1 : 0);
  } catch (error) {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  }
}

// Check if this is the main module (ES module compatible)
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { SyntaxValidator, SyntaxError, ValidationResults };
