/**
 * Bayesian Performance Model
 * Tracks and predicts agent performance using Bayesian inference
 * Continuously learns from execution feedback
 */

import type {
  ABMCTSReward,
  BayesianPerformanceModel,
  BetaDistribution,
  GammaDistribution,
  NormalDistribution,
  PerformanceObservation,
} from '@/types/ab-mcts';
import { BetaSampler, NormalGammaSampler } from './thompson-sampling';
import { LogContext, log } from './logger';

/**
 * Bayesian model for tracking agent performance
 */
export class BayesianModel implements BayesianPerformanceModel {
  agentName: string;
  taskType: string;
  successRate: BetaDistribution;
  executionTime: NormalDistribution;
  resourceUsage: GammaDistribution;
  observations: PerformanceObservation[];
  lastUpdated: number;
  totalSamples: number;
  expectedPerformance: number;
  confidenceInterval: [number, number];
  reliability: number;

  // Additional tracking for Normal-Gamma conjugate prior
  private timeParams: {
    mean: number;
    precision: number;
    shape: number;
    rate: number;
  };

  private resourceParams: {
    shape: number;
    rate: number;
  };

  constructor(agentName: string, taskType: string) {
    this.agentName = agentName;
    this.taskType = taskType;

    // Initialize with uninformative priors
    this.successRate = {
      alpha: 1,
      beta: 1,
      mean: 0.5,
      variance: 1 / 12, // Beta(1,1) variance
    };

    this.executionTime = {
      mean: 1000, // 1 second prior
      variance: 250000, // High uncertainty
      precision: 1 / 250000,
      standardDeviation: 500,
    };

    this.resourceUsage = {
      shape: 2,
      rate: 0.002, // Mean = 1000 (shape/rate)
      mean: 1000,
      variance: 500000,
    };

    // Normal-Gamma parameters for execution time
    this.timeParams = {
      mean: 1000,
      precision: 0.001, // Low precision = high uncertainty
      shape: 1,
      rate: 500,
    };

    this.resourceParams = {
      shape: 2,
      rate: 0.002,
    };

    this.observations = [];
    this.lastUpdated = Date.now();
    this.totalSamples = 0;
    this.expectedPerformance = 0.5;
    this.confidenceInterval = [0, 1];
    this.reliability = 0;
  }

  /**
   * Update model with new observation
   */
  update(observation: PerformanceObservation): void {
    this.observations.push(observation);
    this.totalSamples++;
    this.lastUpdated = Date.now();

    // Update success rate (Beta distribution)
    this.successRate = BetaSampler.update(this.successRate, observation.success);

    // Update execution time (Normal-Gamma)
    const timeUpdate = NormalGammaSampler.update(
      this.timeParams.mean,
      this.timeParams.precision,
      this.timeParams.shape,
      this.timeParams.rate,
      observation.executionTime
    );
    this.timeParams = timeUpdate;

    // Update Normal distribution parameters
    const timeStats = NormalGammaSampler.getStatistics(
      timeUpdate.mean,
      timeUpdate.precision,
      timeUpdate.shape,
      timeUpdate.rate
    );

    this.executionTime = {
      mean: timeStats.expectedMean,
      variance: timeStats.variance,
      precision: 1 / timeStats.variance,
      standardDeviation: Math.sqrt(timeStats.variance),
    };

    // Update resource usage (Gamma distribution)
    this.updateResourceUsage(observation.resourceUsage);

    // Calculate overall performance metrics
    this.updatePerformanceMetrics();

    log.debug('Bayesian model updated', LogContext.AI, {
      agent: this.agentName,
      taskType: this.taskType,
      successRate: this.successRate.mean,
      avgExecutionTime: this.executionTime.mean,
      totalSamples: this.totalSamples,
    });
  }

  /**
   * Update resource usage with Gamma distribution
   */
  private updateResourceUsage(usage: number): void {
    // Method of moments update for Gamma
    const n = this.totalSamples;
    const oldMean = this.resourceUsage.mean;
    const newMean = (oldMean * (n - 1) + usage) / n;

    // Update variance using Welford's algorithm
    const oldVar = this.resourceUsage.variance;
    const newVar = ((n - 1) * oldVar + (usage - oldMean) * (usage - newMean)) / n;

    // Convert to Gamma parameters
    this.resourceUsage = {
      shape: (newMean * newMean) / newVar,
      rate: newMean / newVar,
      mean: newMean,
      variance: newVar,
    };

    this.resourceParams = {
      shape: this.resourceUsage.shape,
      rate: this.resourceUsage.rate,
    };
  }

