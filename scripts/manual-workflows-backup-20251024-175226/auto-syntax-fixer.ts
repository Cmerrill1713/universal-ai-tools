#!/usr/bin/env tsx

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import chalk from 'chalk';

interface SyntaxPattern {
  name: string;
  description: string;
  pattern: RegExp;
  replacement: string;
  fileTypes: string[];
  severity: 'critical' | 'high' | 'medium' | 'low';
  multiline?: boolean;
}

interface FixReport {
  file: string;
  pattern: string;
  count: number;
  originalContent?: string;
  fixedContent?: string;
}

interface SyntaxFixResults {
  totalFiles: number;
  totalFixes: number;
  fixesByPattern: Record<string, number>;
  fixesByFile: Record<string, FixReport[]>;
  errors: string[];
  skippedFiles: string[];
}

class AutoSyntaxFixer {
  private patterns: SyntaxPattern[] = [];
  private results: SyntaxFixResults = {
    totalFiles: 0,
    totalFixes: 0,
    fixesByPattern: {},
    fixesByFile: {},
    errors: [],
    skippedFiles: [],
  };
  private dryRun: boolean = false;
  private verbose: boolean = false;
  private backupDir: string = '';

  constructor(options: { dryRun?: boolean; verbose?: boolean; backup?: boolean } = {}) {
    this.dryRun = options.dryRun || false;
    this.verbose = options.verbose || false;

    if (options.backup) {
      this.backupDir = path.join(process.cwd(), 'backups', `syntax-fix-${Date.now()}`);
      if (!fs.existsSync(this.backupDir)) {
        fs.mkdirSync(this.backupDir, { recursive: true });
      }
    }

    this.loadPatterns();
  }

  private loadPatterns(): void {
    try {
      const patternsPath = path.join(process.cwd(), 'scripts', 'syntax-patterns.json');
      if (fs.existsSync(patternsPath)) {
        const patternsData = JSON.parse(fs.readFileSync(patternsPath, 'utf8'));
        this.patterns = patternsData.patterns.map((p: any) => ({
          ...p,
          pattern: new RegExp(p.pattern, p.flags || 'g'),
        }));
      } else {
        this.patterns = this.getDefaultPatterns();
        this.savePatterns();
      }
    } catch (error) {
      console.error(chalk.red('Error loading patterns:'), error);
      this.patterns = this.getDefaultPatterns();
    }
  }

