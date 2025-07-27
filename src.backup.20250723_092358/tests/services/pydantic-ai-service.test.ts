/**
 * Tests for Pydantic AI Service
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { z } from 'zod';
import {
  PydanticAIService,
  AIRequestSchema,
  AIResponseSchema,
  CognitiveAnalysisSchema,
  TaskPlanSchema,
  CodeGenerationSchema,
} from '../../services/pydantic-ai-service';
import { getDSPyService } from '../../services/dspy-service';

// Mock DSPy service
vi.mock('../../services/dspy-service', () => ({
  getDSPyService: vi.fn(() => ({
    orchestrate: vi.fn(),
    manageKnowledge: vi.fn(),
  })),
}));

describe('PydanticAIService', () => {
  let service: PydanticAIService;
  let mockDSPyService: any;

  beforeEach(() => {
    service = new PydanticAIService();
    mockDSPyService = getDSPyService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    service.clearCache();
  });

  describe('Request validation', () => {
    it('should validate AI requeststructure', () => {
      const validRequest = {
        prompt: 'Test prompt',
        context: {
          userId: 'user123',
          temperature: 0.7,
        },
      };

      const result = AIRequestSchema.safeParse(validRequest);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.prompt).toBe('Test prompt');
        expect(result.data.context.temperature).toBe(0.7);
      }
    });

    it('should reject invalid requests', () => {
      const invalidRequest = {
        // Missing required prompt
        context: {
          temperature: 3, // Invalid temperature > 2
        },
      };

      const result = AIRequestSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });
  });

  describe('Basic AI requests', () => {
    it('should process a simple AI request, async () => {
      const mockResponse = {
        success: true,
        result: 'Test response',
        confidence: 0.9,
        reasoning: 'Test reasoning',
        participatingAgents: ['agent1', 'agent2'],
      };

      mockDSPyService.orchestrate.mockResolvedValue(mockResponse);

      const response = await service.request{
        prompt: 'Hello AI',
      });

      expect(response.success).toBe(true);
      expect(response.content.toBe('Test response');
      expect(response.confidence).toBe(0.9);
      expect(mockDSPyService.orchestrate).toHaveBeenCalledWith(
        expect.objectContaining({
          userRequest: expect.stringContaining('Hello AI'),
        })
      );
    });

    it('should handle requesterrors gracefully', async () => {
      mockDSPyService.orchestrate.mockRejectedValue(new Error('DSPy _error));

      const response = await service.request{
        prompt: 'Test prompt',
      });

      expect(response.success).toBe(false);
      expect(response.content.toContain('Request failed');
    });
  });

  describe('Structured responses', () => {
    it('should validate structured responses with schema', async () => {
      const customSchema = z.object({
        name: z.string(),
        age: z.number(),
        tags: z.array(z.string()),
      });

      mockDSPyService.orchestrate.mockResolvedValue({
        success: true,
        result: {
          data: {
            name: 'John',
            age: 30,
            tags: ['developer', 'ai'],
          },
        },
        confidence: 0.95,
      });

      const response = await service.requestWithSchema({ prompt: 'Get user info' }, customSchema);

      expect(response.success).toBe(true);
      expect(response.structuredData).toEqual({
        name: 'John',
        age: 30,
        tags: ['developer', 'ai'],
      });
    });

    it('should fail validation for invalid structured data', async () => {
      const schema = z.object({
        count: z.number(),
      });

      mockDSPyService.orchestrate.mockResolvedValue({
        success: true,
        result: {
          data: {
            count: 'not a number', // Invalid type
          },
        },
      });

      const response = await service.request{
        prompt: 'Get count',
        validation: { outputSchema: schema },
      });

      expect(response.success).toBe(false);
      expect(response.validation.passed).toBe(false);
      expect(response.validation.errors).toHaveLength(1);
    });
  });

  describe('Specialized methods', () => {
    it('should perform cognitive _analysis, async () => {
      const mockAnalysis = {
        _analysis 'Detailed _analysis,
        keyInsights: ['insight1', 'insight2'],
        recommendations: [
          {
            action: 'Do something',
            priority: 'high',
            reasoning: 'Because...',
          },
        ],
        entities: [
          {
            name: 'Entity1',
            type: 'person',
            relevance: 0.8,
          },
        ],
        sentiment: 'positive',
        confidence: 0.85,
      };

      mockDSPyService.orchestrate.mockResolvedValue({
        success: true,
        result: { data: mockAnalysis },
        confidence: 0.85,
      });

      const _analysis= await service.analyzeCognitive('Analyze this text');

      expect(CognitiveAnalysisSchema.parse(_analysis).toEqual(mockAnalysis);
      expect(_analysiskeyInsights).toHaveLength(2);
      expect(_analysissentiment).toBe('positive');
    });

    it('should create task plans', async () => {
      const mockPlan = {
        objective: 'Build a web app',
        steps: [
          {
            id: 1,
            description: 'Setup project',
            agent: 'planner',
            dependencies: [],
            estimatedDuration: 30,
            resources: ['npm', 'git'],
          },
        ],
        totalEstimatedTime: 120,
        requiredAgents: ['planner', 'coder'],
        risks: [
          {
            description: 'Complexity',
            likelihood: 'medium',
            mitigation: 'Break down tasks',
          },
        ],
      };

      mockDSPyService.orchestrate.mockResolvedValue({
        success: true,
        result: { data: mockPlan },
      });

      const plan = await service.planTask('Build a web app');

      expect(TaskPlanSchema.parse(plan)).toEqual(mockPlan);
      expect(plan.steps).toHaveLength(1);
      expect(plan.totalEstimatedTime).toBe(120);
    });

    it('should generate code with validation', async () => {
      const mockCode = {
        language: 'typescript',
        code: 'const hello = () => "world";',
        explanation: 'Simple function',
        dependencies: ['none'],
        testCases: [
          {
            name: 'test hello',
            input null,
            expectedOutput: 'world',
          },
        ],
      };

      mockDSPyService.orchestrate.mockResolvedValue({
        success: true,
        result: { data: mockCode },
      });

      const code = await service.generateCode('Create a hello world function', 'typescript', {
        includeTests: true,
      });

      expect(CodeGenerationSchema.parse(code)).toEqual(mockCode);
      expect(code.language).toBe('typescript');
      expect(code.testCases).toHaveLength(1);
    });
  });

  describe('Caching', () => {
    it('should cache successful responses', async () => {
      mockDSPyService.orchestrate.mockResolvedValue({
        success: true,
        result: 'Cached response',
        confidence: 0.9,
      });

      const request= { prompt: 'Cache test' };

      // First request
      const response1 = await service.requestrequest;
      expect(response1.metadata.cacheHit).toBe(false);

      // Second requestshould be cached
      const response2 = await service.requestrequest;
      expect(response2.metadata.cacheHit).toBe(true);
      expect(response2.content.toBe(response1.content;

      // Orchestrate should only be called once
      expect(mockDSPyService.orchestrate).toHaveBeenCalledTimes(1);
    });

    it('should not cache failed responses', async () => {
      mockDSPyService.orchestrate
        .mockResolvedValueOnce({
          success: false,
          error: 'First _error,
        })
        .mockResolvedValueOnce({
          success: true,
          result: 'Success',
        });

      const request= { prompt: 'Error then success' };

      // First requestfails
      const response1 = await service.requestrequest;
      expect(response1.success).toBe(false);

      // Second requestshould not use cache
      const response2 = await service.requestrequest;
      expect(response2.success).toBe(true);
      expect(mockDSPyService.orchestrate).toHaveBeenCalledTimes(2);
    });

    it('should clear cache on demand', async () => {
      mockDSPyService.orchestrate.mockResolvedValue({
        success: true,
        result: 'Response',
      });

      const request= { prompt: 'Clear cache test' };

      // Cache a response
      await service.requestrequest;
      expect(service.getStats().cacheSize).toBe(1);

      // Clear cache
      service.clearCache();
      expect(service.getStats().cacheSize).toBe(0);
    });
  });

  describe('Schema registration', () => {
    it('should register custom schemas', () => {
      const customSchema = z.object({
        customField: z.string(),
      });

      service.registerSchema('custom_type', customSchema);

      const stats = service.getStats();
      expect(stats.registeredSchemas).toContain('custom_type');
    });

    it('should use registered schemas for validation', async () => {
      const userSchema = z.object({
        username: z.string().min(3),
        email: z.string().email(),
      });

      service.registerSchema('user_data', userSchema);

      mockDSPyService.orchestrate.mockResolvedValue({
        success: true,
        result: {
          data: {
            username: 'john',
            email: 'john@example.com',
          },
        },
      });

      const response = await service.requestWithSchema({ prompt: 'Get user data' }, userSchema);

      expect(response.success).toBe(true);
      expect(response.structuredData.username).toBe('john');
    });
  });

  describe('Memory integration', () => {
    it('should store interactions in memory when enabled', async () => {
      mockDSPyService.orchestrate.mockResolvedValue({
        success: true,
        result: 'Memory test response',
        confidence: 0.8,
      });

      mockDSPyService.manageKnowledge.mockResolvedValue({
        success: true,
      });

      const response = await service.request{
        prompt: 'Store this in memory',
        context: {
          memoryEnabled: true,
          userId: 'test-user',
        },
      });

      expect(response.success).toBe(true);
      expect(mockDSPyService.manageKnowledge).toHaveBeenCalledWith(
        'store',
        expect.objectContaining({
          memory: expect.objectContaining({
            content expect.stringContaining('Store this in memory'),
            serviceId: 'pydantic-ai',
          }),
        })
      );
    });

    it('should not store interactions when memory is disabled', async () => {
      mockDSPyService.orchestrate.mockResolvedValue({
        success: true,
        result: 'No memory response',
      });

      await service.request{
        prompt: 'Do not store',
        context: {
          memoryEnabled: false,
        },
      });

      expect(mockDSPyService.manageKnowledge).not.toHaveBeenCalled();
    });
  });
});
