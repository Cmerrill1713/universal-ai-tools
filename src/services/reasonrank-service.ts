/**
 * ReasonRank Integration Service
 * Implements reasoning-intensive passage ranking with multi-view rewards
 * Based on research from: https://arxiv.org/pdf/2508.07050
 */

import { llmRouter } from '@/services/llm-router-service';
import { log, LogContext } from '@/utils/logger';
import { z } from 'zod';

// ReasonRank Configuration Schema
const ReasonRankConfigSchema = z.object({
  enabled: z.boolean().default(true),
  reasoningEnabled: z.boolean().default(true),
  multiViewRewardsEnabled: z.boolean().default(true),
  maxPassages: z.number().default(100),
  reasoningModel: z.string().default('deepseek-r1'),
  rankingModel: z.string().default('deepseek-coder'),
  temperature: z.number().min(0).max(2).default(0.1),
  maxTokens: z.number().default(2000),
  confidenceThreshold: z.number().min(0).max(1).default(0.7),
});

export type ReasonRankConfig = z.infer<typeof ReasonRankConfigSchema>;

// Passage Schema
const PassageSchema = z.object({
  id: z.string(),
  content: z.string(),
  metadata: z.record(z.any()).optional(),
  source: z.string().optional(),
  timestamp: z.date().optional(),
  relevanceScore: z.number().optional(),
  reasoningChain: z.string().optional(),
});

export type Passage = z.infer<typeof PassageSchema>;

// Ranking Query Schema
const RankingQuerySchema = z.object({
  query: z.string(),
  context: z.string().optional(),
  domain: z.enum(['general', 'coding', 'math', 'qa', 'web-search']).default('general'),
  complexity: z.enum(['simple', 'moderate', 'complex']).default('moderate'),
  reasoningRequired: z.boolean().default(true),
});

export type RankingQuery = z.infer<typeof RankingQuerySchema>;

// Ranking Result Schema
const RankingResultSchema = z.object({
  passageId: z.string(),
  content: z.string(),
  metadata: z.record(z.any()).optional(),
  relevanceScore: z.number(),
  reasoningChain: z.string(),
  confidence: z.number(),
  rankingPosition: z.number(),
  multiViewScore: z.object({
    singleTurnScore: z.number(),
    multiTurnScore: z.number(),
    reasoningQualityScore: z.number(),
    finalScore: z.number(),
  }),
});

export type RankingResult = z.infer<typeof RankingResultSchema>;

// Training Data Schema
const TrainingDataSchema = z.object({
  query: z.string(),
  passages: z.array(PassageSchema),
  goldRanking: z.array(z.string()), // Array of passage IDs in correct order
  reasoningChains: z.array(z.string()),
  domain: z.string(),
  complexity: z.string(),
});

export type TrainingData = z.infer<typeof TrainingDataSchema>;

export class ReasonRankService {
  private config: ReasonRankConfig;
  private passages: Map<string, Passage> = new Map();
  private trainingData: TrainingData[] = [];
  private performanceMetrics = {
    totalQueriesProcessed: 0,
    totalPassagesRanked: 0,
    averageReasoningTime: 0,
    averageRankingTime: 0,
    reasoningQualityScore: 0,
    rankingAccuracy: 0,
  };

  constructor(config: Partial<ReasonRankConfig> = {}) {
    this.config = ReasonRankConfigSchema.parse({
      ...this.getDefaultConfig(),
      ...config,
    });
  }

  private getDefaultConfig(): ReasonRankConfig {
    return {
      enabled: true,
      reasoningEnabled: true,
      multiViewRewardsEnabled: true,
      maxPassages: 100,
      reasoningModel: 'deepseek-r1',
      rankingModel: 'deepseek-coder',
      temperature: 0.1,
      maxTokens: 2000,
      confidenceThreshold: 0.7,
    };
  }