  /**
   * Update overall performance metrics
   */
  private updatePerformanceMetrics(): void {
    // Expected performance combines success rate and efficiency
    const successScore = this.successRate.mean;
    const timeScore = 1 / (1 + this.executionTime.mean / 1000); // Normalize to 0-1
    const resourceScore = 1 / (1 + this.resourceUsage.mean / 1000); // Normalize to 0-1

    // Weighted combination
    this.expectedPerformance = 0.5 * successScore + 0.3 * timeScore + 0.2 * resourceScore;

    // Confidence interval based on success rate
    this.confidenceInterval = BetaSampler.confidenceInterval(this.successRate);

    // Reliability based on sample size and consistency
    const sampleReliability = Math.min(1, this.totalSamples / 30); // 30 samples for full reliability
    const consistencyScore = this.calculateConsistency();
    this.reliability = 0.7 * sampleReliability + 0.3 * consistencyScore;
  }

  /**
   * Calculate consistency score based on recent observations
   */
  private calculateConsistency(): number {
    if (this.observations.length < 5) return 0;

    const recent = this.observations.slice(-10);
    const successRates = recent.map((o) => (o.success ? 1 : 0));

    // Calculate variance in success rates
    const mean =
      successRates.reduce((a: number, b: number) => a + b, 0 as number) / successRates.length;
    const variance =
      successRates.reduce((sum, rate) => sum + Math.pow(rate - mean, 2), 0 as number) /
      successRates.length;

    // Lower variance = higher consistency
    return Math.exp(-2 * variance); // Maps variance to 0-1
  }

  /**
   * Predict performance for a given context
   */
  predict(context: Record<string, any>): {
    expectedReward: number;
    expectedTime: number;
    expectedResources: number;
    confidence: number;
  } {
    // Sample from posterior distributions
    const successProb = BetaSampler.sample(this.successRate.alpha, this.successRate.beta);
    const timeEstimate = this.sampleExecutionTime();
    const resourceEstimate = this.sampleResourceUsage();

    // Context-aware adjustments
    const contextMultiplier = this.getContextMultiplier(context);

    return {
      expectedReward: successProb * contextMultiplier,
      expectedTime: timeEstimate * contextMultiplier,
      expectedResources: resourceEstimate * contextMultiplier,
      confidence: this.reliability,
    };
  }

  /**
   * Sample execution time from posterior
   */
  private sampleExecutionTime(): number {
    const sample = NormalGammaSampler.sample(
      this.timeParams.mean,
      this.timeParams.precision,
      this.timeParams.shape,
      this.timeParams.rate
    );

    // Ensure positive time
    return Math.max(1, sample.mean);
  }

  /**
   * Sample resource usage from Gamma posterior
   */
  private sampleResourceUsage(): number {
    // Use the private sampleGamma method from BetaSampler
    const sample = (BetaSampler as any).sampleGamma(
      this.resourceParams.shape,
      this.resourceParams.rate
    );

    return Math.max(1, sample);
  }

  /**
   * Get context-based performance multiplier
   */
  private getContextMultiplier(context: Record<string, any>): number {
    let multiplier = 1.0;

    // Adjust based on task complexity
    if (context.complexity === 'simple') multiplier *= 0.8;
    else if (context.complexity === 'complex') multiplier *= 1.2;

    // Adjust based on urgency
    if (context.urgency === 'high') multiplier *= 1.1;
    else if (context.urgency === 'low') multiplier *= 0.9;

    return multiplier;
  }

  /**
   * Get model statistics
   */
  getStatistics(): {
    successRate: { mean: number; confidence: [number, number] };
    executionTime: { mean: number; stdDev: number };
    resourceUsage: { mean: number; variance: number };
    reliability: number;
    samples: number;
  } {
    return {
      successRate: {
        mean: this.successRate.mean,
        confidence: this.confidenceInterval,
      },
      executionTime: {
        mean: this.executionTime.mean,
        stdDev: this.executionTime.standardDeviation,
      },
      resourceUsage: {
        mean: this.resourceUsage.mean,
        variance: this.resourceUsage.variance,
      },
      reliability: this.reliability,
      samples: this.totalSamples,
    };
  }

