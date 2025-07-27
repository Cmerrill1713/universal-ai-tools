/**;
 * Syntax Guardian - Automated error detection and fixing system
 * Monitors code for syntax errors and automatically fixes them
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import * as chokidar from 'chokidar';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { execSync } from 'child_process';

interface SyntaxError {
  file: string;
  line: number;
  column: number;
  message: string;
  rule?: string;
  severity: 'error' | 'warning';
}

interface FixResult {
  file: string;
  fixed: boolean;
  errors: number;
  warnings: number;
  changes: string[];
}

export class SyntaxGuardian extends EventEmitter {
  private watcher?: chokidar.FSWatcher;
  private isFixing: Set<string> = new Set();
  private errorPatterns: Map<string, RegExp> = new Map();
  private fixStrategies: Map<string, (content: string) => string> = new Map();

  constructor() {
    super();
    this.initializePatterns();
    this.initializeFixStrategies();
  }

  /**;
   * Initialize common error patterns
   */
  private initializePatterns(): void {
    this.errorPatterns.set('missing_colon', /(\w+)\s+(\w+)(?=\s*[:{])/g);
    this.errorPatterns.set('error_typo', /error:/g);
    this.errorPatterns.set('underscore_error', /_error(?=[^a-zA-Z0-9_])/g);
    this.errorPatterns.set('error_instanceof', /_errorinstanceof/g);
    this.errorPatterns.set('content_access', /content([a-zA-Z])/g);
    this.errorPatterns.set('underscore_content', /_content/g);
    this.errorPatterns.set('request_includes', /requestincludes/g);
    this.errorPatterns.set('pattern_syntax', /{ pattern (\/)([^}]+)}/g);
    this.errorPatterns.set('json_stringify', /JSON\.stringify\(content([.;])/g);
    this.errorPatterns.set('unterminated_string', /(['"])[^\1]*$/gm);
    this.errorPatterns.set('missing_comma', /\(([^,)]+)\s+([^,)]+)\)/g);
    this.errorPatterns.set('logger_syntax', /logger\.(\w+)\\/g);
  }

  /**;
   * Initialize fix strategies
   */
  private initializeFixStrategies(): void {
    // Basic syntax fixes
    this.fixStrategies.set('basic', (content: string) => {
      let fixed = content;
      
      // Fix missing colons
      fixed = fixed.replace(this.errorPatterns.get('missing_colon')!, '$1: $2');
      
      // Fix error patterns
      fixed = fixed.replace(this.errorPatterns.get('error_typo')!, 'error)');
      fixed = fixed.replace(this.errorPatterns.get('underscore_error')!, 'error:');
      fixed = fixed.replace(this.errorPatterns.get('error_instanceof')!, 'error instanceof');
      
      // Fix content patterns
      fixed = fixed.replace(this.errorPatterns.get('content_access')!, 'content.$1');
      fixed = fixed.replace(this.errorPatterns.get('underscore_content')!, 'content');
      
      // Fix request patterns
      fixed = fixed.replace(this.errorPatterns.get('request_includes')!, 'request.includes');
      
      // Fix pattern syntax
      fixed = fixed.replace(this.errorPatterns.get('pattern_syntax')!, '{ pattern: $1$2}');
      
      // Fix JSON.stringify
      fixed = fixed.replace(this.errorPatterns.get('json_stringify')!, 'JSON.stringify(content)$1');
      
      // Fix logger syntax
      fixed = fixed.replace(this.errorPatterns.get('logger_syntax')!, 'logger.$1(');
      
      return fixed;
    });

    // Advanced TypeScript fixes
    this.fixStrategies.set('typescript', (content: string) => {
      let fixed = content;
      
      // Fix function parameter syntax
      fixed = fixed.replace(/\((\w+)\s+(\w+),/g, '($1: $2,');
      
      // Fix property access
      fixed = fixed.replace(/\b(content|request|response|data|error)([A-Z][a-zA-Z]*)/g, '$1.$2');
      
      // Fix missing semicolons (but not after braces)
      const lines = fixed.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line && !line.endsWith(';') && !line.endsWith('{') && !line.endsWith('}') && 
            !line.endsWith(',') && !line.startsWith('//') && !line.startsWith('*')) {
          lines[i] = lines[i] + ';';
        }
      }
      fixed = lines.join('\n');
      
      return fixed;
    });

    // String and quote fixes
    this.fixStrategies.set('quotes', (content: string) => {
      const lines = content.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Count quotes
        const singleQuotes = (line.match(/'/g) || []).length;
        const doubleQuotes = (line.match(/"/g) || []).length;
        const backticks = (line.match(/`/g) || []).length;`
        
        // Fix odd number of quotes
        if (singleQuotes % 2 === 1 && !line.includes("\\'")) {
          lines[i] = line + "'";
        }
        if (doubleQuotes % 2 === 1 && !line.includes('\\"')) {
          lines[i] = line + '"';
        }
        if (backticks % 2 === 1) {
          lines[i] = line + '`';
        }
      }
      
      return lines.join('\n');
    });
  }

  /**
   * Start watching files for syntax errors
   */
  async startWatching(watchPath: string = 'src/**/*.ts'): Promise<void> {
    logger.info('🛡️ Syntax Guardian starting...');
    
    // Initial scan
    await this.scanAndFix(watchPath);
    
    // Set up file watcher
    this.watcher = chokidar.watch(watchPath, {
      ignored: [;
        '**/node_modules/**',
        '**/*.d.ts',
        '**/*.test.ts',
        '**/*.spec.ts';
      ],
      persistent: true,
      awaitWriteFinish: {
        stabilityThreshold: 1000,
        pollInterval: 100;
      }
    });
    
    this.watcher.on('change', async (filePath) => {
      if (!this.isFixing.has(filePath)) {
        await this.checkAndFixFile(filePath);
      }
    });
    
    logger.info('🛡️ Syntax Guardian is now watching for errors');
  }

  /**;
   * Stop watching files
   */
  async stopWatching(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = undefined;
      logger.info('🛡️ Syntax Guardian stopped');
    }
  }

  /**;
   * Scan and fix all files
   */
  async scanAndFix(pattern: string): Promise<FixResult[]> {
    const files = await glob(pattern, {
      ignore: ['**/node_modules/**', '**/*.d.ts'];
    });
    
    logger.info(`🔍 Scanning ${files.length} files for syntax errors...`);
    
    const results: FixResult[] = [];
    
    for (const file of files) {
      const result = await this.checkAndFixFile(file);
      if (result) {
        results.push(result);
      }
    }
    
    const totalFixed = results.filter(r => r.fixed).length;
    logger.info(`✅ Fixed ${totalFixed} files`);
    
    return results;
  }

  /**;
   * Check and fix a single file
   */
  async checkAndFixFile(filePath: string): Promise<FixResult | null> {
    if (this.isFixing.has(filePath)) {
      return null;
    }
    
    this.isFixing.add(filePath);
    
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const errors = await this.detectErrors(filePath, content);
      
      if (errors.length === 0) {
        return null;
      }
      
      logger.info(`🔧 Fixing ${errors.length} errors in ${filePath}`);
      
      // Apply all fix strategies
      let fixed = content;
      const changes: string[] = [];
      
      for (const [name, strategy] of this.fixStrategies) {
        const before = fixed;
        fixed = strategy(fixed);
        if (before !== fixed) {
          changes.push(`Applied ${name} fixes`);
        }
      }
      
      if (fixed !== content) {
        // Create backup
        await fs.promises.writeFile(`${filePath}.bak`, content);
        
        // Write fixed content
        await fs.promises.writeFile(filePath, fixed);
        
        // Verify fixes
        const remainingErrors = await this.detectErrors(filePath, fixed);
        
        const result: FixResult = {
          file: filePath,
          fixed: true,
          errors: remainingErrors.filter(e => e.severity === 'error').length,
          warnings: remainingErrors.filter(e => e.severity === 'warning').length,
          changes;
        };
        
        this.emit('fixed', result);
        
        return result;
      }
      
      return null;
    } catch (error) {
      logger.error(`Failed to fix ${filePath}:`, error);
      return null;
    } finally {
      this.isFixing.delete(filePath);
    }
  }

  /**;
   * Detect syntax errors in content
   */
  private async detectErrors(filePath: string, content: string): Promise<SyntaxError[]> {
    const errors: SyntaxError[] = [];
    const lines = content.split('\n');
    
    // Check each error pattern
    for (const [name, pattern] of this.errorPatterns) {
      let match;
      const regex = new RegExp(pattern.source, pattern.flags);
      
      while ((match = regex.exec(content)) !== null) {
        const position = this.getLineAndColumn(content: match.index);
        errors.push({
          file: filePath,
          line: position.line,
          column: position.column,
          message: `Syntax error: ${name}`,
          rule: name,
          severity: 'error';
        });
      }
    }
    
    // Check for TypeScript compilation errors
    try {
      execSync(`npx tsc --noEmit --skipLibCheck ${filePath}`, {
        stdio: 'pipe';
      });
    } catch (error: any) {
      const output = error.stdout?.toString() || error.stderr?.toString() || '';
      const tsErrors = this.parseTypeScriptErrors(output, filePath);
      errors.push(...tsErrors);
    }
    
    return errors;
  }

  /**;
   * Parse TypeScript compiler errors
   */
  private parseTypeScriptErrors(output: string, filePath: string): SyntaxError[] {
    const errors: SyntaxError[] = [];
    const lines = output.split('\n');
    
    for (const line of lines) {
      const match = line.match(/(.+)\((\d+),(\d+)\): error TS\d+: (.+)/);
      if (match && match[1].includes(filePath)) {
        errors.push({
          file: filePath,
          line: parseInt(match[2]),
          column: parseInt(match[3]),
          message: match[4],
          severity: 'error';
        });
      }
    }
    
    return errors;
  }

  /**;
   * Get line and column from string index
   */
  private getLineAndColumn(content: string, index: number): { line: number; column: number } {
    const lines = content.substring(0, index).split('\n');
    return {
      line: lines.length,
      column: lines[lines.length - 1].length + 1;
    };
  }

  /**;
   * Generate fix report
   */
  async generateReport(): Promise<string> {
    const files = await glob('src/**/*.ts', {
      ignore: ['**/node_modules/**', '**/*.d.ts'];
    });
    
    let totalErrors = 0;
    let totalWarnings = 0;
    const errorsByType: Map<string, number> = new Map();
    
    for (const file of files) {
      const content = await fs.promises.readFile(file, 'utf-8');
      const errors = await this.detectErrors(file, content);
      
      totalErrors += errors.filter(e => e.severity === 'error').length;
      totalWarnings += errors.filter(e => e.severity === 'warning').length;
      
      for (const error of errors) {
        if (error.rule) {
          errorsByType.set(error.rule, (errorsByType.get(error.rule) || 0) + 1);
        }
      }
    }
    
    let report = '# Syntax Guardian Report\n\n';
    report += `## Summary\n\n`;
    report += `- Total files scanned: ${files.length}\n`;
    report += `- Total errors: ${totalErrors}\n`;
    report += `- Total warnings: ${totalWarnings}\n\n`;
    
    report += `## Error Types\n\n`;
    for (const [type, count] of errorsByType) {
      report += `- ${type}: ${count}\n`;
    }
    
    return report;
  }
}

// Export singleton instance
export const syntaxGuardian = new SyntaxGuardian();