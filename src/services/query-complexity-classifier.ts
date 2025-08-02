/**
 * Query Complexity Classifier
 * Analyzes user queries to determine appropriate model tier
 * Uses pattern matching and ML features for classification
 */

import { LogContext, log } from '@/utils/logger';
import { ModelTier } from './model-tier-manager';

export enum QueryComplexity {
  SIMPLE = 'simple',           // Greetings, basic facts, yes/no
  MEDIUM = 'medium',           // Explanations, summaries, general chat
  COMPLEX = 'complex',         // Analysis, reasoning, problem solving
  EXPERT = 'expert'            // Complex coding, research, creative tasks
}

export interface QueryFeatures {
  wordCount: number;
  sentenceCount: number;
  questionCount: number;
  technicalTerms: number;
  codeKeywords: number;
  analysisKeywords: number;
  complexityIndicators: number;
  hasCode: boolean;
  isGreeting: boolean;
  isSimpleFact: boolean;
  requiresReasoning: boolean;
  isMultiStep: boolean;
}

export interface ClassificationResult {
  complexity: QueryComplexity;
  confidence: number;
  suggestedTier: ModelTier;
  features: QueryFeatures;
  reasoning: string;
  fallbackTier?: ModelTier;
}

export class QueryComplexityClassifier {
  private readonly patterns = {
    greetings: [
      /^(hi|hello|hey|good\s+(morning|afternoon|evening)|howdy|greetings)[\s!.]*$/i,
      /^(how\s+(are\s+you|r\s+u)|what'?s\s+up|sup)[\s!.]*$/i
    ],
    
    simpleFacts: [
      /^(what|when|where|who)\s+is\s+/i,
      /^(what'?s|when'?s|where'?s|who'?s)\s+/i,
      /capital\s+of/i,
      /\d+\s*[+\-*\/]\s*\d+/,
      /^(yes|no|true|false|maybe)[\s!.]*$/i
    ],
    
    technicalTerms: [
      // Programming
      /\b(function|class|method|algorithm|database|api|json|xml|html|css|javascript|python|java|react|node|typescript)\b/i,
      // Science/Math
      /\b(quantum|molecular|calculus|derivative|integral|hypothesis|theorem|equation|formula)\b/i,
      // Technology
      /\b(server|client|backend|frontend|microservice|container|kubernetes|docker|aws|cloud)\b/i
    ],
    
    codeKeywords: [
      /\b(code|program|script|debug|error|bug|compile|syntax|variable|loop|condition)\b/i,
      /\b(write\s+(a\s+)?(function|class|program|script))\b/i,
      /\b(fix\s+(this\s+)?(code|bug|error))\b/i,
      /```[\s\S]*```/,
      /`[^`]+`/
    ],
    
    analysisKeywords: [
      /\b(analyze|compare|evaluate|assess|examine|investigate|study|research)\b/i,
      /\b(pros\s+and\s+cons|advantages\s+and\s+disadvantages|benefits\s+and\s+drawbacks)\b/i,
      /\b(explain\s+(why|how|what|when|where))\b/i,
      /\b(difference\s+between|relationship\s+between|correlation)\b/i
    ],
    
    complexityIndicators: [
      /\b(complex|complicated|detailed|comprehensive|thorough|in-depth)\b/i,
      /\b(step-by-step|multi-step|process|procedure|methodology)\b/i,
      /\b(design|architect|implement|optimize|troubleshoot)\b/i,
      /\b(strategy|approach|solution|framework|best\s+practices)\b/i
    ],
    
    reasoning: [
      /\b(because|therefore|thus|hence|consequently|as\s+a\s+result)\b/i,
      /\b(if.*then|given.*what|assuming.*how)\b/i,
      /\b(prove|demonstrate|justify|reasoning|logic)\b/i,
      /\b(why\s+(do|does|did|would|should|might))\b/i
    ],
    
    multiStep: [
      /(first|second|third|finally|then|next|after\s+that|step\s+\d+)/i,
      /(and\s+then|followed\s+by|in\s+addition|furthermore|moreover)/i,
      /\b(plan|schedule|timeline|roadmap|phases?|stages?)\b/i
    ]
  };

  /**
   * Classify query complexity and suggest appropriate model tier
   */
  public classify(query: string, context?: { conversationHistory?: any[] }): ClassificationResult {
    const features = this.extractFeatures(query);
    const complexity = this.determineComplexity(features);
    const suggestedTier = this.mapComplexityToTier(complexity);
    const confidence = this.calculateConfidence(features, complexity);
    const reasoning = this.generateReasoning(features, complexity);
    const fallbackTier = this.getFallbackTier(suggestedTier);

    const result: ClassificationResult = {
      complexity,
      confidence,
      suggestedTier,
      features,
      reasoning,
      fallbackTier
    };

    log.debug('Query classified', LogContext.AI, {
      complexity,
      tier: suggestedTier,
      confidence: `${Math.round(confidence * 100)  }%`,
      wordCount: features.wordCount
    });

    return result;
  }

  /**
   * Extract features from the query text
   */
  private extractFeatures(query: string): QueryFeatures {
    const text = query.trim().toLowerCase();
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const sentences = query.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    return {
      wordCount: words.length,
      sentenceCount: sentences.length,
      questionCount: (query.match(/\?/g) || []).length,
      technicalTerms: this.countMatches(query, this.patterns.technicalTerms),
      codeKeywords: this.countMatches(query, this.patterns.codeKeywords),
      analysisKeywords: this.countMatches(query, this.patterns.analysisKeywords),
      complexityIndicators: this.countMatches(query, this.patterns.complexityIndicators),
      hasCode: this.hasMatch(query, this.patterns.codeKeywords),
      isGreeting: this.hasMatch(query, this.patterns.greetings),
      isSimpleFact: this.hasMatch(query, this.patterns.simpleFacts),
      requiresReasoning: this.hasMatch(query, this.patterns.reasoning),
      isMultiStep: this.hasMatch(query, this.patterns.multiStep)
    };
  }

  /**
   * Count pattern matches in text
   */
  private countMatches(text: string, patterns: RegExp[]): number {
    return patterns.reduce((count, pattern) => {
      const matches = text.match(pattern);
      return count + (matches ? matches.length : 0);
    }, 0);
  }

  /**
   * Check if text matches any pattern
   */
  private hasMatch(text: string, patterns: RegExp[]): boolean {
    return patterns.some(pattern => pattern.test(text));
  }

  /**
   * Determine query complexity based on extracted features
   */
  private determineComplexity(features: QueryFeatures): QueryComplexity {
    // Simple queries
    if (features.isGreeting || 
        (features.wordCount <= 5 && features.isSimpleFact) ||
        (features.wordCount <= 3 && features.questionCount === 0)) {
      return QueryComplexity.SIMPLE;
    }

    // Expert-level queries
    if (features.hasCode ||
        features.codeKeywords >= 2 ||
        features.complexityIndicators >= 2 ||
        (features.technicalTerms >= 3 && features.analysisKeywords >= 1) ||
        (features.isMultiStep && features.technicalTerms >= 1)) {
      return QueryComplexity.EXPERT;
    }

    // Complex queries
    if (features.requiresReasoning ||
        features.analysisKeywords >= 2 ||
        features.technicalTerms >= 2 ||
        features.isMultiStep ||
        features.wordCount >= 30 ||
        (features.complexityIndicators >= 1 && features.wordCount >= 15)) {
      return QueryComplexity.COMPLEX;
    }

    // Everything else is medium complexity
    return QueryComplexity.MEDIUM;
  }

  /**
   * Map query complexity to model tier
   */
  private mapComplexityToTier(complexity: QueryComplexity): ModelTier {
    switch (complexity) {
      case QueryComplexity.SIMPLE:
        return ModelTier.ULTRA_FAST;
      case QueryComplexity.MEDIUM:
        return ModelTier.FAST;
      case QueryComplexity.COMPLEX:
        return ModelTier.BALANCED;
      case QueryComplexity.EXPERT:
        return ModelTier.POWERFUL;
      default:
        return ModelTier.FAST;
    }
  }

  /**
   * Calculate confidence score for the classification
   */
  private calculateConfidence(features: QueryFeatures, complexity: QueryComplexity): number {
    let confidence = 0.5; // Base confidence

    // High confidence indicators
    if (features.isGreeting && complexity === QueryComplexity.SIMPLE) {
      confidence = 0.95;
    } else if (features.hasCode && complexity === QueryComplexity.EXPERT) {
      confidence = 0.9;
    } else if (features.isSimpleFact && complexity === QueryComplexity.SIMPLE) {
      confidence = 0.85;
    } else {
      // Calculate based on feature strength
      const indicators = {
        [QueryComplexity.SIMPLE]: features.isGreeting || features.isSimpleFact ? 0.3 : 0,
        [QueryComplexity.MEDIUM]: features.wordCount >= 5 && features.wordCount <= 20 ? 0.2 : 0,
        [QueryComplexity.COMPLEX]: (features.analysisKeywords + features.requiresReasoning) * 0.1,
        [QueryComplexity.EXPERT]: (features.technicalTerms + features.codeKeywords + features.complexityIndicators) * 0.1
      };

      confidence += indicators[complexity];
      
      // Adjust for word count appropriateness
      const wordCountScore = this.getWordCountScore(features.wordCount, complexity);
      confidence = (confidence + wordCountScore) / 2;
    }

    return Math.min(0.95, Math.max(0.1, confidence));
  }

  /**
   * Get word count appropriateness score
   */
  private getWordCountScore(wordCount: number, complexity: QueryComplexity): number {
    const ranges = {
      [QueryComplexity.SIMPLE]: [1, 8],
      [QueryComplexity.MEDIUM]: [5, 25],
      [QueryComplexity.COMPLEX]: [15, 50],
      [QueryComplexity.EXPERT]: [20, 100]
    };

    const [min, max] = ranges[complexity];
    if (wordCount >= min && wordCount <= max) {
      return 0.8;
    } else if (wordCount >= min * 0.5 && wordCount <= max * 1.5) {
      return 0.6;
    } else {
      return 0.3;
    }
  }

  /**
   * Generate human-readable reasoning for the classification
   */
  private generateReasoning(features: QueryFeatures, complexity: QueryComplexity): string {
    const reasons: string[] = [];

    if (features.isGreeting) {
      reasons.push('greeting detected');
    }
    
    if (features.isSimpleFact) {
      reasons.push('simple factual query');
    }
    
    if (features.hasCode) {
      reasons.push('contains code');
    }
    
    if (features.technicalTerms > 0) {
      reasons.push(`${features.technicalTerms} technical terms`);
    }
    
    if (features.analysisKeywords > 0) {
      reasons.push(`analysis required (${features.analysisKeywords} indicators)`);
    }
    
    if (features.requiresReasoning) {
      reasons.push('requires reasoning');
    }
    
    if (features.isMultiStep) {
      reasons.push('multi-step process');
    }
    
    if (features.wordCount >= 30) {
      reasons.push('long query');
    }

    if (reasons.length === 0) {
      reasons.push(`${features.wordCount} words, general conversation`);
    }

    return `${complexity}: ${reasons.join(', ')}`;
  }

  /**
   * Get fallback tier if primary tier fails
   */
  private getFallbackTier(primaryTier: ModelTier): ModelTier {
    const fallbacks = {
      [ModelTier.ULTRA_FAST]: ModelTier.FAST,
      [ModelTier.FAST]: ModelTier.BALANCED,
      [ModelTier.BALANCED]: ModelTier.POWERFUL,
      [ModelTier.POWERFUL]: ModelTier.BALANCED,
      [ModelTier.ROUTER]: ModelTier.ULTRA_FAST
    };

    return fallbacks[primaryTier] || ModelTier.FAST;
  }

  /**
   * Classify batch of queries (for optimization)
   */
  public classifyBatch(queries: string[]): ClassificationResult[] {
    return queries.map(query => this.classify(query));
  }

  /**
   * Update classification based on user feedback
   */
  public updateClassification(
    query: string, 
    actualComplexity: QueryComplexity,
    userSatisfaction: number
  ): void {
    // In production, this would update ML models or pattern weights
    log.info('Classification feedback received', LogContext.AI, {
      query: query.substring(0, 50),
      actualComplexity,
      satisfaction: userSatisfaction
    });
  }
}

// Singleton instance
export const queryComplexityClassifier = new QueryComplexityClassifier();