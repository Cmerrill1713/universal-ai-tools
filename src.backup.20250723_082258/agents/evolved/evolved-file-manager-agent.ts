/**
 * Evolved File Manager Agent
 * Self-improving file management with Alpha Evolve integration
 */

import { FileManagerAgent } from '../personal/file_manager_agent.js';
import { AlphaEvolveSystem } from '../../core/evolution/alpha-evolve-system.js';
import type { AgentContext, AgentResponse } from '../base_agent.js';
import type { SupabaseClient } from '@supabase/supabase-js';
import * as path from 'path';

interface EvolvedFileOperation {
  type: string;
  context: any;
  result: any;
  performance: {
    latency: number;
    success: boolean;
    resourceUsage: number;
    userSatisfaction: number;
  };
  strategy: string;
  timestamp: Date;
}

interface AdaptiveStrategy {
  id: string;
  name: string;
  parameters: Record<string, unknown>;
  performance: number;
  usageCount: number;
  lastUsed: Date;
}

export class EvolvedFileManagerAgent extends FileManagerAgent {
  private evolveSystem: AlphaEvolveSystem;
  private operationHistory: EvolvedFileOperation[] = [];
  private activeStrategies: Map<string, AdaptiveStrategy> = new Map();
  private performanceBaseline: Map<string, number> = new Map();

  constructor(supabase: SupabaseClient) {
    super(supabase);

    // Initialize Alpha Evolve system
    this.evolveSystem = new AlphaEvolveSystem(supabase, {
      populationSize: 30,
      mutationRate: 0.2,
      crossoverRate: 0.8,
      adaptationThreshold: 0.65,
      learningRate: 0.02,
    });

    this.setupEvolutionListeners();
  }