  /**
   * Rank passages using reasoning-intensive approach
   */
  async rankPassages(
    query: RankingQuery,
    passages: Passage[],
    options: {
      topK?: number;
      includeReasoning?: boolean;
      useMultiViewRewards?: boolean;
    } = {}
  ): Promise<RankingResult[]> {
    if (!this.config.enabled) {
      throw new Error('ReasonRank service is disabled');
    }

    const { topK = 10, includeReasoning = true, useMultiViewRewards = true } = options;

    log.info('🧠 Starting reasoning-intensive ranking', LogContext.AI, {
      query: query.query.substring(0, 100),
      passageCount: passages.length,
      topK,
      reasoningEnabled: includeReasoning,
      multiViewEnabled: useMultiViewRewards,
    });

    try {
      const startTime = Date.now();

      // Step 1: Generate reasoning chains for each passage
      let reasoningResults: Array<{ passage: Passage; reasoning: string; relevance: number }> = [];

      if (includeReasoning && this.config.reasoningEnabled) {
        reasoningResults = await this.generateReasoningChains(query, passages);
      } else {
        // Fallback to basic relevance scoring
        reasoningResults = passages.map((passage) => ({
          passage,
          reasoning: '',
          relevance: this.calculateBasicRelevance(query.query, passage.content),
        }));
      }

      // Step 2: Apply listwise ranking with reasoning
      const rankedResults = await this.applyListwiseRanking(query, reasoningResults);

      // Step 3: Apply multi-view rewards if enabled
      let finalResults = rankedResults;
      if (useMultiViewRewards && this.config.multiViewRewardsEnabled) {
        finalResults = await this.applyMultiViewRewards(query, rankedResults);
      }

      // Step 4: Sort by final score and limit to topK
      const sortedResults = finalResults
        .sort((a, b) => (b.multiViewScore?.finalScore || 0) - (a.multiViewScore?.finalScore || 0))
        .slice(0, topK)
        .map((result, index) => ({
          ...result,
          rankingPosition: index + 1,
        }));

      const totalTime = Date.now() - startTime;
      this.updatePerformanceMetrics(totalTime, passages.length);

      log.info('✅ Ranking completed successfully', LogContext.AI, {
        queryId: query.query.substring(0, 50),
        resultCount: sortedResults.length,
        totalTime,
        averageTimePerPassage: totalTime / passages.length,
      });

      return sortedResults;
    } catch (error) {
      log.error('❌ Ranking failed', LogContext.AI, {
        error: error instanceof Error ? error.message : String(error),
        query: query.query.substring(0, 100),
      });
      throw error;
    }
  }

  /**
   * Generate reasoning chains for passages (Step 1)
   */
  private async generateReasoningChains(
    query: RankingQuery,
    passages: Passage[]
  ): Promise<Array<{ passage: Passage; reasoning: string; relevance: number }>> {
    const results: Array<{ passage: Passage; reasoning: string; relevance: number }> = [];

    for (const passage of passages) {
      try {
        const reasoning = await this.generateSingleReasoningChain(query, passage);
        const relevance = await this.evaluateRelevanceWithReasoning(query, passage, reasoning);

        results.push({
          passage,
          reasoning,
          relevance,
        });
      } catch (error) {
        log.warn('Failed to generate reasoning for passage', LogContext.AI, {
          passageId: passage.id,
          error: error instanceof Error ? error.message : String(error),
        });

        // Fallback to basic relevance
        results.push({
          passage,
          reasoning: 'Reasoning generation failed',
          relevance: this.calculateBasicRelevance(query.query, passage.content),
        });
      }
    }

    return results;
  }

  /**
   * Generate reasoning chain for a single passage
   */
  private async generateSingleReasoningChain(
    query: RankingQuery,
    passage: Passage
  ): Promise<string> {
    const prompt = `Analyze the relevance of this passage to the given query using step-by-step reasoning.

Query: "${query.query}"
Domain: ${query.domain}
Complexity: ${query.complexity}

Passage: "${passage.content}"

Provide a step-by-step analysis:
1. First, understand what the query is asking for
2. Then, analyze the passage content and identify key information
3. Evaluate how well the passage addresses the query requirements
4. Consider the domain context and complexity level
5. Provide a final relevance assessment

Format your response as a clear reasoning chain that explains your thinking process.`;

    const response = await llmRouter.generateResponse(
      this.config.reasoningModel,
      [{ role: 'user', content: prompt }],
      {
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokens,
      }
    );

    return response.content;
  }

