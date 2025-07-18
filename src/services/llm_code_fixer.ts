import { SupabaseService } from './supabase_service';
import { logger } from '../utils/logger';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Intelligent Code Fixer using LLM + Supabase
 * Automatically fixes TypeScript errors using AI with context understanding
 */
export class LLMCodeFixer {
  private supabase: SupabaseService;
  private fixCache: Map<string, any> = new Map();

  constructor() {
    this.supabase = SupabaseService.getInstance();
  }

  /**
   * Fix TypeScript errors in a file or project
   */
  async fixTypeScriptErrors(errorOutput: string, options?: {
    autoApply?: boolean;
    minConfidence?: number;
    interactive?: boolean;
  }) {
    const opts = {
      autoApply: false,
      minConfidence: 0.8,
      interactive: true,
      ...options
    };

    logger.info('🤖 Starting intelligent TypeScript error fixing...');

    // Parse errors from build output
    const errors = this.parseTypeScriptErrors(errorOutput);
    logger.info(`Found ${errors.length} errors to fix`);

    const fixes: any[] = [];

    for (const error of errors) {
      try {
        // Get file context
        const context = await this.getFileContext(error.file, error.line);

        // Search for similar fixes in memory
        const similarFixes = await this.searchSimilarFixes(error);

        // Generate fix using LLM
        const fix = await this.generateFix(error, context, similarFixes);

        if (fix.confidence >= opts.minConfidence) {
          fixes.push({
            error,
            fix,
            applied: false
          });

          if (opts.autoApply) {
            await this.applyFix(error.file, error.line, fix);
            fixes[fixes.length - 1].applied = true;
          }
        } else {
          logger.warn(`Low confidence fix for ${error.code}: ${fix.confidence}`);
        }
      } catch (err) {
        logger.error(`Failed to fix error in ${error.file}:${error.line}`, err);
      }
    }

    // Generate report
    const report = await this.generateFixReport(fixes);
    
    return {
      totalErrors: errors.length,
      fixesGenerated: fixes.length,
      fixesApplied: fixes.filter(f => f.applied).length,
      report
    };
  }

  /**
   * Parse TypeScript errors from compiler output
   */
  private parseTypeScriptErrors(output: string): Array<{
    file: string;
    line: number;
    column: number;
    code: string;
    message: string;
    codeSnippet?: string;
  }> {
    const errors: any[] = [];
    const lines = output.split('\n');
    let currentError: any = null;

    for (const line of lines) {
      // Match TypeScript error format
      const errorMatch = line.match(/^(.+)\((\d+),(\d+)\): error (TS\d+): (.+)$/);
      
      if (errorMatch) {
        if (currentError) {
          errors.push(currentError);
        }
        
        currentError = {
          file: errorMatch[1],
          line: parseInt(errorMatch[2]),
          column: parseInt(errorMatch[3]),
          code: errorMatch[4],
          message: errorMatch[5],
          contextLines: []
        };
      } else if (currentError && line.trim()) {
        // Capture context lines
        currentError.contextLines.push(line);
        
        // Try to extract code snippet
        if (line.includes('^') || line.includes('~')) {
          const prevLine = currentError.contextLines[currentError.contextLines.length - 2];
          if (prevLine) {
            currentError.codeSnippet = prevLine.trim();
          }
        }
      }
    }

    if (currentError) {
      errors.push(currentError);
    }

    return errors;
  }

  /**
   * Get context around an error
   */
  private async getFileContext(filePath: string, lineNumber: number, contextLines = 10) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      
      const startLine = Math.max(0, lineNumber - contextLines - 1);
      const endLine = Math.min(lines.length, lineNumber + contextLines);
      
      const contextContent = lines.slice(startLine, endLine).join('\n');
      
      // Also get imports
      const imports = lines
        .filter(line => line.trim().startsWith('import'))
        .join('\n');

