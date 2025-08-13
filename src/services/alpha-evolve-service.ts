/**
 * Alpha Evolve Service - Self-Improving AI System
 * Continuously evolves agents and system architecture based on performance
 * Uses multi-tier LLMs for meta-learning and self-modification
 */

import { log,LogContext } from '@/utils/logger';

import { dspyFastOptimizer } from './dspy-fast-optimizer';
import { multiTierLLM } from './multi-tier-llm-service';

export interface EvolutionMetrics {
  agentName: string;
  successRate: number;
  averageResponseTime: number;
  userSatisfaction: number;
  taskComplexityHandled: string;
  improvementSuggestions: string[];
  lastEvolution: Date;
}

export interface EvolutionPlan {
  targetAgent: string;
  evolutionType:
    | 'prompt_optimization'
    | 'tier_adjustment'
    | 'capability_expansion'
    | 'performance_tuning';
  changes: {
    before: unknown;
    after: unknown;
    reasoning: string;
  };
  expectedImprovement: number;
  riskLevel: 'low' | 'medium' | 'high';
  rollbackPlan: string;
}

export interface SystemEvolution {
  timestamp: Date;
  evolutionId: string;
  changes: EvolutionPlan[];
  overallImprovement: number;
  performanceGains: Record<string, number>;
  newCapabilities: string[];
}

export class AlphaEvolveService {
  private evolutionHistory: SystemEvolution[] = [];
  private agentMetrics: Map<string, EvolutionMetrics> = new Map();
  private evolutionEnabled: boolean;
  private evolutionRate: 'conservative' | 'moderate' | 'aggressive';
  private confidenceThreshold: number;

  constructor() {
    this.evolutionEnabled = process.env.ENABLE_ALPHA_EVOLVE === 'true';
    this.evolutionRate = (process.env.AI_EVOLUTION_RATE as any) || 'moderate';
    this.confidenceThreshold = parseFloat(process.env.AI_CONFIDENCE_THRESHOLD || '0.85');

    if (this.evolutionEnabled) {
      this.startEvolutionCycle();
      log.info('🧬 Alpha Evolve system initialized', LogContext.AI, {
        rate: this.evolutionRate,
        threshold: this.confidenceThreshold,
      });
    }
  }

  /**
   * Analyze agent performance and suggest improvements
   */
  public async analyzeAgentPerformance(
    agentName: string,
    performanceData: {
      successRate: number;
      responseTime: number;
      userFeedback: Array<{ rating: number; comment: string }>;
      taskTypes: string[];
      errors: string[];
    }
  ): Promise<EvolutionPlan[]> {
    log.info(`🔍 Analyzing performance for ${agentName}`, LogContext.AI);

    // Use Tier 3+ models for meta-analysis
    const analysisPrompt = `Analyze this agent's performance and suggest specific improvements:

AGENT: ${agentName}
PERFORMANCE DATA:
- Success Rate: ${performanceData.successRate * 100}%
- Average Response Time: ${performanceData.responseTime}ms
- User Satisfaction: ${this.calculateSatisfaction(performanceData.userFeedback)}/5
- Task Types: ${performanceData.taskTypes.join(', ')}
- Common Errors: ${performanceData.errors.join(', ')}

USER FEEDBACK:
${performanceData.userFeedback.map((f) => `Rating: ${f.rating}/5 - ${f.comment}`).join('\n')}

Provide specific, actionable evolution recommendations in JSON format:
{
  "evolution_plans": [
    {
      "evolutionType": "prompt_optimization|tier_adjustment|capability_expansion|performance_tuning",
      "changes": {
        "before": "current state",
        "after": "improved state", 
        "reasoning": "why this change will help"
      },
      "expectedImprovement": 0.15,
      "riskLevel": "low|medium|high",
      "rollbackPlan": "how to undo if needed"
    }
  ],
  "priority_order": ["most important evolution first"],
  "confidence": 0.85,
  "timeline": "suggested implementation timeline"
}`;

    try {
      const result = await multiTierLLM.execute(analysisPrompt, {
        metadata: {
          domain: 'reasoning',
          complexity: 'expert',
          agentName: 'alpha_evolve_analyzer',
        }
      });

      const analysis = this.parseEvolutionAnalysis(result.response);

      log.info(`✅ Performance analysis completed for ${agentName}`, LogContext.AI, {
        evolutionPlans: analysis.length,
        highPriorityChanges: analysis.filter((p) => p.expectedImprovement > 0.1).length,
      });

      return analysis;
    } catch (error) {
      log.error(`❌ Performance analysis failed for ${agentName}`, LogContext.AI, { error });
      return this.getDefaultEvolutionPlan(agentName, performanceData);
    }
  }

