/**
 * ML-Based Parameter Optimizer
 * Uses machine learning to optimize LLM parameters based on historical performance data
 * Implements reinforcement learning with Thompson Sampling and Bayesian optimization
 */

import { LogContext, log  } from '../utils/logger';';
import { createClient  } from '@supabase/supabase-js';';
import { config  } from '../config/environment';';
import type { TaskContext, TaskParameters, UserPreferences } from './intelligent-parameter-service';';
import { TaskType  } from './intelligent-parameter-service';';
import type { OptimizationInsight } from './parameter-analytics-service';';
import { ParameterEffectiveness, parameterAnalyticsService  } from './parameter-analytics-service';';
import { BayesianModel  } from '../utils/bayesian-model';';
import { BetaSampler, NormalGammaSampler, ThompsonSelector  } from '../utils/thompson-sampling';';

export interface OptimizationExperiment {
  id: string;,
  taskType: TaskType;
  parameterSpace: ParameterSpace;,
  trials: OptimizationTrial[];
  bestParameters: TaskParameters;,
  convergenceStatus: 'exploring' | 'converging' | 'converged';'
  startTime: Date;,
  lastUpdate: Date;
}

export interface OptimizationTrial {
  id: string;,
  parameters: TaskParameters;
  score: number;,
  executionTime: number;
  timestamp: Date;,
  contextMetadata: Record<string, any>;
}

export interface ParameterSpace {
  temperature: {, min: number; max: number;, type: 'continuous' };'
  maxTokens: {, min: number; max: number;, type: 'discrete' };'
  topP: {, min: number; max: number;, type: 'continuous' };'
  frequencyPenalty: {, min: number; max: number;, type: 'continuous' };'
  presencePenalty: {, min: number; max: number;, type: 'continuous' };'
}

export interface ModelPerformancePrediction {
  taskType: TaskType;,
  predictedParameters: TaskParameters;
  confidenceScore: number;,
  expectedPerformance: number;
  uncertaintyBounds: {,
    lower: number;
    upper: number;
  };
  recommendationStrength: 'weak' | 'moderate' | 'strong';'
}

export interface OptimizationStrategy {
  name: string;,
  description: string;
  suitableFor: TaskType[];,
  hyperparameters: Record<string, number>;
}

export class MLParameterOptimizer {
  private supabase: unknown;
  private experiments: Map<string, OptimizationExperiment> = new Map();
  private bayesianModels: Map<string, BayesianModel> = new Map();
  private thompsonSelector: ThompsonSelector;
  private parameterSpaces: Map<TaskType, ParameterSpace> = new Map();
  private optimizationStrategies: OptimizationStrategy[] = [];
  private learningRate = 0.01;
  private explorationRate = 0.1;
  private convergenceThreshold = 0.05;

  constructor() {
    // Initialize Thompson Selector first
    this.thompsonSelector = new ThompsonSelector();

    this.initializeSupabase();
    this.initializeOptimizers();
    this.setupParameterSpaces();
    this.defineOptimizationStrategies();
    this.startPeriodicOptimization();
  }

