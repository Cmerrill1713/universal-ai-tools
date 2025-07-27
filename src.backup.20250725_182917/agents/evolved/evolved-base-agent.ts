/**;
 * Evolved Base Agent
 * Enhanced base agent with integrated Alpha Evolve capabilities
 * Allows any agent to evolve their strategies over time
 */

import { BaseAgent, AgentContext, AgentResponse, AgentConfig } from '../base_agent.js';
import { AlphaEvolveSystem } from '../../core/evolution/alpha-evolve-system.js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { EventEmitter } from 'events';

export interface EvolvedAgentConfig extends AgentConfig {
  evolutionEnabled?: boolean;
  evolutionConfig?: {
    populationSize?: number;
    mutationRate?: number;
    crossoverRate?: number;
    adaptationThreshold?: number;
    learningRate?: number;
  };
}

export interface EvolutionMetrics {
  tasksProcessed: number;
  averagePerformance: number;
  evolutionCycles: number;
  lastEvolved: Date;
  topStrategies: any[];
  learningProgress: number;
}

export interface OperationPerformance {
  latency: number;
  success: boolean;
  confidence: number;
  resourceUsage: number;
  userSatisfaction: number;
}

export abstract class EvolvedBaseAgent extends BaseAgent {
  protected evolveSystem?: AlphaEvolveSystem;
  protected evolutionMetrics: EvolutionMetrics;
  protected performanceHistory: Map<string, number[]> = new Map();
  protected strategyCache: Map<string, any> = new Map();
  protected supabase?: SupabaseClient;
  private evolutionEnabled: boolean;

  constructor(config: EvolvedAgentConfig, supabase?: SupabaseClient) {
    super(config);
    this.supabase = supabase;
    this.evolutionEnabled = config.evolutionEnabled !== false;
    this.evolutionMetrics = {
      tasksProcessed: 0,
      averagePerformance: 0.5,
      evolutionCycles: 0,
      lastEvolved: new Date(),
      topStrategies: [],
      learningProgress: 0,
    };

    if (this.evolutionEnabled && supabase) {
      this.initializeEvolution(config.evolutionConfig);
    }
  }

  /**;
   * Initialize Alpha Evolve system for this agent
   */
  private initializeEvolution(evolutionConfig?: any): void {
    if (!this.supabase) return;

    this.evolveSystem = new AlphaEvolveSystem(this.supabase, {
      populationSize: evolutionConfig?.populationSize || 20,
      mutationRate: evolutionConfig?.mutationRate || 0.15,
      crossoverRate: evolutionConfig?.crossoverRate || 0.75,
      adaptationThreshold: evolutionConfig?.adaptationThreshold || 0.65,
      learningRate: evolutionConfig?.learningRate || 0.02,
    });

    this.setupEvolutionListeners();
    this.logger.info(`Evolution enabled for agent: ${this.config.name}`);
  }

  /**;
   * Setup listeners for evolution events
   */
  private setupEvolutionListeners(): void {
    if (!this.evolveSystem) return;

    this.evolveSystem.on('pattern_learned', ({ pattern, outcome }) => {
      this.logger.info(;)
        `[${this.config.name}] Learned pattern: ${pattern.pattern} (confidence: ${pattern.confidence})`;
      );
      this.updateStrategyFromPattern(pattern);
    });

    this.evolveSystem.on('adaptation_applied', ({ adaptation }) => {
      this.logger.info(;
        `[${this.config.name}] Applied adaptation: ${adaptation.type} (+${adaptation.improvement}%)`;
      );
      this.refreshStrategies();
    });

