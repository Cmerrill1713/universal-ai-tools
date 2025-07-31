/**
 * Enhanced Base Agent - Real LLM Integration with Type Safety
 * Replaces mock functionality with actual AI capabilities + validation
 */

import type { AgentConfig, AgentContext, AgentResponse } from '@/types';
import { LogContext, log } from '@/utils/logger';
import { type LLMMessage, llmRouter } from '@/services/llm-router-service';
import { type ValidatedAgentResponse, createValidatedResponse, validators } from '@/utils/validation';
import { z } from 'zod';
import type { ABMCTSFeedback, ABMCTSReward } from '@/types/ab-mcts';
import { bayesianModelRegistry } from '@/utils/bayesian-model';
import { BetaSampler } from '@/utils/thompson-sampling';
import { TWO } from '@/utils/common-constants';
import { mcpIntegrationService } from '@/services/mcp-integration-service';

export abstract class EnhancedBaseAgent {
  protected config: AgentConfig;
  protected isInitialized = false;
  protected conversationHistory: LLMMessage[] = [];
  protected systemPrompt = '';

  // AB-MCTS probabilistic tracking
  protected executionHistory: Array<{
    context: AgentContext;
    response: AgentResponse;
    reward: ABMCTSReward;
    timestamp: number;
  }> = [];
  protected performanceDistribution = {
    alpha: 1, // Beta distribution alpha (successes + 1)
    beta: 1, // Beta distribution beta (failures + 1)
  };
  protected dynamicSpawnCount = 0;

  // Performance metrics tracking
  protected performanceMetrics = {
    totalCalls: 0,
    successRate: 1,
    averageExecutionTime: 0,
    averageConfidence: 0.8,
    lastUsed: null as Date | null,
  };

  constructor(config: AgentConfig) {
    this.config = config;
    this.systemPrompt = this.buildSystemPrompt();
  }

  public getName(): string {
    return this.config.name;
  }

  public getDescription(): string {
    return this.config.description;
  }

  public getCapabilities(): string[] {
    return this.config.capabilities.map((cap) => cap.name);
  }

  public getPriority(): number {
    return this.config.priority;
  }