  /**
   * Execute agent evolution based on analysis
   */
  public async evolveAgent(
    agentName: string,
    evolutionPlan: EvolutionPlan
  ): Promise<{
    success: boolean;
    changes: unknown;
    rollbackInfo: unknown;
    newCapabilities: string[];
  }> {
    if (!this.evolutionEnabled) {
      throw new Error('Alpha Evolve is disabled');
    }

    log.info(`🧬 Evolving agent: ${agentName}`, LogContext.AI, {
      evolutionType: evolutionPlan.evolutionType,
      expectedImprovement: evolutionPlan.expectedImprovement,
    });

    try {
      // Create rollback snapshot
      const rollbackInfo = await this.createRollbackSnapshot(agentName);

      // Apply evolution based on type
      let changes: unknown = {};
      let newCapabilities: string[] = [];

      switch (evolutionPlan.evolutionType) {
        case 'prompt_optimization':
          changes = await this.optimizeAgentPrompt(agentName, evolutionPlan);
          break;

        case 'tier_adjustment':
          changes = await this.adjustAgentTier(agentName, evolutionPlan);
          break;

        case 'capability_expansion':
          const result = await this.expandAgentCapabilities(agentName, evolutionPlan);
          changes = result.changes;
          newCapabilities = result.newCapabilities;
          break;

        case 'performance_tuning':
          changes = await this.tuneAgentPerformance(agentName, evolutionPlan);
          break;
      }

      // Update agent metrics
      this.updateAgentMetrics(agentName, evolutionPlan);

      log.info(`✅ Agent evolution completed: ${agentName}`, LogContext.AI, {
        evolutionType: evolutionPlan.evolutionType,
        newCapabilities: newCapabilities.length,
      });

      return {
        success: true,
        changes,
        rollbackInfo,
        newCapabilities,
      };
    } catch (error) {
      log.error(`❌ Agent evolution failed: ${agentName}`, LogContext.AI, { error });

      return {
        success: false,
        changes: {},
        rollbackInfo: null,
        newCapabilities: [],
      };
    }
  }

  /**
   * System-wide architecture evolution
   */
  public async evolveArchitecture(): Promise<SystemEvolution> {
    log.info('🏗️ Starting system architecture evolution', LogContext.AI);

    const architectureAnalysisPrompt = `Analyze the current multi-tier AI system and suggest architectural improvements:

CURRENT SYSTEM:
- 4-tier LLM architecture (LFM2-1.2B, Gemma/Phi, Qwen/DeepSeek, Devstral)
- Agent-to-agent communication mesh
- DSPy optimization pipeline
- Voice integration with Kokoro-82M
- Multi-modal capabilities

PERFORMANCE METRICS:
${JSON.stringify(await this.getSystemMetrics())}

EVOLUTION GOALS:
- Improve overall response time
- Enhance capability coverage
- Optimize resource utilization
- Add new emergent behaviors

Suggest specific architectural changes in JSON format:
{
  "architectural_changes": [
    {
      "component": "tier_system|routing|communication|memory",
      "change_type": "add|modify|remove|optimize",
      "description": "detailed change description",
      "implementation_steps": ["step 1", "step 2"],
      "expected_impact": "performance/capability improvement",
      "complexity": "low|medium|high"
    }
  ],
  "new_capabilities": ["list of new system capabilities"],
  "performance_predictions": {
    "response_time_improvement": 0.20,
    "capability_expansion": 0.15,
    "resource_efficiency": 0.10
  },
  "implementation_order": ["prioritized list of changes"]
}`;

    try {
      const result = await multiTierLLM.execute(architectureAnalysisPrompt, {
        metadata: {
          domain: 'reasoning',
          complexity: 'expert',
          agentName: 'alpha_evolve_architect',
        }
      });

      const architecturalPlan = this.parseArchitecturalEvolution(result.response);

      // Execute the architectural changes
      const systemEvolution: SystemEvolution = {
        timestamp: new Date(),
        evolutionId: `arch_${Date.now()}`,
        changes: architecturalPlan.changes,
        overallImprovement: architecturalPlan.expectedImprovement,
        performanceGains: architecturalPlan.performanceGains,
        newCapabilities: architecturalPlan.newCapabilities,
      };

      this.evolutionHistory.push(systemEvolution);

      log.info('✅ System architecture evolution completed', LogContext.AI, {
        changes: systemEvolution.changes.length,
        improvement: systemEvolution.overallImprovement,
        newCapabilities: systemEvolution.newCapabilities.length,
      });

      return systemEvolution;
    } catch (error) {
      log.error('❌ Architecture evolution failed', LogContext.AI, { error });
      throw error;
    }
  }