  private initializeSupabase(): void {
    try {
      if (!config.supabase.url || !config.supabase.serviceKey) {
        throw new Error('Supabase configuration missing for ML Parameter Optimizer');';
      }

      this.supabase = createClient(config.supabase.url, config.supabase.serviceKey);

      log.info('✅ ML Parameter Optimizer initialized with Supabase', LogContext.AI);'
    } catch (error) {
      log.error('❌ Failed to initialize ML Parameter Optimizer', LogContext.AI, {')
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private initializeOptimizers(): void {
    this.thompsonSelector = new ThompsonSelector();

    log.info('🧠 Initialized ML optimizers (Bayesian + Thompson Sampling)', LogContext.AI);'
  }

  private setupParameterSpaces(): void {
    // Define parameter spaces for different task types
    const defaultSpace: ParameterSpace = {,;
      temperature: { min: 0.1, max: 1.0, type: 'continuous' },'
      maxTokens: {, min: 50, max: 4000, type: 'discrete' },'
      topP: {, min: 0.1, max: 1.0, type: 'continuous' },'
      frequencyPenalty: {, min: 0.0, max: 2.0, type: 'continuous' },'
      presencePenalty: {, min: 0.0, max: 2.0, type: 'continuous' },'
    };

    // Creative tasks need higher temperature and token limits
    this.parameterSpaces.set(TaskType.CREATIVE_WRITING, {)
      ...defaultSpace,
      temperature: {, min: 0.7, max: 1.2, type: 'continuous' },'
      maxTokens: {, min: 500, max: 8000, type: 'discrete' },'
    });

    // Code tasks need lower temperature and structured output
    this.parameterSpaces.set(TaskType.CODE_GENERATION, {)
      ...defaultSpace,
      temperature: {, min: 0.1, max: 0.5, type: 'continuous' },'
      maxTokens: {, min: 100, max: 2000, type: 'discrete' },'
    });

    // Analysis tasks need balanced parameters
    this.parameterSpaces.set(TaskType.DATA_ANALYSIS, {)
      ...defaultSpace,
      temperature: {, min: 0.2, max: 0.8, type: 'continuous' },'
      maxTokens: {, min: 200, max: 3000, type: 'discrete' },'
    });

    // Set default for all other task types
    Object.values(TaskType).forEach((taskType) => {
      if (!this.parameterSpaces.has(taskType)) {
        this.parameterSpaces.set(taskType, defaultSpace);
      }
    });
  }

  private defineOptimizationStrategies(): void {
    this.optimizationStrategies = [
      {
        name: 'exploration_heavy','
        description: 'High exploration for new task types with limited data','
        suitableFor: [TaskType.RESEARCH, TaskType.BRAINSTORMING, TaskType.CREATIVE_WRITING],
        hyperparameters: {, exploration_rate: 0.3, learning_rate: 0.02 },
      },
      {
        name: 'exploitation_focused','
        description: 'Focus on known good parameters for production tasks','
        suitableFor: [TaskType.CODE_GENERATION, TaskType.CODE_REVIEW, TaskType.CODE_EXPLANATION],
        hyperparameters: {, exploration_rate: 0.05, learning_rate: 0.005 },
      },
      {
        name: 'balanced_learning','
        description: 'Balanced exploration-exploitation for general tasks','
        suitableFor: [TaskType.FACTUAL_QA, TaskType.SUMMARIZATION, TaskType.DATA_ANALYSIS],
        hyperparameters: {, exploration_rate: 0.1, learning_rate: 0.01 },
      }];
  }

  /**
   * Get optimized parameters using ML predictions
   */
  public async getOptimizedParameters()
    taskType: TaskType,
    context: TaskContext,
    userPreferences?: UserPreferences
  ): Promise<ModelPerformancePrediction> {
    try {
      const startTime = Date.now();

      // Get historical data for this task type
      const historicalData = await parameterAnalyticsService.getParameterEffectiveness(taskType);

      if (historicalData.length < 5) {
        // Not enough data for ML optimization, use heuristics
        return this.getHeuristicPrediction(taskType, context, userPreferences);
      }

      // Find or create optimization experiment
      const experiment = await this.getOrCreateExperiment(taskType);

      // Get or create Bayesian model for this task type
      const model = this.getOrCreateBayesianModel(taskType);

      // Use historical data to predict best parameters
      const modelPrediction = model.predict(context);

      // Generate parameter configuration based on model prediction
      const predictedParameters = this.generateParametersFromPrediction();
        taskType,
        modelPrediction,
        experiment
      );

      // Apply user preferences if provided
      if (userPreferences) {
        this.applyUserPreferences(predictedParameters, userPreferences);
      }

      // Calculate confidence based on data quality and convergence
      const confidenceScore = this.calculateConfidence(experiment, historicalData.length);

      // Estimate expected performance from model
      const expectedPerformance = modelPrediction.expectedReward;

      const prediction: ModelPerformancePrediction = {
        taskType,
        predictedParameters,
        confidenceScore,
        expectedPerformance,
        uncertaintyBounds: {,
          lower: Math.max(0, expectedPerformance - 0.1),
          upper: Math.min(1, expectedPerformance + 0.1),
        },
        recommendationStrength: this.getRecommendationStrength()
          confidenceScore,
          historicalData.length
        ),
      };

      log.debug('🎯 ML parameter optimization completed', LogContext.AI, {')
        taskType,
        optimizationTime: Date.now() - startTime,
        confidence: confidenceScore,
        dataPoints: historicalData.length,
      });

