/**
 * Fast LLM Coordinator - Multi-Tier Architecture
 * Uses small, fast models (LFM2-1.2B) for routing and coordination
 * Delegates heavy work to larger models (Ollama, LM Studio, External APIs)
 */

import { TWO } from '@/utils/constants';
import { log,LogContext } from '@/utils/logger';
import { isAllowedHost, normalizeHttpUrl } from '@/utils/url-security';

import { llmRouter } from './llm-router-service';
import { ollamaService } from './ollama-service';
const fetchApi = (globalThis as any).fetch?.bind(globalThis) as typeof globalThis.fetch;

export interface FastRoutingDecision {
  shouldUseLocal: boolean;
  targetService: 'lfm2' | 'ollama' | 'lm-studio' | 'openai' | 'anthropic';
  reasoning: string;
  complexity: 'simple' | 'medium' | 'complex';
  estimatedTokens: number;
  priority: number;
}

export interface CoordinationContext {
  taskType: string;
  complexity: string;
  urgency: 'low' | 'medium' | 'high';
  expectedResponseLength: 'short' | 'medium' | 'long';
  requiresCreativity: boolean;
  requiresAccuracy: boolean;
}

export class FastLLMCoordinator {
  private lfm2Available = false;
  private kokoroAvailable = false;
  private lmStudioUrl: string;
  private lmStudioAvailable = false;

  constructor() {
    const base = process.env.LM_STUDIO_URL || 'http://localhost:5901';
    try {
      const normalized = normalizeHttpUrl(base);
      if (!normalized) {throw new Error('Unsupported protocol');}
      if (!isAllowedHost(normalized, 'ALLOWED_LLM_HOSTS')) {
        throw new Error('Host not allowed');
      }
      this.lmStudioUrl = normalized;
    } catch (e) {
      log.warn('Invalid LM_STUDIO_URL, using http://localhost:5901', LogContext.AI, {
        error: e instanceof Error ? e.message : String(e),
      });
      this.lmStudioUrl = 'http://localhost:5901';
    }
    this.initializeFastModels();
    // Check LM Studio availability on startup
    this.checkLmStudioHealth().catch(err => 
      log.warn('LM Studio not available on startup', LogContext.AI, { error: String(err) })
    );
  }

  private async initializeFastModels(): Promise<void> {
    try {
      // Check if LFM2 model is available
      // Assume LFM2 available based on local setup
      this.lfm2Available = true;

      // Check if Kokoro TTS is available
      // Assume Kokoro available based on local setup
      this.kokoroAvailable = true;

      // Check LM Studio availability
      await this.checkLmStudioHealth();

      log.info('✅ Fast models initialized', LogContext.AI, {
        lfm2: this.lfm2Available,
        kokoro: this.kokoroAvailable,
        lmStudio: this.lmStudioUrl,
      });
    } catch (error) {
      log.error('❌ Failed to initialize fast models', LogContext.AI, { error });
    }
  }