      return {
        fileContent: contextContent,
        imports,
        fullPath: filePath,
        totalLines: lines.length
      };
    } catch (error) {
      logger.error(`Failed to read file ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Search for similar fixes in the database
   */
  private async searchSimilarFixes(error: any) {
    try {
      // Search by error code first
      const { data: exactMatches } = await this.supabase.client
        .from('code_fix_attempts')
        .select('*')
        .eq('error_code', error.code)
        .eq('status', 'successful')
        .order('confidence', { ascending: false })
        .limit(3);

      // Search by error message similarity
      const { data: similarMatches } = await this.supabase.client
        .from('ai_memories')
        .select('*')
        .eq('memory_type', 'code_fix')
        .ilike('content', `%${error.code}%`)
        .limit(5);

      return {
        exactMatches: exactMatches || [],
        similarMatches: similarMatches || []
      };
    } catch (error) {
      logger.error('Failed to search similar fixes:', error);
      return { exactMatches: [], similarMatches: [] };
    }
  }

  /**
   * Generate fix using Supabase Edge Function + LLM
   */
  private async generateFix(error: any, context: any, similarFixes: any) {
    const cacheKey = `${error.code}-${error.message}`;
    
    // Check cache
    if (this.fixCache.has(cacheKey)) {
      return this.fixCache.get(cacheKey);
    }

    try {
      // Call Supabase Edge Function
      const { data, error: fnError } = await this.supabase.client.functions.invoke(
        'fix-typescript-error',
        {
          body: {
            error: {
              ...error,
              codeSnippet: error.codeSnippet || context?.fileContent
            },
            context,
            memories: [
              ...similarFixes.exactMatches,
              ...similarFixes.similarMatches
            ]
          }
        }
      );

      if (fnError) throw fnError;

      // Cache the result
      this.fixCache.set(cacheKey, data);

      return data;
    } catch (error) {
      logger.error('Failed to generate fix:', error);
      
      // Fallback to basic fix suggestions
      return this.generateFallbackFix(error);
    }
  }

  /**
   * Generate basic fix without LLM
   */
  private generateFallbackFix(error: any) {
    const fixes: Record<string, any> = {
      'TS2339': {
        fixedCode: `// @ts-ignore - Property may exist at runtime\n${error.codeSnippet}`,
        explanation: 'Added @ts-ignore comment. Consider adding proper type definitions.',
        confidence: 0.3
      },
      'TS2345': {
        fixedCode: `${error.codeSnippet} as any`,
        explanation: 'Added type assertion. Consider fixing the actual type mismatch.',
        confidence: 0.4
      },
      'TS7053': {
        fixedCode: `// Add index signature to type or use type assertion`,
        explanation: 'Need to add index signature or use proper type guards.',
        confidence: 0.3
      }
    };

    return fixes[error.code] || {
      fixedCode: error.codeSnippet,
      explanation: 'Unable to generate automatic fix',
      confidence: 0.0
    };
  }

  /**
   * Apply fix to file
   */
  private async applyFix(filePath: string, lineNumber: number, fix: any) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');

      // Apply the fix
      if (fix.additionalImports?.length > 0) {
        // Add imports at the top
        const importLines = fix.additionalImports.map((imp: string) => `import ${imp};`);
        lines.unshift(...importLines);
      }

      // Replace the problematic line
      lines[lineNumber - 1] = fix.fixedCode;

      // Write back
      await fs.writeFile(filePath, lines.join('\n'));

      // Record successful fix
      await this.recordSuccessfulFix(filePath, lineNumber, fix);

      logger.info(`✅ Applied fix to ${filePath}:${lineNumber}`);
    } catch (error) {
      logger.error(`Failed to apply fix to ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Record successful fix for future learning
   */
  private async recordSuccessfulFix(filePath: string, lineNumber: number, fix: any) {
    try {
      await this.supabase.client
        .from('code_fix_attempts')
        .update({ status: 'successful' })
        .match({
          file_path: filePath,
          line_number: lineNumber,
          fixed_code: fix.fixedCode
        });
    } catch (error) {
      logger.error('Failed to record successful fix:', error);
    }
  }

  /**
   * Generate comprehensive fix report
   */
  private async generateFixReport(fixes: any[]) {
    const report = {
      summary: {
        total: fixes.length,
        applied: fixes.filter(f => f.applied).length,
        highConfidence: fixes.filter(f => f.fix.confidence >= 0.9).length,
        mediumConfidence: fixes.filter(f => f.fix.confidence >= 0.7 && f.fix.confidence < 0.9).length,
        lowConfidence: fixes.filter(f => f.fix.confidence < 0.7).length
      },
      fixes: fixes.map(f => ({
        file: f.error.file,
        line: f.error.line,
        errorCode: f.error.code,
        errorMessage: f.error.message,
        fix: f.fix.fixedCode,
        explanation: f.fix.explanation,
        confidence: f.fix.confidence,
        applied: f.applied
      })),
      recommendations: this.generateRecommendations(fixes)
    };

    // Save report
    const reportPath = path.join(process.cwd(), 'LLM_FIX_REPORT.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

    return report;
  }

  /**
   * Generate recommendations based on fixes
   */
  private generateRecommendations(fixes: any[]): string[] {
    const recommendations: string[] = [];

    // Analyze patterns
    const errorCounts = fixes.reduce((acc, f) => {
      acc[f.error.code] = (acc[f.error.code] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Generate recommendations
    if (errorCounts['TS2339'] > 10) {
      recommendations.push('Consider updating type definitions - many missing property errors');
    }

    if (errorCounts['TS2345'] > 10) {
      recommendations.push('Review function signatures - many type mismatch errors');
    }

    const lowConfidenceFixes = fixes.filter(f => f.fix.confidence < 0.7).length;
    if (lowConfidenceFixes > fixes.length * 0.3) {
      recommendations.push('Many low-confidence fixes - manual review recommended');
    }

    return recommendations;
  }

  /**
   * Interactive fix mode - let user review each fix
   */
  async interactiveFixMode(errorOutput: string) {
    // This would integrate with a CLI interface
    // For now, just generate fixes without applying
    return this.fixTypeScriptErrors(errorOutput, {
      autoApply: false,
      interactive: true
    });
  }
}

// Usage example
export async function demonstrateLLMFixer() {
  const fixer = new LLMCodeFixer();
  
  // Read build errors
  const buildOutput = await fs.readFile('build_errors.log', 'utf-8');
  
  // Fix errors automatically
  const result = await fixer.fixTypeScriptErrors(buildOutput, {
    autoApply: false, // Set to true to apply fixes
    minConfidence: 0.8
  });

  console.log(`Generated ${result.fixesGenerated} fixes for ${result.totalErrors} errors`);
  console.log(`Report saved to: LLM_FIX_REPORT.json`);
}