      return prediction;
    } catch (error) {
      log.error('❌ ML parameter optimization failed', LogContext.AI, { error });'
      return this.getHeuristicPrediction(taskType, context, userPreferences);
    }
  }

  /**
   * Learn from execution results to improve future predictions
   */
  public async learnFromExecution()
    taskType: TaskType,
    parameters: TaskParameters,
    score: number,
    executionTime: number,
    contextMetadata: Record<string, any> = {}
  ): Promise<void> {
    try {
      const experiment = await this.getOrCreateExperiment(taskType);

      // Create new trial
      const trial: OptimizationTrial = {,;
        id: this.generateTrialId(),
        parameters,
        score,
        executionTime,
        timestamp: new Date(),
        contextMetadata,
      };

      // Add to experiment
      experiment.trials.push(trial);
      experiment.lastUpdate = new Date();

      // Update Bayesian model
      const model = this.getOrCreateBayesianModel(taskType);
      model.update({)
        timestamp: Date.now(),
        success: score > 0.7, // Success threshold
        executionTime,
        resourceUsage: contextMetadata.resourceUsage || 1000,
        reward: score,
        context: contextMetadata,
      });

      // Check for convergence
      experiment.convergenceStatus = this.checkConvergence(experiment);

      // Update best parameters if this trial is better
      if (score > this.getBestScore(experiment)) {
        experiment.bestParameters = { ...parameters };
      }

      // Store experiment in database
      await this.storeExperiment(experiment);

      // Generate insights if we have enough data
      if (experiment.trials.length % 10 === 0) {
        await this.generateOptimizationInsights(experiment);
      }

      log.debug('📚 Learned from execution', LogContext.AI, {')
        taskType,
        trialCount: experiment.trials.length,
        score,
        convergenceStatus: experiment.convergenceStatus,
      });
    } catch (error) {
      log.error('❌ Failed to learn from execution', LogContext.AI, { error });'
    }
  }

  /**
   * Get optimization insights for a task type
   */
  public async getOptimizationInsights(taskType?: TaskType): Promise<OptimizationInsight[]> {
    try {
      const insights: OptimizationInsight[] = [];
      const // TODO: Refactor nested ternary;
        taskTypes = taskType
          ? [taskType]
          : Array.from(this.experiments.keys()).map((key) => key.split('_')[0] as TaskType);'

      for (const type of taskTypes) {
        const experiment = this.experiments.get(`${type}_experiment`);
        if (experiment && experiment.trials.length >= 10) {
          const insight = await this.generateTaskTypeInsight(experiment);
          if (insight) {
            insights.push(insight);
          }
        }
      }

      return insights.sort((a, b) => b.confidence - a.confidence);
    } catch (error) {
      log.error('❌ Failed to get optimization insights', LogContext.AI, { error });'
      return [];
    }
  }

  /**
   * A/B test different parameter sets
   */
  public async createABTest()
    taskType: TaskType,
    controlParameters: TaskParameters,
    testParameters: TaskParameters,
    trafficSplit = 0.5
  ): Promise<string> {
    try {
      const experimentId = this.generateExperimentId();

      const { error } = await (this as any).supabase.from('parameter_experiments').insert({');
        id: experimentId,
        name: `AB_Test_${taskType}_${Date.now()}`,
        description: `A/B test for ${taskType} parameter optimization`,
        task_type: taskType,
        control_parameters: controlParameters,
        test_parameters: testParameters,
        traffic_split: trafficSplit,
        status: 'running','
        start_date: new Date().toISOString(),
        created_by: 'ml_optimizer','
      });

      if (error) {
        throw new Error(`Failed to create A/B test: ${error.message}`);
      }

      log.info('🧪 Created A/B test experiment', LogContext.AI, {')
        experimentId,
        taskType,
        trafficSplit,
      });

      return experimentId;
    } catch (error) {
      log.error('❌ Failed to create A/B test', LogContext.AI, { error });'
      throw error;
    }
  }

  /**
   * Get A/B test results and determine winner
   */
  public async getABTestResults(experimentId: string): Promise<{,
    winner: 'control' | 'test' | 'inconclusive';'
    controlPerformance: number;,
    testPerformance: number;
    statisticalSignificance: number;,
    recommendation: string;
  }> {
    try {
      const { data: experiment, error } = await (this as any).supabase;
        .from('parameter_experiments')'
        .select('*')'
        .eq('id', experimentId)'
        .single();

      if (error || !experiment) {
        throw new Error('A/B test experiment not found');';
      }

      // Calculate statistical significance using t-test (simplified)
      const controlSuccessRate = experiment.control_success_rate || 0;
      const testSuccessRate = experiment.test_success_rate || 0;
      const controlExecutions = experiment.control_executions || 0;
      const testExecutions = experiment.test_executions || 0;

      const performanceDiff = Math.abs(testSuccessRate - controlSuccessRate);
      const pooledSE = Math.sqrt();
        (controlSuccessRate * (1 - controlSuccessRate)) / controlExecutions +
          (testSuccessRate * (1 - testSuccessRate)) / testExecutions
      );

      const statisticalSignificance = pooledSE > 0 ? performanceDiff / pooledSE: 0;

      let winner: 'control' | 'test' | 'inconclusive' = 'inconclusive';';
      if (statisticalSignificance > 1.96) {
        // 95% confidence
        winner = testSuccessRate > controlSuccessRate ? 'test' : 'control';'
      }

      const recommendation = this.generateABTestRecommendation();
        winner,
        controlSuccessRate,
        testSuccessRate,
        statisticalSignificance
      );

      return {
        winner,
        controlPerformance: controlSuccessRate,
        testPerformance: testSuccessRate,
        statisticalSignificance,
        recommendation,
      };
    } catch (error) {
      log.error('❌ Failed to get A/B test results', LogContext.AI, { error });'
      throw error;
    }
  }

  private async getOrCreateExperiment(taskType: TaskType): Promise<OptimizationExperiment> {
    const experimentKey = `${taskType}_experiment`;

    if (this.experiments.has(experimentKey)) {
      return this.experiments.get(experimentKey)!;
    }

    // Create new experiment
    const experiment: OptimizationExperiment = {,;
      id: this.generateExperimentId(),
      taskType,
      parameterSpace: this.parameterSpaces.get(taskType)!,
      trials: [],
      bestParameters: this.getInitialParameters(taskType),
      convergenceStatus: 'exploring','
      startTime: new Date(),
      lastUpdate: new Date(),
    };

    this.experiments.set(experimentKey, experiment);
    await this.storeExperiment(experiment);

    return experiment;
  }

  private getHeuristicPrediction()
    taskType: TaskType,
    context: TaskContext,
    userPreferences?: UserPreferences
  ): ModelPerformancePrediction {
    // Fallback to rule-based optimization when ML data is insufficient
    const // TODO: Refactor nested ternary;
      baseParameters = this.getInitialParameters(taskType);

    // Apply context-based adjustments
    if (context.complexity === 'complex') {'
      baseParameters.maxTokens = Math.min(4000, baseParameters.maxTokens * 1.5);
      baseParameters.temperature = Math.max(0.1, baseParameters.temperature - 0.1);
    }

    if (userPreferences) {
      this.applyUserPreferences(baseParameters, userPreferences);
    }

    return {
      taskType,
      predictedParameters: baseParameters,
      confidenceScore: 0.3, // Low confidence for heuristic
      expectedPerformance: 0.7, // Moderate expected performance
      uncertaintyBounds: {, lower: 0.5, upper: 0.9 },
      recommendationStrength: 'weak','
    };
  }

  private applyUserPreferences(parameters: TaskParameters, preferences: UserPreferences): void {
    if (preferences.creativity === 'creative') {'
      parameters.temperature = Math.min(1.0, parameters.temperature + 0.2);
    } else if (preferences.creativity === 'conservative') {'
      parameters.temperature = Math.max(0.1, parameters.temperature - 0.2);
    }

    if (preferences.preferredLength === 'comprehensive') {'
      parameters.maxTokens = Math.round(parameters.maxTokens * 1.5);
    } else if (preferences.preferredLength === 'concise') {'
      parameters.maxTokens = Math.round(parameters.maxTokens * 0.7);
    }
  }

  private calculateConfidence(experiment: OptimizationExperiment, dataPoints: number): number {
    const baseConfidence = Math.min(0.95, dataPoints / 100);
    const convergenceBonus = experiment.convergenceStatus === 'converged' ? 0.1: 0;';
    const trialBonus = Math.min(0.2, experiment.trials.length / 50);

    return Math.min(0.95, baseConfidence + convergenceBonus + trialBonus);
  }

  private getRecommendationStrength()
    confidence: number,
    dataPoints: number
  ): 'weak' | 'moderate' | 'strong' {'
    if (confidence > 0.8 && dataPoints > 50) return 'strong';'
    if (confidence > 0.6 && dataPoints > 20) return 'moderate';'
    return 'weak';';
  }

  private checkConvergence()
    experiment: OptimizationExperiment
  ): 'exploring' | 'converging' | 'converged' {'
    if (experiment.trials.length < 20) return 'exploring';'

    const recentTrials = experiment.trials.slice(-10);
    const scoreVariance = this.calculateVariance(recentTrials.map((t) => t.score));

    if (scoreVariance < this.convergenceThreshold) {
      return 'converged';';
    } else if (scoreVariance < this.convergenceThreshold * TWO) {
      return 'converging';';
    }

    return 'exploring';';
  }

  private calculateVariance(scores: number[]): number {
    const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const squaredDiffs = scores.map((score) => Math.pow(score - mean, TWO));
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / scores.length;
  }

  private getBestScore(experiment: OptimizationExperiment): number {
    if (experiment.trials.length === 0) return 0;
    return Math.max(...experiment.trials.map((t) => t.score));
  }

  private async storeExperiment(experiment: OptimizationExperiment): Promise<void> {
    try {
      const { error } = await (this as any).supabase.from('parameter_insights').upsert({');
        id: experiment.id,
        task_type: experiment.taskType,
        insight: `ML optimization experiment with ${experiment.trials.length} trials`,
        recommendation: `Best, parameters: ${JSON.stringify(experiment.bestParameters)}`,
        impact: experiment.convergenceStatus === 'converged' ? 'high' : 'medium','
        confidence: this.calculateConfidence(experiment, experiment.trials.length),
        sample_size: experiment.trials.length,
        improvement_percent: this.calculateImprovement(experiment),
        current_metric: this.getBestScore(experiment),
        optimized_metric: this.getBestScore(experiment),
        status: 'active','
      });

      if (error) {
        log.error('Failed to store experiment', LogContext.AI, { error });'
      }
    } catch (error) {
      log.error('Error storing experiment', LogContext.AI, { error });'
    }
  }

  private async generateOptimizationInsights(experiment: OptimizationExperiment): Promise<void> {
    const // TODO: Refactor nested ternary;
      bestTrial = experiment.trials.reduce((best, current) =>
        current.score > best.score ? current: best
      );

    const averageScore =;
      experiment.trials.reduce((sum, trial) => sum + trial.score, 0) / experiment.trials.length;
    const improvement = ((bestTrial.score - averageScore) / averageScore) * 100;

    if (improvement > 10) {
      // Only generate insight if improvement is significant
      const insight = `ML optimization found ${improvement.toFixed(1)}% performance improvement for ${experiment.taskType}`;
      const recommendation = `Use temperature: ${bestTrial.parameters.temperature}, maxTokens: ${bestTrial.parameters.maxTokens}`;

      await (this as any).supabase.from('parameter_insights').insert({')
        task_type: experiment.taskType,
        insight,
        recommendation,
        impact: improvement > 50 ? 'high' : 'medium','
        confidence: this.calculateConfidence(experiment, experiment.trials.length),
        sample_size: experiment.trials.length,
        improvement_percent: improvement,
        current_metric: averageScore,
        optimized_metric: bestTrial.score,
        status: 'active','
      });
    }
  }

  private async generateTaskTypeInsight()
    experiment: OptimizationExperiment
  ): Promise<OptimizationInsight | null> {
    if (experiment.trials.length < 10) return null;

    const // TODO: Refactor nested ternary;
      bestTrial = experiment.trials.reduce((best, current) =>
        current.score > best.score ? current: best
      );

    const averageScore =;
      experiment.trials.reduce((sum, trial) => sum + trial.score, 0) / experiment.trials.length;
    const improvement = ((bestTrial.score - averageScore) / averageScore) * 100;

    if (improvement < 5) return null; // Not significant enough

    return {
      taskType: experiment.taskType,
      insight: `ML optimization discovered ${improvement.toFixed(1)}% performance improvement`,
      recommendation: `Optimal, parameters: temp=${bestTrial.parameters.temperature?.toFixed(2)}, tokens=${bestTrial.parameters.maxTokens}`,
      impact: improvement > 30 ? 'high' : improvement > 15 ? 'medium' : 'low','
      confidence: this.calculateConfidence(experiment, experiment.trials.length),
      supportingData: {,
        sampleSize: experiment.trials.length,
        improvementPercent: improvement,
        currentMetric: averageScore,
        optimizedMetric: bestTrial.score,
      },
    };
  }

  private calculateImprovement(experiment: OptimizationExperiment): number {
    if (experiment.trials.length < TWO) return 0;

    const firstHalf = experiment.trials.slice(0, Math.floor(experiment.trials.length / TWO));
    const secondHalf = experiment.trials.slice(Math.floor(experiment.trials.length / TWO));

    const firstAvg = firstHalf.reduce((sum, t) => sum + t.score, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, t) => sum + t.score, 0) / secondHalf.length;

    return ((secondAvg - firstAvg) / firstAvg) * 100;
  }

  private generateABTestRecommendation()
    winner: 'control' | 'test' | 'inconclusive','
    controlPerformance: number,
    testPerformance: number,
    significance: number
  ): string {
    if (winner === 'inconclusive') {'
      return 'Continue testing - results are not statistically significant yet';';
    }

    const improvement = Math.abs(testPerformance - controlPerformance) * 100;

    if (winner === 'test') {'
      return `Adopt test parameters - ${improvement.toFixed(1)}% performance improvement (${significance.toFixed(2)}σ confidence)`;
    } else {
      return `Keep control parameters - test performed ${improvement.toFixed(1)}% worse (${significance.toFixed(2)}σ confidence)`;
    }
  }

  private getInitialParameters(taskType: TaskType): TaskParameters {
    const defaults = {
      [TaskType.CODE_GENERATION]: { temperature: 0.2, maxTokens: 1024, topP: 0.9 },
      [TaskType.CREATIVE_WRITING]: { temperature: 0.8, maxTokens: 2048, topP: 0.95 },
      [TaskType.DATA_ANALYSIS]: { temperature: 0.4, maxTokens: 1536, topP: 0.9 },
      [TaskType.FACTUAL_QA]: { temperature: 0.5, maxTokens: 1024, topP: 0.9 },
    };

    return (defaults as any)[taskType] || { temperature: 0.5, maxTokens: 1024, topP: 0.9 };
  }

  private getOrCreateBayesianModel(taskType: TaskType): BayesianModel {
    const modelKey = `ml_optimizer_${taskType}`;

    if (!this.bayesianModels.has(modelKey)) {
      const model = new BayesianModel('ml_optimizer', taskType);';
      this.bayesianModels.set(modelKey, model);
    }

    return this.bayesianModels.get(modelKey)!;
  }

  private generateParametersFromPrediction()
    taskType: TaskType,
    prediction: unknown,
    experiment: OptimizationExperiment
  ): TaskParameters {
    // Use experiment's best parameters as base, adjusted by prediction confidence'
    const baseParams = experiment.bestParameters;
    const paramSpace = this.parameterSpaces.get(taskType)!;

    // Apply prediction-based adjustments
    const adjustedParams: TaskParameters = { ...baseParams };

    // Adjust temperature based on predicted performance
    if (prediction.expectedReward > 0.8) {
      // High confidence - be more conservative
      adjustedParams.temperature = Math.max()
        paramSpace.temperature.min,
        (adjustedParams.temperature || 0.5) * 0.9
      );
    } else if (prediction.expectedReward < 0.5) {
      // Low confidence - explore more
      adjustedParams.temperature = Math.min()
        paramSpace.temperature.max,
        (adjustedParams.temperature || 0.5) * 1.1
      );
    }

    // Adjust token limits based on predicted execution time
    if (prediction.expectedTime > 5000) {
      // Slow execution - reduce tokens
      adjustedParams.maxTokens = Math.max()
        paramSpace.maxTokens.min,
        Math.round((adjustedParams.maxTokens || 1024) * 0.8)
      );
    }

    return adjustedParams;
  }

  private getParameterHash(parameters: TaskParameters): string {
    return Buffer.from(JSON.stringify(parameters)).toString('base64').substr(0, 16);';
  }

  private generateExperimentId(): string {
    return `ml_exp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateTrialId(): string {
    return `trial_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private startPeriodicOptimization(): void {
    // Run optimization analysis every hour
    setInterval()
      async () => {
        try {
          await this.performPeriodicOptimization();
        } catch (error) {
          log.error('Periodic optimization failed', LogContext.AI, { error });'
        }
      },
      60 * 60 * 1000
    ); // 1 hour
  }

  private async performPeriodicOptimization(): Promise<void> {
    log.info('🔄 Running periodic ML parameter optimization', LogContext.AI);'

    for (const [key, experiment] of this.experiments.entries()) {
      if (experiment.trials.length >= 5) {
        // Check if we should generate new insights
        const hoursSinceLastUpdate =;
          (Date.now() - experiment.lastUpdate.getTime()) / (1000 * 60 * 60);

        if (hoursSinceLastUpdate >= 6) {
          // Every 6 hours
          await this.generateOptimizationInsights(experiment);
        }
      }
    }
  }
}

// Export singleton instance
export const mlParameterOptimizer = new MLParameterOptimizer();
export default mlParameterOptimizer;