  /**
   * Evaluate relevance using reasoning chain
   */
  private async evaluateRelevanceWithReasoning(
    query: RankingQuery,
    passage: Passage,
    reasoning: string
  ): Promise<number> {
    const prompt = `Based on this reasoning analysis, provide a relevance score from 0.0 to 1.0.

Query: "${query.query}"
Passage: "${passage.content}"
Reasoning: "${reasoning}"

Score the relevance from 0.0 (completely irrelevant) to 1.0 (perfectly relevant).
Consider:
- How well the passage answers the query
- The quality and depth of the information
- The match between query intent and passage content
- Domain relevance and complexity appropriateness

Return only the numerical score (e.g., 0.85):`;

    const response = await llmRouter.generateResponse(
      this.config.rankingModel,
      [{ role: 'user', content: prompt }],
      {
        temperature: 0.1,
        maxTokens: 100,
      }
    );

    const score = parseFloat(response.content.trim());
    return isNaN(score) ? 0.5 : Math.max(0, Math.min(1, score));
  }

  /**
   * Apply listwise ranking with reasoning (Step 2)
   */
  private async applyListwiseRanking(
    query: RankingQuery,
    reasoningResults: Array<{ passage: Passage; reasoning: string; relevance: number }>
  ): Promise<RankingResult[]> {
    const prompt = `You are an expert at ranking passages based on their relevance to a query.

Query: "${query.query}"
Domain: ${query.domain}
Complexity: ${query.complexity}

Passages with reasoning:
${reasoningResults
  .map(
    (result, index) => `
${index + 1}. Passage: "${result.passage.content.substring(0, 200)}..."
   Reasoning: "${result.reasoning.substring(0, 150)}..."
   Relevance Score: ${result.relevance.toFixed(3)}
`
  )
  .join('\n')}

Rank these passages from most relevant to least relevant.
Consider the reasoning chains and relevance scores, but also think about:
- Overall query coverage
- Information quality and depth
- Logical flow and coherence
- Domain expertise

Return the ranking as a JSON array of passage indices (0-based) in order of relevance:`;

    const response = await llmRouter.generateResponse(
      this.config.rankingModel,
      [{ role: 'user', content: prompt }],
      {
        temperature: this.config.temperature,
        maxTokens: 1000,
      }
    );

    const ranking = this.parseRankingResponse(response.content);

    // Convert to RankingResult format
    return ranking.map((index, position) => {
      const result = reasoningResults[index];
      if (!result) {
        throw new Error(`Invalid ranking index: ${index}`);
      }
      return {
        passageId: result.passage.id,
        content: result.passage.content,
        metadata: result.passage.metadata,
        relevanceScore: result.relevance,
        reasoningChain: result.reasoning,
        confidence: this.calculateConfidence(result.relevance, result.reasoning),
        rankingPosition: position + 1,
        multiViewScore: {
          singleTurnScore: result.relevance,
          multiTurnScore: result.relevance, // Will be updated by multi-view rewards
          reasoningQualityScore: this.evaluateReasoningQuality(result.reasoning),
          finalScore: result.relevance,
        },
      };
    });
  }

  /**
   * Apply multi-view rewards (Step 3)
   */
  private async applyMultiViewRewards(
    query: RankingQuery,
    rankedResults: RankingResult[]
  ): Promise<RankingResult[]> {
    const enhancedResults = await Promise.all(
      rankedResults.map(async (result, index) => {
        // Calculate multi-turn score based on context from previous passages
        const multiTurnScore = await this.calculateMultiTurnScore(
          query,
          result,
          rankedResults.slice(0, index)
        );

        // Calculate final score using multi-view approach
        const finalScore = this.calculateMultiViewScore({
          singleTurnScore: result.multiViewScore?.singleTurnScore || result.relevanceScore,
          multiTurnScore,
          reasoningQualityScore: result.multiViewScore?.reasoningQualityScore || 0.5,
        });

        return {
          ...result,
          multiViewScore: {
            singleTurnScore: result.multiViewScore?.singleTurnScore || result.relevanceScore,
            multiTurnScore,
            reasoningQualityScore: result.multiViewScore?.reasoningQualityScore || 0.5,
            finalScore,
          },
        };
      })
    );

    return enhancedResults;
  }

