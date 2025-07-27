/**
 * Pydantic AI Service - Type-safe AI interactions with structured responses
 * Provides validation, structured agent responses, and integration with DSPy
 */

import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { LogContext, logger } from '../utils/enhanced-logger';
import {
  type DSPyOrchestrationRequest,
  type DSPyOrchestrationResponse,
  getDSPyService,
} from './dspy-service';
import type { AgentContext, AgentResponse, BaseAgent } from '../agents/base_agent';
import {
  ImportanceLevel,
  type MemoryModel,
  MemoryType,
  ModelUtils,
  type SearchOptions,
} from '../models/pydantic_models';

// ============================================
// PYDANTIC AI MODELS
// ============================================

/**
 * Structured AI Request with validation
 */
export const AIRequestSchema = z.object({
  id: z
    .string()
    .uuid()
    .default(() => uuidv4()),
  prompt: z.string().min(1).max(10000),
  context: z
    .object({
      userId: z.string().optional(),
      sessionId: z.string().optional(),
      memoryEnabled: z.boolean().default(true),
      temperature: z.number().min(0).max(2).default(0.7),
      maxTokens: z.number().min(1).max(4096).default(2048),
      model: z.string().optional(),
      systemPrompt: z.string().optional(),
      previousMessages: z
        .array(
          z.object({
            role: z.enum(['user', 'assistant', 'system']),
            content: z.string(),
          })
        )
        .optional(),
      metadata: z.record(z.any()).optional(),
    })
    .default({}),
  validation: z
    .object({
      outputSchema: z.any().optional(), // Zod schema for response validation
      retryAttempts: z.number().min(0).max(3).default(1),
      strictMode: z.boolean().default(false),
    })
    .default({}),
  orchestration: z
    .object({
      mode: z.enum(['simple', 'standard', 'cognitive', 'adaptive']).default('standard'),
      preferredAgents: z.array(z.string()).optional(),
      excludeAgents: z.array(z.string()).optional(),
    })
    .default({}),
});

export type AIRequest = z.infer<typeof AIRequestSchema>;

/**
 * Structured AI Response with validation
 */
export const AIResponseSchema = z.object({
  id: z.string().uuid(),
  requestId: z.string().uuid(),
  success: z.boolean(),
  content: z.string(),
  structuredData: z.any().optional(),
  reasoning: z.string(),
  confidence: z.number().min(0).max(1),
  model: z.string(),
  usage: z
    .object({
      promptTokens: z.number(),
      completionTokens: z.number(),
      totalTokens: z.number(),
    })
    .optional(),
  validation: z.object({
    passed: z.boolean(),
    errors: z.array(z.string()).optional(),
    warnings: z.array(z.string()).optional(),
  }),
  metadata: z.object({
    latencyMs: z.number(),
    agentsInvolved: z.array(z.string()),
    memoryAccessed: z.boolean(),
    cacheHit: z.boolean().default(false),
    timestamp: z.date(),
  }),
  nextActions: z.array(z.string()).optional(),
  relatedMemories: z.array(z.any()).optional(),
});

export type AIResponse = z.infer<typeof AIResponseSchema>;

/**
 * Agent-specific structured response schemas
 */
export const CognitiveAnalysisSchema = z.object({
  _analysis: z.string(),
  keyInsights: z.array(z.string()),
  recommendations: z.array(
    z.object({
      action: z.string(),
      priority: z.enum(['high', 'medium', 'low']),
      reasoning: z.string(),
    })
  ),
  entities: z.array(
    z.object({
      name: z.string(),
      type: z.string(),
      relevance: z.number(),
    })
  ),
  sentiment: z.enum(['positive', 'negative', 'neutral', 'mixed']),
  confidence: z.number(),
});

export const TaskPlanSchema = z.object({
  objective: z.string(),
  steps: z.array(
    z.object({
      id: z.number(),
      description: z.string(),
      agent: z.string(),
      dependencies: z.array(z.number()),
      estimatedDuration: z.number(),
      resources: z.array(z.string()),
    })
  ),
  totalEstimatedTime: z.number(),
  requiredAgents: z.array(z.string()),
  risks: z.array(
    z.object({
      description: z.string(),
      likelihood: z.enum(['high', 'medium', 'low']),
      mitigation: z.string(),
    })
  ),
});

export const CodeGenerationSchema = z.object({
  language: z.string(),
  code: z.string(),
  explanation: z.string(),
  dependencies: z.array(z.string()),
  testCases: z
    .array(
      z.object({
        name: z.string(),
        input: z.any(),
        expectedOutput: z.any(),
      })
    )
    .optional(),
  complexity: z
    .object({
      timeComplexity: z.string(),
      spaceComplexity: z.string(),
    })
    .optional(),
});

// ============================================
// PYDANTIC AI SERVICE
// ============================================

