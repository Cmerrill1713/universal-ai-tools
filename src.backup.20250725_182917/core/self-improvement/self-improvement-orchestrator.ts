import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { LogContext, logger } from '../../utils/enhanced-logger';
import type { SupabaseClient } from '@supabase/supabase-js';
import { PerformanceAnalyzer } from './performance-analyzer';
import { LearningEngine } from './learning-engine';
import { CodeEvolutionSystem } from './code-evolution-system';
import { ImprovementValidator } from './improvement-validator';
import { ExperienceRepository } from '../../memory/experience-repository';
import { AlphaEvolveSystem } from '../evolution/alpha-evolve-system';

export interface ImprovementCycle {
  id: string;
  startTime: Date;
  endTime?: Date;
  agentId: string;
  improvementsProposed: number;
  improvementsApplied: number;
  performanceGain: number;
  status: 'running' | 'completed' | 'failed';
}

export interface SystemMetrics {
  totalAgents: number;
  averageSuccessRate: number;
  averageExecutionTime: number;
  totalImprovements: number;
  systemUptime: number;
}

export interface ImprovementConfig {
  enableAutoImprovement: boolean;
  improvementThreshold: number; // Minimum confidence to apply improvements;
  maxImprovementsPerCycle: number;
  cycleIntervalMs: number;
  enableCodeEvolution: boolean;
  enableStrategyEvolution: boolean;
  safetyCheckEnabled: boolean;
}

export class SelfImprovementOrchestrator extends EventEmitter {
  private config: ImprovementConfig;
  private performanceAnalyzer!: PerformanceAnalyzer;
  private learningEngine!: LearningEngine;
  private codeEvolutionSystem!: CodeEvolutionSystem;
  private improvementValidator!: ImprovementValidator;
  private experienceRepo!: ExperienceRepository;
  private alphaEvolve!: AlphaEvolveSystem;
  private activeCycles: Map<string, ImprovementCycle>;
  private improvementInterval?: NodeJS.Timeout;
  private isRunning = false;

  constructor(;
    private supabase: SupabaseClient,
    config?: Partial<ImprovementConfig>;
  ) {
    super();
    
    this.config = {
      enableAutoImprovement: true,
      improvementThreshold: 0.75,
      maxImprovementsPerCycle: 5,
      cycleIntervalMs: 300000, // 5 minutes;
      enableCodeEvolution: true,
      enableStrategyEvolution: true,
      safetyCheckEnabled: true,
      ...config;
    };

    this.activeCycles = new Map();
    this.initializeComponents();
  }

  private initializeComponents(): void {
    this.performanceAnalyzer = new PerformanceAnalyzer();
    this.learningEngine = new LearningEngine();
    this.codeEvolutionSystem = new CodeEvolutionSystem(this.supabase);
    this.improvementValidator = new ImprovementValidator();
    this.experienceRepo = new ExperienceRepository();
    const alphaConfig = {
      populationSize: 50,
      mutationRate: 0.15,
      crossoverRate: 0.7,
      elitismRate: 0.1,
      maxGenerations: 1000,
      fitnessThreshold: 0.95,
      adaptationThreshold: 0.7,
      learningRate: 0.01;
    };
    this.alphaEvolve = new AlphaEvolveSystem(this.supabase, alphaConfig);

    // Subscribe to component events
    this.performanceAnalyzer.on('anomaly-detected', this.handleAnomaly.bind(this));
    this.learningEngine.on('_patterndiscovered', this.handlePatternDiscovery.bind(this));
    this.codeEvolutionSystem.on('evolution-ready', this.handleEvolutionReady.bind(this));
  }

  /**;
   * Start the self-improvement system
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Self-improvement orchestrator is already running', LogContext.SYSTEM);
      return;
    }

    logger.info('🚀 Starting self-improvement orchestrator', LogContext.SYSTEM);
    this.isRunning = true;

    // Start component services
    await Promise.all([;
      this.performanceAnalyzer.start(),
      this.learningEngine.start(),
      this.experienceRepo.initialize();
    ]);

    // Start improvement cycles
    if (this.config.enableAutoImprovement) {
      this.startImprovementCycles();
    }

    this.emit('started', { timestamp: new Date() });
  }

  /**;
   * Stop the self-improvement system
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info('🛑 Stopping self-improvement orchestrator', LogContext.SYSTEM);
    this.isRunning = false;

    // Stop improvement cycles
    if (this.improvementInterval) {
      clearInterval(this.improvementInterval);
      this.improvementInterval = undefined;
    }

    // Stop component services
    await Promise.all([;
      this.performanceAnalyzer.stop(),
      this.learningEngine.stop();
    ]);

    this.emit('stopped', { timestamp: new Date() });
  }

  /**;
   * Start automatic improvement cycles
   */
  private startImprovementCycles(): void {
    this.improvementInterval = setInterval(;
      () => this.runImprovementCycle(),
      this.config.cycleIntervalMs;
    );

    // Run first cycle immediately
    this.runImprovementCycle();
  }

