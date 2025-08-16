/**
 * Multi-Tier Model Router Agent
 * Domain-specific agent for intelligent model selection and tier routing
 * Optimizes model choice based on query complexity and performance requirements
 */

import type { AgentConfig, AgentContext, AgentResponse } from '@/types';
import { log, LogContext } from '@/utils/logger';

import { EnhancedBaseAgent } from '../enhanced-base-agent';

interface RouterContext extends AgentContext {
  complexityHint?: 'simple' | 'medium' | 'complex' | 'expert';
  performanceTarget?: 'speed' | 'quality' | 'balanced' | 'cost_efficient';
  domain?: 'general' | 'code' | 'reasoning' | 'creative' | 'analysis';
  maxLatency?: number; // milliseconds
  qualityThreshold?: number; // 0-1
  fallbackEnabled?: boolean;
}

interface ModelTier {
  tier: number;
  name: string;
  model: string;
  provider: string;
  efficiency: number; // pts/sec or similar metric
  cost: number; // relative cost
  specialization: string[];
  latency: number; // avg response time ms
  quality: number; // quality score 0-1
}

interface RoutingDecision {
  selectedTier: number;
  selectedModel: ModelTier;
  reasoning: string;
  confidence: number;
  alternatives: ModelTier[];
  estimatedMetrics: {
    latency: number;
    quality: number;
    cost: number;
    efficiency: number;
  };
}

interface RouterResponse extends AgentResponse {
  data: {
    routingDecision: RoutingDecision;
    execution?: {
      actualLatency: number;
      actualQuality: number;
      actualCost: number;
      modelResponse: any;
    };
    optimization?: {
      routingAccuracy: number;
      performanceGain: number;
      costSavings: number;
      recommendedAdjustments: string[];
    };
    fallbackUsed?: boolean;
    tierPerformanceHistory: {
      tier: number;
      successRate: number;
      avgLatency: number;
      avgQuality: number;
    }[];
  };
}

export class MultiTierRouterAgent extends EnhancedBaseAgent {
  private modelTiers: ModelTier[] = [
    {
      tier: 1,
      name: 'Gemma 2B',
      model: 'gemma:2b',
      provider: 'ollama',
      efficiency: 25.0,
      cost: 0.1,
      specialization: ['simple_qa', 'basic_text'],
      latency: 800,
      quality: 0.65
    },
    {
      tier: 2,
      name: 'LFM2 8B',
      model: 'lfm2:8b',
      provider: 'local',
      efficiency: 18.0,
      cost: 0.2,
      specialization: ['reasoning', 'analysis'],
      latency: 1200,
      quality: 0.78
    },
    {
      tier: 3,
      name: 'Qwen2.5 Coder 14B MLX',
      model: 'qwen2.5-coder-14b-instruct-mlx',
      provider: 'lm-studio',
      efficiency: 16.0,
      cost: 0.3,
      specialization: ['code', 'technical', 'detailed_analysis'],
      latency: 1800,
      quality: 0.88
    },
    {
      tier: 4,
      name: 'Qwen3 Coder 30B',
      model: 'qwen/qwen3-coder-30b',
      provider: 'lm-studio',
      efficiency: 12.5,
      cost: 0.5,
      specialization: ['complex_code', 'deep_reasoning', 'expert_analysis'],
      latency: 3000,
      quality: 0.92
    },
    {
      tier: 3,
      name: 'DeepSeek R1 14B',
      model: 'deepseek-r1:14b',
      provider: 'ollama',
      efficiency: 14.2,
      cost: 0.3,
      specialization: ['r1_reasoning', 'multi_step', 'complex_reasoning'],
      latency: 2200,
      quality: 0.90
    }
  ];

  private routingHistory: Array<{
    context: RouterContext;
    decision: RoutingDecision;
    actualMetrics: any;
    success: boolean;
    timestamp: number;
  }> = [];

  private tierMetrics = new Map<number, {
    totalRequests: number;
    successCount: number;
    totalLatency: number;
    totalQuality: number;
    lastUsed: number;
  }>();

