/**
 * Dynamic Model Router
 * Routes requests to the best available model without hardcoding
 * Learns from performance and adapts over time
 */

import { toolTrainCodeSearchAgent } from '@/agents/specialized/tooltrain-code-search-agent';
import type { AgentContext } from '@/types';
import { log, LogContext } from '@/utils/logger';

import type { 
  DiscoveredModel, 
  TaskRequirements 
} from './model-discovery-service';
import { 
  modelDiscoveryService 
} from './model-discovery-service';

export interface RoutingDecision {
  primary: DiscoveredModel;
  fallbacks: DiscoveredModel[];
  reasoning: string;
  estimatedLatency: number;
  confidence: number;
  specializedAgent?: {
    name: string;
    type: 'code-search' | 'tooltrain-enhanced';
    confidence: number;
    reasoning: string;
  };
}

export interface PerformanceMetrics {
  modelId: string;
  provider: string;
  taskType: string;
  latencyMs: number;
  tokensPerSecond: number;
  success: boolean;
  quality?: number; // 0-1 scale, if measured
  timestamp: number;
}

export interface ModelPerformance {
  avgLatency: number;
  avgTokensPerSecond: number;
  successRate: number;
  avgQuality?: number;
  sampleCount: number;
}

export class DynamicModelRouter {
  private performanceHistory: Map<string, PerformanceMetrics[]> = new Map();
  private modelPerformance: Map<string, ModelPerformance> = new Map();
  private routingWeights: Map<string, number> = new Map();
  private maxHistoryPerModel = 100;
  private learningRate = 0.1;
  
  // ToolTrain-inspired code search routing
  private codeSearchPatterns: RegExp[] = [
    /find\s+(function|class|method|variable|import)/i,
    /search\s+(for\s+)?(code|function|class|method)/i,
    /locate\s+(the\s+)?(function|class|method|variable)/i,
    /where\s+(is\s+)?(function|class|method|variable|import)/i,
    /show\s+(me\s+)?(all\s+)?(usages?|references?)\s+of/i,
    /trace\s+(imports?|dependencies?|calls?)/i,
    /analyze\s+(function|class|method|code)/i,
    /understand\s+(how|what|why).*?(function|class|method)/i,
    /explain\s+(this\s+)?(function|class|method|code)/i,
    /debug\s+(this\s+)?(function|class|method|code)/i,
  ];
  
  private codeSearchKeywords = [
    'repository', 'codebase', 'source code', 'git', 'github',
    'function definition', 'class definition', 'method signature',
    'import statement', 'dependency', 'call chain', 'inheritance',
    'implementation', 'refactor', 'bug', 'error', 'stack trace'
  ];

  constructor() {
    this.loadPerformanceHistory();
    this.startPerformanceAnalysis();
  }

  /**
   * Route a request to the best available model
   */
  public async route(
    taskType: string,
    prompt: string,
    options?: {
      priority?: 'speed' | 'quality' | 'balanced';
      maxLatencyMs?: number;
      minQuality?: number;
      requiredCapabilities?: string[];
    }
  ): Promise<RoutingDecision> {
    // ToolTrain-inspired code search detection
    const codeSearchAnalysis = this.analyzeCodeSearchIntent(taskType, prompt);
    
    if (codeSearchAnalysis.isCodeSearch && codeSearchAnalysis.confidence > 0.7) {
      log.info('🔍 Code search detected - routing to ToolTrain agent', LogContext.AI, {
        confidence: codeSearchAnalysis.confidence,
        patterns: codeSearchAnalysis.matchedPatterns,
        keywords: codeSearchAnalysis.matchedKeywords,
      });
      
      // Create specialized routing decision for code search
      return this.createCodeSearchRoutingDecision(taskType, prompt, codeSearchAnalysis, options);
    }

    // Fall back to regular model routing
    const decision = await this.routeRegularTask(taskType, prompt, options);

    log.info('🎯 Routing decision made', LogContext.AI, {
      taskType,
      primary: `${decision.primary.provider}:${decision.primary.name}`,
      fallbackCount: decision.fallbacks.length,
      confidence: decision.confidence,
      estimatedLatency: decision.estimatedLatency,
    });

    return decision;
  }