export class PydanticAIService {
  private dspyService = getDSPyService();
  private responseCache = new Map<string, AIResponse>();
  private validationCache = new Map<string, z.ZodSchema>();

  constructor() {
    this.setupBuiltInSchemas();
  }

  /**
   * Setup built-in validation schemas for common use cases
   */
  private setupBuiltInSchemas()): void {
    this.validationCache.set('cognitive_analysis, CognitiveAnalysisSchema;
    this.validationCache.set('task_plan', TaskPlanSchema);
    this.validationCache.set('code_generation', CodeGenerationSchema);
  }

  /**
   * Main AI requestmethod with type safety and validation
   */
  async requestrequest Partial<AIRequest>): Promise<AIResponse> {
    const startTime = Date.now();

    try {
      // Validate and parse request
      const validatedRequest = AIRequestSchema.parse(request;

      // Check cache if enabled
      const cacheKey = this.generateCacheKey(validatedRequest);
      if (this.responseCache.has(cacheKey)) {
        const cached = this.responseCache.get(cacheKey)!;
        return {
          ...cached,
          metadata: {
            ...cached.metadata,
            cacheHit: true,
            latencyMs: Date.now() - startTime,
          },
        };
      }

      // Prepare DSPy orchestration request
      const dspyRequest: DSPyOrchestrationRequest = {
        requestId: validatedRequest.id,
        userRequest: this.buildPromptWithContext(validatedRequest),
        userId: validatedRequest.context.userId || 'anonymous',
        orchestrationMode: validatedRequest.orchestration.mode,
        context: {
          ...validatedRequest.context,
          validation: validatedRequest.validation,
          preferredAgents: validatedRequest.orchestration.preferredAgents,
          excludeAgents: validatedRequest.orchestration.excludeAgents,
        },
        timestamp: new Date(),
      };

      // Execute through DSPy orchestration
      const dspyResponse = await this.dspyService.orchestrate(dspyRequest);

      // Process and validate response
      const aiResponse = await this.processResponse(validatedRequest, dspyResponse, startTime;

      // Cache successful responses
      if (aiResponse.success && aiResponse.validation.passed) {
        this.responseCache.set(cacheKey, aiResponse;
      }

      return aiResponse;
    } catch (error) {
      logger.error('PydanticAI reque, LogContext.SYSTEM, {
        _error error instanceof Error ? error.message : String(_error,
      });

      return this.createErrorResponse(requestid || uuidv4(), error Date.now() - startTime);
    }
  }

  /**
   * Request with custom output schema validation
   */
  async requestWithSchema<T>(
    request Partial<AIRequest>,
    outputSchema: z.ZodSchema<T>
  ): Promise<AIResponse & { structuredData: T, }> {
    const enhancedRequest: Partial<AIRequest> = {
      ...request
      validation: {
        ...requestvalidation,
        outputSchema,
      },
    };

    const response = await this.requestenhancedRequest);

    if (!response.success || !response.structuredData) {
      throw new Error('Failed to get structured response');
    }

    return response as AIResponse & { structuredData: T, };
  }

  /**
   * Specialized cognitive_analysisrequest
   */
  async analyzeCognitive(
    content string,
    context?: Partial<AIRequest['context']>
  ): Promise<z.infer<typeof CognitiveAnalysisSchema>> {
    const response = await this.requestWithSchema(
      {
        prompt: `Perform a comprehensive cognitive analysis of the following content ${content`,
        context: {
          ...context,
          systemPrompt:
            'You are a cognitive_analysisexpert. Provide detailed insights, entities, and recommendations.',
        },
        orchestration: {
          mode: 'cognitive',
          preferredAgents: ['cognitive_analyzer', 'entity_extractor'],
        },
      },
      CognitiveAnalysisSchema
    );

    return response.structuredData;
  }

  /**
   * Specialized task planning request
   */
  async planTask(
    objective: string,
    constraints?: Record<string, unknown>
  ): Promise<z.infer<typeof TaskPlanSchema>> {
    const response = await this.requestWithSchema(
      {
        prompt: `Create a detailed task plan for ${objective}`,
        context: {
          systemPrompt:
            'You are a task planning expert. Break down objectives into actionable steps with clear dependencies.',
          metadata: { constraints },
        },
        orchestration: {
          mode: 'cognitive',
          preferredAgents: ['planner', 'resource_manager'],
        },
      },
      TaskPlanSchema
    );

    return response.structuredData;
  }

  /**
   * Generate code with validation
   */
  async generateCode(
    specification: string,
    language: string,
    options?: {
      includeTests?: boolean;
      analyzeComplexity?: boolean;
    }
  ): Promise<z.infer<typeof CodeGenerationSchema>> {
    const response = await this.requestWithSchema(
      {
        prompt: `Generate ${language} code for ${specification}`,
        context: {
          systemPrompt: `You are an expert ${language} developer. Generate clean, efficient, well-documented code.`,
          metadata: options,
        },
        orchestration: {
          mode: 'standard',
          preferredAgents: ['code_generator', 'code_reviewer'],
        },
      },
      CodeGenerationSchema
    );

    return response.structuredData;
  }

  /**
   * Build prompt with context and system instructions
   */
  private buildPromptWithContext(request: AIRequest: string {
    const parts: string[] = [];

    if (requestcontext.systemPrompt) {
      parts.push(`System: ${requestcontext.systemPrompt}`);
    }

    if (requestcontext.previousMessages) {
      requestcontext.previousMessages.forEach((msg) => {
        parts.push(`${msg.role}: ${msg.content`);
      });
    }

    parts.push(`User: ${requestprompt}`);

    return parts.join('\n\n');
  }

  /**
   * Process DSPy response into structured AI response
   */
  private async processResponse(
    request AIRequest,
    dspyResponse: DSPyOrchestrationResponse,
    startTime: number
  ): Promise<AIResponse> {
    const latencyMs = Date.now() - startTime;

    // Extract structured data if present
    let structuredData: any = null;
    let validationResult = { passed: true, errors: [], warnings: [] };

    if (dspyResponse.success && dspyResponse.result) {
      // Try to extract structured data
      structuredData = this.extractStructuredData(dspyResponse.result);

      // Validate if schema provided
      if (requestvalidation.outputSchema && structuredData) {
        validationResult = this.validateStructuredData(
          structuredData,
          requestvalidation.outputSchema
        );
      }
    }

    // Build response
    const response: AIResponse = {
      id: uuidv4(),
      requestId: requestid,
      success: dspyResponse.success && validationResult.passed,
      content this.extractTextContent(dspyResponse.result),
      structuredData,
      reasoning: dspyResponse.reasoning || '',
      confidence: dspyResponse.confidence || 0,
      model: 'dspy-orchestrated',
      usage: {
        promptTokens: 0, // Would need token counting
        completionTokens: 0,
        totalTokens: 0,
      },
      validation: validationResult,
      metadata: {
        latencyMs,
        agentsInvolved: dspyResponse.participatingAgents || [],
        memoryAccessed: requestcontext.memoryEnabled,
        cacheHit: false,
        timestamp: new Date(),
      },
      nextActions: this.extractNextActions(dspyResponse),
      relatedMemories: [],
    };

    // Store in memory if enabled
    if (requestcontext.memoryEnabled) {
      await this.storeInteractionMemory(request: response;
    }

    return response;
  }

  /**
   * Extract structured data from response
   */
  private extractStructuredData(result: any): any {
    if (typeof result === 'object' && result !== null) {
      // If result already has structured format
      if (result.data || result.structuredData) {
        return result.data || result.structuredData;
      }

      // Try to parse if it's a JSON string
      if (typeof result === 'string') {
        try {
          return JSON.parse(result);
        } catch {
          // Not JSON, return null
          return null;
        }
      }

      // Return the object itself if it looks structured
      return result;
    }

    return null;
  }

  /**
   * Extract text contentfrom response
   */
  private extractTextContent(result: any: string {
    if (typeof result === 'string') {
      return result;
    }

    if (result?.content {
      return String(result.content;
    }

    if (result?.text) {
      return String(result.text);
    }

    if (result?.message) {
      return String(result.message);
    }

    return JSON.stringify(result, null, 2);
  }

  /**
   * Validate structured data against schema
   */
  private validateStructuredData(
    data: any,
    schema: z.ZodSchema
  ): { passed: boolean; errors: string[]; warnings: string[] } {
    try {
      schema.parse(data);
      return { passed: true, errors: [], warnings: [] };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          passed: false,
          errors: errorerrors.map((e) => `${e.path.join('.')}: ${e.message}`),`
          warnings: [],
        };
      }
      return {
        passed: false,
        errors: [`Validation failed: ${String(_error}`],`
        warnings: [],
      };
    }
  }

  /**
   * Extract next actions from response
   */
  private extractNextActions(response: DSPyOrchestrationResponse: string[] {
    const actions: string[] = [];

    if (response.result?.nextActions) {
      actions.push(...response.result.nextActions);
    }

    if (response.result?.recommendations) {
      actions.push(...response.result.recommendations);
    }

    return actions;
  }

  /**
   * Store interaction in memory system
   */
  private async storeInteractionMemory(request AIRequest, response: AIResponse)): Promise<void> {
    try {
      const memory: Partial<MemoryModel> = {
        content `Q: ${requestprompt}\nA: ${response.content`,
        serviceId: 'pydantic-ai',
        memoryType: MemoryType.USER_INTERACTION,
        importanceScore: response.confidence,
        keywords: ['ai-interaction', ...response.metadata.agentsInvolved],
        metadata: {
          requestId: requestid,
          responseId: response.id,
          model: response.model,
          validation: response.validation,
          structuredData: response.structuredData,
        },
      };

      // Store through DSPy knowledge management
      await this.dspyService.manageKnowledge('store', { memory });
    } catch (error) {
      logger.warn('Failed to store interaction memory:', LogContext.SYSTEM, {
        _error error instanceof Error ? error.message : String(_error,
      });
    }
  }

  /**
   * Generate cache key for request
   */
  private generateCacheKey(request: AIRequest: string {
    const key = {
      prompt: requestprompt,
      context: {
        systemPrompt: requestcontext.systemPrompt,
        temperature: requestcontext.temperature,
        model: requestcontext.model,
      },
      orchestration: requestorchestration,
    };

    return JSON.stringify(key);
  }

  /**
   * Create_errorresponse
   */
  private createErrorResponse(requestId: string, error unknown, latencyMs: number: AIResponse {
    return {
      id: uuidv4(),
      requestId,
      success: false,
      content `Request failed: ${error instanceof Error ? error.message : String(_error}`,
      reasoning: 'An_erroroccurred during requestprocessing',
      confidence: 0,
      model: '_error,
      validation: {
        passed: false,
        errors: [error instanceof Error ? error.message : String(_error],
      },
      metadata: {
        latencyMs,
        agentsInvolved: [],
        memoryAccessed: false,
        cacheHit: false,
        timestamp: new Date(),
      },
    };
  }

  /**
   * Clear response cache
   */
  clearCache()): void {
    this.responseCache.clear();
    logger.info('PydanticAI response cache cleared');
  }

  /**
   * Get service statistics
   */
  getStats(): {
    cacheSize: number;
    registeredSchemas string[];
  } {
    return {
      cacheSize: this.responseCache.size,
      registeredSchemas Array.from(this.validationCache.keys()),
    };
  }

  /**
   * Register custom validation schema
   */
  registerSchema(name: string, schema: z.ZodSchema)): void {
    this.validationCache.set(name, schema;
    logger.info(`Registered validation schema: ${name}`);
  }

  /**
   * Create agent context from AI request
   */
  createAgentContext(request: AIRequest: AgentContext {
    return {
      requestId: requestid,
      userId: requestcontext.userId,
      sessionId: requestcontext.sessionId,
      userRequest: requestprompt,
      previousContext: requestcontext.metadata,
      timestamp: new Date(),
      memoryContext: {
        enabled: requestcontext.memoryEnabled,
        temperature: requestcontext.temperature,
        model: requestcontext.model,
      },
      metadata: requestcontext.metadata,
    };
  }

  /**
   * Convert agent response to AI response
   */
  convertAgentResponse(agentResponse: AgentResponse, request: AIRequest: AIResponse {
    return {
      id: uuidv4(),
      requestId: requestid,
      success: agentResponse.success,
      content agentResponse.data ? String(agentResponse.data) : agentResponse.message || '',
      structuredData: agentResponse.data,
      reasoning: agentResponse.reasoning,
      confidence: agentResponse.confidence,
      model: agentResponse.agentId,
      validation: {
        passed: agentResponse.success,
        errors: agentResponse._error? [agentResponse._error : undefined,
      },
      metadata: {
        latencyMs: agentResponse.latencyMs,
        agentsInvolved: [agentResponse.agentId],
        memoryAccessed: Boolean(agentResponse.memoryUpdates),
        cacheHit: false,
        timestamp: new Date(),
      },
      nextActions: agentResponse.nextActions,
    };
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

let_pydanticAIService: PydanticAIService | null = null;

export function getPydanticAIService(): PydanticAIService {
  if (!_pydanticAIService) {
    _pydanticAIService = new PydanticAIService();
  }
  return_pydanticAIService;
}

// Export convenience methods
export const pydanticAI = {
  request (request Partial<AIRequest>) => getPydanticAIService().requestrequest,
  requestWithSchema: <T>(request Partial<AIRequest>, schema: z.ZodSchema<T>) =>
    getPydanticAIService().requestWithSchema(request: schema,
  analyzeCognitive: (content string, context?: Partial<AIRequest['context']>) =>
    getPydanticAIService().analyzeCognitive(content: context,
  planTask: (objective: string, constraints?: Record<string, unknown>) =>
    getPydanticAIService().planTask(objective, constraints,
  generateCode: (spec: string, lang: string, options?: any =>
    getPydanticAIService().generateCode(spec, lang, options,
  registerSchema: (name: string, schema: z.ZodSchema) =>
    getPydanticAIService().registerSchema(name, schema,
  clearCache: () => getPydanticAIService().clearCache(),
  getStats: () => getPydanticAIService().getStats(),
};