  /**
   * Setup listeners for evolution events
   */
  private setupEvolutionListeners(): void {
    this.evolveSystem.on('pattern_learned', ({ _pattern outcome }) => {
      this.logger.info(
        `Learned new _pattern ${_pattern_pattern with confidence ${_patternconfidence}`
      );
      this.updateStrategiesFromPattern(_pattern;
    });

    this.evolveSystem.on('adaptation_applied', ({ adaptation }) => {
      this.logger.info(
        `Applied adaptation: ${adaptation.type} with ${adaptation.improvement}% improvement`
      );
      this.refreshActiveStrategies();
    });

    this.evolveSystem.on('evolution_completed', (metrics) => {
      this.logger.info(
        `Evolution cycle completed. Fitness: ${metrics.fitnessScore}, Success rate: ${metrics.successRate}`
      );
    });
  }

  /**
   * Enhanced process method with evolution tracking
   */
  protected async process(_context: AgentContext & { memoryContext?: any }): Promise<AgentResponse> {
    const startTime = Date.now();
    const initialResourceUsage = process.memoryUsage().heapUsed;

    try {
      // Get best strategy from evolution system
      const bestStrategy = await this.evolveSystem.getBestStrategy();
      const strategyParams = this.extractStrategyParameters(bestStrategy);

      // Apply evolved parameters to operation
      const evolvedContext = {
        ...context,
        strategyParams,
      };

      // Execute with parent implementation
      const result = await super.process(evolvedContext);

      // Track operation performance
      const operation: EvolvedFileOperation = {
        type: this.identifyOperationType(context.userRequest),
        context: evolvedContext,
        result: result.data,
        performance: {
          latency: Date.now() - startTime,
          success: result.success,
          resourceUsage: (process.memoryUsage().heapUsed - initialResourceUsage) / 1024 / 1024, // MB
          userSatisfaction: this.estimateUserSatisfaction(result),
        },
        strategy: bestStrategy?.id || 'default',
        timestamp: new Date(),
      };

      // Record operation
      this.operationHistory.push(operation);

      // Learn from this operation
      await this.evolveSystem.learnFromPattern(operation.type, operation.context, {
        success: operation.performance.success,
        performance: this.calculateEvolvedPerformanceScore(operation.performance),
      });

      // Enhance result with evolution insights
      return {
        ...result,
        metadata: {
          ...result.metadata,
          evolutionInsights: await this.getEvolutionInsights(operation),
          strategyUsed: strategyParams,
        },
      };
    } catch (_error) {
      // Learn from failure
      await this.evolveSystem.learnFromPattern(
        'error_recovery',
        { _error _errorinstanceof Error ? _errormessage : String(_error, context },
        { success: false, performance: 0 }
      );

      throw _error;
    }
  }

  /**
   * Enhanced file organization with adaptive strategies
   */
  private async organizeFilesEvolved(intent: any): Promise<unknown> {
    const strategy = await this.selectOptimalStrategy('organize', intent);

    // Apply evolved organization parameters
    const evolvedIntent = {
      ...intent,
      criteria: {
        ...intent.criteria,
        strategy: strategy.parameters.organizationPreference || intent.criteria?.strategy,
        batchSize: strategy.parameters.batchSize || 100,
        parallelism: strategy.parameters.parallelism || 4,
      },
    };

    // Track strategy usage
    this.recordStrategyUsage(strategy.id);

    // Execute organization with monitoring
    const result = await this.executeWithMonitoring(
      () => super['organizeFiles'](evolvedIntent),
      'organize_files'
    );

    // Analyze results for learning
    await this.analyzeOrganizationResults(result, strategy);

    return result;
  }

  /**
   * Enhanced duplicate detection with learning
   */
  private async findDuplicateFilesEvolved(intent: any): Promise<unknown> {
    const strategy = await this.selectOptimalStrategy('duplicates', intent);

    // Apply evolved parameters
    const evolvedIntent = {
      ...intent,
      options: {
        ...intent.options,
        checkContent: strategy.parameters.deepScan !== false,
        threshold: strategy.parameters.similarityThreshold || 0.95,
        hashAlgorithm: strategy.parameters.hashAlgorithm || 'sha256',
        chunkSize: strategy.parameters.chunkSize || 65536,
      },
    };

    const result = await this.executeWithMonitoring(
      () => super['findDuplicateFiles'](evolvedIntent),
      'find_duplicates'
    );

    // Learn from duplicate patterns
    if (result.duplicateGroups?.length > 0) {
      await this.learnFromDuplicatePatterns(result.duplicateGroups);
    }

    return result;
  }

  /**
   * Enhanced search with query understanding evolution
   */
  private async smartFileSearchEvolved(intent: any): Promise<unknown> {
    const strategy = await this.selectOptimalStrategy('search', intent);

    // Evolve query understanding
    const enhancedQuery = await this.evolveQueryUnderstanding(
      intent.criteria?.query || intent.target
    );

    const evolvedIntent = {
      ...intent,
      criteria: {
        ...intent.criteria,
        query: enhancedQuery.query,
        expandedTerms: enhancedQuery.expansions,
        searchDepth: strategy.parameters.searchDepth || 5,
      },
      options: {
        ...intent.options,
        includeContent: strategy.parameters.contentSearch !== false,
        fuzzyMatch: strategy.parameters.fuzzyMatch || true,
        semanticSearch: strategy.parameters.semanticSearch || false,
      },
    };

    const result = await this.executeWithMonitoring(
      () => super['smartFileSearch'](evolvedIntent),
      'smart_search'
    );

    // Learn from search effectiveness
    await this.learnFromSearchResults(enhancedQuery, result);

    return result;
  }

  /**
   * Execute operation with performance monitoring
   */
  private async executeWithMonitoring<T>(
    operation: () => Promise<T>,
    operationType: string
  ): Promise<T> {
    const startTime = Date.now();
    const startMemory = process.memoryUsage().heapUsed;

    try {
      const result = await operation();

      // Record performance metrics
      const metrics = {
        latency: Date.now() - startTime,
        memoryDelta: process.memoryUsage().heapUsed - startMemory,
        operationType,
        timestamp: new Date(),
      };

      await this.storePerformanceMetrics(metrics);

      return result;
    } catch (_error) {
      // Record failure metrics
      await this.storePerformanceMetrics({
        latency: Date.now() - startTime,
        memoryDelta: process.memoryUsage().heapUsed - startMemory,
        operationType,
        timestamp: new Date(),
        _error _errorinstanceof Error ? _errormessage : String(_error,
      });

      throw _error;
    }
  }

  /**
   * Select optimal strategy based on context and evolution
   */
  private async selectOptimalStrategy(operation: string, intent: any): Promise<AdaptiveStrategy> {
    // Get best evolved strategy
    const evolvedStrategy = await this.evolveSystem.getBestStrategy();

    // Check for context-specific strategy
    const contextKey = this.generateContextKey(operation, intent);
    let strategy = this.activeStrategies.get(contextKey);

    if (!strategy || this.shouldRefreshStrategy(strategy)) {
      strategy = await this.createAdaptiveStrategy(operation, intent, evolvedStrategy);
      this.activeStrategies.set(contextKey, strategy);
    }

    return strategy;
  }

  /**
   * Create adaptive strategy from evolution
   */
  private async createAdaptiveStrategy(
    operation: string,
    intent: any,
    evolvedStrategy: any
  ): Promise<AdaptiveStrategy> {
    const parameters: Record<string, unknown> = {};

    if (evolvedStrategy) {
      for (const gene of evolvedStrategy.genome.genes) {
        parameters[this.mapGeneToParameter(gene.trait)] = gene.value;
      }
    }

    // Add operation-specific parameters
    switch (operation) {
      case 'organize':
        parameters.organizationPreference = parameters.organizationPreference || 'type';
        parameters.createBackup = true;
        break;
      case 'duplicates':
        parameters.deepScan = true;
        parameters.autoCleanup = false;
        break;
      case 'search':
        parameters.semanticSearch = parameters.fileCount > 10000;
        parameters.indexingEnabled = true;
        break;
    }

    return {
      id: `strategy_${operation}_${Date.now()}`,
      name: `Evolved ${operation} Strategy`,
      parameters,
      performance: evolvedStrategy?.genome.fitness || 0.5,
      usageCount: 0,
      lastUsed: new Date(),
    };
  }

  /**
   * Evolve query understanding over time
   */
  private async evolveQueryUnderstanding(query: string): Promise<unknown> {
    // Check if we've seen similar queries
    const similarQueries = await this.findSimilarQueries(query);

    const expansions: string[] = [];
    const synonyms: string[] = [];

    // Learn from successful past queries
    for (const pastQuery of similarQueries) {
      if (pastQuery.success) {
        expansions.push(...pastQuery.expansions);
        synonyms.push(...pastQuery.synonyms);
      }
    }

    // Apply query evolution
    const evolvedQuery = {
      query,
      expansions: [...new Set(expansions)],
      synonyms: [...new Set(synonyms)],
      intent: await this.classifyQueryIntent(query),
      confidence: this.calculateQueryConfidence(query, similarQueries),
    };

    return evolvedQuery;
  }

  /**
   * Learn from duplicate detection patterns
   */
  private async learnFromDuplicatePatterns(duplicateGroups: any[]): Promise<void> {
    for (const group of duplicateGroups) {
      const _pattern= {
        type: 'duplicate__pattern,
        characteristics: {
          fileTypes: [...new Set(group.files.map((f: any) => f.extension))],
          averageSize: group.files.reduce((sum: number, f: any) => sum + f.size, 0) / group.files.length,
          locations: group.files.map((f: any) => path.dirname(f.path)),
        },
      };

      await this.evolveSystem.learnFromPattern('duplicate_detection', _pattern {
        success: true,
        performance: group.confidence,
      });
    }
  }

  /**
   * Learn from search effectiveness
   */
  private async learnFromSearchResults(query: any, results: any): Promise<void> {
    const relevanceScore = await this.calculateSearchRelevance(query, results);

    await this.evolveSystem.learnFromPattern(
      'search_optimization',
      {
        query: query.query,
        expansions: query.expansions,
        resultCount: results.totalFound,
        searchTime: results.searchTime,
      },
      {
        success: relevanceScore > 0.7,
        performance: relevanceScore,
      }
    );
  }

  /**
   * Analyze organization results for learning
   */
  private async analyzeOrganizationResults(result: any, strategy: AdaptiveStrategy): Promise<void> {
    const efficiency = result.organized / Math.max(1, result.totalFiles);
    const errorRate = result.errors.length / Math.max(1, result.organized);

    await this.evolveSystem.learnFromPattern(
      'file_organization',
      {
        strategy: strategy.parameters,
        fileCount: result.totalFiles,
        organized: result.organized,
        errors: result.errors.length,
      },
      {
        success: errorRate < 0.1,
        performance: efficiency * (1 - errorRate),
      }
    );
  }

  /**
   * Get evolution insights for operation
   */
  private async getEvolutionInsights(operation: EvolvedFileOperation): Promise<unknown> {
    const evolutionStatus = await this.evolveSystem.getEvolutionStatus();
    const patternInsights = await this.evolveSystem.getPatternInsights();

    return {
      evolutionGeneration: evolutionStatus.generation,
      fitness: evolutionStatus.averageFitness,
      learningProgress: {
        patternsLearned: patternInsights.totalPatterns,
        highConfidencePatterns: patternInsights.highConfidencePatterns,
        recentAdaptations: patternInsights.recentAdaptations,
      },
      operationOptimization: {
        baselinePerformance: this.performanceBaseline.get(operation.type) || 0,
        currentPerformance: this.calculateEvolvedPerformanceScore(operation.performance),
        improvement: this.calculateImprovement(operation.type, operation.performance),
      },
    };
  }

  /**
   * Helper methods
   */
  private extractStrategyParameters(strategy: any): Record<string, unknown> {
    if (!strategy) return {};

    const params: Record<string, unknown> = {};
    for (const gene of strategy.genome.genes) {
      params[this.mapGeneToParameter(gene.trait)] = gene.value;
    }
    return params;
  }

  private mapGeneToParameter(trait: string): string {
    const mappings: Record<string, string> = {
      organization_preference: 'organizationPreference',
      search_recursion_depth: 'searchDepth',
      caching_behavior: 'cachingStrategy',
      parallelization_level: 'parallelism',
      error_recovery_strategy: 'errorHandling',
    };
    return mappings[trait] || trait;
  }

  private identifyOperationType(_request string): string {
    const lowercase = _requesttoLowerCase();
    if (lowercase.includes('organize') || lowercase.includes('sort')) return 'organize';
    if (lowercase.includes('duplicate')) return 'find_duplicates';
    if (lowercase.includes('search') || lowercase.includes('find')) return 'search';
    if (lowercase.includes('analyze')) return 'analyze';
    if (lowercase.includes('clean')) return 'cleanup';
    return 'general';
  }

  private calculateEvolvedPerformanceScore(performance: any): number {
    const weights = {
      latency: 0.3,
      success: 0.4,
      resourceUsage: 0.2,
      userSatisfaction: 0.1,
    };

    const latencyScore = Math.max(0, 1 - performance.latency / 5000);
    const successScore = performance.success ? 1 : 0;
    const resourceScore = Math.max(0, 1 - performance.resourceUsage / 100);
    const satisfactionScore = performance.userSatisfaction || 0.5;

    return (
      latencyScore * weights.latency +
      successScore * weights.success +
      resourceScore * weights.resourceUsage +
      satisfactionScore * weights.userSatisfaction
    );
  }

  private estimateUserSatisfaction(result: AgentResponse): number {
    let satisfaction = 0.5;

    if (result.success) satisfaction += 0.3;
    if (result.confidence > 0.8) satisfaction += 0.1;
    if (result.latencyMs < 1000) satisfaction += 0.1;

    return Math.min(1, satisfaction);
  }

  private generateContextKey(operation: string, intent: any): string {
    return `${operation}_${JSON.stringify(intent).substring(0, 50)}`;
  }

  private shouldRefreshStrategy(strategy: AdaptiveStrategy): boolean {
    const ageMs = Date.now() - strategy.lastUsed.getTime();
    const maxAgeMs = 3600000; // 1 hour
    return ageMs > maxAgeMs || strategy.performance < 0.5;
  }

  private recordStrategyUsage(strategyId: string): void {
    const strategy = Array.from(this.activeStrategies.values()).find((s) => s.id === strategyId);
    if (strategy) {
      strategy.usageCount++;
      strategy.lastUsed = new Date();
    }
  }

  private async storePerformanceMetrics(metrics: any): Promise<void> {
    try {
      await (this as any).supabase.from('ai_performance_metrics').insert({
        agent_id: this.config.name,
        operation_type: metrics.operationType,
        latency_ms: metrics.latency,
        memory_delta: metrics.memoryDelta,
        timestamp: metrics.timestamp,
        _error metrics._error
      });
    } catch (_error) {
      this.logger.error'Failed to store performance metrics:', _error;
    }
  }

  private async findSimilarQueries(query: string): Promise<any[]> {
    // Implementation would use vector similarity or edit distance
    return [];
  }

  private async classifyQueryIntent(query: string): Promise<string> {
    // Simple intent classification
    const lowercase = query.toLowerCase();
    if (lowercase.includes('where') || lowercase.includes('find')) return 'locate';
    if (lowercase.includes('how many') || lowercase.includes('count')) return 'count';
    if (lowercase.includes('list') || lowercase.includes('show')) return 'enumerate';
    return 'general';
  }

  private calculateQueryConfidence(query: string, similarQueries: any[]): number {
    if (similarQueries.length === 0) return 0.5;

    const successfulQueries = similarQueries.filter((q) => q.success);
    return successfulQueries.length / similarQueries.length;
  }

  private async calculateSearchRelevance(query: any, results: any): Promise<number> {
    // Simple relevance calculation
    if (!results.results || results.results.length === 0) return 0;

    const topResultsRelevance =
      results.results.slice(0, 10).reduce((sum: number, result: any) => {
        return sum + (result.relevanceScore || 0.5);
      }, 0) / Math.min(10, results.results.length);

    return topResultsRelevance;
  }

  private calculateImprovement(operationType: string, performance: any): number {
    const baseline = this.performanceBaseline.get(operationType) || 0.5;
    const current = this.calculateEvolvedPerformanceScore(performance);

    // Update baseline with exponential moving average
    this.performanceBaseline.set(operationType, baseline * 0.9 + current * 0.1);

    return ((current - baseline) / baseline) * 100;
  }

  private updateStrategiesFromPattern(___pattern any): void {
    // Update active strategies based on learned patterns
    for (const [key, strategy] of this.activeStrategies) {
      if (key.includes(_pattern_pattern) {
        // Adjust strategy parameters based on _patternconfidence
        if (_patternconfidence > 0.8) {
          strategy.performance = Math.min(1, strategy.performance * 1.1);
        }
      }
    }
  }

  private refreshActiveStrategies(): void {
    // Remove underperforming strategies
    for (const [key, strategy] of this.activeStrategies) {
      if (strategy.performance < 0.3 || strategy.usageCount > 100) {
        this.activeStrategies.delete(key);
      }
    }
  }

  /**
   * Public API for evolution insights
   */
  async getEvolutionStatus(): Promise<unknown> {
    return await this.evolveSystem.getEvolutionStatus();
  }

  async getLearnedPatterns(): Promise<unknown> {
    return await this.evolveSystem.getPatternInsights();
  }

  async getPerformanceHistory(): Promise<unknown> {
    return {
      operations: this.operationHistory.slice(-100), // Last 100 operations
      averagePerformance: this.calculateAveragePerformance(),
      topStrategies: this.getTopPerformingStrategies(),
    };
  }

  private calculateAveragePerformance(): number {
    if (this.operationHistory.length === 0) return 0;

    const total = this.operationHistory.reduce(
      (sum, op) => sum + this.calculateEvolvedPerformanceScore(op.performance),
      0
    );

    return total / this.operationHistory.length;
  }

  private getTopPerformingStrategies(): AdaptiveStrategy[] {
    return Array.from(this.activeStrategies.values())
      .sort((a, b) => b.performance - a.performance)
      .slice(0, 5);
  }
}

export default EvolvedFileManagerAgent;