  /**
   * Analyze if the request is a code search task inspired by ToolTrain
   */
  private analyzeCodeSearchIntent(taskType: string, prompt: string): {
    isCodeSearch: boolean;
    confidence: number;
    matchedPatterns: string[];
    matchedKeywords: string[];
    reasoning: string;
  } {
    const promptLower = prompt.toLowerCase();
    const taskTypeLower = taskType.toLowerCase();
    let confidence = 0;
    const matchedPatterns: string[] = [];
    const matchedKeywords: string[] = [];

    // Check task type indicators
    if (taskTypeLower.includes('code') || taskTypeLower.includes('search') || 
        taskTypeLower.includes('find') || taskTypeLower.includes('repository')) {
      confidence += 0.2;
    }

    // Check regex patterns
    for (const pattern of this.codeSearchPatterns) {
      if (pattern.test(prompt)) {
        confidence += 0.15;
        matchedPatterns.push(pattern.source);
      }
    }

    // Check keywords
    for (const keyword of this.codeSearchKeywords) {
      if (promptLower.includes(keyword.toLowerCase())) {
        confidence += 0.1;
        matchedKeywords.push(keyword);
      }
    }

    // Additional context clues
    const codeIndicators = [
      'function', 'class', 'method', 'variable', 'import', 'export',
      'interface', 'type', 'const', 'let', 'var', 'async', 'await',
      'return', 'throw', 'catch', 'try', 'extends', 'implements'
    ];

    let codeIndicatorCount = 0;
    for (const indicator of codeIndicators) {
      if (promptLower.includes(indicator)) {
        codeIndicatorCount++;
      }
    }

    if (codeIndicatorCount >= 2) {
      confidence += 0.2;
    } else if (codeIndicatorCount >= 1) {
      confidence += 0.1;
    }

    // File extension context
    const fileExtensions = ['.ts', '.js', '.py', '.java', '.cpp', '.c', '.go', '.rs', '.swift'];
    for (const ext of fileExtensions) {
      if (prompt.includes(ext)) {
        confidence += 0.1;
        break;
      }
    }

    // Repository navigation patterns
    const navPatterns = [
      'where is', 'find file', 'in the codebase', 'project structure',
      'source tree', 'module structure', 'package structure'
    ];
    for (const pattern of navPatterns) {
      if (promptLower.includes(pattern)) {
        confidence += 0.15;
        break;
      }
    }

    const isCodeSearch = confidence > 0.5; // Threshold for considering it a code search
    confidence = Math.min(1.0, confidence); // Cap at 1.0

    let reasoning = '';
    if (isCodeSearch) {
      reasoning = `Detected code search task with ${confidence.toFixed(2)} confidence. `;
      if (matchedPatterns.length > 0) {
        reasoning += `Matched patterns: ${matchedPatterns.length}. `;
      }
      if (matchedKeywords.length > 0) {
        reasoning += `Found keywords: ${matchedKeywords.slice(0, 3).join(', ')}. `;
      }
      reasoning += `Code indicators: ${codeIndicatorCount}.`;
    } else {
      reasoning = `Low confidence (${confidence.toFixed(2)}) for code search classification.`;
    }

    return {
      isCodeSearch,
      confidence,
      matchedPatterns,
      matchedKeywords,
      reasoning,
    };
  }

  /**
   * Create specialized routing decision for code search tasks
   */
  private async createCodeSearchRoutingDecision(
    taskType: string,
    prompt: string,
    codeSearchAnalysis: any,
    options?: any
  ): Promise<RoutingDecision> {
    // Get regular model routing as fallback
    const regularDecision = await this.routeRegularTask(taskType, prompt, options);

    // Create specialized agent routing
    const specializedAgent = {
      name: 'tooltrain-code-search-agent',
      type: 'code-search' as const,
      confidence: codeSearchAnalysis.confidence,
      reasoning: `ToolTrain-inspired code search agent selected. ${codeSearchAnalysis.reasoning}`,
    };

    // Enhanced routing decision with specialized agent
    const decision: RoutingDecision = {
      ...regularDecision,
      specializedAgent,
      reasoning: `Code search detected - routing to ToolTrain agent (${(codeSearchAnalysis.confidence * 100).toFixed(1)}% confidence). Fallback: ${regularDecision.reasoning}`,
      estimatedLatency: regularDecision.estimatedLatency * 0.8, // ToolTrain agent may be faster for code search
      confidence: Math.max(regularDecision.confidence, codeSearchAnalysis.confidence),
    };

    log.info('🎯 Code search routing decision created', LogContext.AI, {
      agentType: 'tooltrain-code-search',
      confidence: codeSearchAnalysis.confidence,
      fallbackModel: `${regularDecision.primary.provider}:${regularDecision.primary.name}`,
      estimatedLatency: decision.estimatedLatency,
    });

    return decision;
  }