  /**
   * Compare with another model
   */
  compareTo(other: BayesianModel): {
    betterSuccess: number; // Probability this model has better success rate
    fasterExecution: number; // Probability this model is faster
    moreEfficient: number; // Probability this model uses fewer resources
    overallBetter: number; // Overall probability this model is better
  } {
    // Monte Carlo comparison
    const samples = 10000;
    let betterSuccess = 0;
    let fasterExecution = 0;
    let moreEfficient = 0;
    let overallBetter = 0;

    for (let i = 0; i < samples; i++) {
      // Sample from both models
      const thisSuccess = BetaSampler.sample(this.successRate.alpha, this.successRate.beta);
      const otherSuccess = BetaSampler.sample(other.successRate.alpha, other.successRate.beta);

      const thisTime = this.sampleExecutionTime();
      const otherTime = other.sampleExecutionTime();

      const thisResource = this.sampleResourceUsage();
      const otherResource = other.sampleResourceUsage();

      // Count wins
      if (thisSuccess > otherSuccess) betterSuccess++;
      if (thisTime < otherTime) fasterExecution++;
      if (thisResource < otherResource) moreEfficient++;

      // Overall comparison (weighted)
      const thisScore = 0.5 * thisSuccess + 0.3 * (1 / thisTime) + 0.2 * (1 / thisResource);
      const otherScore = 0.5 * otherSuccess + 0.3 * (1 / otherTime) + 0.2 * (1 / otherResource);
      if (thisScore > otherScore) overallBetter++;
    }

    return {
      betterSuccess: betterSuccess / samples,
      fasterExecution: fasterExecution / samples,
      moreEfficient: moreEfficient / samples,
      overallBetter: overallBetter / samples,
    };
  }

  /**
   * Serialize model for storage
   */
  toJSON(): string {
    return JSON.stringify({
      agentName: this.agentName,
      taskType: this.taskType,
      successRate: this.successRate,
      executionTime: this.executionTime,
      resourceUsage: this.resourceUsage,
      timeParams: this.timeParams,
      resourceParams: this.resourceParams,
      observations: this.observations.slice(-100), // Keep last 100
      lastUpdated: this.lastUpdated,
      totalSamples: this.totalSamples,
      expectedPerformance: this.expectedPerformance,
      confidenceInterval: this.confidenceInterval,
      reliability: this.reliability,
    });
  }

  /**
   * Restore model from JSON
   */
  static fromJSON(json: string): BayesianModel {
    const data = JSON.parse(json);
    const model = new BayesianModel(data.agentName, data.taskType);

    Object.assign(model, data);

    return model;
  }
}

/**
 * Model registry for managing multiple Bayesian models
 */
export class BayesianModelRegistry {
  private models: Map<string, BayesianModel> = new Map();

  /**
   * Get or create model for agent/task combination
   */
  getModel(agentName: string, taskType: string): BayesianModel {
    const key = `${agentName}:${taskType}`;

    if (!this.models.has(key)) {
      this.models.set(key, new BayesianModel(agentName, taskType));
    }

    return this.models.get(key)!;
  }

  /**
   * Update model with reward observation
   */
  updateModel(
    agentName: string,
    taskType: string,
    reward: ABMCTSReward,
    executionTime: number,
    context: Record<string, any>
  ): void {
    const model = this.getModel(agentName, taskType);

    const observation: PerformanceObservation = {
      timestamp: Date.now(),
      success: reward.value > 0.5,
      executionTime,
      resourceUsage: reward.metadata.memoryUsed + reward.metadata.tokensUsed,
      reward: reward.value,
      context,
    };

    model.update(observation);
  }

  /**
   * Get best agent for task type
   */
  getBestAgent(
    taskType: string,
    availableAgents: string[]
  ): {
    agent: string;
    confidence: number;
    expectedPerformance: number;
  } {
    let bestAgent = '';
    let bestPerformance = -Infinity;
    let bestConfidence = 0;

    for (const agent of availableAgents) {
      const model = this.getModel(agent, taskType);

      if (model.expectedPerformance > bestPerformance) {
        bestPerformance = model.expectedPerformance;
        bestAgent = agent;
        bestConfidence = model.reliability;
      }

      return undefined;

      return undefined;
    }

    return {
      agent: bestAgent,
      confidence: bestConfidence,
      expectedPerformance: bestPerformance,
    };
  }

  /**
   * Get performance rankings for task type
   */
  getRankings(taskType: string): Array<{
    agent: string;
    performance: number;
    reliability: number;
    samples: number;
  }> {
    const rankings = [];

    for (const [key, model] of this.models) {
      if (key.endsWith(`:${taskType}`)) {
        rankings.push({
          agent: model.agentName,
          performance: model.expectedPerformance,
          reliability: model.reliability,
          samples: model.totalSamples,
        });
      }
    }

    return rankings.sort((a, b) => b.performance - a.performance);
  }

  /**
   * Serialize all models
   */
  serialize(): string {
    const data: Record<string, any> = {};

    for (const [key, model] of this.models) {
      data[key] = JSON.parse(model.toJSON());
    }

    return JSON.stringify(data);
  }

  /**
   * Restore from serialized data
   */
  static deserialize(data: string): BayesianModelRegistry {
    const registry = new BayesianModelRegistry();
    const parsed = JSON.parse(data);

    for (const [key, modelData] of Object.entries(parsed)) {
      const model = BayesianModel.fromJSON(JSON.stringify(modelData));
      registry.models.set(key, model);
    }

    return registry;
  }
}

// Export singleton registry
export const bayesianModelRegistry = new BayesianModelRegistry();