  private getDefaultPatterns(): SyntaxPattern[] {
    return [
      {
        name: 'error_property_colon',
        description: 'Fix missing colon after error property',
        pattern: /(?<!\/\/.*)(?<!\/\*[\s\S]*?)\berror\s+(?!instanceof|=>|:|\.|=|\?)/g,
        replacement: 'error:',
        fileTypes: ['.ts', '.tsx', '.js', '.jsx'],
        severity: 'critical',
      },
      {
        name: 'error_instanceof_space',
        description: 'Fix missing space in error instanceof',
        pattern: /\berrorinstanceof\b/g,
        replacement: 'error instanceof',
        fileTypes: ['.ts', '.tsx', '.js', '.jsx'],
        severity: 'critical',
      },
      {
        name: 'template_literal_fix',
        description: 'Fix malformed template literals',
        pattern: /`([^`]*?)\\([^`]*?)`/g,
        replacement: '`$1$2`',
        fileTypes: ['.ts', '.tsx', '.js', '.jsx'],
        severity: 'high',
      },
      {
        name: 'missing_comma_object',
        description: 'Fix missing comma in object literals',
        pattern: /(\w+:\s*[^,}\n]+?)(\s+)(\w+:)/g,
        replacement: '$1,$2$3',
        fileTypes: ['.ts', '.tsx', '.js', '.jsx'],
        severity: 'high',
      },
      {
        name: 'unterminated_string',
        description: 'Fix unterminated strings',
        pattern: /'([^']*?)$/gm,
        replacement: "'$1'",
        fileTypes: ['.ts', '.tsx', '.js', '.jsx'],
        severity: 'critical',
      },
      {
        name: 'missing_parentheses_function',
        description: 'Fix missing parentheses in function calls',
        pattern: /(\w+\.(?:log|error|warn|info|debug))\s+([^(])/g,
        replacement: '$1($2',
        fileTypes: ['.ts', '.tsx', '.js', '.jsx'],
        severity: 'high',
      },
      {
        name: 'content_header_hyphen',
        description: 'Fix content-length and content-type headers',
        pattern: /['"]content[\s_-]*(length|type)['"]:/g,
        replacement: '"content-$1":',
        fileTypes: ['.ts', '.tsx', '.js', '.jsx'],
        severity: 'medium',
      },
      {
        name: 'import_duplicate_constants',
        description: 'Fix duplicate constant imports',
        pattern: /import\s*{\s*([^}]*?),\s*([^}]*?)\s*}\s*from\s*['"]([^'"]*constants[^'"]*)['"]/g,
        replacement: 'import { $1 } from "$3"',
        fileTypes: ['.ts', '.tsx'],
        severity: 'medium',
      },
      {
        name: 'type_annotation_space',
        description: 'Fix spacing in type annotations',
        pattern: /:\s*([A-Z][a-zA-Z]*)\s*</g,
        replacement: ': $1<',
        fileTypes: ['.ts', '.tsx'],
        severity: 'low',
      },
      {
        name: 'export_default_space',
        description: 'Fix export default spacing',
        pattern: /export\s+default\s+{/g,
        replacement: 'export default {',
        fileTypes: ['.ts', '.tsx', '.js', '.jsx'],
        severity: 'low',
      },
      {
        name: 'semicolon_missing',
        description: 'Add missing semicolons',
        pattern: /^(\s*(?:import|export|const|let|var|return|throw|break|continue).*[^;{}\s])$/gm,
        replacement: '$1;',
        fileTypes: ['.ts', '.tsx', '.js', '.jsx'],
        severity: 'medium',
      },
      {
        name: 'double_quote_consistency',
        description: 'Convert single quotes to double quotes for consistency',
        pattern: /'([^']*?)'/g,
        replacement: '"$1"',
        fileTypes: ['.ts', '.tsx', '.js', '.jsx'],
        severity: 'low',
      },
    ];
  }

  private savePatterns(): void {
    try {
      const patternsPath = path.join(process.cwd(), 'scripts', 'syntax-patterns.json');
      const patternsData = {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        patterns: this.patterns.map((p) => ({
          ...p,
          pattern: p.pattern.source,
          flags: p.pattern.flags,
        })),
      };
      fs.writeFileSync(patternsPath, JSON.stringify(patternsData, null, 2));
    } catch (error) {
      console.error(chalk.red('Error saving patterns:'), error);
    }
  }

  public async fixDirectory(dirPath: string): Promise<SyntaxFixResults> {
    console.log(chalk.blue(`🔧 ${this.dryRun ? 'Analyzing' : 'Fixing'} syntax in: ${dirPath}`));

    let files: string[];

    // Check if the path is a file or directory
    const stat = fs.statSync(dirPath);
    if (stat.isFile() && this.isTargetFile(dirPath)) {
      files = [dirPath];
    } else if (stat.isDirectory()) {
      files = this.getAllFiles(dirPath);
    } else {
      console.error(chalk.red(`Error: ${dirPath} is not a valid file or directory`));
      return this.results;
    }

    this.results.totalFiles = files.length;

    for (const file of files) {
      await this.fixFile(file);
    }

    this.generateReport();
    return this.results;
  }

  public async fixStagedFiles(): Promise<SyntaxFixResults> {
    try {
      const stagedFiles = execSync('git diff --cached --name-only', { encoding: 'utf8' })
        .split('\n')
        .filter((file) => file.trim() && this.isTargetFile(file))
        .map((file) => path.resolve(file));

      console.log(
        chalk.blue(`🔧 ${this.dryRun ? 'Analyzing' : 'Fixing'} ${stagedFiles.length} staged files`)
      );

      this.results.totalFiles = stagedFiles.length;

      for (const file of stagedFiles) {
        if (fs.existsSync(file)) {
          await this.fixFile(file);
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
      const items = fs.readdirSync(currentPath);

      for (const item of items) {
        const fullPath = path.join(currentPath, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          // Skip common directories that shouldn't be processed
          if (!['node_modules', '.git', 'dist', 'build', 'coverage'].includes(item)) {
            traverse(fullPath);
          }
        } else if (this.isTargetFile(fullPath)) {
          files.push(fullPath);
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

  private async fixFile(filePath: string): Promise<void> {
    try {
      const originalContent = fs.readFileSync(filePath, 'utf8');
      let fixedContent = originalContent;
      const fileExtension = path.extname(filePath);

      // Create backup if requested
      if (this.backupDir) {
        const relativePath = path.relative(process.cwd(), filePath);
        const backupPath = path.join(this.backupDir, relativePath);
        const backupDir = path.dirname(backupPath);
        if (!fs.existsSync(backupDir)) {
          fs.mkdirSync(backupDir, { recursive: true });
        }
        fs.writeFileSync(backupPath, originalContent);
      }

      const fileReport: FixReport[] = [];

      for (const pattern of this.patterns) {
        if (!pattern.fileTypes.includes(fileExtension)) {
          continue;
        }

        const matches = fixedContent.match(pattern.pattern);
        if (matches && matches.length > 0) {
          const beforeFix = fixedContent;
          fixedContent = fixedContent.replace(pattern.pattern, pattern.replacement);

          const fixCount = matches.length;
          this.results.totalFixes += fixCount;
          this.results.fixesByPattern[pattern.name] =
            (this.results.fixesByPattern[pattern.name] || 0) + fixCount;

          fileReport.push({
            file: filePath,
            pattern: pattern.name,
            count: fixCount,
            originalContent: beforeFix,
            fixedContent: fixedContent,
          });

          if (this.verbose) {
            console.log(
              chalk.green(`  ✓ ${pattern.name}: ${fixCount} fixes in ${path.basename(filePath)}`)
            );
          }
        }
      }

      if (fileReport.length > 0) {
        this.results.fixesByFile[filePath] = fileReport;

        if (!this.dryRun) {
          fs.writeFileSync(filePath, fixedContent);
        }
      }
    } catch (error) {
      const errorMsg = `Error processing ${filePath}: ${error}`;
      this.results.errors.push(errorMsg);
      if (this.verbose) {
        console.error(chalk.red(errorMsg));
      }
    }
  }

  private generateReport(): void {
    console.log('\n' + chalk.bold('🔧 Syntax Fix Report'));
    console.log('═'.repeat(50));

    console.log(chalk.blue(`Files processed: ${this.results.totalFiles}`));
    console.log(chalk.green(`Total fixes: ${this.results.totalFixes}`));

    if (Object.keys(this.results.fixesByPattern).length > 0) {
      console.log('\n' + chalk.bold('Fixes by pattern:'));
      for (const [pattern, count] of Object.entries(this.results.fixesByPattern)) {
        console.log(chalk.yellow(`  ${pattern}: ${count} fixes`));
      }
    }

    if (Object.keys(this.results.fixesByFile).length > 0) {
      console.log('\n' + chalk.bold('Files with fixes:'));
      for (const [file, reports] of Object.entries(this.results.fixesByFile)) {
        const totalFileFixes = reports.reduce((sum, r) => sum + r.count, 0);
        console.log(chalk.cyan(`  ${path.relative(process.cwd(), file)}: ${totalFileFixes} fixes`));
        if (this.verbose) {
          for (const report of reports) {
            console.log(chalk.gray(`    - ${report.pattern}: ${report.count}`));
          }
        }
      }
    }

    if (this.results.errors.length > 0) {
      console.log('\n' + chalk.bold.red('Errors:'));
      for (const error of this.results.errors) {
        console.log(chalk.red(`  ${error}`));
      }
    }

    if (this.dryRun) {
      console.log('\n' + chalk.yellow('📝 This was a dry run. No files were modified.'));
    } else {
      console.log('\n' + chalk.green('✅ Syntax fixes applied successfully!'));
    }

    // Save detailed report to file
    const reportPath = path.join(process.cwd(), 'syntax-fix-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
    console.log(chalk.gray(`📄 Detailed report saved to: ${reportPath}`));
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const options = {
    dryRun: args.includes('--dry-run') || args.includes('-d'),
    verbose: args.includes('--verbose') || args.includes('-v'),
    backup: args.includes('--backup') || args.includes('-b'),
    staged: args.includes('--staged') || args.includes('-s'),
    help: args.includes('--help') || args.includes('-h'),
  };

  if (options.help) {
    console.log(`
${chalk.bold('Auto Syntax Fixer')}

Usage: tsx scripts/auto-syntax-fixer.ts [options] [directory]

Options:
  -d, --dry-run     Analyze without making changes
  -v, --verbose     Show detailed output
  -b, --backup      Create backup of original files
  -s, --staged      Only process git staged files
  -h, --help        Show this help message

Examples:
  tsx scripts/auto-syntax-fixer.ts                    # Fix all files in src/
  tsx scripts/auto-syntax-fixer.ts --staged           # Fix only staged files
  tsx scripts/auto-syntax-fixer.ts --dry-run src/     # Analyze src/ without changes
  tsx scripts/auto-syntax-fixer.ts --backup ./src     # Fix with backup
`);
    process.exit(0);
  }

  const fixer = new AutoSyntaxFixer(options);

  try {
    let results: SyntaxFixResults;

    if (options.staged) {
      results = await fixer.fixStagedFiles();
    } else {
      const targetDir = args.find((arg) => !arg.startsWith('-')) || './src';
      results = await fixer.fixDirectory(path.resolve(targetDir));
    }

    process.exit(results.errors.length > 0 ? 1 : 0);
  } catch (error) {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  }
}

// Check if this is the main module (ES module compatible)
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { AutoSyntaxFixer, SyntaxPattern, FixReport, SyntaxFixResults };