  /**
   * Route task through regular model selection (extracted from original route method)
   */
  private async routeRegularTask(
    taskType: string,
    prompt: string,
    options?: any
  ): Promise<RoutingDecision> {
    // Build task requirements from inputs
    const requirements: TaskRequirements = {
      type: taskType,
      needs: options?.requiredCapabilities || this.inferCapabilities(taskType, prompt),
      priority: options?.priority || 'balanced',
      complexity: this.estimateComplexity(prompt),
      maxLatencyMs: options?.maxLatencyMs,
      minQuality: options?.minQuality,
    };

    // Get available models
    const models = modelDiscoveryService.getModels();
    
    if (models.length === 0) {
      throw new Error('No models available');
    }

    // Score all models for this task
    const scores = models.map(model => ({
      model,
      score: this.scoreModel(model, requirements, prompt),
      estimatedLatency: this.estimateLatency(model, prompt.length),
    }));

    // Sort by score
    scores.sort((a, b) => b.score - a.score);

    // Select primary and fallbacks
    const primaryScore = scores[0];
    if (!primaryScore) {
      throw new Error('No suitable models found for routing');
    }
    
    const primary = primaryScore.model;
    const fallbacks = this.selectFallbacks(scores.slice(1), primary, requirements);

    const decision: RoutingDecision = {
      primary,
      fallbacks,
      reasoning: this.explainDecision(primary, requirements, primaryScore.score),
      estimatedLatency: primaryScore.estimatedLatency,
      confidence: this.calculateConfidence(scores),
    };

    return decision;
  }

  /**
   * Score a model for the given requirements
   */
  private scoreModel(
    model: DiscoveredModel,
    requirements: TaskRequirements,
    prompt: string
  ): number {
    let score = 0;

    // Base score from model discovery service
    const baseScore = modelDiscoveryService['scoreModel'](model, requirements);
    score += baseScore;

    // Performance-based adjustments
    const perfKey = `${model.provider}:${model.id}`;
    const performance = this.modelPerformance.get(perfKey);
    
    if (performance) {
      // Success rate weight
      score += performance.successRate * 20;

      // Latency consideration
      if (requirements.priority === 'speed') {
        const latencyScore = Math.max(0, 100 - (performance.avgLatency / 100));
        score += latencyScore * 0.3;
      }

      // Quality consideration
      if (requirements.priority === 'quality' && performance.avgQuality) {
        score += performance.avgQuality * 30;
      }

      // Throughput bonus
      score += Math.min(20, performance.avgTokensPerSecond / 10);
    }

    // Learned routing weights
    const weightKey = `${requirements.type}:${model.id}`;
    const learnedWeight = this.routingWeights.get(weightKey) || 1.0;
    score *= learnedWeight;

    // Context length penalty for very long prompts
    const estimatedTokens = prompt.length / 4;
    if (estimatedTokens > 2000 && model.tier < 3) {
      score *= 0.7; // Penalize small models for long contexts
    }

    // Provider availability bonus
    const providerStatus = modelDiscoveryService.getProviderStatus();
    if (providerStatus.get(model.provider)) {
      score += 5; // Small bonus for confirmed available providers
    }

    return score;
  }