  /**
   * Calculate multi-turn score considering previous passages
   */
  private async calculateMultiTurnScore(
    query: RankingQuery,
    currentPassage: RankingResult,
    previousPassages: RankingResult[]
  ): Promise<number> {
    if (previousPassages.length === 0) {
      return currentPassage.multiViewScore?.singleTurnScore || currentPassage.relevanceScore;
    }

    const prompt = `Evaluate how well this passage complements the previously ranked passages for the query.

Query: "${query.query}"

Previously ranked passages:
${previousPassages.map((p, i) => `${i + 1}. ${(p.content || '').substring(0, 150)}...`).join('\n')}

Current passage: "${(currentPassage.content || '').substring(0, 200)}..."

Consider:
- Does this passage add new, valuable information?
- Does it avoid redundancy with previous passages?
- Does it create a coherent, comprehensive answer when combined?
- Does it maintain the logical flow and quality?

Score from 0.0 to 1.0, where higher means better complementarity.
Return only the numerical score:`;

    const response = await llmRouter.generateResponse(
      this.config.rankingModel,
      [{ role: 'user', content: prompt }],
      {
        temperature: 0.1,
        maxTokens: 100,
      }
    );

    const score = parseFloat(response.content.trim());
    return isNaN(score)
      ? (currentPassage.multiViewScore?.singleTurnScore || currentPassage.relevanceScore)
      : Math.max(0, Math.min(1, score));
  }

