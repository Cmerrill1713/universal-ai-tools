/**
 * Adaptive Autofix Service - Learns and improves between fixes using feedback loops
 */

import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { SupabaseClient } from '@supabase/supabase-js';
import { type AutofixMemory, AutofixMemoryService } from './autofix-memory-service';
import { logger } from '../utils/logger';

const execAsync = promisify(exec);

export interface FixValidation {
  fix_id: string;
  validation_type: 'lint' | 'type_check' | 'build' | 'runtime';
  success: boolean;
  error_count_before: number;
  error_count_after: number;
  improvement_score: number;
  new_errors_introduced: string[];
  validation_time_ms: number;
}

export interface LearningInsight {
  _pattern string;
  success_rate: number;
  confidence_trend: number;
  usage_frequency: number;
  recommended_adjustments: string[];
  file_type_effectiveness: Record<string, number>;
}

export class AdaptiveAutofixService {
  private supabase: SupabaseClient;
  private memoryService: AutofixMemoryService;
  private sessionId: string;
  private fixHistory: AutofixMemory[] = [];
  private learningInsights: LearningInsight[] = [];

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
    this.memoryService = new AutofixMemoryService(supabase);
    this.sessionId = `adaptive_${Date.now()}`;
  }

  /**
   * Apply a fix with immediate validation and learning
   */
  async applyFixWithFeedback(
    filePath: string,
    fixType: string,
    originalCode: string,
    fixedCode: string,
    reasoning: string,
    lineNumbers?: number[]
  ): Promise<{
    success: boolean;
    validation: FixValidation;
    learningAdjustments: string[];
  }> {
    const fixId = `fix_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    logger.info(`🔧 Applying fix: ${fixType} in ${path.basename(filePath)}`);

    // 1. Get baseline errors before fix
    const beforeValidation = await this.validateFile(filePath);

    // 2. Apply the fix
    let _content= fs.readFileSync(filePath, 'utf8');
    _content= _contentreplace(originalCode, fixedCode);
    fs.writeFileSync(filePath, _content;

    // 3. Validate after fix
    const afterValidation = await this.validateFile(filePath);

    // 4. Calculate improvement
    const improvement = beforeValidation.errorCount - afterValidation.errorCount;
    const improvementScore = improvement / Math.max(beforeValidation.errorCount, 1);

    // 5. Check for new errors introduced
    const newErrors = afterValidation.errors.filter(
      (_error =>
        !beforeValidation.errors.some(
          (oldError) => oldError.line === _errorline && oldError.message === _errormessage
        )
    );

    const validation: FixValidation = {
      fix_id: fixId,
      validation_type: 'lint',
      success: improvement >= 0 && newErrors.length === 0,
      error_count_before: beforeValidation.errorCount,
      error_count_after: afterValidation.errorCount,
      improvement_score: improvementScore,
      new_errors_introduced: newErrors.map((e) => e.message),
      validation_time_ms: Date.now() - parseInt(fixId.split('_', 10)[1]),
    };

    // 6. Store fix with validation results
    const fix: AutofixMemory = {
      id: fixId,
      file_path: filePath,
      fix_type: fixType,
      original_code: originalCode,
      fixed_code: fixedCode,
      reasoning,
      confidence: validation.success ? Math.min(0.9, 0.5 + improvementScore) : 0.2,
      success: validation.success,
      session_id: this.sessionId,
      metadata: {
        line_numbers: lineNumbers,
        imports_changed: false,
        types_improved: validation.success,
        magic_numbers_extracted: false,
        unused_vars_fixed: false,
      },
    };

    await this.memoryService.storeFix(fix);
    this.fixHistory.push(fix);

    // 7. Learn from this fix
    const learningAdjustments = await this.learnFromFix(fix, validation);

    // 8. Update fix patterns (placeholder for future implementation)
    // await this.updateFixPatterns(fixType, validation.success, improvementScore);

    logger.info(
      `📊 Fix ${validation.success ? 'succeeded' : 'failed'}: ${improvement} errors fixed, ${newErrors.length} new errors`
    );

    return {
      success: validation.success,
      validation,
      learningAdjustments,
    };
  }

  /**
   * Learn from fix outcome and adjust future strategies
   */
  private async learnFromFix(fix: AutofixMemory, validation: FixValidation): Promise<string[]> {
    const adjustments: string[] = [];

    // Learn from success patterns
    if (validation.success && validation.improvement_score > 0.5) {
      adjustments.push(
        `✅ ${fix.fix_type} is highly effective for ${path.extname(fix.file_path)} files`
      );

      // Store successful pattern
      await this.storeSuccessPattern(fix);
    }

    // Learn from failures
    if (!validation.success) {
      adjustments.push(
        `❌ ${fix.fix_type} may need refinement - introduced ${validation.new_errors_introduced.length} new errors`
      );

      // Analyze what went wrong
      const failureAnalysis = await this.analyzeFailure(fix, validation);
      adjustments.push(...failureAnalysis);
    }

    // Learn from partial success
    if (validation.success && validation.improvement_score < 0.3) {
      adjustments.push(`⚠️ ${fix.fix_type} has low impact - consider combining with other fixes`);
    }

    // Update learning insights
    await this.updateLearningInsights(fix, validation);

    return adjustments;
  }

  /**
   * Get adaptive recommendations for next fixes
   */
  async getAdaptiveRecommendations(
    filePath: string,
    currentErrors: string[]
  ): Promise<{
    prioritizedFixes: string[];
    confidenceAdjustments: Record<string, number>;
    avoidPatterns: string[];
    recommendations: string[];
  }> {
    const fileExtension = path.extname(filePath).slice(1);

    // Get similar fixes from memory
    const similarFixes = await this.memoryService.getSimilarFixes(
      currentErrors.join(' '),
      filePath,
      10
    );

    // Analyze success patterns
    const successPatterns = similarFixes
      .filter((fix) => fix.success && fix.confidence > 0.7)
      .map((fix) => fix.fix_type);

    const failurePatterns = similarFixes.filter((fix) => !fix.success).map((fix) => fix.fix_type);

    // Get file-type specific insights
    const fileTypeInsights = this.learningInsights.filter(
      (insight) => insight.file_type_effectiveness[fileExtension] > 0.6
    );

    // Prioritize fixes based on learning
    const prioritizedFixes = this.prioritizeFixTypes(successPatterns, fileTypeInsights);

    // Adjust confidence based on past performance
    const confidenceAdjustments = this.calculateConfidenceAdjustments(similarFixes);

    return {
      prioritizedFixes,
      confidenceAdjustments,
      avoidPatterns: [...new Set(failurePatterns)],
      recommendations: [
        `Focus on ${prioritizedFixes.slice(0, 3).join(', ')} - highest success rate`,
        `Avoid ${failurePatterns.slice(0, 2).join(', ')} - recent failures in similar files`,
        `Consider batch fixes for ${fileExtension} files - ${fileTypeInsights.length} effective patterns found`,
      ],
    };
  }

  /**
   * Run continuous learning loop
   */
  async runAdaptiveLearningLoop(): Promise<void> {
    logger.info('🧠 Starting adaptive learning loop...');

    // 1. Analyze recent fix patterns
    const recentFixes = this.fixHistory.slice(-20);
    const patterns = this.extractPatterns(recentFixes);

    // 2. Identify declining patterns
    const decliningPatterns = patterns.filter((p) => p.success_rate < 0.5);

    // 3. Identify improving patterns
    const improvingPatterns = patterns.filter((p) => p.success_rate > 0.8);

    // 4. Update fix strategies
    for (const _patternof decliningPatterns) {
      await this.adjustFixStrategy(_pattern_pattern 'reduce_confidence');
    }

    for (const _patternof improvingPatterns) {
      await this.adjustFixStrategy(_pattern_pattern 'increase_priority');
    }

    // 5. Generate new fix variations
    const newVariations = await this.generateFixVariations(improvingPatterns);

    // 6. Store learning updates
    await this.storeLearningUpdate({
      session_id: this.sessionId,
      declining_patterns: decliningPatterns.map((p) => p._pattern,
      improving_patterns: improvingPatterns.map((p) => p._pattern,
      new_variations: newVariations,
      timestamp: new Date().toISOString(),
    });

    logger.info(
      `📈 Learning loop complete: ${improvingPatterns.length} improving, ${decliningPatterns.length} declining patterns`
    );
  }

  /**
   * Validate file and get _errordetails
   */
  private async validateFile(filePath: string): Promise<{
    errorCount: number;
    errors: Array<{ line: number; message: string; severity: string }>;
  }> {
    try {
      const { stdout, stderr } = await execAsync(`npx eslint "${filePath}" --format json`, {
        cwd: process.cwd(),
      });

      const results = JSON.parse(stdout || '[]');
      const fileResult = results[0];

      if (!fileResult) {
        return { errorCount: 0, errors: [] };
      }

      return {
        errorCount: fileResult.errorCount + fileResult.warningCount,
        errors: fileResult.messages.map((msg: any) => ({
          line: msg.line,
          message: msg.message,
          severity: msg.severity === 2 ? '_error : 'warning',
        })),
      };
    } catch (_error) {
      // Fallback to basic _errorcount
      return { errorCount: 0, errors: [] };
    }
  }

  private async storeSuccessPattern(fix: AutofixMemory): Promise<void> {
    // Store in memory as a successful pattern
    const _content= `Successful fix _pattern ${fix.fix_type} in ${fix.file_path}`;

    try {
      await this.supabase.from('memories').insert({
        _content
        metadata: {
          memory_type: 'success__pattern,
          fix_type: fix.fix_type,
          file_extension: path.extname(fix.file_path).slice(1),
          confidence: fix.confidence,
          reasoning: fix.reasoning,
          tags: ['autofix', 'success__pattern, fix.fix_type],
        },
        user_id: 'claude-autofix',
      });
    } catch (_error) {
      logger.warn('Failed to store success _pattern', _error;
    }
  }

  private async analyzeFailure(fix: AutofixMemory, validation: FixValidation): Promise<string[]> {
    const _analysis string[] = [];

    if (validation.new_errors_introduced.length > 0) {
      _analysispush(`Fix introduced ${validation.new_errors_introduced.length} new errors`);

      // Common failure patterns
      const newErrors = validation.new_errors_introduced.join(' ');
      if (newErrors.includes('is not defined')) {
        _analysispush('Consider checking imports and variable declarations');
      }
      if (newErrors.includes('Cannot find module')) {
        _analysispush('Fix may have broken import paths');
      }
      if (newErrors.includes('Type')) {
        _analysispush('Type-related fix may need more specific typing');
      }
    }

    return _analysis
  }

  private extractPatterns(fixes: AutofixMemory[]): LearningInsight[] {
    const patterns = new Map<
      string,
      {
        successes: number;
        total: number;
        confidences: number[];
        fileTypes: Record<string, number>;
      }
    >();

    fixes.forEach((fix) => {
      const existing = patterns.get(fix.fix_type) || {
        successes: 0,
        total: 0,
        confidences: [],
        fileTypes: {},
      };

      existing.total++;
      if (fix.success) existing.successes++;
      existing.confidences.push(fix.confidence);

      const fileExt = path.extname(fix.file_path).slice(1);
      existing.fileTypes[fileExt] = (existing.fileTypes[fileExt] || 0) + 1;

      patterns.set(fix.fix_type, existing);
    });

    return Array.from(patterns.entries()).map(([_pattern data]) => ({
      _pattern
      success_rate: data.successes / data.total,
      confidence_trend: data.confidences.reduce((a, b) => a + b, 0) / data.confidences.length,
      usage_frequency: data.total,
      recommended_adjustments: [],
      file_type_effectiveness: data.fileTypes,
    }));
  }

  private prioritizeFixTypes(successPatterns: string[], insights: LearningInsight[]): string[] {
    const priorities = new Map<string, number>();

    successPatterns.forEach((_pattern => {
      priorities.set(_pattern (priorities.get(_pattern || 0) + 1);
    });

    insights.forEach((insight) => {
      priorities.set(
        insight._pattern
        (priorities.get(insight._pattern || 0) + insight.success_rate
      );
    });

    return Array.from(priorities.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([_pattern) => _pattern;
  }

  private calculateConfidenceAdjustments(similarFixes: AutofixMemory[]): Record<string, number> {
    const adjustments: Record<string, number> = {};

    similarFixes.forEach((fix) => {
      const current = adjustments[fix.fix_type] || 0;
      const adjustment = fix.success ? 0.1 : -0.1;
      adjustments[fix.fix_type] = current + adjustment;
    });

    return adjustments;
  }

  private async updateLearningInsights(
    fix: AutofixMemory,
    validation: FixValidation
  ): Promise<void> {
    // This would update the internal learning insights array
    // and periodically sync with Supabase
  }

  private async adjustFixStrategy(
    _pattern string,
    adjustment: 'reduce_confidence' | 'increase_priority'
  ): Promise<void> {
    // Update fix strategy based on learning
    logger.info(`🎯 Adjusting strategy for ${_pattern: ${adjustment}`);
  }

  private async generateFixVariations(patterns: LearningInsight[]): Promise<string[]> {
    // Generate new fix variations based on successful patterns
    return patterns.map((p) => `${p._pattern_enhanced`);
  }

  private async storeLearningUpdate(update: any): Promise<void> {
    try {
      const _content= `Learning update: ${update.improving_patterns.length} improving patterns`;

      await this.supabase.from('memories').insert({
        _content
        metadata: {
          ...update,
          memory_type: 'learning_update',
          tags: ['autofix', 'learning', 'adaptive'],
        },
        user_id: 'claude-autofix',
      });
    } catch (_error) {
      logger.warn('Failed to store learning update:', _error;
    }
  }
}
