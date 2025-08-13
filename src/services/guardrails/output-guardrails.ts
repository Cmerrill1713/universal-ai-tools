/**
 * Output Guardrails Service
 * Comprehensive response filtering and safety validation for outgoing AI responses
 */

import { z } from 'zod';
import { log, LogContext } from '../../utils/logger.js';

interface OutputGuardrailResult {
  allowed: boolean;
  reason?: string;
  confidence: number;
  categories: string[];
  sanitizedContent?: string;
  metadata: {
    originalLength: number;
    sanitizedLength?: number;
    processingTime: number;
    riskScore: number;
  };
}

interface HarmCategory {
  name: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  patterns: RegExp[];
  action: 'warn' | 'block' | 'sanitize' | 'flag';
  description: string;
}

class OutputGuardrailsService {
  private readonly harmfulPatterns: HarmCategory[] = [
    {
      name: 'dangerous_instructions',
      severity: 'critical',
      patterns: [
        /(?:how\s+to\s+(?:make|build|create|construct))\s+(?:bomb|explosive|weapon)/i,
        /(?:step\s+by\s+step|instructions?|tutorial)\s+(?:for|on|to)\s+(?:harm|hurt|kill|poison)/i,
        /(?:recipe|formula|method)\s+(?:for|to)\s+(?:poison|explosive|harmful\s+substance)/i,
        /(?:bypass|disable|hack)\s+(?:security|alarm|camera|system)/i
      ],
      action: 'block',
      description: 'Content contains dangerous instructions'
    },
    {
      name: 'personal_information',
      severity: 'high',
      patterns: [
        /(?:social\s+security|ssn)[\s\-:]*\d{3}[\s\-]?\d{2}[\s\-]?\d{4}/i,
        /(?:credit\s+card|cc)[\s\-:]*\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}/i,
        /(?:password|pwd|passphrase)[\s\-:]*[A-Za-z0-9!@#$%^&*]{6,}/i,
        /(?:api[\s\-]?key|token)[\s\-:]*[A-Za-z0-9\-_]{20,}/i
      ],
      action: 'sanitize',
      description: 'Response contains personal information'
    },
    {
      name: 'inappropriate_content',
      severity: 'high',
      patterns: [
        /(?:explicit|graphic)\s+(?:sexual|violent)\s+(?:content|material|description)/i,
        /(?:hate\s+speech|discriminatory)\s+(?:language|content|remarks)/i,
        /(?:self[\s\-]?harm|suicide)\s+(?:methods|instructions|encouragement)/i
      ],
      action: 'block',
      description: 'Content contains inappropriate material'
    },
    {
      name: 'misinformation',
      severity: 'medium',
      patterns: [
        /(?:proven|scientific)\s+fact[:\s]+(?:earth\s+is\s+flat|vaccines?\s+cause\s+autism)/i,
        /(?:guaranteed|100%\s+effective)\s+(?:cure|treatment)\s+for\s+(?:cancer|covid|aids)/i,
        /(?:conspiracy|secret|hidden)\s+(?:government|agenda|truth)/i
      ],
      action: 'flag',
      description: 'Content may contain misinformation'
    },
    {
      name: 'financial_advice',
      severity: 'medium',
      patterns: [
        /(?:guaranteed|sure\s+bet|can't\s+lose)\s+(?:investment|profit|returns?)/i,
        /(?:buy|sell|invest\s+in)\s+(?:now|immediately|today)\s+(?:for|to)\s+(?:profit|money)/i,
        /(?:insider|secret)\s+(?:trading|investment)\s+(?:tip|information)/i
      ],
      action: 'warn',
      description: 'Content contains financial advice without disclaimers'
    },
    {
      name: 'medical_advice',
      severity: 'high',
      patterns: [
        /(?:diagnose|diagnosis|treat|cure)\s+(?:yourself|your)\s+(?:with|using|by)/i,
        /(?:stop\s+taking|don't\s+take)\s+(?:your\s+)?(?:medication|pills|prescription)/i,
        /(?:instead\s+of|rather\s+than)\s+(?:seeing|visiting)\s+(?:a\s+)?(?:doctor|physician)/i
      ],
      action: 'warn',
      description: 'Content contains medical advice'
    },
    {
      name: 'code_vulnerabilities',
      severity: 'high',
      patterns: [
        /(?:sql\s+injection|xss|cross[\s\-]?site\s+scripting)\s+(?:attack|exploit|vulnerability)/i,
        /(?:buffer\s+overflow|code\s+injection)\s+(?:exploit|attack|technique)/i,
        /(?:backdoor|malware|virus)\s+(?:code|implementation|creation)/i,
        /eval\s*\(\s*(?:user[\s\-]?input|request|untrusted)/i
      ],
      action: 'block',
      description: 'Code contains security vulnerabilities'
    },
    {
      name: 'system_manipulation',
      severity: 'critical',
      patterns: [
        /(?:rm\s+\-rf|del\s+\/[sq]|format\s+[cd]:)\s*[\/\\]?/i,
        /(?:DROP\s+TABLE|DELETE\s+FROM|TRUNCATE)\s+\w+/i,
        /(?:sudo|su\s+\-|runas)\s+(?:rm|del|format|shutdown)/i
      ],
      action: 'block',
      description: 'Content contains system manipulation commands'
    }
  ];

  private readonly qualityChecks = {
    minLength: 10,
    maxLength: 100000,
    maxRepetition: 0.3, // 30% repetition threshold
    maxGibberish: 0.2,  // 20% gibberish threshold
    requiredCoherence: 0.7 // 70% coherence requirement
  };

  /**
   * Validate and filter AI response content
   */
  async validateOutput(
    content: string, 
    requestContext: {
      userId?: string;
      requestType?: string;
      model?: string;
      prompt?: string;
    } = {}
  ): Promise<OutputGuardrailResult> {
    const startTime = Date.now();
    
    try {
      const originalLength = content.length;
      
      // Quality checks
      const qualityResult = this.checkQuality(content);
      if (!qualityResult.passed) {
        return {
          allowed: false,
          reason: qualityResult.reason,
          confidence: 1.0,
          categories: ['quality_violation'],
          metadata: {
            originalLength,
            processingTime: Date.now() - startTime,
            riskScore: 1.0
          }
        };
      }

      // Safety analysis
      const safetyResult = this.analyzeSafety(content);
      const riskScore = this.calculateRiskScore(safetyResult.categories);

      // Context-aware filtering
      const contextResult = this.analyzeContext(content, requestContext);

      // Combine results
      const finalResult = this.combineResults(safetyResult, contextResult);

      // Log high-risk outputs
      if (riskScore > 0.7 || !finalResult.allowed) {
        log.warn('🛡️ High-risk output detected', LogContext.SECURITY, {
          userId: requestContext.userId,
          model: requestContext.model,
          requestType: requestContext.requestType,
          riskScore,
          categories: finalResult.categories,
          allowed: finalResult.allowed,
          contentPreview: content.substring(0, 200) + '...'
        });
      }

      return {
        ...finalResult,
        metadata: {
          originalLength,
          sanitizedLength: finalResult.sanitizedContent?.length,
          processingTime: Date.now() - startTime,
          riskScore
        }
      };

    } catch (error) {
      log.error('Output guardrails validation failed', LogContext.SECURITY, { 
        error,
        userId: requestContext.userId,
        model: requestContext.model
      });
      
      return {
        allowed: false,
        reason: 'Output validation system error',
        confidence: 0.0,
        categories: ['system_error'],
        metadata: {
          originalLength: content.length,
          processingTime: Date.now() - startTime,
          riskScore: 1.0
        }
      };
    }
  }

  /**
   * Analyze content safety against harmful patterns
   */
  private analyzeSafety(content: string): {
    allowed: boolean;
    categories: string[];
    sanitizedContent?: string;
    actions: string[];
  } {
    const detectedCategories: string[] = [];
    const actions: string[] = [];
    let sanitizedContent = content;
    let shouldBlock = false;

    for (const category of this.harmfulPatterns) {
      for (const pattern of category.patterns) {
        if (pattern.test(content)) {
          detectedCategories.push(category.name);
          actions.push(category.action);

          switch (category.action) {
            case 'block':
              shouldBlock = true;
              break;
            case 'sanitize':
              sanitizedContent = sanitizedContent.replace(pattern, '[CONTENT FILTERED]');
              break;
            case 'flag':
              // Add warning prefix
              sanitizedContent = `⚠️ Disclaimer: This information should be verified. ` + sanitizedContent;
              break;
            case 'warn':
              // Add appropriate disclaimer
              if (category.name === 'medical_advice') {
                sanitizedContent = `⚠️ Medical Disclaimer: This is not medical advice. Consult a healthcare professional. ` + sanitizedContent;
              } else if (category.name === 'financial_advice') {
                sanitizedContent = `⚠️ Financial Disclaimer: This is not financial advice. Do your own research. ` + sanitizedContent;
              }
              break;
          }
        }
      }
    }

    return {
      allowed: !shouldBlock,
      categories: detectedCategories.length > 0 ? detectedCategories : ['safe'],
      sanitizedContent: sanitizedContent !== content ? sanitizedContent : undefined,
      actions
    };
  }

  /**
   * Check response quality
   */
  private checkQuality(content: string): { passed: boolean; reason?: string } {
    // Length check
    if (content.length < this.qualityChecks.minLength) {
      return { passed: false, reason: 'Response too short' };
    }
    if (content.length > this.qualityChecks.maxLength) {
      return { passed: false, reason: 'Response too long' };
    }

    // Repetition check
    const repetitionRatio = this.calculateRepetitionRatio(content);
    if (repetitionRatio > this.qualityChecks.maxRepetition) {
      return { passed: false, reason: 'Excessive repetition detected' };
    }

    // Gibberish check
    const gibberishRatio = this.calculateGibberishRatio(content);
    if (gibberishRatio > this.qualityChecks.maxGibberish) {
      return { passed: false, reason: 'Content appears to be gibberish' };
    }

    return { passed: true };
  }

  /**
   * Context-aware analysis
   */
  private analyzeContext(content: string, context: any): {
    riskAdjustment: number;
    contextFlags: string[];
  } {
    const contextFlags: string[] = [];
    let riskAdjustment = 0;

    // Code context - be more strict with executable content
    if (context.requestType === 'code' || /```/.test(content)) {
      if (/(?:exec|eval|system|shell)/i.test(content)) {
        riskAdjustment += 0.3;
        contextFlags.push('executable_code');
      }
    }

    // Educational context - be more lenient
    if (context.requestType === 'educational' || /(?:explain|teach|learn)/i.test(context.prompt || '')) {
      riskAdjustment -= 0.2;
      contextFlags.push('educational_context');
    }

    // Creative context - different standards
    if (context.requestType === 'creative' || /(?:story|fiction|creative)/i.test(context.prompt || '')) {
      riskAdjustment -= 0.1;
      contextFlags.push('creative_context');
    }

    return { riskAdjustment, contextFlags };
  }

  /**
   * Calculate overall risk score
   */
  private calculateRiskScore(categories: string[]): number {
    let score = 0;
    
    for (const category of categories) {
      const harmCategory = this.harmfulPatterns.find(h => h.name === category);
      if (harmCategory) {
        switch (harmCategory.severity) {
          case 'critical': score += 0.4; break;
          case 'high': score += 0.3; break;
          case 'medium': score += 0.2; break;
          case 'low': score += 0.1; break;
        }
      }
    }

    return Math.min(score, 1.0);
  }

  /**
   * Combine safety and context results
   */
  private combineResults(
    safetyResult: any, 
    contextResult: any
  ): { allowed: boolean; categories: string[]; sanitizedContent?: string; confidence: number } {
    const adjustedRisk = Math.max(0, this.calculateRiskScore(safetyResult.categories) + contextResult.riskAdjustment);
    
    return {
      allowed: safetyResult.allowed && adjustedRisk < 0.8,
      categories: [...safetyResult.categories, ...contextResult.contextFlags],
      sanitizedContent: safetyResult.sanitizedContent,
      confidence: 1.0 - adjustedRisk
    };
  }

  /**
   * Calculate repetition ratio in text
   */
  private calculateRepetitionRatio(text: string): number {
    const words = text.toLowerCase().split(/\s+/);
    const wordCount = new Map<string, number>();
    
    for (const word of words) {
      wordCount.set(word, (wordCount.get(word) || 0) + 1);
    }

    let totalRepetitions = 0;
    for (const count of wordCount.values()) {
      if (count > 1) totalRepetitions += count - 1;
    }

    return words.length > 0 ? totalRepetitions / words.length : 0;
  }

  /**
   * Calculate gibberish ratio in text
   */
  private calculateGibberishRatio(text: string): number {
    const words = text.split(/\s+/);
    let gibberishCount = 0;

    for (const word of words) {
      // Simple heuristic: word with no vowels or too many consonants
      const vowelRatio = (word.match(/[aeiou]/gi) || []).length / word.length;
      if (word.length > 3 && vowelRatio < 0.1) {
        gibberishCount++;
      }
      
      // Check for random character sequences
      if (word.length > 5 && /^[a-z]{5,}$/i.test(word) && !/[aeiou]{2,}/i.test(word)) {
        gibberishCount++;
      }
    }

    return words.length > 0 ? gibberishCount / words.length : 0;
  }

  /**
   * Get guardrail statistics
   */
  getStats(): {
    totalProcessed: number;
    totalBlocked: number;
    totalSanitized: number;
    categoryBreakdown: Record<string, number>;
    averageRiskScore: number;
  } {
    // This would typically be stored in a database
    return {
      totalProcessed: 0,
      totalBlocked: 0,
      totalSanitized: 0,
      categoryBreakdown: {},
      averageRiskScore: 0
    };
  }
}

export const outputGuardrailsService = new OutputGuardrailsService();
export { OutputGuardrailsService };
export type { OutputGuardrailResult };