  /**
   * Select fallback models
   */
  private selectFallbacks(
    candidates: Array<{ model: DiscoveredModel; score: number }>,
    primary: DiscoveredModel,
    requirements: TaskRequirements
  ): DiscoveredModel[] {
    const fallbacks: DiscoveredModel[] = [];
    const usedProviders = new Set([primary.provider]);
    const usedTiers = new Set([primary.tier]);

    for (const candidate of candidates) {
      // Skip if we have enough fallbacks
      if (fallbacks.length >= 2) {break;}

      // Prefer different providers for resilience
      const differentProvider = !usedProviders.has(candidate.model.provider);
      
      // Prefer different tiers for variety
      const differentTier = !usedTiers.has(candidate.model.tier);

      // Must have required capabilities
      const hasCapabilities = requirements.needs.every(need => 
        candidate.model.capabilities.includes(need)
      );

      if (hasCapabilities && (differentProvider || differentTier)) {
        fallbacks.push(candidate.model);
        usedProviders.add(candidate.model.provider);
        usedTiers.add(candidate.model.tier);
      }
    }

    // If we don't have enough fallbacks, add any capable model
    if (fallbacks.length < 2) {
      for (const candidate of candidates) {
        if (fallbacks.length >= 2) {break;}
        if (!fallbacks.includes(candidate.model)) {
          const hasCapabilities = requirements.needs.every(need => 
            candidate.model.capabilities.includes(need)
          );
          if (hasCapabilities) {
            fallbacks.push(candidate.model);
          }
        }
      }
    }

    return fallbacks;
  }

  /**
   * Track performance of a model
   */
  public async trackPerformance(
    model: DiscoveredModel,
    taskType: string,
    metrics: {
      latencyMs: number;
      tokensGenerated: number;
      success: boolean;
      quality?: number;
    }
  ): Promise<void> {
    const perfMetric: PerformanceMetrics = {
      modelId: model.id,
      provider: model.provider,
      taskType,
      latencyMs: metrics.latencyMs,
      tokensPerSecond: (metrics.tokensGenerated / metrics.latencyMs) * 1000,
      success: metrics.success,
      quality: metrics.quality,
      timestamp: Date.now(),
    };

    // Add to history
    const key = `${model.provider}:${model.id}`;
    const history = this.performanceHistory.get(key) || [];
    history.push(perfMetric);

    // Keep only recent history
    if (history.length > this.maxHistoryPerModel) {
      history.shift();
    }
    this.performanceHistory.set(key, history);

    // Update aggregated performance
    this.updateModelPerformance(key, history);

    // Update routing weights based on performance
    this.updateRoutingWeights(model, taskType, metrics);

    // Persist to storage
    await this.savePerformanceHistory();
  }

  /**
   * Update aggregated model performance
   */
  private updateModelPerformance(key: string, history: PerformanceMetrics[]): void {
    if (history.length === 0) {return;}

    const recent = history.slice(-20); // Focus on recent performance
    
    const avgLatency = recent.reduce((sum, m) => sum + m.latencyMs, 0) / recent.length;
    const avgTokensPerSecond = recent.reduce((sum, m) => sum + m.tokensPerSecond, 0) / recent.length;
    const successRate = recent.filter(m => m.success).length / recent.length;
    
    const qualityMetrics = recent.filter(m => m.quality !== undefined);
    const avgQuality = qualityMetrics.length > 0
      ? qualityMetrics.reduce((sum, m) => sum + m.quality!, 0) / qualityMetrics.length
      : undefined;

    this.modelPerformance.set(key, {
      avgLatency,
      avgTokensPerSecond,
      successRate,
      avgQuality,
      sampleCount: history.length,
    });
  }

  /**
   * Update routing weights using simple reinforcement learning
   */
  private updateRoutingWeights(
    model: DiscoveredModel,
    taskType: string,
    metrics: { success: boolean; quality?: number }
  ): void {
    const key = `${taskType}:${model.id}`;
    const currentWeight = this.routingWeights.get(key) || 1.0;

    // Calculate reward/penalty
    let adjustment = 0;
    if (metrics.success) {
      adjustment = 0.1; // Base reward for success
      if (metrics.quality !== undefined) {
        adjustment *= metrics.quality; // Scale by quality
      }
    } else {
      adjustment = -0.2; // Penalty for failure
    }

    // Apply learning rate
    const newWeight = currentWeight + (adjustment * this.learningRate);
    
    // Clamp between 0.1 and 2.0
    this.routingWeights.set(key, Math.max(0.1, Math.min(2.0, newWeight)));
  }