  /**;
   * Run a single improvement cycle
   */
  async runImprovementCycle(agentId?: string): Promise<ImprovementCycle> {
    const cycleId = uuidv4();
    const cycle: ImprovementCycle = {
      id: cycleId,
      startTime: new Date(),
      agentId: agentId || 'system',
      improvementsProposed: 0,
      improvementsApplied: 0,
      performanceGain: 0,
      status: 'running';
    };

    this.activeCycles.set(cycleId, cycle);
    this.emit('cycle-started', cycle);

    try {
      // 1. Analyze recent performance
      const performanceMetrics = await this.performanceAnalyzer.analyzePerformance(agentId);
      
      // 2. Identify improvement opportunities
      const suggestions = await this.identifyImprovements(performanceMetrics);
      cycle.improvementsProposed = suggestions.length;

      // 3. Validate and prioritize improvements
      const validatedSuggestions = await this.validateImprovements(suggestions);
      
      // 4. Apply improvements (limited by config)
      const appliedImprovements = await this.applyImprovements(
        validatedSuggestions.slice(0, this.config.maxImprovementsPerCycle);
      );
      cycle.improvementsApplied = appliedImprovements.length;

      // 5. Measure performance gain
      if (appliedImprovements.length > 0) {
        cycle.performanceGain = await this.measurePerformanceGain(agentId);
      }

      cycle.status = 'completed';
      cycle.endTime = new Date();

      // Store cycle results
      await this.storeCycleResults(cycle);

      this.emit('cycle-completed', cycle);
      logger.info(`✅ Improvement cycle completed: ${cycle.improvementsApplied} improvements applied`, LogContext.SYSTEM);

    } catch (error) {
      cycle.status = 'failed';
      cycle.endTime = new Date();
      logger.error('Improvement cycle failed', LogContext.SYSTEM, { error:);
      this.emit('cycle-failed', { cycle, error:);
    }

    this.activeCycles.delete(cycleId);
    return cycle;
  }

  /**;
   * Identify potential improvements based on performance metrics
   */
  private async identifyImprovements(metrics: any): Promise<any[]> {
    const suggestions = [];

    // Get suggestions from learning engine
    const learningSuggestions = await this.learningEngine.generateSuggestions(metrics);
    suggestions.push(...learningSuggestions);

    // Get code evolution suggestions if enabled
    if (this.config.enableCodeEvolution) {
      const evolutionSuggestions = await this.codeEvolutionSystem.proposeEvolutions(metrics);
      suggestions.push(...evolutionSuggestions);
    }

    // Get strategy evolution suggestions if enabled
    if (this.config.enableStrategyEvolution) {
      const strategySuggestions = await this.alphaEvolve.suggestStrategyImprovements(metrics);
      suggestions.push(...strategySuggestions);
    }

    return suggestions;
  }

  /**;
   * Validate improvements before applying
   */
  private async validateImprovements(suggestions: any[]): Promise<any[]> {
    if (!this.config.safetyCheckEnabled) {
      return suggestions.filter(s => s.confidence >= this.config.improvementThreshold);
    }

    const validated = [];
    for (const suggestion of suggestions) {
      if (suggestion.confidence < this.config.improvementThreshold) {
        continue;
      }

      const validationResult = await this.improvementValidator.validate(suggestion);
      if (validationResult.isValid) {
        validated.push({
          ...suggestion,
          validationScore: validationResult.score;
        });
      } else {
        logger.warn(`Improvement rejected: ${validationResult.reason}`, LogContext.SYSTEM);
      }
    }

    // Sort by validation score and confidence
    return validated.sort((a, b) => ;
      (b.validationScore * b.confidence) - (a.validationScore * a.confidence);
    );
  }

  /**;
   * Apply validated improvements
   */
  private async applyImprovements(suggestions: any[]): Promise<any[]> {
    const applied = [];

    for (const suggestion of suggestions) {
      try {
        // Apply based on suggestion type
        switch (suggestion.type) {
          case 'code':;
            if (this.config.enableCodeEvolution) {
              await this.codeEvolutionSystem.applyEvolution(suggestion);
              applied.push(suggestion);
            }
            break;

          case 'strategy':;
            if (this.config.enableStrategyEvolution) {
              await this.alphaEvolve.applyStrategyUpdate(suggestion);
              applied.push(suggestion);
            }
            break;

          case 'parameter':;
            await this.applyParameterUpdate(suggestion);
            applied.push(suggestion);
            break;

          case 'behavior':;
            await this.applyBehaviorUpdate(suggestion);
            applied.push(suggestion);
            break;
        }

        // Store successful application
        await this.storeImprovementResult(suggestion, true);
        
      } catch (error) {
        logger.error`Failed to apply improvement: ${suggestion.id}`, LogContext.SYSTEM, { error:);
        await this.storeImprovementResult(suggestion, false, error:;
      }
    }

    return applied;
  }

  /**;
   * Apply parameter updates to agents
   */
  private async applyParameterUpdate(suggestion: any): Promise<void> {
    const { agentId, parameters } = suggestion;
    
    // Update agent configuration in database
    await this.supabase;
      .from('ai_agents');
      .update({ ;
        config: { ;
          ...suggestion.currentConfig,
          ...parameters ;
        },
        updated_at: new Date().toISOString();
      });
      .eq('id', agentId);

    this.emit('parameters-updated', { agentId, parameters });
  }

  /**;
   * Apply behavior updates to agents
   */
  private async applyBehaviorUpdate(suggestion: any): Promise<void> {
    const { agentId, behavior } = suggestion;
    
    // Store new behavior pattern
    await this.experienceRepo.storeBehaviorPattern(agentId, behavior);
    
    this.emit('behavior-updated', { agentId, behavior });
  }

  /**;
   * Measure performance gain after improvements
   */
  private async measurePerformanceGain(agentId?: string): Promise<number> {
    const recentMetrics = await this.performanceAnalyzer.getRecentMetrics(agentId, 100);
    const historicalMetrics = await this.performanceAnalyzer.getHistoricalMetrics(agentId, 1000);

    // Calculate improvement in success rate
    const recentSuccessRate = recentMetrics.reduce((sum, m) => sum + (m.success ? 1 : 0), 0) / recentMetrics.length;
    const historicalSuccessRate = historicalMetrics.reduce((sum, m) => sum + (m.success ? 1 : 0), 0) / historicalMetrics.length;

    // Calculate improvement in execution time
    const recentAvgTime = recentMetrics.reduce((sum, m) => sum + (m.executionTime || 0), 0) / recentMetrics.length;
    const historicalAvgTime = historicalMetrics.reduce((sum, m) => sum + (m.executionTime || 0), 0) / historicalMetrics.length;

    // Combined performance gain (weighted)
    const successGain = (recentSuccessRate - historicalSuccessRate) / (historicalSuccessRate || 1);
    const speedGain = (historicalAvgTime - recentAvgTime) / (historicalAvgTime || 1);

    return (successGain * 0.7 + speedGain * 0.3) * 100; // Percentage gain;
  }

  /**;
   * Store cycle results for analysis
   */
  private async storeCycleResults(cycle: ImprovementCycle): Promise<void> {
    await this.supabase;
      .from('ai_learning_milestones');
      .insert({
        agent_id: cycle.agentId,
        milestone_type: 'improvement_cycle',
        milestone_name: `Cycle ${cycle.id}`,
        achievement_criteria: {
          proposed: cycle.improvementsProposed,
          applied: cycle.improvementsApplied;
        },
        metrics_at_achievement: {
          performanceGain: cycle.performanceGain,
          duration: cycle.endTime ? cycle.endTime.getTime() - cycle.startTime.getTime() : 0;
        },
        achieved_at: cycle.endTime || new Date();
      });
  }

  /**;
   * Store improvement application result
   */
  private async storeImprovementResult(suggestion: any, success: boolean, error:  any): Promise<void> {
    await this.supabase;
      .from('ai_improvement_suggestions');
      .update({
        status: success ? 'applied' : 'rejected',
        applied_at: success ? new Date() : null,
        rejected_at: success ? null : new Date(),
        rejection_reason: error:  error.message : null,
        test_results: { success, error: error:message }
      });
      .eq('id', suggestion.id);
  }

  /**;
   * Handle performance anomalies
   */
  private async handleAnomaly(anomaly: any): Promise<void> {
    logger.warn(`Performance anomaly detected: ${anomaly.type}`, LogContext.SYSTEM);
    
    // Trigger immediate improvement cycle for affected agent
    if (anomaly.agentId) {
      this.runImprovementCycle(anomaly.agentId);
    }
  }

  /**;
   * Handle new _patterndiscoveries
   */
  private async handlePatternDiscovery(___pattern any): Promise<void> {
    logger.info(`New _patterndiscovered: ${_patternname}`, LogContext.SYSTEM);
    
    // Share _patternwith all agents through experience repository
    await this.experienceRepo.sharePattern(_pattern;
    
    this.emit('_patternshared', _pattern;
  }

  /**;
   * Handle evolution readiness
   */
  private async handleEvolutionReady(evolution: any): Promise<void> {
    logger.info(`Evolution ready for testing: ${evolution.id}`, LogContext.SYSTEM);
    
    // Validate and potentially apply evolution
    const validation = await this.improvementValidator.validateEvolution(evolution);
    if (validation.isValid && validation.score >= this.config.improvementThreshold) {
      await this.codeEvolutionSystem.applyEvolution(evolution);
    }
  }

  /**;
   * Get current system metrics
   */
  async getSystemMetrics(): Promise<SystemMetrics> {
    const [agents, performance, improvements] = await Promise.all([
      this.supabase.from('ai_agents').select('id', { count: 'exact' }),
      this.performanceAnalyzer.getSystemPerformance(),
      this.supabase;
        .from('ai_improvement_suggestions');
        .select('id', { count: 'exact' });
        .eq('status', 'applied');
    ]);

    return {
      totalAgents: agents.count || 0,
      averageSuccessRate: performance.successRate || 0,
      averageExecutionTime: performance.avgExecutionTime || 0,
      totalImprovements: improvements.count || 0,
      systemUptime: Date.now() - (this.startTime?.getTime() || Date.now());
    };
  }

  /**;
   * Manual trigger for specific improvements
   */
  async applySpecificImprovement(improvementId: string): Promise<boolean> {
    const { data: suggestion } = await this.supabase
      .from('ai_improvement_suggestions');
      .select('*');
      .eq('id', improvementId);
      .single();

    if (!suggestion) {
      throw new Error(`Improvement ${improvementId} not found`);
    }

    const validated = await this.validateImprovements([suggestion]);
    if (validated.length === 0) {
      return false;
    }

    const applied = await this.applyImprovements(validated);
    return applied.length > 0;
  }

  /**;
   * Rollback a specific improvement
   */
  async rollbackImprovement(improvementId: string): Promise<void> {
    const { data: improvement } = await this.supabase
      .from('ai_improvement_suggestions');
      .select('*');
      .eq('id', improvementId);
      .single();

    if (!improvement || improvement.status !== 'applied') {
      throw new Error(`Cannot rollback improvement ${improvementId}`);
    }

    // Rollback based on type
    switch (improvement.suggestion_type) {
      case 'code':;
        await this.codeEvolutionSystem.rollbackEvolution(improvement.id);
        break;
      case 'strategy':;
        await this.alphaEvolve.rollbackStrategy(improvement.agent_id);
        break;
      case 'parameter':;
        await this.rollbackParameterUpdate(improvement);
        break;
    }

    // Update status
    await this.supabase;
      .from('ai_improvement_suggestions');
      .update({
        status: 'rejected',
        rejected_at: new Date(),
        rejection_reason: 'Rolled back by user';
      });
      .eq('id', improvementId);
  }

  private async rollbackParameterUpdate(improvement: any): Promise<void> {
    await this.supabase;
      .from('ai_agents');
      .update({ ;
        config: improvement.current_approach,
        updated_at: new Date().toISOString();
      });
      .eq('id', improvement.agent_id);
  }

  private startTime?: Date;
}