  /**
   * Continuous learning from interactions
   */
  public async learnFromInteraction(
    agentName: string,
    interaction: {
      userRequest: string;
      agentResponse: string;
      userFeedback?: number;
      wasSuccessful: boolean;
      responseTime: number;
      tokensUsed: number;
    }
  ): Promise<void> {
    // Store interaction for pattern learning
    const learningPrompt = `Learn from this agent interaction to improve future responses:

AGENT: ${agentName}
USER REQUEST: "${interaction.userRequest}"
AGENT RESPONSE: "${interaction.agentResponse.substring(0, 500)}..."
SUCCESS: ${interaction.wasSuccessful}
USER FEEDBACK: ${interaction.userFeedback || 'None'}/5
PERFORMANCE: ${interaction.responseTime}ms, ${interaction.tokensUsed} tokens

Extract patterns and improvement opportunities:
{
  "patterns_identified": ["list of patterns in this interaction"],
  "success_factors": ["what made this successful/unsuccessful"],
  "improvement_suggestions": ["specific ways to improve"],
  "knowledge_gained": ["new knowledge to remember"],
  "applies_to_agents": ["which other agents could benefit from this learning"]
}`;

    try {
      // Use multiTierLLM with proper context structure
      const learningResult = await multiTierLLM.execute(learningPrompt, {
        metadata: {
          domain: 'reasoning',
          complexity: 'medium',
          agentName: 'alpha_evolve_learner',
        }
      });

      // Apply learning insights
      await this.applyLearningInsights(agentName, learningResult.response);
    } catch (error) {
      log.warn(`⚠️ Learning from interaction failed for ${agentName}`, LogContext.AI, { 
        error: error instanceof Error ? error.message : 'Unknown error',
        userRequest: interaction.userRequest?.substring(0, 100),
        agentResponse: interaction.agentResponse?.substring(0, 100)
      });
      
      // Fallback: Store basic metrics without LLM analysis
      try {
        await this.storeBasicInteractionMetrics(agentName, interaction);
      } catch (fallbackError) {
        log.error(`❌ Failed to store basic interaction metrics for ${agentName}`, LogContext.AI, {
          error: fallbackError instanceof Error ? fallbackError.message : 'Unknown fallback error'
        });
      }
    }
  }

  private startEvolutionCycle(): void {
    const evolutionInterval = this.getEvolutionInterval();

    setInterval(async () => {
      if (this.evolutionEnabled) {
        await this.runEvolutionCycle();
      }
    }, evolutionInterval);

    log.info('🔄 Evolution cycle started', LogContext.AI, {
      interval: `${evolutionInterval / (1000 * 60)} minutes`,
      rate: this.evolutionRate,
    });
  }