  /**
   * Infer required capabilities from task type and prompt
   */
  private inferCapabilities(taskType: string, prompt: string): string[] {
    const capabilities: string[] = ['general'];

    // Task type based
    if (taskType.includes('code') || taskType.includes('programming')) {
      capabilities.push('code_generation', 'debugging');
    }
    if (taskType.includes('chat') || taskType.includes('conversation')) {
      capabilities.push('conversation', 'instruction_following');
    }
    if (taskType.includes('analysis') || taskType.includes('reasoning')) {
      capabilities.push('reasoning', 'analysis');
    }
    if (taskType.includes('creative') || taskType.includes('writing')) {
      capabilities.push('creative_writing');
    }

    // Prompt content based
    const promptLower = prompt.toLowerCase();
    if (promptLower.includes('debug') || promptLower.includes('error') || promptLower.includes('fix')) {
      capabilities.push('debugging');
    }
    if (promptLower.includes('explain') || promptLower.includes('why') || promptLower.includes('how')) {
      capabilities.push('reasoning');
    }
    if (promptLower.includes('write') || promptLower.includes('create') || promptLower.includes('generate')) {
      capabilities.push('creative_writing');
    }
    if (promptLower.includes('code') || promptLower.includes('function') || promptLower.includes('class')) {
      capabilities.push('code_generation');
    }

    return [...new Set(capabilities)];
  }

  /**
   * Estimate task complexity
   */
  private estimateComplexity(prompt: string): number {
    let complexity = 0.3; // Base complexity

    // Length factor
    const words = prompt.split(/\s+/).length;
    if (words > 100) {complexity += 0.2;}
    if (words > 300) {complexity += 0.2;}

    // Question complexity
    const complexIndicators = [
      'analyze', 'explain', 'compare', 'evaluate', 'design',
      'implement', 'optimize', 'debug', 'refactor', 'architect'
    ];
    
    const promptLower = prompt.toLowerCase();
    for (const indicator of complexIndicators) {
      if (promptLower.includes(indicator)) {
        complexity += 0.1;
      }
    }

    // Code presence
    if (prompt.includes('```') || prompt.includes('function') || prompt.includes('class')) {
      complexity += 0.2;
    }

    return Math.min(1.0, complexity);
  }

  /**
   * Estimate latency for a model
   */
  private estimateLatency(model: DiscoveredModel, promptLength: number): number {
    // Base estimate from tier
    let baseLatency = 0;
    switch (model.tier) {
      case 1: baseLatency = 100; break;
      case 2: baseLatency = 300; break;
      case 3: baseLatency = 1000; break;
      case 4: baseLatency = 3000; break;
    }

    // Adjust based on historical performance
    const perfKey = `${model.provider}:${model.id}`;
    const performance = this.modelPerformance.get(perfKey);
    if (performance) {
      baseLatency = performance.avgLatency;
    }

    // Scale by prompt length
    const tokens = promptLength / 4;
    const scaleFactor = 1 + (tokens / 1000) * 0.5;

    return Math.round(baseLatency * scaleFactor);
  }

  /**
   * Explain routing decision
   */
  private explainDecision(
    model: DiscoveredModel,
    requirements: TaskRequirements,
    score: number
  ): string {
    const reasons: string[] = [];

    reasons.push(`Selected ${model.name} (${model.provider})`);
    reasons.push(`Tier ${model.tier} model with ${model.estimatedSpeed} speed`);
    
    if (requirements.priority === 'speed') {
      reasons.push('Optimized for fast response time');
    } else if (requirements.priority === 'quality') {
      reasons.push('Optimized for response quality');
    }

    const performance = this.modelPerformance.get(`${model.provider}:${model.id}`);
    if (performance) {
      reasons.push(`Historical: ${Math.round(performance.avgLatency)}ms avg, ${Math.round(performance.successRate * 100)}% success`);
    }

    reasons.push(`Capabilities: ${model.capabilities.slice(0, 3).join(', ')}`);
    reasons.push(`Score: ${Math.round(score)}`);

    return reasons.join('. ');
  }

  /**
   * Calculate routing confidence
   */
  private calculateConfidence(scores: Array<{ score: number }>): number {
    if (scores.length === 0) {return 0;}
    if (scores.length === 1) {return 0.5;}

    const topScore = scores[0]?.score ?? 0;
    const secondScore = scores[1]?.score ?? 0;
    
    // Confidence based on score separation
    const separation = (topScore - secondScore) / topScore;
    return Math.min(0.95, 0.5 + separation);
  }