  /**
   * Calculate final multi-view score
   */
  private calculateMultiViewScore(scores: {
    singleTurnScore: number;
    multiTurnScore: number;
    reasoningQualityScore: number;
  }): number {
    // Weighted combination of different scores
    const weights = {
      singleTurn: 0.4,
      multiTurn: 0.4,
      reasoningQuality: 0.2,
    };

    return (
      scores.singleTurnScore * weights.singleTurn +
      scores.multiTurnScore * weights.multiTurn +
      scores.reasoningQualityScore * weights.reasoningQuality
    );
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(relevanceScore: number, reasoning: string): number {
    // Base confidence on relevance score
    let confidence = relevanceScore;

    // Boost confidence for longer, more detailed reasoning
    const reasoningLength = reasoning.length;
    if (reasoningLength > 200) {
      confidence += 0.1;
    } else if (reasoningLength < 100) {
      confidence -= 0.1;
    }

    // Boost confidence for reasoning that mentions specific details
    if (
      reasoning.includes('because') ||
      reasoning.includes('since') ||
      reasoning.includes('therefore')
    ) {
      confidence += 0.05;
    }

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Evaluate reasoning quality
   */
  private evaluateReasoningQuality(reasoning: string): number {
    let quality = 0.5; // Base score

    // Boost for structured reasoning
    if (reasoning.includes('1.') && reasoning.includes('2.') && reasoning.includes('3.')) {
      quality += 0.2;
    }

    // Boost for logical connectors
    if (
      reasoning.includes('because') ||
      reasoning.includes('therefore') ||
      reasoning.includes('however')
    ) {
      quality += 0.15;
    }

    // Boost for specific analysis
    if (
      reasoning.includes('analyze') ||
      reasoning.includes('evaluate') ||
      reasoning.includes('consider')
    ) {
      quality += 0.1;
    }

    // Penalty for very short reasoning
    if (reasoning.length < 50) {
      quality -= 0.2;
    }

    return Math.max(0, Math.min(1, quality));
  }

  /**
   * Calculate basic relevance (fallback method)
   */
  private calculateBasicRelevance(query: string, passageContent: string): number {
    const queryWords = query.toLowerCase().split(/\s+/);
    const passageWords = passageContent.toLowerCase().split(/\s+/);

    let matches = 0;
    for (const queryWord of queryWords) {
      if (queryWord.length > 2 && passageWords.includes(queryWord)) {
        matches++;
      }
    }

    return Math.min(1, matches / queryWords.length);
  }

  /**
   * Parse ranking response from LLM
   */
  private parseRankingResponse(content: string): number[] {
    try {
      // Try to extract JSON array from response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const ranking = JSON.parse(jsonMatch[0]);
        if (Array.isArray(ranking) && ranking.every((n) => typeof n === 'number')) {
          return ranking;
        }
      }

      // Fallback: try to extract numbers in order
      const numbers = content.match(/\d+/g);
      if (numbers) {
        return numbers.map((n) => parseInt(n) - 1); // Convert to 0-based indices
      }

      // Default: return original order
      return Array.from({ length: 100 }, (_, i) => i);
    } catch (error) {
      log.warn('Failed to parse ranking response', LogContext.AI, { error: String(error) });
      return Array.from({ length: 100 }, (_, i) => i);
    }
  }

  /**
   * Generate training data for fine-tuning
   */
  async generateTrainingData(
    queries: string[],
    passages: Passage[],
    options: {
      domain?: string;
      complexity?: string;
      maxExamples?: number;
    } = {}
  ): Promise<TrainingData[]> {
    const { domain = 'general', complexity = 'moderate', maxExamples = 100 } = options;

    log.info('📚 Generating training data', LogContext.AI, {
      queryCount: queries.length,
      passageCount: passages.length,
      domain,
      complexity,
      maxExamples,
    });

    const trainingData: TrainingData[] = [];

    for (let i = 0; i < Math.min(queries.length, maxExamples); i++) {
      try {
        const query = queries[i];

        // Generate reasoning chains and rankings
        const rankingQuery: RankingQuery = {
          query,
          domain: (domain as RankingQuery['domain']) || 'general',
          complexity: (complexity as RankingQuery['complexity']) || 'medium',
          reasoningRequired: true,
        };

        const rankingResults = await this.rankPassages(rankingQuery, passages, {
          topK: Math.min(10, passages.length),
          includeReasoning: true,
          useMultiViewRewards: true,
        });

        // Create training example
        const trainingExample: TrainingData = {
          query,
          passages: rankingResults.map((r) => ({
            id: r.passageId || '',
            content: r.content || '',
            metadata: r.metadata || {},
          })),
          goldRanking: rankingResults.map((r) => r.passageId || ''),
          reasoningChains: rankingResults.map((r) => r.reasoningChain || ''),
          domain,
          complexity,
        };

        trainingData.push(trainingExample);
      } catch (error) {
        log.warn('Failed to generate training example', LogContext.AI, {
          queryIndex: i,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    this.trainingData.push(...trainingData);

    log.info('✅ Training data generated successfully', LogContext.AI, {
      generatedCount: trainingData.length,
      totalCount: this.trainingData.length,
    });

    return trainingData;
  }

  /**
   * Get training data for export
   */
  getTrainingData(): TrainingData[] {
    return [...this.trainingData];
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(totalTime: number, passageCount: number): void {
    this.performanceMetrics.totalQueriesProcessed++;
    this.performanceMetrics.totalPassagesRanked += passageCount;
    this.performanceMetrics.averageRankingTime =
      (this.performanceMetrics.averageRankingTime *
        (this.performanceMetrics.totalQueriesProcessed - 1) +
        totalTime) /
      this.performanceMetrics.totalQueriesProcessed;
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics() {
    return { ...this.performanceMetrics };
  }

  /**
   * Add passage to the service
   */
  addPassage(passage: Passage): void {
    this.passages.set(passage.id, passage);
  }

  /**
   * Get passage by ID
   */
  getPassage(id: string): Passage | undefined {
    return this.passages.get(id);
  }

  /**
   * Get all passages
   */
  getAllPassages(): Passage[] {
    return Array.from(this.passages.values());
  }

  /**
   * Clear all data (useful for testing)
   */
  clearData(): void {
    this.passages.clear();
    this.trainingData = [];
    this.performanceMetrics = {
      totalQueriesProcessed: 0,
      totalPassagesRanked: 0,
      averageReasoningTime: 0,
      averageRankingTime: 0,
      reasoningQualityScore: 0,
      rankingAccuracy: 0,
    };
  }
}

// Export singleton instance
export const reasonRankService = new ReasonRankService();