  protected abstract buildSystemPrompt(): string;
  protected abstract getInternalModelName(): string;

  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      await this.onInitialize();
      this.isInitialized = true;
      log.info(`✅ Enhanced agent initialized: ${this.config.name}`, LogContext.AGENT, {
        model: this.getInternalModelName(),
        capabilities: this.getCapabilities(),
      });
    } catch (error) {
      log.error(`❌ Failed to initialize enhanced agent: ${this.config.name}`, LogContext.AGENT, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  public async execute(context: AgentContext): Promise<AgentResponse> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();

    try {
      log.info(`🧠 Executing enhanced agent: ${this.config.name}`, LogContext.AGENT, {
        requestId: context.requestId,
        userRequest:
          context.userRequest.substring(0, 100) + (context.userRequest.length > 100 ? '...' : ''),
      });

      // Validate context
      this.validateContext(context);

      // Build messages for LLM
      const         messages = this.buildMessages(context);

      // Call LLM router with internal model name and MCP context
      const llmResponse = await llmRouter.generateResponse(this.getInternalModelName(), messages, {
        capabilities: this.getCapabilities(),
        temperature: this.getTemperature(),
        maxTokens: this.getMaxTokens(),
        includeContext: true,
        contextTypes: this.getContextTypes(),
        userId: context.userId,
        requestId: context.requestId,
      });

      // Process LLM response
      const agentResponse = await this.processLLMResponse(llmResponse, context);

      // Update conversation history
      this.updateConversationHistory(context.userRequest, llmResponse.content);

      // Save context to MCP for future use
      await this.saveMCPContext(context, agentResponse, llmResponse);

      const executionTime = Date.now() - startTime;
      log.info(`✅ Enhanced agent execution completed: ${this.config.name}`, LogContext.AGENT, {
        requestId: context.requestId,
        executionTime: `${executionTime}ms`,
        success: agentResponse.success,
        confidence: agentResponse.confidence,
        model: llmResponse.model,
        provider: llmResponse.provider,
        tokens: llmResponse.usage?.total_tokens || 0,
      });

      return {
        ...agentResponse,
        metadata: {
          ...agentResponse.metadata,
          executionTime,
          agentName: this.config.name,
          model: llmResponse.model,
          provider: llmResponse.provider,
          tokens: llmResponse.usage,
        },
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      log.error(`❌ Enhanced agent execution failed: ${this.config.name}`, LogContext.AGENT, {
        requestId: context.requestId,
        error: errorMessage,
        executionTime: `${executionTime}ms`,
      });

      return this.createErrorResponse(
        `Agent execution failed: ${errorMessage}`,
        `Error in ${this.config.name}: ${errorMessage}`,
        {
          executionTime,
          agentName: this.config.name,
          error: errorMessage,
        }
      );
    }
  }

  protected buildMessages(context: AgentContext): LLMMessage[] {
    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: this.systemPrompt,
      },
    ];

    // Add relevant conversation history (last 5 exchanges)
    const       recentHistory = this.conversationHistory.slice(-10);
    messages.push(...recentHistory);

    // Add current user request with context
    const contextualRequest = this.buildContextualRequest(context);
    messages.push({
      role: 'user',
      content: contextualRequest,
    });

    return messages;
  }

  protected buildContextualRequest(context: AgentContext): string {
    let request = `User Request: ${context.userRequest}\n\n`;

    if (context.workingDirectory) {
      request += `Working Directory: ${context.workingDirectory}\n`;
    }

    if (context.userId && context.userId !== 'anonymous') {
      request += `User ID: ${context.userId}\n`;
    }

    // Add any additional context from derived classes
    const additionalContext = this.getAdditionalContext(context);
    if (additionalContext) {
      request += `Additional Context: ${additionalContext}\n`;
    }

    request += `\nPlease provide a helpful, accurate, and contextually appropriate response based on your role and capabilities.`;

    return request;
  }

  protected getAdditionalContext(context: AgentContext): string | null {
    // Override in derived classes to add specific context
    return null;
  }

  protected async processLLMResponse(
    llmResponse: unknown,
    context: AgentContext
  ): Promise<AgentResponse> {
    try {
      // Try to extract structured data if the response is JSON
      let data: unknown = (llmResponse as any).content;
      let reasoning = (llmResponse as any).content;

      try {
        const parsed = JSON.parse((llmResponse as any).content);
        if (parsed && typeof parsed === 'object') {
          data = parsed;
          reasoning = parsed.reasoning || parsed.explanation || (llmResponse as any).content;
        }
      } catch {
        // Not JSON, use as plain text
      }

      // Calculate confidence based on response quality and provider
      const confidence = this.calculateConfidence(llmResponse, context);

      return this.createSuccessResponse(
        data,
        `Response generated by ${this.config.name}`,
        confidence,
        reasoning
      );
    } catch (error) {
      return this.createErrorResponse(
        'Failed to process LLM response',
        `Error processing response: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  protected calculateConfidence(llmResponse: unknown, context: AgentContext): number {
    let confidence = 0.7; // Base confidence

    // Adjust based on provider reliability
    const response = llmResponse as { provider?: string; content?: string; usage?: { completion_tokens: number; prompt_tokens: number } };
    switch (response.provider) {
      case 'anthropic':
        confidence += 0.1;
        break;
      case 'openai':
        confidence += 0.05;
        break;
      case 'ollama':
        confidence -= 0.1;
        break;
    }

    // Adjust based on response length and quality indicators
    const responseLength = response.content?.length || 0;
    if (responseLength > 500) confidence += 0.05;
    if (responseLength < 50) confidence -= 0.1;

    // Adjust based on token usage efficiency
    if (response.usage) {
      const efficiency = response.usage.completion_tokens / response.usage.prompt_tokens;
      if (efficiency > 0.5 && efficiency < 2.0) confidence += 0.05;
    }

    return Math.max(0.1, Math.min(1.0, confidence));
  }

  protected updateConversationHistory(userMessage: string, assistantMessage: string): void {
    this.conversationHistory.push(
      { role: 'user', content: userMessage },
      { role: 'assistant', content: assistantMessage }
    );

    // Keep only last 20 messages (10 exchanges) to prevent context overflow
    if (this.conversationHistory.length > 20) {
      this.conversationHistory = this.conversationHistory.slice(-20);
    }
  }

  protected getTemperature(): number {
    // Override in derived classes for specific temperature settings
    return 0.7;
  }

  protected getMaxTokens(): number {
    // Override in derived classes for specific token limits
    return this.config.maxLatencyMs && this.config.maxLatencyMs < 5000 ? 1000 : 2000;
  }

  public async shutdown(): Promise<void> {
    try {
      await this.onShutdown();
      this.isInitialized = false;
      this.conversationHistory = [];
      log.info(`🔄 Enhanced agent shutdown: ${this.config.name}`, LogContext.AGENT);
    } catch (error) {
      log.error(`❌ Error during enhanced agent shutdown: ${this.config.name}`, LogContext.AGENT, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Optional lifecycle hooks
  protected async onInitialize(): Promise<void> {
    // Override in subclasses if needed
  }

  protected async onShutdown(): Promise<void> {
    // Override in subclasses if needed
  }

  // Helper method to validate context
  protected validateContext(context: AgentContext): void {
    if (!context.userRequest || context.userRequest.trim().length === 0) {
      throw new Error('User request is required and cannot be empty');
    }

    if (!context.requestId) {
      throw new Error('Request ID is required');
    }
  }

  // Helper method to create success response
  protected createSuccessResponse(
    data: unknown,
    message: string,
    confidence = 0.8,
    reasoning?: string,
    metadata?: Record<string, unknown>
  ): AgentResponse {
    return {
      success: true,
      data,
      confidence: Math.max(0, Math.min(1, confidence)),
      message,
      reasoning: reasoning || `Processed by ${this.config.name}`,
      metadata: {
        agentName: this.config.name,
        timestamp: new Date().toISOString(),
        ...metadata,
      },
    };
  }

  // Helper method to create error response
  protected createErrorResponse(
    message: string,
    reasoning?: string,
    metadata?: Record<string, unknown>
  ): AgentResponse {
    return {
      success: false,
      data: null,
      confidence: 0,
      message,
      reasoning: reasoning || `Error in ${this.config.name}: ${message}`,
      metadata: {
        agentName: this.config.name,
        timestamp: new Date().toISOString(),
        ...metadata,
      },
    };
  }

  // Enhanced validated response methods for superior type safety
  protected createValidatedSuccessResponse<T>(
    data: T,
    message: string,
    confidence = 0.8,
    reasoning?: string,
    dataSchema?: z.ZodSchema<T>
  ): ValidatedAgentResponse<T> {
    return createValidatedResponse(data, message, confidence, reasoning, dataSchema);
  }

  protected createValidatedErrorResponse<T = null>(
    message: string,
    reasoning?: string,
    metadata?: Record<string, unknown>
  ): ValidatedAgentResponse<T> {
    return createValidatedResponse(
      null as T,
      message,
      0,
      reasoning || `Error in ${this.config.name}: ${message}`,
      z.null() as any
    );
  }

  // Validated execution method - superior to Agent Zero's approach
  public async executeValidated<T>(
    context: AgentContext,
    dataSchema?: z.ZodSchema<T>
  ): Promise<ValidatedAgentResponse<T>> {
    try {
      // Validate input context
      const         contextValidator = validators.custom(
          z.object({
            userRequest: z.string().min(1),
            requestId: z.string().min(1),
            userId: z.string().optional(),
            metadata: z.record(z.unknown()).optional(),
          })
        );

      const contextValidation = contextValidator.validate(context);
      if (!contextValidation.success) {
        log.warn(`⚠️ Context validation failed for ${this.config.name}`, LogContext.AGENT, {
          errors: contextValidation.errors,
        });

        return this.createValidatedErrorResponse(
          'Invalid context provided',
          `Context validation failed: ${contextValidation.errors?.map((e) => e.message).join(', ')}`,
          { validationErrors: contextValidation.errors }
        );
      }

      // Execute the agent logic
      const response = await this.execute(context);

      // Validate the response
      const responseValidator = validators.agentResponse(dataSchema);
      const responseValidation = responseValidator.validate(response);

      if (!responseValidation.success) {
        log.warn(`⚠️ Response validation failed for ${this.config.name}`, LogContext.AGENT, {
          errors: responseValidation.errors,
        });

        return this.createValidatedErrorResponse(
          'Response validation failed',
          `Generated response did not meet validation requirements`,
          {
            originalResponse: response,
            validationErrors: responseValidation.errors,
          }
        );
      }

      // Return validated response
      return this.createValidatedSuccessResponse(
        response.data as T,
        response.message,
        response.confidence,
        response.reasoning,
        dataSchema
      );
    } catch (error) {
      log.error(`❌ Validated execution failed for ${this.config.name}`, LogContext.AGENT, {
        error: error instanceof Error ? error.message : String(error),
      });

      return this.createValidatedErrorResponse(
        'Execution failed with unexpected error',
        error instanceof Error ? error.message : String(error),
        { errorType: error instanceof Error ? error.constructor.name : 'Unknown' }
      );
    }
  }

  // Batch execution with validation - unique advantage over Agent Zero
  public async executeBatchValidated<T>(
    contexts: AgentContext[],
    dataSchema?: z.ZodSchema<T>
  ): Promise<ValidatedAgentResponse<T>[]> {
    const results: ValidatedAgentResponse<T>[] = [];

    log.info(`🔄 Starting batch execution for ${this.config.name}`, LogContext.AGENT, {
      batchSize: contexts.length,
    });

    for (
      let         i = 0;
      i < contexts.length;
      i++
    ) {
      const context = contexts[i];
      try {
        const result = await this.executeValidated(context!, dataSchema);
        results.push(result);

        log.info(`✅ Batch item ${i + 1}/${contexts.length} completed`, LogContext.AGENT, {
          success: result.success,
          confidence: result.confidence,
        });
      } catch (error) {
        const errorResult = this.createValidatedErrorResponse<T>(
          `Batch execution failed for item ${i + 1}`,
          error instanceof Error ? error.message : String(error),
          { batchIndex: i, batchSize: contexts.length }
        );
        results.push(errorResult);

        log.error(`❌ Batch item ${i + 1}/${contexts.length} failed`, LogContext.AGENT, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    log.info(`🏁 Batch execution completed for ${this.config.name}`, LogContext.AGENT, {
      totalItems: contexts.length,
      successCount: results.filter((r) => r.success).length,
      failureCount: results.filter((r) => !r.success).length,
    });

    return results;
  }

  // Get conversation history (for debugging/monitoring)
  public getConversationHistory(): LLMMessage[] {
    return [...this.conversationHistory];
  }

  // Clear conversation history
  public clearConversationHistory(): void {
    this.conversationHistory =
            [];
    log.info(`🔄 Conversation history cleared: ${this.config.name}`, LogContext.AGENT);
  }

  // ==================== AB-MCTS Probabilistic Methods ====================

  /**
   * Get probabilistic score for this agent based on historical performance
   */
  public getProbabilisticScore(context: AgentContext): number {
    // Get Bayesian model prediction
    const model = bayesianModelRegistry.getModel(this.config.name, this.getTaskType(context));

    const prediction = model.predict(context.metadata || {});

    // Sample from Beta distribution for exploration
    const thompsonSample = BetaSampler.sample(
      this.performanceDistribution.alpha,
      this.performanceDistribution.beta
    );

    // Combine model prediction with Thompson sampling
    const score = 0.7 * prediction.expectedReward + 0.3 * thompsonSample;

    log.debug(`🎲 Probabilistic score for ${this.config.name}`, LogContext.AGENT, {
      modelPrediction: prediction.expectedReward,
      thompsonSample,
      finalScore: score,
      confidence: prediction.confidence,
    });

    return score;
  }

  /**
   * Update performance based on execution feedback
   */
  public updatePerformance(
    context: AgentContext,
    response: AgentResponse,
    feedback: ABMCTSFeedback
  ): void {
    // Store in execution history
    this.executionHistory.push({
      context,
      response,
      reward: feedback.reward,
      timestamp: feedback.timestamp,
    });

    // Keep only last 100 executions
    if (this.executionHistory.length > 100) {
      this.executionHistory = this.executionHistory.slice(-100);
    }

    // Update Beta distribution
    if (feedback.reward.value > 0.5) {
      this.performanceDistribution.alpha++;
    } else {
      this.performanceDistribution.beta++;
    }

    // Update Bayesian model
    bayesianModelRegistry.updateModel(
      this.config.name,
      this.getTaskType(context),
      feedback.reward,
      feedback.reward.metadata.executionTime,
      context.metadata || {}
    );

    log.info(`📊 Performance updated for ${this.config.name}`, LogContext.AGENT, {
      reward: feedback.reward.value,
      newAlpha: this.performanceDistribution.alpha,
      newBeta: this.performanceDistribution.beta,
      successRate: this.getSuccessRate(),
    });
  }

  /**
   * Get current success rate estimate
   */
  public getSuccessRate(): number {
    return (
      this.performanceDistribution.alpha /
      (this.performanceDistribution.alpha + this.performanceDistribution.beta)
    );
  }

  /**
   * Get confidence interval for success rate
   */
  public getConfidenceInterval(confidence = 0.95): [number, number] {
    return BetaSampler.confidenceInterval(
      {
        alpha: this.performanceDistribution.alpha,
        beta: this.performanceDistribution.beta,
        mean: this.getSuccessRate(),
        variance: 0,
      },
      confidence
    );
  }

  /**
   * Check if agent should spawn a new variant (GEN node)
   */
  public shouldSpawnVariant(): boolean {
    // Spawn if performance is consistently poor
    const successRate = this.getSuccessRate();
    const sampleSize = this.performanceDistribution.alpha + this.performanceDistribution.beta - TWO;

    if (sampleSize >= 20 && successRate < 0.3) {
      return true;
    }

    // Spawn if high variance in recent performance
    const recentPerformance = this.executionHistory.slice(-10);
    if (recentPerformance.length >= 10) {
      const variance = this.calculateVariance(recentPerformance.map((h) => h.reward.value));
      if (variance > 0.2) {
        return true;
      }
    }

    return false;
  }

  /**
   * Spawn a variant of this agent with modified parameters
   */
  public async spawnVariant(): Promise<EnhancedBaseAgent | null> {
    if (!this.shouldSpawnVariant()) {
      return null;
    }

    this.dynamicSpawnCount++;

    log.info(`🧬 Spawning variant of ${this.config.name}`, LogContext.AGENT, {
      spawnCount: this.dynamicSpawnCount,
      currentSuccessRate: this.getSuccessRate(),
    });

    // This would be implemented by concrete agent classes
    // For now, return null (subclasses should override)
    return null;
  }

  /**
   * Get simple performance metrics for dashboard
   */
  public getPerformanceMetrics() {
    // Update metrics based on execution history
    if (this.executionHistory.length > 0) {
      const recentExecutions = this.executionHistory.slice(-100);
      const successCount = recentExecutions.filter((e) => e.response.success).length;
      this.performanceMetrics.successRate = successCount / recentExecutions.length;

      const totalTime = recentExecutions.reduce(
        (sum, e) => sum + ((e.response.metadata as { executionTime?: number })?.executionTime || 0),
        0
      );
      this.performanceMetrics.averageExecutionTime = totalTime / recentExecutions.length;

      const totalConfidence = recentExecutions.reduce((sum, e) => sum + e.response.confidence, 0);
      this.performanceMetrics.averageConfidence = totalConfidence / recentExecutions.length;

      this.performanceMetrics.totalCalls = this.executionHistory.length;
      this.performanceMetrics.lastUsed = new Date();
    }

    return this.performanceMetrics;
  }

  /**
   * Get detailed performance metrics for monitoring
   */
  public getDetailedPerformanceMetrics(): {
    successRate: number;
    confidenceInterval: [number, number];
    executionCount: number;
    averageReward: number;
    recentTrend: 'improving' | 'stable' | 'declining';
    spawnCount: number;
  } {
    const successRate = this.getSuccessRate();
    const confidenceInterval = this.getConfidenceInterval();
    const executionCount = this.executionHistory.length;

    // Calculate average reward
    const averageReward =       executionCount > 0
        ? this.executionHistory.reduce((sum, h) => sum + h.reward.value, 0) / executionCount
        : 0;

    // Determine trend
    const       recentTrend = this.calculateTrend();

    return {
      successRate,
      confidenceInterval,
      executionCount,
      averageReward,
      recentTrend,
      spawnCount: this.dynamicSpawnCount,
    };
  }

  /**
   * Calculate reward based on response (for AB-MCTS integration)
   */
  protected calculateReward(
    response: AgentResponse,
    executionTime: number,
    context: AgentContext
  ): ABMCTSReward {
    // Quality component based on success and confidence
    const quality = response.success ? response.confidence : 0;

    // Speed component (normalized to 0-1)
    const targetTime = context.metadata?.targetTime || 5000; // 5s default
    const speedScore = Math.max(0, 1 - executionTime / targetTime);

    // Cost component (based on tokens/resources)
    const tokensUsed = (response.metadata?.tokens as any)?.total_tokens || 100;
    const costScore = Math.max(0, 1 - tokensUsed / 1000);

    // Weighted combination
    const value = 0.5 * quality + 0.3 * speedScore + 0.2 * costScore;

    return {
      value,
      components: {
        quality,
        speed: speedScore,
        cost: costScore,
        user_satisfaction: (response.metadata?.userRating as number) || quality,
      },
      metadata: {
        executionTime,
        tokensUsed,
        memoryUsed: 0, // Would track actual memory
        errors: response.success ? 0 : 1,
      },
    };
  }

  /**
   * Helper method to get task type from context
   */
  private getTaskType(context: AgentContext): string {
    return context.metadata?.taskType || 'general';
  }

  /**
   * Calculate variance for a set of values
   */
  private calculateVariance(values: number[]): number {
    if (
      values.length === 0     )
      return 0;

    const mean = values.reduce((a, b) => a + b) / values.length;
    const squaredDiffs = values.map((v) => Math.pow(v - mean, TWO));
    return squaredDiffs.reduce((a, b) => a + b) / values.length;
  }

  /**
   * Calculate performance trend
   */
  private calculateTrend(): 'improving' | 'stable' | 'declining' {
    if (this.executionHistory.length < 10) return 'stable';

    const recent = this.executionHistory.slice(-10);
    const older = this.executionHistory.slice(-20, -10);

    if (older.length < 5) return 'stable';

    const recentAvg = recent.reduce((sum, h) => sum + h.reward.value, 0) / recent.length;
    const olderAvg = older.reduce((sum, h) => sum + h.reward.value, 0) / older.length;

    const diff = recentAvg - olderAvg;

    if (diff > 0.1) return 'improving';
    if (diff < -0.1) return 'declining';
    return 'stable';
  }

  /**
   * Enhanced execute method with AB-MCTS feedback collection
   */
  public async executeWithFeedback(context: AgentContext): Promise<{
    response: AgentResponse;
    feedback: ABMCTSFeedback;
  }> {
    const startTime = Date.now();
    const response = await this.execute(context);
    const executionTime = Date.now() - startTime;

    // Calculate reward
    const reward = this.calculateReward(response, executionTime, context);

    // Create feedback
    const feedback: ABMCTSFeedback = {
      nodeId: context.metadata?.nodeId || `direct-${Date.now()}`,
      reward,
      errorOccurred: !response.success,
      errorMessage: response.success ? undefined : response.message,
      timestamp: Date.now(),
      context: {
        taskType: this.getTaskType(context),
        userId: context.userId,
        sessionId: context.requestId,
      },
    };

    // Update our own performance
    this.updatePerformance(context, response, feedback);

    return { response, feedback };
  }

  /**
   * Get context types for MCP integration (can be overridden by subclasses)
   */
  protected getContextTypes(): string[] {
    return ['project_overview', 'code_patterns', 'conversation_history'];
  }

  /**
   * Save context to MCP for future use
   */
  protected async saveMCPContext(
    context: AgentContext,
    agentResponse: AgentResponse,
    llmResponse: any
  ): Promise<void> {
    try {
      // Save conversation context
      const conversationContext = {
        userRequest: context.userRequest,
        agentResponse: agentResponse.data,
        agentName: this.config.name,
        confidence: agentResponse.confidence,
        success: agentResponse.success,
        timestamp: new Date().toISOString(),
        requestId: context.requestId,
        userId: context.userId,
      };

      await mcpIntegrationService.sendMessage('save_context', {
        content: JSON.stringify(conversationContext),
        category: 'conversation_history',
        metadata: {
          agentName: this.config.name,
          userId: context.userId,
          requestId: context.requestId,
          workingDirectory: context.workingDirectory,
          success: agentResponse.success,
          confidence: agentResponse.confidence,
        },
      });

      // If this was a successful code-related interaction, save as code pattern
      if (agentResponse.success && this.isCodeRelated(context.userRequest)) {
        await mcpIntegrationService.sendMessage('save_context', {
          content: `User Request: ${context.userRequest}\n\nAgent Response: ${agentResponse.data}`,
          category: 'code_patterns',
          metadata: {
            agentName: this.config.name,
            userId: context.userId,
            requestId: context.requestId,
            patternType: this.extractPatternType(context.userRequest),
            success: true,
          },
        });
      }

      // If there was an error or low confidence, save for error analysis
      if (!agentResponse.success || (agentResponse.confidence && agentResponse.confidence < 0.7)) {
        await mcpIntegrationService.sendMessage('save_context', {
          content: `User Request: ${context.userRequest}\n\nError/Issue: ${agentResponse.message || 'Low confidence response'}\n\nAttempted Response: ${agentResponse.data}`,
          category: 'error_analysis',
          metadata: {
            agentName: this.config.name,
            userId: context.userId,
            requestId: context.requestId,
            errorType: agentResponse.success ? 'low_confidence' : 'execution_error',
            confidence: agentResponse.confidence,
          },
        });
      }

      log.debug('✅ Context saved to MCP', LogContext.MCP, {
        agentName: this.config.name,
        requestId: context.requestId,
        success: agentResponse.success,
        confidence: agentResponse.confidence,
      });

    } catch (error) {
      log.warn('⚠️ Failed to save context to MCP', LogContext.MCP, {
        agentName: this.config.name,
        requestId: context.requestId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Check if the request is code-related
   */
  private isCodeRelated(userRequest: string): boolean {
    const codeKeywords = [
      'code', 'function', 'class', 'method', 'variable', 'debug', 'fix', 'error',
      'implement', 'refactor', 'optimize', 'bug', 'syntax', 'typescript', 'javascript',
      'react', 'node', 'api', 'database', 'sql', 'query', 'import', 'export'
    ];

    const lowercaseRequest = userRequest.toLowerCase();
    return codeKeywords.some(keyword => lowercaseRequest.includes(keyword));
  }

  /**
   * Extract pattern type from user request
   */
  private extractPatternType(userRequest: string): string {
    const request = userRequest.toLowerCase();
    
    if (request.includes('fix') || request.includes('debug') || request.includes('error')) {
      return 'error_fix';
    } else if (request.includes('implement') || request.includes('create') || request.includes('build')) {
      return 'implementation';
    } else if (request.includes('refactor') || request.includes('optimize') || request.includes('improve')) {
      return 'optimization';
    } else if (request.includes('explain') || request.includes('understand') || request.includes('how')) {
      return 'explanation';
    } else {
      return 'general_code';
    }
  }
}

export default EnhancedBaseAgent;