  /**
   * Load performance history from storage
   */
  private async loadPerformanceHistory(): Promise<void> {
    try {
      // Performance history persistence not implemented - starts fresh each session
      // Consider adding Supabase integration for performance metrics storage
      log.info('Performance history initialized', LogContext.AI);
    } catch (error) {
      log.warn('Failed to load performance history', LogContext.AI, { error });
    }
  }

  /**
   * Save performance history to storage
   */
  private async savePerformanceHistory(): Promise<void> {
    try {
      // Performance history persistence not implemented
    } catch (error) {
      log.warn('Failed to save performance history', LogContext.AI, { error });
    }
  }

  /**
   * Start periodic performance analysis
   */
  private startPerformanceAnalysis(): void {
    setInterval(() => {
      this.analyzePerformanceTrends();
    }, 60000); // Every minute
  }

  /**
   * Analyze performance trends and adjust routing
   */
  private analyzePerformanceTrends(): void {
    for (const [key, performance] of this.modelPerformance.entries()) {
      if (performance.sampleCount < 5) {continue;}

      // Alert on poor performance
      if (performance.successRate < 0.5) {
        log.warn('Model performing poorly', LogContext.AI, {
          model: key,
          successRate: performance.successRate,
          samples: performance.sampleCount,
        });
      }

      // Alert on slow performance
      if (performance.avgLatency > 5000) {
        log.warn('Model responding slowly', LogContext.AI, {
          model: key,
          avgLatency: performance.avgLatency,
          samples: performance.sampleCount,
        });
      }
    }
  }

