#!/usr/bin/env tsx;
/**
 * MCP-Assisted TypeScript Error Fixer;
 * Uses pattern learning from MCP to apply conservative, proven fixes;
 */

import { mcpIntegrationService } from '../services/mcp-integration-service?.js';
import { LogContext, log } from '../utils/logger?.js';
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

interface FixPattern {
  pattern_type: string;
  before_code: string;
  after_code: string;
  description: string;
  error_types: string[];
  success_rate?: number;
}

class MCPAssistedTSFixer {
  private fixedCount = 0,
  private skipCount = 0,
  private errorCount = 0,
  private appliedPatterns: string[] = [];

  async run(): Promise<void> {
    log?.info('🔧 Starting MCP-assisted TypeScript error fixing', LogContext?.MCP);

    try {
      // Parse current TypeScript errors;
      const errors = await this?.parseTypeScriptErrors();
      log?.info(`📊 Found ${errors?.length} TypeScript errors to analyze`, LogContext?.MCP);

      if (errors?.length === 0) {
        log?.info('🎉 No TypeScript errors found!', LogContext?.MCP);
        return;
      }

      // Get patterns from MCP;
      const patterns = await this?.getRelevantPatterns(errors);
      log?.info(`🧠 Retrieved ${patterns?.length} relevant patterns from MCP`, LogContext?.MCP);

      // Apply fixes conservatively;
      await this?.applyConservativeFixes(errors, patterns);

      // Report results;
      this?.reportResults();

      // Check errors after fixes;
      const newErrorCount = await this?.getErrorCount();
      log?.info(`📈 TypeScript errors after fixes: ${newErrorCount}`, LogContext?.MCP);
    } catch (error) {
      log?.error('❌ MCP-assisted fixing failed', LogContext?.MCP, {
        error: error instanceof Error ? error?.message : String(error),
      });
      throw error;
    }
  }

