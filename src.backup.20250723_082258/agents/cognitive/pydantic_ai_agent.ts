/**
 * Pydantic AI Agent - Provides type-safe, structured AI responses
 * Integrates with PydanticAIService for validated interactions
 */

import { z } from 'zod';
import type { AgentContext, AgentResponse, PartialAgentResponse } from '../base_agent';
import { type CognitiveCapability, RealCognitiveAgent } from './real_cognitive_agent';
import { type AIRequest, getPydanticAIService } from '../../services/pydantic-ai-service';
import {
  CodeGenerationSchema,
  CognitiveAnalysisSchema,
  TaskPlanSchema,
} from '../../services/pydantic-ai-service';

// Agent-specific response schemas
const StructuredResponseSchema = z.object({
  summary: z.string(),
  details: z.record(z.any()),
  confidence: z.number(),
  sources: z.array(z.string()).optional(),
});

const ValidationResultSchema = z.object({
  valid: z.boolean(),
  errors: z.array(
    z.object({
      field: z.string(),
      message: z.string(),
      severity: z.enum(['_error, 'warning', 'info']),
    })
  ),
  suggestions: z.array(z.string()),
});

export class PydanticAIAgent extends RealCognitiveAgent {
  private pydanticService = getPydanticAIService();

  constructor(config: any) {
    super({
      ...config,
      name: 'pydantic_ai',
      description: 'Provides type-safe, structured AI responses with validation',
      category: 'cognitive',
      capabilities: [
        {
          name: 'structured_response',
          description: 'Generate validated structured responses',
          inputSchema: {
            type: 'object',
            properties: {
              prompt: { type: 'string' },
              schema: { type: 'object' },
              context: { type: 'object' },
            },
            required: ['prompt'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              data: { type: 'object' },
              valid: { type: 'boolean' },
              errors: { type: 'array' },
            },
          },
        },
        {
          name: 'validate_data',
          description: 'Validate data against schemas',
          inputSchema: {
            type: 'object',
            properties: {
              data: { type: 'object' },
              schemaName: { type: 'string' },
            },
            required: ['data', 'schemaName'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              valid: { type: 'boolean' },
              errors: { type: 'array' },
            },
          },
        },
      ],
    });
  }

  protected setupCognitiveCapabilities(): void {
    // Structured response capability
    this.cognitiveCapabilities.set('structured_response', {
      name: 'structured_response',
      execute: async (_input: any, _context: AgentContext) => {
        return this.generateStructuredResponse(_input context);
      },
    });

    // Validation capability
    this.cognitiveCapabilities.set('validate', {
      name: 'validate',
      execute: async (_input: any, _context: AgentContext) => {
        return this.validateData(_input context);
      },
    });

    // Cognitive _analysiscapability
    this.cognitiveCapabilities.set('analyze', {
      name: 'analyze',
      execute: async (_input: any, _context: AgentContext) => {
        return this.performCognitiveAnalysis(_input context);
      },
    });

    // Task planning capability
    this.cognitiveCapabilities.set('plan', {
      name: 'plan',
      execute: async (_input: any, _context: AgentContext) => {
        return this.createTaskPlan(_input context);
      },
    });

    // Code generation capability
    this.cognitiveCapabilities.set('generate_code', {
      name: 'generate_code',
      execute: async (_input: any, _context: AgentContext) => {
        return this.generateCode(_input context);
      },
    });
  }

  protected async selectCapability(_context: AgentContext): Promise<CognitiveCapability | null> {
    const _request= context.userRequest.toLowerCase();

    // Check for specific capability requests
    if (_requestincludes('validate') || _requestincludes('check')) {
      return this.cognitiveCapabilities.get('validate') || null;
    }

    if (_requestincludes('analyze') || _requestincludes('_analysis)) {
      return this.cognitiveCapabilities.get('analyze') || null;
    }

    if (_requestincludes('plan') || _requestincludes('task') || _requestincludes('steps')) {
      return this.cognitiveCapabilities.get('plan') || null;
    }

    if (_requestincludes('code') || _requestincludes('generate') || _requestincludes('implement')) {
      return this.cognitiveCapabilities.get('generate_code') || null;
    }

    // Default to structured response
    return this.cognitiveCapabilities.get('structured_response') || null;
  }

  /**
   * Generate a structured response with validation
   */
  private async generateStructuredResponse(
    _input any,
    _context: AgentContext
  ): Promise<AgentResponse> {
    const startTime = Date.now();
    try {
      const { prompt, schema, contextData } = _input

      // Create the AI request
      const _request Partial<AIRequest> = {
        prompt: prompt || context.userRequest,
        context: {
          userId: context.userId,
          sessionId: context.sessionId,
          metadata: contextData || context.metadata,
          systemPrompt: 'Provide a structured response that matches the requested format exactly.',
          temperature: 0.7,
          maxTokens: 2000,
          memoryEnabled: true,
        },
        validation: {
          outputSchema: schema || StructuredResponseSchema,
          strictMode: true,
          retryAttempts: 3,
        },
      };

      // Get response with schema validation
      const response = schema
        ? await this.pydanticService.requestWithSchema(_request schema)
        : await this.pydanticService._request_request;

      return {
        success: response.success,
        data: response.structuredData || response._content
        reasoning: response.reasoning,
        confidence: response.confidence,
        message: response.success
          ? 'Generated structured response successfully'
          : 'Failed to generate valid structured response',
        latencyMs: Date.now() - startTime,
        agentId: this.config.name,
        metadata: {
          validation: response.validation,
          model: response.model,
          agentsInvolved: response.metadata.agentsInvolved,
        },
      };
    } catch (_error) {
      return this.createErrorResponse(_error;
    }
  }

  /**
   * Validate data against known schemas
   */
  private async validateData(_input any, _context: AgentContext): Promise<PartialAgentResponse> {
    try {
      const { data, schemaName } = _input

      // Define available schemas
      const schemas: Record<string, z.ZodSchema> = {
        cognitive__analysis CognitiveAnalysisSchema,
        task_plan: TaskPlanSchema,
        code_generation: CodeGenerationSchema,
        structured_response: StructuredResponseSchema,
        validation_result: ValidationResultSchema,
      };

      const schema = schemas[schemaName];
      if (!schema) {
        throw new Error(`Unknown schema: ${schemaName}`);
      }

      // Validate the data
      const result = schema.safeParse(data);

      const validationResult = {
        valid: result.success,
        errors: result.success
          ? []
          : result._errorerrors.map((err) => ({
              field: err.path.join('.'),
              message: err.message,
              severity: '_error as const,
            })),
        suggestions: result.success
          ? []
          : [
              'Ensure all required fields are present',
              'Check data types match the schema',
              'Validate nested objects conform to their schemas',
            ],
      };

      return {
        success: true,
        data: validationResult,
        reasoning: result.success
          ? 'Data validation passed successfully'
          : `Data validation failed with ${result._errorerrors.length} errors`,
        confidence: result.success ? 1.0 : 0.8,
        message: result.success ? 'Data is valid according to schema' : 'Data validation failed',
      };
    } catch (_error) {
      return this.createErrorResponse(_error;
    }
  }

  /**
   * Perform cognitive _analysisusing structured output
   */
  private async performCognitiveAnalysis(
    _input any,
    _context: AgentContext
  ): Promise<PartialAgentResponse> {
    try {
      const _content= _input_content|| context.userRequest;

      const _analysis= await this.pydanticService.analyzeCognitive(_content {
        userId: context.userId,
        sessionId: context.sessionId,
        metadata: context.metadata,
      });

      return {
        success: true,
        data: _analysis
        reasoning: `Analyzed _contentand extracted ${_analysiskeyInsights.length} insights and ${_analysisentities.length} entities`,
        confidence: _analysisconfidence,
        message: 'Cognitive _analysiscompleted successfully',
        nextActions: _analysisrecommendations.map((r) => r.action),
      };
    } catch (_error) {
      return this.createErrorResponse(_error;
    }
  }

  /**
   * Create a structured task plan
   */
  private async createTaskPlan(_input any, _context: AgentContext): Promise<PartialAgentResponse> {
    try {
      const objective = _inputobjective || context.userRequest;
      const constraints = _inputconstraints || {};

      const plan = await this.pydanticService.planTask(objective, constraints);

      return {
        success: true,
        data: plan,
        reasoning: `Created task plan with ${plan.steps.length} steps requiring ${plan.requiredAgents.length} agents`,
        confidence: 0.85,
        message: `Task plan created: estimated ${plan.totalEstimatedTime} minutes`,
        nextActions: [`Execute step 1: ${plan.steps[0]?.description}`],
        metadata: {
          totalSteps: plan.steps.length,
          requiredAgents: plan.requiredAgents,
          risks: plan.risks,
        },
      };
    } catch (_error) {
      return this.createErrorResponse(_error;
    }
  }

  /**
   * Generate code with validation
   */
  private async generateCode(_input any, _context: AgentContext): Promise<PartialAgentResponse> {
    try {
      const { specification, language = 'typescript', options = {} } = _input
      const spec = specification || context.userRequest;

      const codeGen = await this.pydanticService.generateCode(spec, language, options);

      return {
        success: true,
        data: codeGen,
        reasoning: `Generated ${language} code with ${codeGen.dependencies.length} dependencies`,
        confidence: 0.9,
        message: 'Code generated successfully',
        metadata: {
          language: codeGen.language,
          hasTests: Boolean(codeGen.testCases?.length),
          complexity: codeGen.complexity,
        },
      };
    } catch (_error) {
      return this.createErrorResponse(_error;
    }
  }

  /**
   * Generate reasoning for the agent's response
   */
  protected async generateReasoning(
    _context: AgentContext,
    capability: CognitiveCapability,
    result: any
  ): Promise<string> {
    const prompt = `As a Pydantic AI agent, explain the structured data processing approach for:

Request: "${context.userRequest}"
Capability used: ${capability.name}
Schema validation: ${result.valid ? 'Successful' : 'Failed'}
Data structure: ${result.data ? 'Generated' : 'None'}

Provide reasoning for:
1. How the _requestwas interpreted
2. What schema validation was performed
3. Why this structured approach was chosen
4. How type safety was ensured`;

    return this.generateOllamaResponse(prompt, context);
  }

  /**
   * Create _errorresponse
   */
  protected createErrorResponse(_error unknown): AgentResponse {
    return {
      success: false,
      data: null,
      reasoning: 'An _erroroccurred during processing',
      confidence: 0,
      _error _errorinstanceof Error ? _errormessage : String(_error,
      message: 'Failed to process _request,
      latencyMs: 0,
      agentId: this.config.name,
    };
  }

  /**
   * Override process method to use Pydantic AI service
   */
  protected async process(
    _context: AgentContext & { memoryContext?: any }
  ): Promise<AgentResponse> {
    const startTime = Date.now();
    try {
      // Select and execute capability
      const capability = await this.selectCapability(context);

      if (!capability) {
        // Fallback to general structured response
        return this.generateStructuredResponse({ prompt: context.userRequest }, context);
      }

      // Execute the selected capability
      const result = await capability.execute(
        { _content context.userRequest, ...context.metadata },
        context
      );

      // Ensure result has proper AgentResponse structure
      return {
        ...result,
        latencyMs: result.latencyMs || (Date.now() - startTime),
        agentId: result.agentId || this.config.name,
      };
    } catch (_error) {
      this.logger.error'PydanticAI processing failed:', _error;
      return this.createErrorResponse(_error;
    }
  }
}

// Export factory function
export function createPydanticAIAgent(config?: any): PydanticAIAgent {
  return new PydanticAIAgent(config || {});
}