  /**
   * Execute ToolTrain code search agent directly
   */
  public async executeCodeSearchAgent(
    prompt: string,
    context?: any
  ): Promise<{
    success: boolean;
    response: any;
    metrics: {
      executionTime: number;
      toolsUsed: number;
      searchDepth: number;
      confidence: number;
    };
  }> {
    const startTime = Date.now();
    
    try {
      const agentContext = {
        input: prompt,
        metadata: {
          source: 'dynamic-router',
          codeSearchTask: true,
          ...context,
        },
      };

      const agent = new toolTrainCodeSearchAgent({
        name: 'ToolTrain Code Search Agent',
        description: 'Specialized code search and repository navigation agent',
        priority: 1,
        capabilities: [],
        maxLatencyMs: 30000,
        retryAttempts: 3,
        dependencies: []
      });

      const agentContextFixed: AgentContext = {
        userRequest: agentContext.input,
        requestId: `code-search-${Date.now()}`,
        metadata: agentContext.metadata
      };

      const response = await agent.execute(agentContextFixed);
      
      const executionTime = Date.now() - startTime;
      
      // Track performance for the ToolTrain agent
      await this.trackCodeSearchAgentPerformance({
        prompt,
        response,
        executionTime,
        success: response.success,
      });

      return {
        success: response.success,
        response: response.data,
        metrics: {
          executionTime,
          toolsUsed: (response.metadata?.toolsUsed as number) || 0,
          searchDepth: (response.metadata?.searchDepth as number) || 0,
          confidence: response.confidence || 0.8,
        },
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      log.error('ToolTrain code search agent execution failed', LogContext.AI, {
        prompt: prompt.substring(0, 100),
        error: error instanceof Error ? error.message : String(error),
        executionTime,
      });

      // Track failure
      await this.trackCodeSearchAgentPerformance({
        prompt,
        response: null,
        executionTime,
        success: false,
      });

      return {
        success: false,
        response: null,
        metrics: {
          executionTime,
          toolsUsed: 0,
          searchDepth: 0,
          confidence: 0,
        },
      };
    }
  }

  /**
   * Track ToolTrain code search agent performance
   */
  private async trackCodeSearchAgentPerformance(data: {
    prompt: string;
    response: any;
    executionTime: number;
    success: boolean;
  }): Promise<void> {
    const agentKey = 'tooltrain:code-search-agent';
    
    // Create synthetic model for tracking
    const syntheticModel: DiscoveredModel = {
      id: 'code-search-agent',
      name: 'ToolTrain Code Search Agent',
      provider: 'local',
      capabilities: ['code_generation', 'debugging', 'reasoning', 'tool_usage', 'repository_navigation'],
      tier: 3,
      estimatedSpeed: 'fast',
      metadata: {
        quantization: 'specialized',
        family: 'code-search'
      },
    };

    // Calculate quality based on response structure and content
    let quality = 0.7; // Base quality
    if (data.success && data.response) {
      if (data.response.paths && data.response.paths.length > 0) {
        quality += 0.2;
      }
      if (data.response.confidence && data.response.confidence > 0.8) {
        quality += 0.1;
      }
    }

    await this.trackPerformance(syntheticModel, 'code-search', {
      latencyMs: data.executionTime,
      tokensGenerated: data.response?.metadata?.tokensGenerated || 100,
      success: data.success,
      quality: Math.min(1.0, quality),
    });
  }

  /**
   * Get code search routing statistics
   */
  public getCodeSearchStats(): {
    totalCodeSearchRequests: number;
    codeSearchSuccessRate: number;
    avgCodeSearchLatency: number;
    popularPatterns: Array<{ pattern: string; count: number }>;
    popularKeywords: Array<{ keyword: string; count: number }>;
  } {
    const agentKey = 'tooltrain:code-search-agent';
    const performance = this.modelPerformance.get(agentKey);
    
    // In a real implementation, we'd track pattern/keyword usage
    // For now, return mock data based on our patterns
    const popularPatterns = this.codeSearchPatterns.slice(0, 5).map((pattern, index) => ({
      pattern: pattern.source,
      count: 10 - index * 2,
    }));

    const popularKeywords = this.codeSearchKeywords.slice(0, 5).map((keyword, index) => ({
      keyword,
      count: 8 - index,
    }));

    return {
      totalCodeSearchRequests: performance?.sampleCount || 0,
      codeSearchSuccessRate: performance?.successRate || 0,
      avgCodeSearchLatency: performance?.avgLatency || 0,
      popularPatterns,
      popularKeywords,
    };
  }

  /**
   * Update code search patterns based on usage data
   */
  public updateCodeSearchPatterns(
    newPatterns: string[],
    newKeywords: string[]
  ): void {
    // Add new patterns (validate regex first)
    for (const pattern of newPatterns) {
      try {
        const regex = new RegExp(pattern, 'i');
        if (!this.codeSearchPatterns.some(p => p.source === pattern)) {
          this.codeSearchPatterns.push(regex);
        }
      } catch (error) {
        log.warn('Invalid regex pattern provided', LogContext.AI, { pattern });
      }
    }

    // Add new keywords
    for (const keyword of newKeywords) {
      if (!this.codeSearchKeywords.includes(keyword)) {
        this.codeSearchKeywords.push(keyword);
      }
    }

    // Keep only the most recent patterns (prevent unbounded growth)
    if (this.codeSearchPatterns.length > 50) {
      this.codeSearchPatterns = this.codeSearchPatterns.slice(-40);
    }

    if (this.codeSearchKeywords.length > 100) {
      this.codeSearchKeywords = this.codeSearchKeywords.slice(-80);
    }

    log.info('Code search patterns updated', LogContext.AI, {
      totalPatterns: this.codeSearchPatterns.length,
      totalKeywords: this.codeSearchKeywords.length,
    });
  }

  /**
   * Get performance report
   */
  public getPerformanceReport(): Record<string, ModelPerformance> {
    return Object.fromEntries(this.modelPerformance);
  }

  /**
   * Get routing weights
   */
  public getRoutingWeights(): Record<string, number> {
    return Object.fromEntries(this.routingWeights);
  }

  /**
   * Reset performance data for a model
   */
  public resetModelPerformance(modelId: string, provider: string): void {
    const key = `${provider}:${modelId}`;
    this.performanceHistory.delete(key);
    this.modelPerformance.delete(key);
    
    // Reset routing weights for this model
    for (const [weightKey] of this.routingWeights) {
      if (weightKey.includes(modelId)) {
        this.routingWeights.delete(weightKey);
      }
    }
  }
}

// Singleton instance
export const dynamicModelRouter = new DynamicModelRouter();