  constructor(config: AgentConfig) {
    super({
      ...config,
      name: 'multi_tier_router',
      description: 'Intelligent multi-tier model routing and selection agent',
      capabilities: [
        { name: 'tier_routing', description: 'Route queries to optimal model tiers', inputSchema: {}, outputSchema: {} },
        { name: 'complexity_analysis', description: 'Analyze query complexity for routing', inputSchema: {}, outputSchema: {} },
        { name: 'performance_optimization', description: 'Optimize routing based on performance metrics', inputSchema: {}, outputSchema: {} },
        { name: 'cost_optimization', description: 'Balance cost and quality in model selection', inputSchema: {}, outputSchema: {} },
        { name: 'fallback_management', description: 'Handle model failures with intelligent fallbacks', inputSchema: {}, outputSchema: {} }
      ]
    });

    // Initialize tier metrics
    this.modelTiers.forEach(tier => {
      if (!this.tierMetrics.has(tier.tier)) {
        this.tierMetrics.set(tier.tier, {
          totalRequests: 0,
          successCount: 0,
          totalLatency: 0,
          totalQuality: 0,
          lastUsed: 0
        });
      }
    });
  }

  protected buildSystemPrompt(): string {
    return `You are a specialized Multi-Tier Model Router Agent with expertise in:

ROUTING INTELLIGENCE:
- Query complexity analysis and classification
- Performance vs cost optimization
- Model capability matching
- Latency and quality prediction
- Intelligent fallback strategies

MODEL TIER ARCHITECTURE:
Tier 1: Fast, lightweight models (Gemma 2B) - Simple queries, speed-critical
Tier 2: Balanced models (LFM2 8B) - General reasoning, balanced performance  
Tier 3: Specialized models (Qwen2.5 Coder 14B, DeepSeek R1) - Technical/reasoning tasks
Tier 4: Heavy models (Qwen3 Coder 30B) - Complex analysis, expert-level tasks

ROUTING DECISION FACTORS:
1. Query Complexity: Syntax analysis, domain detection, reasoning requirements
2. Performance Target: Speed vs quality optimization
3. Domain Specialization: Code, reasoning, creative, analysis
4. Resource Constraints: Latency limits, cost considerations
5. Historical Performance: Success rates, actual vs predicted metrics

OPTIMIZATION STRATEGIES:
- Dynamic tier selection based on real-time performance
- Predictive latency and quality estimation
- Cost-aware routing for efficiency
- Learning from routing outcomes
- Intelligent cascade fallbacks

OUTPUT REQUIREMENTS:
- Clear routing decision with tier and model selection
- Detailed reasoning for the choice
- Estimated performance metrics
- Alternative options considered
- Fallback strategies if primary fails

Focus on optimal resource utilization while maintaining quality standards.`;
  }

  protected getInternalModelName(): string {
    // Use efficient model for routing decisions
    return 'qwen2.5-coder-14b-instruct-mlx';
  }

  protected getTemperature(): number {
    return 0.2; // Low temperature for consistent routing decisions
  }

  protected getMaxTokens(): number {
    return 800; // Concise routing analysis
  }

  protected getContextTypes(): string[] {
    return ['routing_patterns', 'model_performance', 'query_complexity', 'optimization_history'];
  }

  protected getAdditionalContext(context: AgentContext): string | null {
    const routerContext = context as RouterContext;
    
    let additional = 'ROUTING CONFIGURATION:\n';
    additional += `Complexity Hint: ${routerContext.complexityHint || 'auto-detect'}\n`;
    additional += `Performance Target: ${routerContext.performanceTarget || 'balanced'}\n`;
    additional += `Domain: ${routerContext.domain || 'general'}\n`;
    additional += `Max Latency: ${routerContext.maxLatency || 'no limit'}\n`;
    additional += `Quality Threshold: ${routerContext.qualityThreshold || 0.8}\n`;
    additional += `Fallback Enabled: ${routerContext.fallbackEnabled !== false}\n\n`;

    // Add tier performance summary
    additional += 'TIER PERFORMANCE SUMMARY:\n';
    for (const [tier, metrics] of Array.from(this.tierMetrics.entries())) {
      if (metrics.totalRequests > 0) {
        const successRate = (metrics.successCount / metrics.totalRequests * 100).toFixed(1);
        const avgLatency = (metrics.totalLatency / metrics.totalRequests).toFixed(0);
        const avgQuality = (metrics.totalQuality / metrics.totalRequests).toFixed(2);
        additional += `Tier ${tier}: ${successRate}% success, ${avgLatency}ms avg, ${avgQuality} quality\n`;
      }
    }

    return additional;
  }