    this.evolveSystem.on('evolution_completed', (metrics) => {
      this.evolutionMetrics.evolutionCycles++;
      this.evolutionMetrics.lastEvolved = new Date();
      this.logger.info(;
        `[${this.config.name}] Evolution cycle completed. Fitness: ${metrics.fitnessScore}`;
      );
    });
  }

  /**;
   * Enhanced execute method with evolution tracking
   */
  async execute(context: AgentContext): Promise<AgentResponse> {
    const startTime = Date.now();
    const initialMemory = process.memoryUsage().heapUsed;

    try {
      // Get evolved strategy if available
      let evolvedContext = context;
      if (this.evolutionEnabled && this.evolveSystem) {
        const strategy = await this.selectOptimalStrategy(context);
        evolvedContext = this.applyStrategyToContext(context, strategy);
      }

      // Execute base implementation
      const response = await super.execute(evolvedContext);

      // Track and learn from execution
      if (this.evolutionEnabled && this.evolveSystem) {
        const performance = this.calculatePerformance(response, Date.now() - startTime, initialMemory);
        await this.learnFromExecution(context, response, performance);
      }

      return response;
    } catch (error) {
      // Learn from failures too
      if (this.evolutionEnabled && this.evolveSystem) {
        await this.learnFromFailure(context, error);
      }
      throw error;
    }
  }

  /**;
   * Select optimal strategy based on context
   */
  protected async selectOptimalStrategy(context: AgentContext): Promise<any> {
    if (!this.evolveSystem) return null;

    const contextKey = this.generateContextKey(context);
    
    // Check cache first
    if (this.strategyCache.has(contextKey)) {
      const cached = this.strategyCache.get(contextKey);
      if (this.isStrategyValid(cached)) {
        return cached;
      }
    }

    // Get best evolved strategy
    const bestStrategy = await this.evolveSystem.getBestStrategy();
    if (!bestStrategy) return null;

    // Adapt strategy to context
    const adaptedStrategy = await this.adaptStrategyToContext(bestStrategy, context);
    
    // Cache the strategy
    this.strategyCache.set(contextKey, {
      strategy: adaptedStrategy,
      timestamp: Date.now(),
      uses: 0,
    });

    return adaptedStrategy;
  }

  /**;
   * Apply strategy parameters to context
   */
  protected applyStrategyToContext(context: AgentContext, strategy: any): AgentContext {
    if (!strategy?.strategy) return context;

    const parameters = this.extractStrategyParameters(strategy.strategy);
    
    return {
      ...context,
      metadata: {
        ...context.metadata,
        strategyParams: parameters,
        evolutionGeneration: strategy.strategy.generation || 0,
      },
    };
  }

  /**;
   * Calculate execution performance
   */
  protected calculatePerformance(;
    response: AgentResponse,
    latency: number,
    memoryUsed: number;
  ): OperationPerformance {
    const currentMemory = process.memoryUsage().heapUsed;
    const memoryDelta = (currentMemory - memoryUsed) / (1024 * 1024); // MB

    return {
      latency,
      success: response.success,
      confidence: response.confidence,
      resourceUsage: memoryDelta,
      userSatisfaction: this.estimateUserSatisfaction(response),
    };
  }

  /**;
   * Learn from successful execution
   */
  protected async learnFromExecution(;
    context: AgentContext,
    response: AgentResponse,
    performance: OperationPerformance;
  ): Promise<void> {
    if (!this.evolveSystem) return;

    const operationType = this.identifyOperationType(context);
    const performanceScore = this.calculatePerformanceScore(performance);

    // Record in history
    if (!this.performanceHistory.has(operationType)) {
      this.performanceHistory.set(operationType, []);
    }
    this.performanceHistory.get(operationType)!.push(performanceScore);

    // Learn pattern
    await this.evolveSystem.learnFromPattern(;
      operationType,
      {
        context: this.sanitizeContext(context),
        response: this.sanitizeResponse(response),
        performance,
      },
      {
        success: performance.success,
        performance: performanceScore,
      }
    );

    // Update metrics
    this.updateEvolutionMetrics(performanceScore);
  }

  /**;
   * Learn from failures
   */
  protected async learnFromFailure(context: AgentContext, error: any): Promise<void> {
    if (!this.evolveSystem) return;

    await this.evolveSystem.learnFromPattern(;
      'error_recovery',
      {
        context: this.sanitizeContext(context),
        error: error instanceof Error ? error.message : String(error),
        errorType: error?.constructor?.name || 'UnknownError',
      },
      {
        success: false,
        performance: 0,
      }
    );
  }

  /**;
   * Update evolution metrics
   */
  protected updateEvolutionMetrics(performanceScore: number): void {
    this.evolutionMetrics.tasksProcessed++;
    
    // Exponential moving average
    const alpha = 0.1;
    this.evolutionMetrics.averagePerformance = ;
      alpha * performanceScore + (1 - alpha) * this.evolutionMetrics.averagePerformance;
    
    // Calculate learning progress
    this.evolutionMetrics.learningProgress = this.calculateLearningProgress();
  }

  /**;
   * Calculate overall learning progress
   */
  protected calculateLearningProgress(): number {
    const historySize = Array.from(this.performanceHistory.values())
      .reduce((sum, history) => sum + history.length, 0);
    
    if (historySize < 10) return 0; // Not enough data
    
    // Compare recent performance to early performance
    let recentAvg = 0;
    let earlyAvg = 0;
    let recentCount = 0;
    let earlyCount = 0;
    
    for (const history of this.performanceHistory.values()) {
      if (history.length >= 2) {
        const early = history.slice(0, Math.floor(history.length / 2));
        const recent = history.slice(Math.floor(history.length / 2));
        
        earlyAvg += early.reduce((a, b) => a + b, 0);
        earlyCount += early.length;
        recentAvg += recent.reduce((a, b) => a + b, 0);
        recentCount += recent.length;
      }
    }
    
    if (earlyCount === 0 || recentCount === 0) return 0;
    
    earlyAvg /= earlyCount;
    recentAvg /= recentCount;
    
    // Calculate improvement percentage
    return Math.max(0, Math.min(1, (recentAvg - earlyAvg) / Math.max(0.1, earlyAvg)));
  }

  /**;
   * Helper methods
   */
  protected extractStrategyParameters(strategy: any): Record<string, any> {
    const params: Record<string, any> = {};
    
    if (strategy?.genome?.genes) {
      for (const gene of strategy.genome.genes) {
        params[this.normalizeGeneTrait(gene.trait)] = gene.value;
      }
    }
    
    return params;
  }

  protected normalizeGeneTrait(trait: string): string {
    return trait.replace(/_/g, '').replace(/([A-Z])/g, (match) => match.toLowerCase());
  }

  protected generateContextKey(context: AgentContext): string {
    const request = context.userRequest.toLowerCase().substring(0, 50);
    const hasMemory = !!context.memoryContext;
    return `${this.config.name}_${request}_${hasMemory}`;
  }

  protected isStrategyValid(cached: any): boolean {
    const maxAge = 3600000; // 1 hour
    return Date.now() - cached.timestamp < maxAge && cached.uses < 100;
  }

  protected async adaptStrategyToContext(strategy: any, context: AgentContext): Promise<any> {
    // Base implementation - can be overridden by specific agents
    return strategy;
  }

  protected identifyOperationType(context: AgentContext): string {
    // Base implementation - should be overridden by specific agents
    return 'general_operation';
  }

  protected sanitizeContext(context: AgentContext): any {
    // Remove sensitive data before storing
    const { userId, sessionId, ...safeContext } = context;
    return safeContext;
  }

  protected sanitizeResponse(response: AgentResponse): any {
    // Remove sensitive data before storing
    const { data, ...safeResponse } = response;
    return {
      ...safeResponse,
      dataSize: JSON.stringify(data).length,
    };
  }

  protected calculatePerformanceScore(performance: OperationPerformance): number {
    const weights = {
      latency: 0.25,
      success: 0.35,
      confidence: 0.2,
      resourceUsage: 0.1,
      userSatisfaction: 0.1,
    };

    const latencyScore = Math.max(0, 1 - performance.latency / this.config.maxLatencyMs);
    const successScore = performance.success ? 1 : 0;
    const resourceScore = Math.max(0, 1 - performance.resourceUsage / 100); // Under 100MB is good

    return (;
      latencyScore * weights.latency +;
      successScore * weights.success +;
      performance.confidence * weights.confidence +;
      resourceScore * weights.resourceUsage +;
      performance.userSatisfaction * weights.userSatisfaction;
    );
  }

  protected estimateUserSatisfaction(response: AgentResponse): number {
    let satisfaction = 0.5; // Base satisfaction
    
    if (response.success) satisfaction += 0.3;
    if (response.confidence > 0.8) satisfaction += 0.1;
    if (response.latencyMs < this.config.maxLatencyMs * 0.5) satisfaction += 0.1;
    
    return Math.min(1, satisfaction);
  }

  protected updateStrategyFromPattern(pattern: any): void {
    // Invalidate cached strategies that might be affected
    for (const [key, cached] of this.strategyCache.entries()) {
      if (key.includes(pattern.pattern)) {
        this.strategyCache.delete(key);
      }
    }
  }

  protected refreshStrategies(): void {
    // Clear old strategies
    const maxAge = 3600000; // 1 hour
    const now = Date.now();
    
    for (const [key, cached] of this.strategyCache.entries()) {
      if (now - cached.timestamp > maxAge) {
        this.strategyCache.delete(key);
      }
    }
  }

  /**;
   * Public evolution API
   */
  async getEvolutionStatus(): Promise<any> {
    if (!this.evolveSystem) {
      return { enabled: false };
    }

    const status = await this.evolveSystem.getEvolutionStatus();
    const patterns = await this.evolveSystem.getPatternInsights();

    return {
      enabled: true,
      metrics: this.evolutionMetrics,
      evolutionStatus: status,
      patterns,
      performanceHistory: this.getPerformanceSummary(),
    };
  }

  protected getPerformanceSummary(): any {
    const summary: any = {};
    
    for (const [operation, history] of this.performanceHistory.entries()) {
      if (history.length > 0) {
        summary[operation] = {
          count: history.length,
          average: history.reduce((a, b) => a + b, 0) / history.length,
          recent: history.slice(-10),
          trend: this.calculateTrend(history),
        };
      }
    }
    
    return summary;
  }

  protected calculateTrend(history: number[]): string {
    if (history.length < 3) return 'insufficient_data';
    
    const recent = history.slice(-10);
    const older = history.slice(-20, -10);
    
    if (older.length === 0) return 'improving';
    
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
    
    if (recentAvg > olderAvg * 1.1) return 'improving';
    if (recentAvg < olderAvg * 0.9) return 'declining';
    return 'stable';
  }

  /**;
   * Enable/disable evolution at runtime
   */
  setEvolutionEnabled(enabled: boolean): void {
    this.evolutionEnabled = enabled;
    if (!enabled && this.evolveSystem) {
      this.logger.info(`Evolution disabled for agent: ${this.config.name}`);
    }
  }

  /**;
   * Force evolution cycle
   */
  async triggerEvolution(): Promise<void> {
    if (!this.evolveSystem) {
      throw new Error('Evolution not enabled for this agent');
    }

    await this.evolveSystem.forceEvolutionCycle();
    this.evolutionMetrics.evolutionCycles++;
    this.evolutionMetrics.lastEvolved = new Date();
  }
}

export default EvolvedBaseAgent;