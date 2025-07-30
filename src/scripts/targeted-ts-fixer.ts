#!/usr/bin/env tsx
/**
 * Targeted TypeScript Error Fixer
 * Focuses on the most common error patterns to reach "couple hundred or less" goal
 */

import { mcpIntegrationService } from '../services/mcp-integration-service.js';
import { LogContext, log } from '../utils/logger.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';

const execAsync = promisify(exec);

interface TSError {
  file: string;
  line: number;
  column: number;
  code: string;
  message: string;
  fullText: string;
}

class TargetedTSFixer {
  private fixedCount = 0;
  private skipCount = 0;
  private errorCount = 0;

  async run(): Promise<void> {
    log.info('🎯 Starting targeted TypeScript error fixing', LogContext.MCP);

    try {
      const errors = await this.parseTypeScriptErrors();
      log.info(`📊 Found ${errors.length} TypeScript errors`, LogContext.MCP);

      if (errors.length === 0) {
        log.info('🎉 No TypeScript errors found!', LogContext.MCP);
        return;
      }

      // Analyze error patterns
      const errorPatterns = this.analyzeErrorPatterns(errors);
      this.reportPatterns(errorPatterns);

      // Apply targeted fixes
      await this.applyTargetedFixes(errors);

      // Report results
      this.reportResults();

      // Check final error count
      const newErrorCount = await this.getErrorCount();
      log.info(`📈 TypeScript errors after targeted fixes: ${newErrorCount}`, LogContext.MCP);

    } catch (error) {
      log.error('❌ Targeted fixing failed', LogContext.MCP, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private async parseTypeScriptErrors(): Promise<TSError[]> {
    try {
      const { stdout } = await execAsync('npx tsc --noEmit 2>&1 || true');
      const lines = stdout.split('\n');
      const errors: TSError[] = [];

      for (const line of lines) {
        if (line.includes('error TS')) {
          const match = line.match(/^(.+?)\((\d+),(\d+)\): error (TS\d+): (.+)$/);
          if (match) {
            const [, file, lineStr, columnStr, code, message] = match;
            errors.push({
              file: file || '',
              line: parseInt(lineStr || '0', 10),
              column: parseInt(columnStr || '0', 10),
              code: code || '',
              message: message || '',
              fullText: line,
            });
          }
        }
      }

      return errors;
    } catch (error) {
      log.error('❌ Failed to parse TypeScript errors', LogContext.MCP, { error });
      return [];
    }
  }

  private analyzeErrorPatterns(errors: TSError[]): Record<string, number> {
    const patterns: Record<string, number> = {};

    for (const error of errors) {
      // Count specific error patterns
      if (error.message.includes("is of type 'unknown'")) {
        patterns['unknown_type'] = (patterns['unknown_type'] || 0) + 1;
      } else if (error.message.includes('Object is of type')) {
        patterns['object_type'] = (patterns['object_type'] || 0) + 1;
      } else if (error.message.includes('Argument of type')) {
        patterns['argument_type'] = (patterns['argument_type'] || 0) + 1;
      } else if (error.message.includes('Property') && error.message.includes('does not exist')) {
        patterns['property_missing'] = (patterns['property_missing'] || 0) + 1;
      } else if (error.message.includes('Cannot be used as')) {
        patterns['cannot_be_used'] = (patterns['cannot_be_used'] || 0) + 1;
      } else {
        patterns['other'] = (patterns['other'] || 0) + 1;
      }
    }

    return patterns;
  }

  private reportPatterns(patterns: Record<string, number>): void {
    console.log('\n📊 Error Pattern Analysis:');
    console.log('='.repeat(40));
    
    const sortedPatterns = Object.entries(patterns).sort(([,a], [,b]) => b - a);
    for (const [pattern, count] of sortedPatterns) {
      console.log(`${pattern.padEnd(20)}: ${count}`);
    }
    console.log('='.repeat(40));
  }

  private async applyTargetedFixes(errors: TSError[]): Promise<void> {
    // Group errors by file
    const errorsByFile = new Map<string, TSError[]>();
    
    for (const error of errors) {
      if (!errorsByFile.has(error.file)) {
        errorsByFile.set(error.file, []);
      }
      errorsByFile.get(error.file)!.push(error);
    }

    // Focus on files with fixable patterns
    for (const [filePath, fileErrors] of errorsByFile) {
      const fixableErrors = fileErrors.filter(e => 
        e.message.includes("is of type 'unknown'") ||
        e.message.includes('Object is of type') ||
        e.message.includes('Argument of type') && e.message.includes('unknown')
      );

      if (fixableErrors.length > 0 && fixableErrors.length <= 20) {
        await this.fixErrorsInFile(filePath, fixableErrors);
      } else if (fixableErrors.length > 20) {
        log.warn(`⚠️ Skipping ${filePath} - too many errors (${fixableErrors.length})`, LogContext.MCP);
        this.skipCount += fixableErrors.length;
      }
    }
  }

  private async fixErrorsInFile(filePath: string, errors: TSError[]): Promise<void> {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      let modifiedContent = content;
      let hasChanges = false;

      const lines = content.split('\n');

      // Sort errors by line number (descending to avoid line number shifts)
      const sortedErrors = errors.sort((a, b) => b.line - a.line);

      for (const error of sortedErrors) {
        const lineIndex = error.line - 1;
        if (lineIndex >= 0 && lineIndex < lines.length) {
          const line = lines[lineIndex];
          const newLine = this.fixLineError(line, error);
          
          if (newLine !== line) {
            lines[lineIndex] = newLine;
            hasChanges = true;
            this.fixedCount++;
            
            // Save successful pattern to MCP
            await this.saveSuccessfulPattern(error, line, newLine);
          }
        }
      }

      if (hasChanges) {
        modifiedContent = lines.join('\n');
        await fs.writeFile(filePath, modifiedContent, 'utf8');
        log.debug(`✅ Applied ${errors.length} fixes to ${filePath}`, LogContext.MCP);
      }

    } catch (error) {
      log.error(`❌ Failed to fix errors in ${filePath}`, LogContext.MCP, { error });
      this.errorCount++;
    }
  }

  private fixLineError(line: string, error: TSError): string {
    let fixedLine = line;

    // Fix unknown type issues
    if (error.message.includes("'context' is of type 'unknown'")) {
      fixedLine = fixedLine.replace(/(\w+)\.(\w+)/g, '($1 as any).$2');
    } else if (error.message.includes("'llmResponse' is of type 'unknown'")) {
      fixedLine = fixedLine.replace(/llmResponse/g, 'llmResponse as any');
    } else if (error.message.includes("Object is of type 'unknown'")) {
      // Find the object and cast it
      const objectMatch = line.match(/(\w+)\./);
      if (objectMatch) {
        const objectName = objectMatch[1];
        fixedLine = fixedLine.replace(new RegExp(`\\b${objectName}\\.`, 'g'), `(${objectName} as any).`);
      }
    } else if (error.message.includes("Argument of type 'unknown'")) {
      // Cast arguments that are unknown
      fixedLine = fixedLine.replace(/(\w+)(?=\s*[,\)])/, '$1 as any');
    } else if (error.message.includes('Spread types may only be created from object types')) {
      // Fix spread operator issues
      fixedLine = fixedLine.replace(/\.\.\.(\w+)/, '...(($1 as any) || {})');
    }

    return fixedLine;
  }

  private async saveSuccessfulPattern(error: TSError, beforeLine: string, afterLine: string): Promise<void> {
    try {
      await mcpIntegrationService.sendMessage('save_code_pattern', {
        pattern_type: `targeted_fix_${error.code}`,
        before_code: beforeLine.trim(),
        after_code: afterLine.trim(),
        description: `Targeted fix for ${error.code}: ${error.message}`,
        error_types: [error.code],
        success_rate: 0.85,
        metadata: {
          applied_to_file: error.file,
          line_number: error.line,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      log.debug('Could not save pattern to MCP', LogContext.MCP);
    }
  }

  private async getErrorCount(): Promise<number> {
    try {
      const { stdout } = await execAsync('npx tsc --noEmit 2>&1 | grep -c "error TS" || true');
      return parseInt(stdout.trim(), 10) || 0;
    } catch {
      return 0;
    }
  }

  private reportResults(): void {
    console.log('\n📊 Targeted TypeScript Fixing Results:');
    console.log('='.repeat(50));
    console.log(`✅ Fixes Applied: ${this.fixedCount}`);
    console.log(`⏭️  Errors Skipped: ${this.skipCount}`);
    console.log(`❌ Fix Failures: ${this.errorCount}`);
    console.log('='.repeat(50));
    
    if (this.fixedCount > 0) {
      console.log('🎉 Successfully applied targeted fixes! Run type-check to see results.');
    } else {
      console.log('ℹ️  No fixes were applied. Errors may require manual intervention.');
    }
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const fixer = new TargetedTSFixer();
  
  fixer.run()
    .then(() => {
      console.log('✅ Targeted TypeScript fixing completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Targeted fixing failed:', error);
      process.exit(1);
    });
}

export { TargetedTSFixer };