  public async execute(context: AgentContext): Promise<RouterResponse> {
    const routerContext = context as RouterContext;
    const startTime = Date.now();
    
    try {
      log.info('🎯 Multi-tier router analyzing query for optimal routing', LogContext.AGENT, {
        userRequest: (context as AgentContext).userRequest.substring(0, 100),
        performanceTarget: routerContext.performanceTarget,
        domain: routerContext.domain
      });

      // Step 1: Analyze query complexity and requirements
      const complexityAnalysis = await this.analyzeQueryComplexity(routerContext);
      
      // Step 2: Make routing decision
      const routingDecision = await this.makeRoutingDecision(complexityAnalysis, routerContext);
      
      // Step 3: Execute with selected model (if requested)
      let execution;
      if ((routerContext as AgentContext).userRequest.toLowerCase().includes('execute') || 
          (routerContext as AgentContext).userRequest.toLowerCase().includes('run')) {
        execution = await this.executeWithSelectedModel(routingDecision, routerContext);
      }

      // Step 4: Update metrics and learn from decision
      await this.updateRoutingMetrics(routingDecision, execution, routerContext);

      // Step 5: Generate optimization recommendations
      const optimization = await this.generateOptimizationRecommendations();

      const response = this.createSuccessResponse(
        {
          routingDecision,
          execution,
          optimization,
          fallbackUsed: execution?.usedFallback || false,
          tierPerformanceHistory: this.getTierPerformanceHistory()
        },
        `Optimal routing decision: ${routingDecision.selectedModel.name} (Tier ${routingDecision.selectedTier})`,
        routingDecision.confidence,
        `Selected ${routingDecision.selectedModel.name} based on ${routingDecision.reasoning}`
      );

      log.info('✅ Multi-tier routing completed', LogContext.AGENT, {
        selectedTier: routingDecision.selectedTier,
        selectedModel: routingDecision.selectedModel.name,
        confidence: routingDecision.confidence,
        estimatedLatency: routingDecision.estimatedMetrics.latency
      });

      return response as RouterResponse;

    } catch (error) {
      log.error('❌ Multi-tier routing failed', LogContext.AGENT, {
        error: error instanceof Error ? error.message : String(error)
      });

      return this.createRouterErrorResponse(
        'Multi-tier routing failed',
        `Error in routing analysis: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async analyzeQueryComplexity(context: RouterContext): Promise<{
    complexity: 'simple' | 'medium' | 'complex' | 'expert';
    domain: string;
    reasoningRequired: boolean;
    technicalContent: boolean;
    estimatedTokens: number;
  }> {
    const userRequest = (context as AgentContext).userRequest.toLowerCase();
    
    // Domain detection
    let domain = context.domain || 'general';
    if (userRequest.includes('code') || userRequest.includes('function') || userRequest.includes('bug')) {
      domain = 'code';
    } else if (userRequest.includes('reason') || userRequest.includes('analyze') || userRequest.includes('think')) {
      domain = 'reasoning';
    } else if (userRequest.includes('create') || userRequest.includes('write') || userRequest.includes('design')) {
      domain = 'creative';
    }

    // Complexity analysis
    let complexity = context.complexityHint || 'medium';
    if (!context.complexityHint) {
      // Auto-detect complexity
      const complexityIndicators = {
        simple: ['what is', 'define', 'list', 'show me', 'simple'],
        medium: ['explain', 'how to', 'why', 'compare', 'analyze'],
        complex: ['design', 'implement', 'optimize', 'architecture', 'algorithm'],
        expert: ['research', 'comprehensive', 'advanced', 'detailed analysis', 'thesis']
      };

      for (const [level, indicators] of Object.entries(complexityIndicators)) {
        if (indicators.some(indicator => userRequest.includes(indicator))) {
          complexity = level as any;
          break;
        }
      }
    }

    // Technical content detection
    const technicalKeywords = ['api', 'database', 'server', 'client', 'protocol', 'algorithm', 'data structure'];
    const technicalContent = technicalKeywords.some(keyword => userRequest.includes(keyword));

    // Reasoning requirement detection
    const reasoningKeywords = ['because', 'therefore', 'analyze', 'compare', 'evaluate', 'reasoning'];
    const reasoningRequired = reasoningKeywords.some(keyword => userRequest.includes(keyword));

    // Estimate token requirements
    const estimatedTokens = Math.max(100, (context as AgentContext).userRequest.length * 0.75); // Rough estimation

    return {
      complexity: complexity as any,
      domain,
      reasoningRequired,
      technicalContent,
      estimatedTokens
    };
  }

  private async makeRoutingDecision(
    analysis: any,
    context: RouterContext
  ): Promise<RoutingDecision> {
    // Filter models based on domain specialization
    let candidateModels = this.modelTiers.filter(model => {
      if (analysis.domain === 'code') {
        return model.specialization.some(spec => 
          spec.includes('code') || spec.includes('technical')
        );
      }
      if (analysis.domain === 'reasoning') {
        return model.specialization.some(spec => 
          spec.includes('reasoning') || spec.includes('analysis')
        );
      }
      return true; // General domain accepts all models
    });

    // Apply constraints
    if (context.maxLatency) {
      candidateModels = candidateModels.filter(model => model.latency <= context.maxLatency!);
    }

    if (context.qualityThreshold) {
      candidateModels = candidateModels.filter(model => model.quality >= context.qualityThreshold!);
    }

    // Score models based on requirements
    const scoredModels = candidateModels.map(model => {
      let score = 0;

      // Base quality score
      score += model.quality * 30;

      // Performance target scoring
      switch (context.performanceTarget) {
        case 'speed':
          score += (1 / model.latency) * 1000 * 25; // Higher score for lower latency
          score += model.efficiency * 10;
          break;
        case 'quality':
          score += model.quality * 40;
          score += (model.tier >= 3 ? 10 : 0); // Bonus for higher tiers
          break;
        case 'cost_efficient':
          score += (1 / model.cost) * 20; // Higher score for lower cost
          score += model.efficiency * 15;
          break;
        default: // balanced
          score += model.quality * 25;
          score += model.efficiency * 10;
          score += (1 / model.cost) * 10;
          break;
      }

      // Complexity matching
      const complexityTierMapping = {
        simple: [1, 2],
        medium: [2, 3],
        complex: [3, 4],
        expert: [4]
      };

      const idealTiers = complexityTierMapping[analysis.complexity as keyof typeof complexityTierMapping] || [2, 3];
      if (idealTiers.includes(model.tier)) {
        score += 15;
      }

      // Domain specialization bonus
      const domainBonus = model.specialization.filter(spec => 
        analysis.domain === 'code' && spec.includes('code') ||
        analysis.domain === 'reasoning' && (spec.includes('reasoning') || spec.includes('r1'))
      ).length * 5;

      score += domainBonus;

      // Historical performance adjustment
      const tierMetrics = this.tierMetrics.get(model.tier);
      if (tierMetrics && tierMetrics.totalRequests > 0) {
        const successRate = tierMetrics.successCount / tierMetrics.totalRequests;
        score += successRate * 10;
      }

      return { model, score };
    });

    // Select best model
    scoredModels.sort((a, b) => b.score - a.score);
    const selectedModel = scoredModels[0]?.model;

    if (!selectedModel) {
      throw new Error('No suitable model found for the given constraints');
    }

    // Build reasoning
    const reasoning = this.buildRoutingReasoning(selectedModel, analysis, context, scoredModels);

    // Estimate metrics
    const estimatedMetrics = {
      latency: selectedModel.latency,
      quality: selectedModel.quality,
      cost: selectedModel.cost,
      efficiency: selectedModel.efficiency
    };

    // Calculate confidence
    const confidence = this.calculateRoutingConfidence(selectedModel, analysis, scoredModels);

    return {
      selectedTier: selectedModel.tier,
      selectedModel,
      reasoning,
      confidence,
      alternatives: scoredModels.slice(1, 4).map(s => s.model),
      estimatedMetrics
    };
  }

  private buildRoutingReasoning(
    selectedModel: ModelTier,
    analysis: any,
    context: RouterContext,
    scoredModels: Array<{ model: ModelTier; score: number }>
  ): string {
    let reasoning = `Selected ${selectedModel.name} (Tier ${selectedModel.tier}) because:\n`;
    
    reasoning += `• Query complexity: ${analysis.complexity} - matches tier ${selectedModel.tier} capabilities\n`;
    reasoning += `• Domain: ${analysis.domain} - model specializes in ${selectedModel.specialization.join(', ')}\n`;
    reasoning += `• Performance target: ${context.performanceTarget || 'balanced'} - optimized for this goal\n`;
    
    if (context.maxLatency) {
      reasoning += `• Latency constraint: ${selectedModel.latency}ms ≤ ${context.maxLatency}ms\n`;
    }
    
    if (context.qualityThreshold) {
      reasoning += `• Quality requirement: ${selectedModel.quality} ≥ ${context.qualityThreshold}\n`;
    }

    reasoning += `• Efficiency: ${selectedModel.efficiency} pts/sec\n`;
    reasoning += `• Cost factor: ${selectedModel.cost} (relative)\n`;

    if (scoredModels.length > 1 && scoredModels[0]) {
      const topScore = scoredModels[0].score;
      const secondScore = scoredModels[1]?.score || 0;
      const margin = ((topScore - secondScore) / topScore * 100).toFixed(1);
      reasoning += `• Decision margin: ${margin}% better than next best option`;
    }

    return reasoning;
  }

  private calculateRoutingConfidence(
    selectedModel: ModelTier,
    analysis: any,
    scoredModels: Array<{ model: ModelTier; score: number }>
  ): number {
    let confidence = 0.7; // Base confidence

    // Historical performance boost
    const tierMetrics = this.tierMetrics.get(selectedModel.tier);
    if (tierMetrics && tierMetrics.totalRequests > 0) {
      const successRate = tierMetrics.successCount / tierMetrics.totalRequests;
      confidence += successRate * 0.2;
    }

    // Decision margin boost
    if (scoredModels.length > 1 && scoredModels[0]) {
      const topScore = scoredModels[0].score;
      const secondScore = scoredModels[1]?.score || 0;
      const margin = (topScore - secondScore) / topScore;
      confidence += margin * 0.15;
    }

    // Domain specialization boost
    const domainMatch = selectedModel.specialization.some(spec => 
      spec.includes(analysis.domain) || 
      (analysis.domain === 'reasoning' && spec.includes('r1'))
    );
    if (domainMatch) confidence += 0.1;

    return Math.min(0.95, Math.max(0.5, confidence));
  }

  private async executeWithSelectedModel(
    decision: RoutingDecision,
    context: RouterContext
  ): Promise<any> {
    const startTime = Date.now();
    
    try {
      // Call the selected model
      const response = await this.callSelectedModel(decision.selectedModel, (context as AgentContext).userRequest);
      const actualLatency = Date.now() - startTime;

      // Assess actual quality (simplified)
      const actualQuality = this.assessResponseQuality(response);

      return {
        actualLatency,
        actualQuality,
        actualCost: decision.selectedModel.cost,
        modelResponse: response,
        usedFallback: false
      };

    } catch (error) {
      log.warn('⚠️ Primary model failed, attempting fallback', LogContext.AGENT, {
        primaryModel: decision.selectedModel.name,
        error: error instanceof Error ? error.message : String(error)
      });

      if (context.fallbackEnabled !== false) {
        return await this.executeWithFallback(decision, context, startTime);
      } else {
        throw error;
      }
    }
  }

  private async callSelectedModel(model: ModelTier, userRequest: string): Promise<any> {
    // Simulate model calling based on provider
    switch (model.provider) {
      case 'lm-studio':
        const lmResponse = await fetch('http://localhost:5901/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: model.model,
            messages: [{ role: 'user', content: userRequest }],
            temperature: 0.3,
            max_tokens: 400
          }),
          signal: AbortSignal.timeout(10000)
        });

        if (lmResponse.ok) {
          const data = await lmResponse.json();
          return data.choices[0]?.message?.content || '';
        } else {
          throw new Error(`LM Studio API error: ${lmResponse.status}`);
        }

      case 'ollama':
        const ollamaResponse = await fetch('http://localhost:11434/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: model.model,
            prompt: userRequest,
            stream: false
          }),
          signal: AbortSignal.timeout(10000)
        });

        if (ollamaResponse.ok) {
          const data = await ollamaResponse.json();
          return data.response || '';
        } else {
          throw new Error(`Ollama API error: ${ollamaResponse.status}`);
        }

      default:
        // Fallback to simulated response
        return `Response from ${model.name}: ${userRequest.substring(0, 100)}... [simulated]`;
    }
  }

  private async executeWithFallback(
    originalDecision: RoutingDecision,
    context: RouterContext,
    startTime: number
  ): Promise<any> {
    // Select fallback model (next best alternative)
    const fallbackModel = originalDecision.alternatives[0];
    
    if (!fallbackModel) {
      throw new Error('No fallback model available');
    }

    try {
      const response = await this.callSelectedModel(fallbackModel, (context as AgentContext).userRequest);
      const actualLatency = Date.now() - startTime;
      const actualQuality = this.assessResponseQuality(response);

      return {
        actualLatency,
        actualQuality,
        actualCost: fallbackModel.cost,
        modelResponse: response,
        usedFallback: true,
        fallbackModel: fallbackModel.name
      };

    } catch (fallbackError) {
      throw new Error(`Both primary and fallback models failed: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`);
    }
  }

  private assessResponseQuality(response: string): number {
    // Simplified quality assessment
    let quality = 0.5; // Base quality

    if (response.length > 50) quality += 0.1;
    if (response.length > 200) quality += 0.1;
    if (response.includes('.') && response.split('.').length > 2) quality += 0.1; // Multiple sentences
    if (response.toLowerCase().includes('because') || response.toLowerCase().includes('therefore')) quality += 0.1; // Reasoning
    
    return Math.min(1.0, quality);
  }

  private async updateRoutingMetrics(
    decision: RoutingDecision,
    execution: any,
    context: RouterContext
  ): Promise<void> {
    // Update tier metrics
    const tierMetrics = this.tierMetrics.get(decision.selectedTier);
    if (tierMetrics) {
      tierMetrics.totalRequests++;
      tierMetrics.lastUsed = Date.now();
      
      if (execution) {
        if (execution.actualQuality > 0.6) {
          tierMetrics.successCount++;
        }
        tierMetrics.totalLatency += execution.actualLatency;
        tierMetrics.totalQuality += execution.actualQuality;
      }
    }

    // Store routing history
    this.routingHistory.push({
      context,
      decision,
      actualMetrics: execution,
      success: execution ? execution.actualQuality > 0.6 : false,
      timestamp: Date.now()
    });

    // Keep only last 100 routing decisions
    if (this.routingHistory.length > 100) {
      this.routingHistory = this.routingHistory.slice(-100);
    }
  }

  private async generateOptimizationRecommendations(): Promise<any> {
    const recommendations: string[] = [];
    let routingAccuracy = 0;
    let performanceGain = 0;
    const costSavings = 0;

    // Calculate routing accuracy
    const recentDecisions = this.routingHistory.slice(-20);
    if (recentDecisions.length > 0) {
      const successfulDecisions = recentDecisions.filter(d => d.success).length;
      routingAccuracy = successfulDecisions / recentDecisions.length;
    }

    // Generate recommendations based on metrics
    if (routingAccuracy < 0.8) {
      recommendations.push('Consider adjusting complexity detection algorithms');
    }

    // Check for underutilized tiers
    for (const [tier, metrics] of Array.from(this.tierMetrics.entries())) {
      if (metrics.totalRequests > 0) {
        const successRate = metrics.successCount / metrics.totalRequests;
        if (successRate < 0.7) {
          recommendations.push(`Tier ${tier} showing low success rate (${(successRate * 100).toFixed(1)}%)`);
        }
      }
    }

    // Performance and cost analysis
    const avgLatency = recentDecisions.reduce((sum, d) => 
      sum + (d.actualMetrics?.actualLatency || 0), 0) / Math.max(1, recentDecisions.length);

    if (avgLatency > 5000) {
      recommendations.push('Consider promoting faster models for latency-sensitive queries');
      performanceGain = 0.15; // Estimated 15% improvement
    }

    return {
      routingAccuracy,
      performanceGain,
      costSavings,
      recommendedAdjustments: recommendations
    };
  }

  private getTierPerformanceHistory(): Array<{
    tier: number;
    successRate: number;
    avgLatency: number;
    avgQuality: number;
  }> {
    return Array.from(this.tierMetrics.entries()).map(([tier, metrics]) => ({
      tier,
      successRate: metrics.totalRequests > 0 ? metrics.successCount / metrics.totalRequests : 0,
      avgLatency: metrics.totalRequests > 0 ? metrics.totalLatency / metrics.totalRequests : 0,
      avgQuality: metrics.totalRequests > 0 ? metrics.totalQuality / metrics.totalRequests : 0
    }));
  }

  // Get router-specific performance metrics
  public getRouterMetrics() {
    return {
      ...this.getPerformanceMetrics(),
      routingAccuracy: this.calculateRoutingAccuracy(),
      averageDecisionTime: this.calculateAverageDecisionTime(),
      tierUtilization: this.calculateTierUtilization(),
      fallbackRate: this.calculateFallbackRate()
    };
  }

  private calculateRoutingAccuracy(): number {
    if (this.routingHistory.length === 0) return 0;
    const successfulDecisions = this.routingHistory.filter(d => d.success).length;
    return successfulDecisions / this.routingHistory.length;
  }

  private calculateAverageDecisionTime(): number {
    // Placeholder - would track actual decision making time
    return 150; // Average 150ms for routing decisions
  }

  private calculateTierUtilization(): { [tier: number]: number } {
    const utilization: { [tier: number]: number } = {};
    const totalRequests = Array.from(this.tierMetrics.values())
      .reduce((sum, metrics) => sum + metrics.totalRequests, 0);

    for (const [tier, metrics] of Array.from(this.tierMetrics.entries())) {
      utilization[tier] = totalRequests > 0 ? metrics.totalRequests / totalRequests : 0;
    }

    return utilization;
  }

  private calculateFallbackRate(): number {
    const fallbackUsed = this.routingHistory.filter(d => 
      d.actualMetrics?.usedFallback === true
    ).length;
    
    return this.routingHistory.length > 0 ? fallbackUsed / this.routingHistory.length : 0;
  }

  // Type-safe helper methods for RouterResponse
  private createRouterSuccessResponse(
    data: RouterResponse['data'],
    message: string,
    confidence = 0.8,
    reasoning?: string
  ): RouterResponse {
    const baseResponse = this.createSuccessResponse(data, message, confidence, reasoning);
    return {
      ...baseResponse,
      data
    } as RouterResponse;
  }

  private createRouterErrorResponse(
    message: string,
    reasoning?: string
  ): RouterResponse {
    const baseResponse = this.createErrorResponse(message, reasoning);
    return {
      ...baseResponse,
      data: {
        routingDecision: {
          selectedTier: 1,
          selectedModel: this.modelTiers[0],
          reasoning: 'Error occurred during routing',
          confidence: 0,
          alternatives: [],
          estimatedMetrics: {
            latency: 0,
            quality: 0,
            cost: 0,
            efficiency: 0
          }
        },
        fallbackUsed: false,
        tierPerformanceHistory: []
      }
    } as RouterResponse;
  }
}

export default MultiTierRouterAgent;