  public async checkLmStudioHealth(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const resp = await fetchApi(`${this.lmStudioUrl}/v1/models`, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeout);
      this.lmStudioAvailable = resp.ok;
      return this.lmStudioAvailable;
    } catch {
      this.lmStudioAvailable = false;
      return false;
    }
  }

  public isLmStudioAvailable(): boolean {
    return this.lmStudioAvailable;
  }

  /**
   * Fast routing decision using LFM2-1.2B
   * This small model quickly decides which service should handle the request
   */
  public async makeRoutingDecision(
    userRequest: string,
    context: CoordinationContext
  ): Promise<FastRoutingDecision> {
    const startTime = Date.now();

    // Quick analysis prompt for LFM2
    const routingPrompt = `Analyze this request and decide the best AI service:

REQUEST: "${userRequest}"
CONTEXT: ${JSON.stringify(context)}

Respond with JSON only:
{
  "shouldUseLocal": boolean,
  "targetService": "lfm2|ollama|lm-studio|openai|anthropic",
  "reasoning": "brief explanation",
  "complexity": "simple|medium|complex",
  "estimatedTokens": number,
  "priority": 1-5
}

ROUTING RULES:
- lfm2: Simple questions, quick responses, <100 tokens
- ollama: Medium complexity, general purpose, <1000 tokens
- lm-studio: Code generation, technical tasks, <2000 tokens
- openai: Complex reasoning, creative tasks, >1000 tokens
- anthropic: Analysis, research, long-form content`;

    try {
      // Use LFM2 for fast routing decisions (simulated for now)
      const decision = await this.queryLFM2(routingPrompt);

      const duration = Date.now() - startTime;
      log.info('⚡ Fast routing decision made', LogContext.AI, {
        decision: decision.targetService,
        duration: `${duration}ms`,
        complexity: decision.complexity,
      });

      return decision;
    } catch {
      log.warn('⚠️ Fast routing failed, using fallback logic', LogContext.AI);
      return this.getFallbackDecision(userRequest, context);
    }
  }

  /**
   * Execute request using the fast coordinator pattern
   */
  public async executeWithCoordination(
    userRequest: string,
    context: CoordinationContext
  ): Promise<{
    response: unknown;
    metadata: {
      routingDecision: FastRoutingDecision;
      executionTime: number;
      tokensUsed: number;
      serviceUsed: string;
    };
  }> {
    const startTime = Date.now();

    // Step 1: Fast routing decision (LFM2)
    const decision = await this.makeRoutingDecision(userRequest, context);

    // Step 2: Execute based on decision
    let response: unknown;
    let tokensUsed = 0;

    switch (decision.targetService) {
      case 'lfm2':
        response = await this.executeLFM2(userRequest);
        tokensUsed = (response as any).tokens || 50;
        break;

      case 'ollama':
        response = await this.executeOllama(userRequest);
        tokensUsed = (response as any).usage?.total_tokens || 0;
        break;

      case 'lm-studio':
        response = await this.executeLMStudio(userRequest);
        tokensUsed = (response as any).usage?.total_tokens || 0;
        break;

      case 'openai':
      case 'anthropic':
        response = await llmRouter.generateResponse(
          decision.targetService === 'openai' ? 'code-assistant' : 'planner-pro',
          [{ role: 'user', content: userRequest }]
        );
        tokensUsed = (response as any).usage?.total_tokens || 0;
        break;

      default:
        throw new Error(`Unsupported service: ${decision.targetService}`);
    }

    const executionTime = Date.now() - startTime;

    return {
      response,
      metadata: {
        routingDecision: decision,
        executionTime,
        tokensUsed,
        serviceUsed: decision.targetService,
      },
    };
  }

  /**
   * LFM2-1.2B execution (fastest for simple tasks)
   */
  private async queryLFM2(prompt: string): Promise<FastRoutingDecision> {
    try {
      // Import LFM2 bridge dynamically to avoid circular dependencies
      const { lfm2Bridge } = await import('./lfm2-bridge');

      const response = await lfm2Bridge.routingDecision(prompt, {
        taskType: 'routing',
        timestamp: Date.now(),
      });

      return {
        shouldUseLocal: ['lfm2', 'ollama'].includes(response.targetService),
        targetService: response.targetService,
        reasoning: response.reasoning,
        complexity: this.estimateComplexity(prompt),
        estimatedTokens: response.estimatedTokens,
        priority: (() => {
          if (response.confidence > 0.8) {return 1;}
          if (response.confidence > 0.6) {return 2;}
          return 3;
        })(),
      };
    } catch (error) {
      log.warn('⚠️ LFM2 routing failed, using fallback logic', LogContext.AI, { error });

      // Fallback to simple heuristics
      const complexity = this.estimateComplexity(prompt);

      let targetService: FastRoutingDecision['targetService'] = 'lfm2';
      if (complexity === 'complex') {targetService = 'anthropic';} else if (complexity === 'medium') {targetService = 'ollama';} else if (prompt.includes('code') || prompt.includes('program')) {targetService = 'lm-studio';}

      const priority = complexity === 'simple' ? 1 : complexity === 'medium' ? 3 : 5;
      return {
        shouldUseLocal: targetService === 'lfm2' || targetService === 'ollama',
        targetService,
        reasoning: `Fallback routing - Complexity: ${complexity}, contains technical terms: ${prompt.includes('code')}`,
        complexity,
        estimatedTokens: prompt.length / 4,
        priority,
      };
    }
  }

  private async executeLFM2(userRequest: string): Promise<any> {
    try {
      // Import LFM2 bridge dynamically
      const { lfm2Bridge } = await import('./lfm2-bridge');

      const response = await lfm2Bridge.quickResponse(userRequest, 'simple_qa');

      return {
        content: response.content,
        model: response.model,
        provider: 'local',
        tokens: response.tokens,
        executionTime: response.executionTime,
        confidence: response.confidence,
      };
    } catch (error) {
      log.warn('⚠️ LFM2 execution failed, using mock response', LogContext.AI, { error });

      // Fallback to mock response
      await new Promise((resolve) => setTimeout(resolve, 50));

      return {
        content: `Fast response to: ${userRequest}`,
        model: 'LFM2-1.2B',
        provider: 'local',
        tokens: Math.min(100, userRequest.length / TWO),
      };
    }
  }

  private async executeOllama(userRequest: string): Promise<any> {
    return ollamaService.generateResponse([{ role: 'user', content: userRequest }]);
  }

  private async executeLMStudio(userRequest: string): Promise<any> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const response = await fetchApi(`${this.lmStudioUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: userRequest }],
          temperature: 0.7,
          max_tokens: 1000,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`LM Studio error: ${response.status}`);
      }

      const ct = response.headers.get('content-type') || '';
      const data = ct.includes('application/json') ? await response.json() : await response.text();
      return {
        content:
          (data).choices?.[0]?.message?.content || (typeof data === 'string' ? data : ''),
        model: 'lm-studio',
        provider: 'lm-studio',
        usage: (data).usage,
      };
    } catch {
      log.warn('⚠️ LM Studio unavailable, falling back to Ollama', LogContext.AI);
      return this.executeOllama(userRequest);
    }
  }

  /**
   * DSPy Integration for optimization
   */
  public async optimizeWithDSPy(
    taskType: string,
    examples: Array<{ input: string; expectedOutput: string }>
  ): Promise<{
    optimizedPrompt: string;
    confidence: number;
    iterations: number;
  }> {
    log.info('🔧 Starting DSPy optimization', LogContext.AI, {
      taskType,
      examples: examples.length,
    });

    // This would integrate with the DSPy orchestrator
    // For now, return a simulated optimization
    return {
      optimizedPrompt: `Optimized prompt for ${taskType} based on ${examples.length} examples`,
      confidence: 0.85,
      iterations: 3,
    };
  }

  /**
   * Multi-agent coordination with fast routing
   */
  public async coordinateMultipleAgents(
    primaryTask: string,
    supportingTasks: string[]
  ): Promise<{
    primary: unknown;
    supporting: unknown[];
    coordination: {
      totalTime: number;
      fastDecisions: number;
      servicesUsed: string[];
    };
  }> {
    const startTime = Date.now();
    const decisions: FastRoutingDecision[] = [];
    const servicesUsed: string[] = [];

    // Fast routing for all tasks
    const primaryDecision = await this.makeRoutingDecision(primaryTask, {
      taskType: 'primary',
      complexity: 'medium',
      urgency: 'high',
      expectedResponseLength: 'medium',
      requiresCreativity: false,
      requiresAccuracy: true,
    });
    decisions.push(primaryDecision);

    const supportingDecisions = await Promise.all(
      supportingTasks.map((task) =>
        this.makeRoutingDecision(task, {
          taskType: 'supporting',
          complexity: 'simple',
          urgency: 'medium',
          expectedResponseLength: 'short',
          requiresCreativity: false,
          requiresAccuracy: false,
        })
      )
    );
    decisions.push(...supportingDecisions);

    // Execute all tasks based on fast routing decisions
    const [primary, ...supporting] = await Promise.all([
      this.executeBasedOnDecision(primaryTask, primaryDecision),
      ...supportingTasks.map((task, index) =>
        this.executeBasedOnDecision(task, supportingDecisions[index])
      ),
    ]);

    decisions.forEach((d) => {
      if (!servicesUsed.includes(d.targetService)) {
        servicesUsed.push(d.targetService);
      }
    });

    return {
      primary,
      supporting,
      coordination: {
        totalTime: Date.now() - startTime,
        fastDecisions: decisions.length,
        servicesUsed,
      },
    };
  }

  private async executeBasedOnDecision(task: string, decision: FastRoutingDecision): Promise<any> {
    const context: CoordinationContext = {
      taskType: 'general',
      complexity: decision.complexity,
      urgency: 'medium',
      expectedResponseLength: 'medium',
      requiresCreativity: false,
      requiresAccuracy: true,
    };

    const result = await this.executeWithCoordination(task, context);
    return result.response;
  }

  private estimateComplexity(prompt: string): 'simple' | 'medium' | 'complex' {
    const { length } = prompt;
    const complexKeywords = ['analyze', 'explain', 'research', 'comprehensive', 'detailed'];
    const hasComplexKeywords = complexKeywords.some((keyword) =>
      prompt.toLowerCase().includes(keyword)
    );

    if (length < 100 && !hasComplexKeywords) {return 'simple';}
    if (length < 300 || hasComplexKeywords) {return 'medium';}
    return 'complex';
  }

  private getFallbackDecision(
    userRequest: string,
    context: CoordinationContext
  ): FastRoutingDecision {
    return {
      shouldUseLocal: true,
      targetService: 'ollama',
      reasoning: 'Fallback routing due to coordinator failure',
      complexity: (context.complexity as any) || 'medium',
      estimatedTokens: userRequest.length / 4,
      priority: 3,
    };
  }

  public async getSystemStatus(): Promise<{
    fastModels: { lfm2: boolean; kokoro: boolean };
    services: { ollama: boolean; lmStudio: boolean };
    performance: { averageRoutingTime: number };
  }> {
    return {
      fastModels: {
        lfm2: this.lfm2Available,
        kokoro: this.kokoroAvailable,
      },
      services: {
        ollama: false, // Temporarily disabled for troubleshooting
        lmStudio: this.isLmStudioAvailable(),
      },
      performance: {
        averageRoutingTime: 50, // Would track actual metrics
      },
    };
  }
}

// Singleton instance
export const fastCoordinator = new FastLLMCoordinator();
export default fastCoordinator;
