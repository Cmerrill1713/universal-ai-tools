#!/usr/bin/env npx tsx

/**
 * Codebase Integrity Validator
 * Detects potential hallucinations, missing imports, and inconsistencies
 */

import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';

interface ValidationError {
  type: 'MISSING_IMPORT' | 'INVALID_PATH' | 'UNDEFINED_REFERENCE' | 'SYNTAX_ERROR' | 'INCONSISTENT_NAMING';
  file: string;
  line?: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
  suggestion?: string;
}

interface ValidationReport {
  totalFiles: number;
  errorsFound: number;
  warningsFound: number;
  errors: ValidationError[];
  summary: {
    missingImports: number;
    invalidPaths: number;
    undefinedReferences: number;
    syntaxErrors: number;
    inconsistentNaming: number;
  };
}

class CodebaseIntegrityValidator {
  private errors: ValidationError[] = [];
  private projectRoot: string;
  private sourceFiles: string[] = [];

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }

  async validate(): Promise<ValidationReport> {
    console.log('🔍 Starting codebase integrity validation...');
    
    // Find all source files
    this.sourceFiles = await this.findSourceFiles();
    console.log(`📁 Found ${this.sourceFiles.length} source files`);

    // Run validation checks
    await this.validateImports();
    await this.validateServiceReferences();
    await this.validateRouterConsistency();
    await this.validateTypeDefinitions();
    await this.validateConfigReferences();

    // Generate report
    const report = this.generateReport();
    await this.saveReport(report);
    
    return report;
  }

  private async findSourceFiles(): Promise<string[]> {
    const patterns = [
      'src/**/*.ts',
      'src/**/*.js',
      '!src/**/*.test.ts',
      '!src/**/*.test.js',
      '!src/**/*.d.ts'
    ];

    const files: string[] = [];
    for (const pattern of patterns) {
      const matches = await glob(pattern, { cwd: this.projectRoot });
      files.push(...matches.map(f => path.resolve(this.projectRoot, f)));
    }

    return files;
  }

  private async validateImports(): Promise<void> {
    console.log('🔗 Validating imports...');

    for (const filePath of this.sourceFiles) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]?.trim() || '';
          
          // Check import statements
          if (line.startsWith('import ') && line.includes('from ')) {
            await this.validateImportStatement(filePath, i + 1, line);
          }

          // Check dynamic imports
          if (line.includes('import(') || line.includes('await import(')) {
            await this.validateDynamicImport(filePath, i + 1, line);
          }

          // Check require statements
          if (line.includes('require(')) {
            await this.validateRequireStatement(filePath, i + 1, line);
          }
        }
      } catch (error) {
        this.addError({
          type: 'SYNTAX_ERROR',
          file: filePath,
          message: `Failed to read file: ${error}`,
          severity: 'error'
        });
      }
    }
  }

  private async validateImportStatement(filePath: string, lineNumber: number, line: string): Promise<void> {
    const importMatch = line.match(/from\s+['"`]([^'"`]+)['"`]/);
    if (!importMatch) return;

    const importPath = importMatch[1];
    
    // Skip node_modules imports  
    if (!importPath || (!importPath.startsWith('.') && !importPath.startsWith('@/'))) {
      return;
    }

    // Resolve the import path
    const resolvedPath = await this.resolveImportPath(filePath, importPath);
    
    if (!resolvedPath) {
      this.addError({
        type: 'MISSING_IMPORT',
        file: filePath,
        line: lineNumber,
        message: `Import path '${importPath}' cannot be resolved`,
        severity: 'error',
        suggestion: `Check if the file exists or update the import path`
      });
    }
  }

  private async validateDynamicImport(filePath: string, lineNumber: number, line: string): Promise<void> {
    const importMatch = line.match(/import\(['"`]([^'"`]+)['"`]\)/);
    if (!importMatch) return;

    const importPath = importMatch[1];
    
    // Skip node_modules imports
    if (!importPath || (!importPath.startsWith('.') && !importPath.startsWith('@/'))) {
      return;
    }

    const resolvedPath = await this.resolveImportPath(filePath, importPath);
    
    if (!resolvedPath) {
      this.addError({
        type: 'MISSING_IMPORT',
        file: filePath,
        line: lineNumber,
        message: `Dynamic import path '${importPath}' cannot be resolved`,
        severity: 'error',
        suggestion: `Check if the file exists or update the import path`
      });
    }
  }

  private async validateRequireStatement(filePath: string, lineNumber: number, line: string): Promise<void> {
    const requireMatch = line.match(/require\(['"`]([^'"`]+)['"`]\)/);
    if (!requireMatch) return;

    const importPath = requireMatch[1];
    
    // Skip node_modules imports
    if (!importPath || (!importPath.startsWith('.') && !importPath.startsWith('@/'))) {
      return;
    }

    const resolvedPath = await this.resolveImportPath(filePath, importPath);
    
    if (!resolvedPath) {
      this.addError({
        type: 'MISSING_IMPORT',
        file: filePath,
        line: lineNumber,
        message: `Require path '${importPath}' cannot be resolved`,
        severity: 'error',
        suggestion: `Check if the file exists or update the require path`
      });
    }
  }

  private async resolveImportPath(fromFile: string, importPath: string): Promise<string | null> {
    const fromDir = path.dirname(fromFile);
    
    let resolvedPath: string;
    
    if (importPath.startsWith('@/')) {
      // Handle @ alias (assuming it points to src/)
      resolvedPath = path.resolve(this.projectRoot, 'src', importPath.substring(2));
    } else {
      // Handle relative imports
      resolvedPath = path.resolve(fromDir, importPath);
    }

    // Try different extensions
    const extensions = ['.ts', '.js', '.tsx', '.jsx', ''];
    
    for (const ext of extensions) {
      const fullPath = resolvedPath + ext;
      try {
        const stats = await fs.stat(fullPath);
        if (stats.isFile()) {
          return fullPath;
        }
      } catch {
        // File doesn't exist, try next extension
      }
    }

    // Try index files
    for (const ext of ['.ts', '.js']) {
      const indexPath = path.join(resolvedPath, `index${ext}`);
      try {
        const stats = await fs.stat(indexPath);
        if (stats.isFile()) {
          return indexPath;
        }
      } catch {
        // Index file doesn't exist
      }
    }

    return null;
  }

  private async validateServiceReferences(): Promise<void> {
    console.log('🔧 Validating service references...');

    const serviceReferences = [
      { name: 'supabase', patterns: ['supabase', 'createClient'] },
      { name: 'redis', patterns: ['redis', 'RedisService'] },
      { name: 'ollama', patterns: ['ollama', 'OllamaService'] },
      { name: 'pyvision', patterns: ['pyVisionBridge', 'visionResourceManager'] },
      { name: 'ab-mcts', patterns: ['abMCTSOrchestrator', 'feedbackCollector'] }
    ];

    for (const filePath of this.sourceFiles) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        
        for (const service of serviceReferences) {
          for (const pattern of service.patterns) {
            if (content.includes(pattern)) {
              await this.validateServiceExists(filePath, service.name, pattern);
            }
          }
        }
      } catch (error) {
        // File read error already handled elsewhere
      }
    }
  }

  private async validateServiceExists(filePath: string, serviceName: string, pattern: string): Promise<void> {
    // Check if the service file exists
    const servicePaths = [
      `src/services/${serviceName}-service.ts`,
      `src/services/${serviceName}.ts`,
      `src/services/${pattern}.ts`,
      `src/utils/${pattern}.ts`
    ];

    let serviceExists = false;
    for (const servicePath of servicePaths) {
      const fullPath = path.resolve(this.projectRoot, servicePath);
      try {
        await fs.stat(fullPath);
        serviceExists = true;
        break;
      } catch {
        // Service doesn't exist at this path
      }
    }

    if (!serviceExists) {
      // Check if it's imported properly
      const content = await fs.readFile(filePath, 'utf-8');
      const hasImport = content.includes(`import`) && content.includes(pattern);
      
      if (!hasImport) {
        this.addError({
          type: 'UNDEFINED_REFERENCE',
          file: filePath,
          message: `Service '${pattern}' is referenced but not imported or defined`,
          severity: 'warning',
          suggestion: `Import ${pattern} or create the service file`
        });
      }
    }
  }

  private async validateRouterConsistency(): Promise<void> {
    console.log('🛣️ Validating router consistency...');

    // Find all router files
    const routerFiles = this.sourceFiles.filter(f => f.includes('/routers/'));
    
    for (const routerFile of routerFiles) {
      try {
        const content = await fs.readFile(routerFile, 'utf-8');
        
        // Check for middleware imports that might not exist
        const middlewareImports = [
          'authenticate',
          'validateRequest',
          'authorize',
          'rateLimiter'
        ];

        for (const middleware of middlewareImports) {
          if (content.includes(middleware) && !content.includes(`import`)) {
            this.addError({
              type: 'UNDEFINED_REFERENCE',
              file: routerFile,
              message: `Middleware '${middleware}' is used but not imported`,
              severity: 'error',
              suggestion: `Import ${middleware} or remove its usage`
            });
          }
        }

        // Check for proper router export
        if (!content.includes('export default router') && !content.includes('export { router as default }')) {
          this.addError({
            type: 'INCONSISTENT_NAMING',
            file: routerFile,
            message: 'Router file should export default router',
            severity: 'warning',
            suggestion: 'Add "export default router;" at the end of the file'
          });
        }

      } catch (error) {
        // File read error
      }
    }
  }

  private async validateTypeDefinitions(): Promise<void> {
    console.log('📝 Validating type definitions...');

    // Find all type files
    const typeFiles = this.sourceFiles.filter(f => f.includes('/types/') || f.endsWith('.d.ts'));
    
    for (const filePath of this.sourceFiles) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        
        // Look for custom type usage
        const typeMatches = content.match(/:\s*([A-Z][a-zA-Z0-9]+)/g);
        if (typeMatches) {
          for (const match of typeMatches) {
            const typeName = match.replace(':', '').trim();
            
            // Skip built-in types
            if (['String', 'Number', 'Boolean', 'Object', 'Array', 'Date', 'Error', 'Promise'].includes(typeName)) {
              continue;
            }

            // Check if type is imported or defined
            if (!content.includes(`import`) || !content.includes(typeName)) {
              this.addError({
                type: 'UNDEFINED_REFERENCE',
                file: filePath,
                message: `Type '${typeName}' is used but not imported or defined`,
                severity: 'warning',
                suggestion: `Import ${typeName} from the appropriate types file`
              });
            }
          }
        }
      } catch (error) {
        // File read error
      }
    }
  }

  private async validateConfigReferences(): Promise<void> {
    console.log('⚙️ Validating config references...');

    // Check if config files exist
    const configPaths = [
      'src/config/environment.ts',
      'src/config/index.ts',
      'src/config.ts'
    ];

    let configExists = false;
    for (const configPath of configPaths) {
      try {
        await fs.stat(path.resolve(this.projectRoot, configPath));
        configExists = true;
        break;
      } catch {
        // Config doesn't exist at this path
      }
    }

    if (!configExists) {
      this.addError({
        type: 'MISSING_IMPORT',
        file: 'src/',
        message: 'No configuration file found',
        severity: 'error',
        suggestion: 'Create a config file at src/config/environment.ts'
      });
    }

    // Check for config usage without imports
    for (const filePath of this.sourceFiles) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        
        if (content.includes('config.') && !content.includes('import') && !content.includes('config')) {
          this.addError({
            type: 'UNDEFINED_REFERENCE',
            file: filePath,
            message: 'Config is used but not imported',
            severity: 'error',
            suggestion: 'Import config from the appropriate config file'
          });
        }
      } catch (error) {
        // File read error
      }
    }
  }

  private addError(error: ValidationError): void {
    this.errors.push(error);
  }

  private generateReport(): ValidationReport {
    const errors = this.errors.filter(e => e.severity === 'error');
    const warnings = this.errors.filter(e => e.severity === 'warning');

    return {
      totalFiles: this.sourceFiles.length,
      errorsFound: errors.length,
      warningsFound: warnings.length,
      errors: this.errors,
      summary: {
        missingImports: this.errors.filter(e => e.type === 'MISSING_IMPORT').length,
        invalidPaths: this.errors.filter(e => e.type === 'INVALID_PATH').length,
        undefinedReferences: this.errors.filter(e => e.type === 'UNDEFINED_REFERENCE').length,
        syntaxErrors: this.errors.filter(e => e.type === 'SYNTAX_ERROR').length,
        inconsistentNaming: this.errors.filter(e => e.type === 'INCONSISTENT_NAMING').length
      }
    };
  }

  private async saveReport(report: ValidationReport): Promise<void> {
    const reportPath = path.resolve(this.projectRoot, 'codebase-integrity-report.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    // Also create a human-readable report
    const humanReportPath = path.resolve(this.projectRoot, 'codebase-integrity-report.md');
    const humanReport = this.generateHumanReport(report);
    await fs.writeFile(humanReportPath, humanReport);

    console.log(`📊 Reports saved:`);
    console.log(`   JSON: ${reportPath}`);
    console.log(`   Markdown: ${humanReportPath}`);
  }

  private generateHumanReport(report: ValidationReport): string {
    let md = `# Codebase Integrity Report\n\n`;
    md += `**Generated:** ${new Date().toISOString()}\n\n`;
    
    md += `## Summary\n\n`;
    md += `- **Total Files Scanned:** ${report.totalFiles}\n`;
    md += `- **Errors Found:** ${report.errorsFound}\n`;
    md += `- **Warnings Found:** ${report.warningsFound}\n\n`;
    
    md += `### Error Breakdown\n\n`;
    md += `- Missing Imports: ${report.summary.missingImports}\n`;
    md += `- Invalid Paths: ${report.summary.invalidPaths}\n`;
    md += `- Undefined References: ${report.summary.undefinedReferences}\n`;
    md += `- Syntax Errors: ${report.summary.syntaxErrors}\n`;
    md += `- Inconsistent Naming: ${report.summary.inconsistentNaming}\n\n`;

    if (report.errors.length > 0) {
      md += `## Issues Found\n\n`;
      
      const errorsByType = report.errors.reduce((acc, error) => {
        if (!acc[error.type]) acc[error.type] = [];
        acc[error.type]?.push(error);
        return acc;
      }, {} as Record<string, ValidationError[]>);

      for (const [type, errors] of Object.entries(errorsByType)) {
        md += `### ${type.replace(/_/g, ' ')}\n\n`;
        
        for (const error of errors) {
          md += `**File:** \`${path.relative(process.cwd(), error.file)}\`\n`;
          if (error.line) md += `**Line:** ${error.line}\n`;
          md += `**Message:** ${error.message}\n`;
          md += `**Severity:** ${error.severity}\n`;
          if (error.suggestion) md += `**Suggestion:** ${error.suggestion}\n`;
          md += `\n---\n\n`;
        }
      }
    }

    md += `## Recommendations\n\n`;
    
    if (report.summary.missingImports > 0) {
      md += `- Fix ${report.summary.missingImports} missing import statements\n`;
    }
    
    if (report.summary.undefinedReferences > 0) {
      md += `- Resolve ${report.summary.undefinedReferences} undefined references\n`;
    }
    
    if (report.summary.syntaxErrors > 0) {
      md += `- Fix ${report.summary.syntaxErrors} syntax errors\n`;
    }

    md += `\n## Next Steps\n\n`;
    md += `1. Review and fix all errors marked as 'error' severity\n`;
    md += `2. Address warnings to improve code quality\n`;
    md += `3. Run the validator again to verify fixes\n`;
    md += `4. Consider adding this to your CI/CD pipeline\n`;

    return md;
  }
}

// CLI interface
async function main() {
  const projectRoot = process.cwd();
  const validator = new CodebaseIntegrityValidator(projectRoot);
  
  try {
    const report = await validator.validate();
    
    console.log('\n📋 Validation Complete!');
    console.log(`   Files scanned: ${report.totalFiles}`);
    console.log(`   Errors: ${report.errorsFound}`);
    console.log(`   Warnings: ${report.warningsFound}`);
    
    if (report.errorsFound > 0) {
      console.log('\n❌ Critical issues found. Please review the report.');
      process.exit(1);
    } else if (report.warningsFound > 0) {
      console.log('\n⚠️ Warnings found. Consider addressing them.');
      process.exit(0);
    } else {
      console.log('\n✅ No issues found! Codebase integrity is good.');
      process.exit(0);
    }
    
  } catch (error) {
    console.error('❌ Validation failed:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { CodebaseIntegrityValidator };