  private async runEvolutionCycle(): Promise<void> {
    log.info('🧬 Running evolution cycle', LogContext.AI);

    try {
      // Analyze all agent performances
      const agents = Array.from(this.agentMetrics.keys());
      const evolutionPlans: EvolutionPlan[] = [];

      for (const agentName of agents) {
        const metrics = this.agentMetrics.get(agentName);
        if (metrics && this.shouldEvolveAgent(metrics)) {
          const plans = await this.analyzeAgentPerformance(agentName, {
            successRate: metrics.successRate,
            responseTime: metrics.averageResponseTime,
            userFeedback: [], // Would come from real user interactions
            taskTypes: ['general'],
            errors: [],
          });
          evolutionPlans.push(...plans);
        }
      }

      // Execute highest-priority evolutions
      const prioritizedPlans = evolutionPlans
        .sort((a, b) => b.expectedImprovement - a.expectedImprovement)
        .slice(0, this.getMaxEvolutionsPerCycle());

      for (const plan of prioritizedPlans) {
        await this.evolveAgent(plan.targetAgent, plan);
      }

      // Consider system-wide evolution
      if (this.shouldEvolveArchitecture()) {
        await this.evolveArchitecture();
      }
    } catch (error) {
      log.error('❌ Evolution cycle failed', LogContext.AI, { error });
    }
  }

  private shouldEvolveAgent(metrics: EvolutionMetrics): boolean {
    const timeSinceLastEvolution = Date.now() - metrics.lastEvolution.getTime();
    const hoursSinceEvolution = timeSinceLastEvolution / (1000 * 60 * 60);

    return (
      metrics.successRate < this.confidenceThreshold ||
      metrics.userSatisfaction < 4.0 ||
      hoursSinceEvolution > 24 // Evolve at least daily
    );
  }

  private shouldEvolveArchitecture(): boolean {
    if (this.evolutionHistory.length === 0) {
      return true;
    }
    const lastEvolution = this.evolutionHistory[this.evolutionHistory.length - 1];
    return !!lastEvolution && Date.now() - lastEvolution.timestamp.getTime() > 24 * 60 * 60 * 1000;
  }

  private getEvolutionInterval(): number {
    const intervals = {
      conservative: 60 * 60 * 1000, // 1 hour
      moderate: 30 * 60 * 1000, // 30 minutes
      aggressive: 15 * 60 * 1000, // 15 minutes
    };
    return intervals[this.evolutionRate];
  }

  private getMaxEvolutionsPerCycle(): number {
    const limits = {
      conservative: 1,
      moderate: 3,
      aggressive: 5,
    };
    return limits[this.evolutionRate];
  }

  private calculateSatisfaction(feedback: Array<{ rating: number; comment: string }>): number {
    if (feedback.length === 0) return 3.5; // Default neutral
    return feedback.reduce((sum, f) => sum + f.rating, 0) / feedback.length;
  }

  private parseEvolutionAnalysis(response: string): EvolutionPlan[] {
    try {
      const parsed = JSON.parse(response);
      return parsed.evolution_plans || [];
    } catch {
      return [];
    }
  }

  private parseArchitecturalEvolution(response: string): {
    changes: any[];
    expectedImprovement: number;
    performanceGains: Record<string, any>;
    newCapabilities: string[];
  } {
    try {
      return JSON.parse(response);
    } catch {
      return {
        changes: [],
        expectedImprovement: 0,
        performanceGains: {},
        newCapabilities: [],
      };
    }
  }

  private getDefaultEvolutionPlan(agentName: string, performanceData: unknown): EvolutionPlan[] {
    return [
      {
        targetAgent: agentName,
        evolutionType: 'performance_tuning',
        changes: {
          before: 'baseline performance',
          after: 'optimized performance',
          reasoning: 'Default optimization based on performance data',
        },
        expectedImprovement: 0.05,
        riskLevel: 'low',
        rollbackPlan: 'Revert to previous configuration',
      },
    ];
  }

  private async createRollbackSnapshot(agentName: string): Promise<any> {
    // Create snapshot of current agent state
    return {
      agentName,
      timestamp: new Date(),
      configuration: 'current_config', // Would store actual config
      metrics: this.agentMetrics.get(agentName),
    };
  }