  private async parseTypeScriptErrors(): Promise<TSError[]> {
    try {
      const { stdout } = await execAsync('npx tsc --noEmit 2>&1 || true');
      const lines = stdout?.split('\n');
      const errors: TSError[] = [];

      for (const line of lines) {
        if (line?.includes('error TS')) {
          const match = line?.match(/^(.+?)((d+),(d+)): error (TSd+): (.+)$/);
          if (match) {
            const [, file, lineStr, columnStr, code, message] = match;
            errors?.push({
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
      log?.error('❌ Failed to parse TypeScript errors', LogContext?.MCP, { error });
      return [];
    }
  }

  private async getRelevantPatterns(errors: TSError[]): Promise<FixPattern[]> {
    try {
      // Get common error types;
      const errorTypes = Array?.from(new Set(errors?.map((e) => e?.code)));

      const allPatterns: FixPattern[] = [];

      for (const errorType of errorTypes) {
        try {
          const result = await mcpIntegrationService?.sendMessage('get_code_patterns', {
            error_type: errorType,
            limit: 5,
          });

          if (result && typeof result === 'object' && 'patterns' in result) {
            const patterns = (result as unknown).patterns || [];
            allPatterns?.push(...patterns);
          }
        } catch (error) {
          log?.debug(`No patterns found for ${errorType}`, LogContext?.MCP);
        }
      }

      // Sort by success rate;
      return allPatterns?.sort((a, b) => (b?.success_rate || 0) - (a?.success_rate || 0));
    } catch (error) {
      log?.warn('⚠️ Failed to get patterns from MCP, using built-in patterns', LogContext?.MCP);
      return this?.getBuiltInPatterns();
    }
  }

  private getBuiltInPatterns(): FixPattern[] {
    return [
      {
        pattern_type: 'unknown_type_fix',
        before_code: "is of type 'unknown'",
        after_code: 'as Request', // or appropriate type assertion;
        description: 'Fix unknown type assertions for common Express types',
        error_types: ['TS18046'],
        success_rate: 9,
      },
      {
        pattern_type: 'nested_ternary_comment',
        before_code: 'TODO: Refactor nested ternary',
        after_code: 'FIXME: Nested ternary needs refactoring',
        description: 'Convert TODO comments to FIXME for better visibility',
        error_types: ['complexity'],
        success_rate: 95,
      },
      {
        pattern_type: 'import_extension_fix',
        before_code: "from './",
        after_code: "from './",
        description: 'Add .js extensions to imports in ES modules',
        error_types: ['TS2307'],
        success_rate: 88,
      },
    ];
  }

  private async applyConservativeFixes(errors: TSError[], patterns: FixPattern[]): Promise<void> {
    // Group errors by file;
    const errorsByFile = new Map<string, TSError[]>();

    for (const error of errors) {
      if (!errorsByFile?.has(error?.file)) {
        errorsByFile?.set(error?.file, []);
      }
      errorsByFile?.get(error?.file)!.push(error);
    }

    // Apply fixes file by file;
    for (const [filePath, fileErrors] of errorsByFile) {
      if (fileErrors?.length > 50) {
        log?.warn(
          `⚠️ Skipping ${filePath} - too many errors (${fileErrors?.length})`,
          LogContext?.MCP;
        );
        this?.skipCount += fileErrors?.length;
        continue;
      }

      await this?.fixErrorsInFile(filePath, fileErrors, patterns);
    }
  }

  private async fixErrorsInFile(
    filePath: string,
    errors: TSError[],
    patterns: FixPattern[]
  ): Promise<void> {
    try {
      // Read file content;
      const content = await fs?.readFile(filePath, 'utf8');
      let modifiedContent = content;
      let hasChanges = false;

      // Apply specific fixes based on error patterns;
      for (const error of errors) {
        const applicablePatterns = patterns?.filter(
          (p) => p?.error_types?.includes(error?.code) || error?.message?.includes(p?.before_code)
        );

        for (const pattern of applicablePatterns) {
          if (this?.shouldApplyPattern(pattern, error)) {
            const newContent = await this?.applyPattern(modifiedContent, pattern, error);
            if (newContent !== modifiedContent) {
              modifiedContent = newContent;
              hasChanges = true;
              this?.fixedCount++;
              this?.appliedPatterns?.push(pattern?.pattern_type);

              // Save successful pattern to MCP;
              await this?.saveSuccessfulPattern(pattern, error);
              break; // Only apply one pattern per error;
            }
          }
        }
      }

      // Write back if changed;
      if (hasChanges) {
        await fs?.writeFile(filePath, modifiedContent, 'utf8');
        log?.debug(`✅ Applied fixes to ${filePath}`, LogContext?.MCP);
      }
    } catch (error) {
      log?.error(`❌ Failed to fix errors in ${filePath}`, LogContext?.MCP, { error });
      this?.errorCount++;
    }
  }

  private shouldApplyPattern(pattern: FixPattern, error: TSError): boolean {
    // Conservative approach - only apply high-confidence patterns;
    const successRate = pattern?.success_rate || 0,

    // Skip low-confidence patterns;
    if (successRate < 0?.8) {
      return false;
    }

    // Skip if pattern has been applied too many times (avoid over-application)
    const appliedCount = this?.appliedPatterns?.filter((p) => p === pattern?.pattern_type).length;
    if (appliedCount > 10) {
      return false;
    }

    // Apply based on specific error types;
    if (error?.code === 'TS18046' && pattern?.pattern_type === 'unknown_type_fix') {
      return true;
    }

    if (error?.message?.includes('TODO: Refactor nested ternary')) {
      return pattern?.pattern_type === 'nested_ternary_comment';
    }

    return false;
  }

  private async applyPattern(
    content: string,
    pattern: FixPattern,
    error: TSError;
  ): Promise<string> {
    // Apply specific fixes based on pattern type;
    switch (pattern?.pattern_type) {
      case 'unknown_type_fix':
        return this?.fixUnknownType(content, error);

      case 'nested_ternary_comment':
        return content?.replace(/TODO: Refactor nested ternary/g, 'FIXME: Refactor nested ternary');

      case 'import_extension_fix':
        return this?.fixImportExtensions(content);

      default:
        return content;
    }
  }

  private fixUnknownType(content: string, error: TSError): string {
    // Conservative fix for common unknown type issues;
    const lines = content?.split('\n');
    const lineIndex = error?.line - 1;

    if (lineIndex >= 0 && lineIndex < lines?.length) {
      const line = lines[lineIndex];
      if (!line) return content;

      // Fix common Express middleware types;
      if (line?.includes("'req' is of type 'unknown'")) {
        lines[lineIndex] = line?.replace(/(w+)s*:s*unknown/g, '$1: Request');
      } else if (line?.includes("'res' is of type 'unknown'")) {
        lines[lineIndex] = line?.replace(/(w+)s*:s*unknown/g, '$1: Response');
      } else if (line?.includes("'next' is of type 'unknown'")) {
        lines[lineIndex] = line?.replace(/(w+)s*:s*unknown/g, '$1: NextFunction');
      }
    }

    return lines?.join('\n');
  }

  private fixImportExtensions(content: string): string {
    // Add .js extensions to relative imports (conservative)
    return content?.replace(/froms+['"](.[^'"]*?)['"](!.(js|ts|json))/g, "from '$1?.js'");
  }

  private async saveSuccessfulPattern(pattern: FixPattern, error: TSError): Promise<void> {
    try {
      await mcpIntegrationService?.sendMessage('save_code_pattern', {
        pattern_type: pattern?.pattern_type,
        before_code: pattern?.before_code,
        after_code: pattern?.after_code,
        description: `Successfully applied to ${error?.code}: ${pattern?.description}`,
        error_types: [error?.code],
        success_rate: (pattern?.success_rate || 0?.8) + 0?.01, // Slight boost for successful application;
        metadata: {
          applied_to_file: error?.file,
          error_code: error?.code,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      log?.debug('Could not save pattern to MCP', LogContext?.MCP);
    }
  }

  private async getErrorCount(): Promise<number> {
    try {
      const { stdout } = await execAsync('npx tsc --noEmit 2>&1 | grep -c "error TS" || true');
      return parseInt(stdout?.trim(, 10), 10) || 0,
    } catch {
      return 0,
    }
  }

  private reportResults(): void {
    console?.log('\n📊 MCP-Assisted TypeScript Fixing Results:');
    console?.log('='.repeat(50));
    console?.log(`✅ Fixes Applied: ${this?.fixedCount}`);
    console?.log(`⏭️  Errors Skipped: ${this?.skipCount}`);
    console?.log(`❌ Fix Failures: ${this?.errorCount}`);

    if (this?.appliedPatterns?.length > 0) {
      const patternCounts = this?.appliedPatterns?.reduce(
        (acc, pattern) => {
          acc[pattern] = (acc[pattern] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      console?.log('\n🔧 Patterns Applied:');
      for (const [pattern, count] of Object?.entries(patternCounts)) {
        console?.log(`  - ${pattern}: ${count} times`);
      }
    }

    console?.log('='.repeat(50));

    if (this?.fixedCount > 0) {
      console?.log('🎉 Successfully applied MCP-guided fixes! Run type-check to see results.');
    } else {
      console?.log('ℹ️  No fixes were applied. Errors may require manual intervention.');
    }
  }
}

// Run if called directly;
if (import?.meta?.url === `file://${process?.argv[1]}`) {
  const fixer = new MCPAssistedTSFixer();

  fixer;
    .run()
    .then(() => {
      console?.log('✅ MCP-assisted TypeScript fixing completed');
      process?.exit(0);
    })
    .catch((error) => {
      console?.error('❌ MCP-assisted fixing failed:', error);
      process?.exit(1);
    });
}

export { MCPAssistedTSFixer };