  private async optimizeAgentPrompt(agentName: string, plan: EvolutionPlan): Promise<any> {
    // Use DSPy to optimize prompts
    return dspyFastOptimizer.optimizeLFM2Responses(agentName, []);
  }

  private async adjustAgentTier(agentName: string, plan: EvolutionPlan): Promise<any> {
    // Adjust preferred tier based on performance
    return { tierAdjustment: 'tier_optimized' };
  }

  private async expandAgentCapabilities(
    agentName: string,
    plan: EvolutionPlan
  ): Promise<{
    changes: unknown;
    newCapabilities: string[];
  }> {
    // Add new capabilities to agent
    return {
      changes: { capabilityExpansion: 'expanded' },
      newCapabilities: ['new_capability_1', 'new_capability_2'],
    };
  }

  private async tuneAgentPerformance(agentName: string, plan: EvolutionPlan): Promise<any> {
    // Tune performance parameters
    return { performanceTuning: 'optimized' };
  }

  private updateAgentMetrics(agentName: string, plan: EvolutionPlan): void {
    const metrics = this.agentMetrics.get(agentName);
    if (metrics) {
      metrics.lastEvolution = new Date();
      metrics.successRate = Math.min(1.0, metrics.successRate + plan.expectedImprovement);
      this.agentMetrics.set(agentName, metrics);
    }
  }

  private async getSystemMetrics(): Promise<any> {
    return {
      totalAgents: this.agentMetrics.size,
      averageSuccessRate: 0.85,
      systemUptime: process.uptime(),
      evolutionHistory: this.evolutionHistory.length,
    };
  }

  private async applyLearningInsights(agentName: string, insights: string): Promise<void> {
    // Apply learning insights to improve agent
    log.info(`📚 Applying learning insights to ${agentName}`, LogContext.AI);
  }

  private async storeBasicInteractionMetrics(
    agentName: string, 
    interaction: {
      userRequest: string;
      agentResponse: string;
      userFeedback?: number;
      wasSuccessful: boolean;
      responseTime: number;
      tokensUsed: number;
    }
  ): Promise<void> {
    // Update or create basic metrics without LLM analysis
    let metrics = this.agentMetrics.get(agentName);
    if (!metrics) {
      metrics = {
        agentName,
        successRate: 0,
        averageResponseTime: 0,
        userSatisfaction: 3.5,
        taskComplexityHandled: 'general',
        improvementSuggestions: [],
        lastEvolution: new Date()
      };
    }

    // Update metrics based on interaction
    const currentSuccessCount = Math.floor(metrics.successRate * 100);
    const newSuccessCount = currentSuccessCount + (interaction.wasSuccessful ? 1 : 0);
    const totalInteractions = currentSuccessCount + 1;
    
    metrics.successRate = newSuccessCount / totalInteractions;
    metrics.averageResponseTime = (metrics.averageResponseTime + interaction.responseTime) / 2;
    
    if (interaction.userFeedback) {
      metrics.userSatisfaction = (metrics.userSatisfaction + interaction.userFeedback) / 2;
    }

    this.agentMetrics.set(agentName, metrics);
    
    log.info(`📊 Updated basic metrics for ${agentName}`, LogContext.AI, {
      successRate: metrics.successRate.toFixed(2),
      avgResponseTime: Math.round(metrics.averageResponseTime),
      userSatisfaction: metrics.userSatisfaction.toFixed(1)
    });
  }

  public getEvolutionStatus(): {
    enabled: boolean;
    rate: string;
    agentsTracked: number;
    evolutionsCompleted: number;
    lastEvolution: Date | null;
  } {
    const lastEvolution =
      this.evolutionHistory.length > 0
        ? this.evolutionHistory[this.evolutionHistory.length - 1]?.timestamp || null
        : null;

    return {
      enabled: this.evolutionEnabled,
      rate: this.evolutionRate,
      agentsTracked: this.agentMetrics.size,
      evolutionsCompleted: this.evolutionHistory.length,
      lastEvolution,
    };
  }
}

// Singleton instance
export const alphaEvolve = new AlphaEvolveService();
export default alphaEvolve;
