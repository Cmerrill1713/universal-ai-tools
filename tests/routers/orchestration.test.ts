import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
// Mock the problematic bridge module before importing
jest.mock('../../src/services/dspy-orchestrator/bridge', () => ({
  dspyBridge: {
    orchestrate: jest.fn(),
    coordinate: jest.fn(),
    getStatus: jest.fn(),
    optimizePrompts: jest.fn(),
  },
}));

import orchestrationRouter from '../../src/routers/orchestration';
import { requireAuth } from '../../src/middleware/auth-jwt';
import { validateRequest } from '../../src/middleware/request-validation';

// Mock dependencies
jest.mock('../../src/middleware/auth-jwt');
jest.mock('../../src/middleware/request-validation');
jest.mock('../../src/core/coordination/enhanced-dspy-coordinator');
jest.mock('../../src/services/enhanced-orchestrator-adapter');
jest.mock('../../src/core/knowledge/dspy-knowledge-manager');
jest.mock('../../src/services/dspy-performance-optimizer');

const mockOrchestrator = {
  orchestrate: jest.fn(),
  coordinate: jest.fn(),
  getStatus: jest.fn(),
  optimizePrompts: jest.fn(),
};

const mockKnowledgeManager = {
  search: jest.fn(),
  extract: jest.fn(),
  evolve: jest.fn(),
};

describe('Orchestration Router', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/orchestration', orchestrationRouter);

    // Reset mocks
    jest.clearAllMocks();
    (requireAuth as jest.Mock).mockImplementation((req, res, next) => {
      req.user = { id: 'test-user-id', email: 'test@example.com' };
      next();
    });
    (validateRequest as jest.Mock).mockImplementation((req, res, next) => next());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('POST /api/orchestration/orchestrate', () => {
    it('should orchestrate task successfully', async () => {
      const orchestrationRequest = {
        task: 'Create a comprehensive test plan for API endpoints',
        context: {
          domain: 'testing',
          priority: 'high',
          requirements: ['coverage', 'security', 'performance'],
        },
        agents: ['planner', 'code_assistant', 'reviewer'],
        config: {
          timeout: 30000,
          parallelism: TWO,
        },
      };

      const mockResult = {
        id: 'orchestration-123',
        status: 'completed',
        result: {
          plan: 'Detailed test plan...',
          implementation: 'Test implementation code...',
          review: 'Code review feedback...',
        },
        metrics: {
          duration: 25000,
          agents_used: THREE,
          tokens_consumed: 1500,
        },
        agents_involved: ['planner', 'code_assistant', 'reviewer'],
      };

      mockOrchestrator.orchestrate.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/orchestration/orchestrate')
        .set('Authorization', 'Bearer valid-token')
        .send(orchestrationRequest);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('id', 'orchestration-123');
      expect(response.body.data).toHaveProperty('status', 'completed');
      expect(response.body.data.metrics).toHaveProperty('duration');
      expect(mockOrchestrator.orchestrate).toHaveBeenCalledWith(orchestrationRequest);
    });

    it('should validate required fields', async () => {
      const invalidRequest = {
        // Missing required task field
        context: { domain: 'testing' },
      };

      const response = await request(app)
        .post('/api/orchestration/orchestrate')
        .set('Authorization', 'Bearer valid-token')
        .send(invalidRequest);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('task');
    });

    it('should handle orchestration timeout', async () => {
      mockOrchestrator.orchestrate.mockResolvedValue({
        id: 'orchestration-timeout',
        status: 'timeout',
        partial_result: 'Partial completion...',
        error: 'Task exceeded maximum execution time',
      });

      const response = await request(app)
        .post('/api/orchestration/orchestrate')
        .set('Authorization', 'Bearer valid-token')
        .send({
          task: 'Complex long-running task',
          config: { timeout: 1000 }, // Very short timeout
        });

      expect(response.status).toBe(408);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('timeout');
    });

    it('should enforce maximum agent limit', async () => {
      const tooManyAgentsRequest = {
        task: 'Simple task',
        agents: Array(20).fill('agent'), // Too many agents
      };

      const response = await request(app)
        .post('/api/orchestration/orchestrate')
        .set('Authorization', 'Bearer valid-token')
        .send(tooManyAgentsRequest);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('maximum');
    });

    it('should sanitize task input', async () => {
      const maliciousTask = {
        task: 'Execute system command: <script>rm -rf /</script>',
        agents: ['planner'],
      };

      mockOrchestrator.orchestrate.mockResolvedValue({
        id: 'safe-orchestration',
        status: 'completed',
        result: 'Safe result',
      });

      const response = await request(app)
        .post('/api/orchestration/orchestrate')
        .set('Authorization', 'Bearer valid-token')
        .send(maliciousTask);

      expect(response.status).toBe(200);
      // Verify the task was sanitized
      expect(mockOrchestrator.orchestrate).toHaveBeenCalledWith(
        expect.objectContaining({
          task: expect.not.stringContaining('<script>'),
        })
      );
    });
  });

  describe('POST /api/orchestration/coordinate', () => {
    it('should coordinate multiple agents successfully', async () => {
      const coordinationRequest = {
        agents: [
          { id: 'agent-1', type: 'planner', config: { depth: 3 } },
          { id: 'agent-2', type: 'executor', config: { timeout: 15000 } },
          { id: 'agent-3', type: 'reviewer', config: { strict: true } },
        ],
        workflow: {
          type: 'sequential',
          dependencies: ['agent-1 → agent-2 → agent-3'],
        },
        shared_context: {
          project: 'universal-ai-tools',
          objective: 'Implement test coverage',
        },
      };

      const mockCoordinationResult = {
        id: 'coordination-456',
        status: 'success',
        workflow_execution: {
          'agent-1': { status: 'completed', output: 'Test plan created' },
          'agent-2': { status: 'completed', output: 'Tests implemented' },
          'agent-3': { status: 'completed', output: 'Review passed' },
        },
        metrics: {
          total_duration: 45000,
          parallel_efficiency: 0.85,
        },
      };

      mockOrchestrator.coordinate.mockResolvedValue(mockCoordinationResult);

      const response = await request(app)
        .post('/api/orchestration/coordinate')
        .set('Authorization', 'Bearer valid-token')
        .send(coordinationRequest);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('id', 'coordination-456');
      expect(response.body.data.workflow_execution).toHaveProperty('agent-1');
      expect(mockOrchestrator.coordinate).toHaveBeenCalledWith(coordinationRequest);
    });

    it('should handle agent coordination failures', async () => {
      mockOrchestrator.coordinate.mockResolvedValue({
        id: 'coordination-failed',
        status: 'failed',
        error: 'Agent-2 failed to execute',
        partial_results: {
          'agent-1': { status: 'completed', output: 'Plan created' },
          'agent-2': { status: 'failed', error: 'Resource unavailable' },
        },
      });

      const response = await request(app)
        .post('/api/orchestration/coordinate')
        .set('Authorization', 'Bearer valid-token')
        .send({
          agents: [
            { id: 'agent-1', type: 'planner' },
            { id: 'agent-2', type: 'failing-agent' },
          ],
        });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('partial_results');
    });

    it('should validate workflow dependencies', async () => {
      const invalidWorkflow = {
        agents: [
          { id: 'agent-1', type: 'planner' },
          { id: 'agent-2', type: 'executor' },
        ],
        workflow: {
          type: 'sequential',
          dependencies: ['agent-1 → non-existent-agent'], // Invalid dependency
        },
      };

      const response = await request(app)
        .post('/api/orchestration/coordinate')
        .set('Authorization', 'Bearer valid-token')
        .send(invalidWorkflow);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('dependency');
    });
  });

  describe('POST /api/orchestration/knowledge/search', () => {
    it('should search knowledge base with orchestration context', async () => {
      const searchRequest = {
        query: 'API testing best practices',
        context: {
          domain: 'testing',
          scope: 'api-endpoints',
        },
        rerank: true,
        limit: 15,
      };

      const mockSearchResults = [
        {
          id: 'knowledge-1',
          title: 'API Testing Guide',
          content: 'Comprehensive guide for API testing...',
          relevance_score: 0.94,
          context_match: 0.88,
        },
        {
          id: 'knowledge-2',
          title: 'Best Practices for REST APIs',
          content: 'Best practices and patterns...',
          relevance_score: 0.89,
          context_match: 0.85,
        },
      ];

      mockKnowledgeManager.search.mockResolvedValue(mockSearchResults);

      const response = await request(app)
        .post('/api/orchestration/knowledge/search')
        .set('Authorization', 'Bearer valid-token')
        .send(searchRequest);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0]).toHaveProperty('relevance_score');
      expect(mockKnowledgeManager.search).toHaveBeenCalledWith(searchRequest);
    });

    it('should apply context-aware filtering', async () => {
      const contextualSearch = {
        query: 'security testing',
        context: {
          domain: 'security',
          current_task: 'vulnerability_assessment',
          priority_areas: ['authentication', 'authorization'],
        },
      };

      mockKnowledgeManager.search.mockResolvedValue([]);

      const response = await request(app)
        .post('/api/orchestration/knowledge/search')
        .set('Authorization', 'Bearer valid-token')
        .send(contextualSearch);

      expect(response.status).toBe(200);
      expect(mockKnowledgeManager.search).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.objectContaining({
            priority_areas: ['authentication', 'authorization'],
          }),
        })
      );
    });
  });

  describe('POST /api/orchestration/knowledge/extract', () => {
    it('should extract knowledge from content', async () => {
      const extractionRequest = {
        content: `
          # API Testing Guidelines
          
          ## Authentication
          - Use JWT tokens for stateless authentication
          - Implement proper token refresh mechanisms
          
          ## Error Handling
          - Return appropriate HTTP status codes
          - Provide clear error messages
        `,
        type: 'documentation',
        metadata: {
          source: 'internal_docs',
          domain: 'api_testing',
        },
      };

      const mockExtractionResult = {
        extracted_knowledge: [
          {
            title: 'JWT Authentication for APIs',
            content: 'Use JWT tokens for stateless authentication...',
            type: 'best_practice',
            confidence: 0.92,
          },
          {
            title: 'API Error Handling',
            content: 'Return appropriate HTTP status codes...',
            type: 'guideline',
            confidence: 0.88,
          },
        ],
        metadata: {
          extraction_method: 'dspy_structured',
          processing_time: 1200,
          knowledge_density: 0.75,
        },
      };

      mockKnowledgeManager.extract.mockResolvedValue(mockExtractionResult);

      const response = await request(app)
        .post('/api/orchestration/knowledge/extract')
        .set('Authorization', 'Bearer valid-token')
        .send(extractionRequest);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data.extracted_knowledge).toHaveLength(2);
      expect(response.body.data.metadata).toHaveProperty('knowledge_density');
    });

    it('should handle content with no extractable knowledge', async () => {
      mockKnowledgeManager.extract.mockResolvedValue({
        extracted_knowledge: [],
        metadata: {
          extraction_method: 'dspy_structured',
          processing_time: 500,
          knowledge_density: 0.0,
        },
      });

      const response = await request(app)
        .post('/api/orchestration/knowledge/extract')
        .set('Authorization', 'Bearer valid-token')
        .send({
          content: 'Random noise and irrelevant content...',
          type: 'unknown',
        });

      expect(response.status).toBe(200);
      expect(response.body.data.extracted_knowledge).toHaveLength(0);
    });
  });

  describe('POST /api/orchestration/knowledge/evolve', () => {
    it('should evolve knowledge base based on usage patterns', async () => {
      const evolutionRequest = {
        knowledge_ids: ['knowledge-1', 'knowledge-2', 'knowledge-3'],
        evolution_type: 'consolidation',
        criteria: {
          similarity_threshold: 0.85,
          usage_frequency: 'high',
          recency_weight: 0.3,
        },
      };

      const mockEvolutionResult = {
        evolution_id: 'evolution-789',
        status: 'completed',
        changes: [
          {
            type: 'merge',
            source_ids: ['knowledge-1', 'knowledge-2'],
            result_id: 'knowledge-merged-1',
            confidence: 0.91,
          },
          {
            type: 'update',
            knowledge_id: 'knowledge-3',
            changes: ['improved_clarity', 'added_examples'],
            confidence: 0.87,
          },
        ],
        metrics: {
          knowledge_reduction: 0.33,
          quality_improvement: 0.15,
          processing_time: 8500,
        },
      };

      mockKnowledgeManager.evolve.mockResolvedValue(mockEvolutionResult);

      const response = await request(app)
        .post('/api/orchestration/knowledge/evolve')
        .set('Authorization', 'Bearer valid-token')
        .send(evolutionRequest);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('evolution_id', 'evolution-789');
      expect(response.body.data.changes).toHaveLength(2);
    });

    it('should require special permissions for knowledge evolution', async () => {
      // Mock user without evolution permissions
      (requireAuth as jest.Mock).mockImplementationOnce((req, res, next) => {
        req.user = { id: 'regular-user', email: 'user@example.com', role: 'user' };
        next();
      });

      const response = await request(app)
        .post('/api/orchestration/knowledge/evolve')
        .set('Authorization', 'Bearer valid-token')
        .send({
          knowledge_ids: ['knowledge-1'],
          evolution_type: 'consolidation',
        });

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('permission');
    });
  });

  describe('POST /api/orchestration/optimize/prompts', () => {
    it('should optimize prompts for better performance', async () => {
      const optimizationRequest = {
        prompts: [
          {
            id: 'prompt-1',
            content: 'Create a test plan for the API',
            current_performance: { accuracy: 0.75, efficiency: 0.68 },
          },
          {
            id: 'prompt-2',
            content: 'Review the code for security issues',
            current_performance: { accuracy: 0.82, efficiency: 0.71 },
          },
        ],
        optimization_criteria: {
          target_accuracy: 0.9,
          target_efficiency: 0.8,
          preserve_intent: true,
        },
      };

      const mockOptimizationResult = {
        optimization_id: 'opt-123',
        optimized_prompts: [
          {
            id: 'prompt-1',
            original: 'Create a test plan for the API',
            optimized:
              'Generate a comprehensive API test plan including unit, integration, and security tests',
            improvements: {
              accuracy: 0.89,
              efficiency: 0.84,
              clarity: 0.92,
            },
          },
          {
            id: 'prompt-2',
            original: 'Review the code for security issues',
            optimized:
              'Conduct a thorough security code review focusing on authentication, authorization, and input validation',
            improvements: {
              accuracy: 0.91,
              efficiency: 0.79,
              clarity: 0.88,
            },
          },
        ],
        metrics: {
          overall_improvement: 0.18,
          processing_time: 3200,
        },
      };

      mockOrchestrator.optimizePrompts.mockResolvedValue(mockOptimizationResult);

      const response = await request(app)
        .post('/api/orchestration/optimize/prompts')
        .set('Authorization', 'Bearer valid-token')
        .send(optimizationRequest);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data.optimized_prompts).toHaveLength(2);
      expect(response.body.data.metrics).toHaveProperty('overall_improvement');
    });
  });

  describe('GET /api/orchestration/status', () => {
    it('should return system orchestration status', async () => {
      const mockStatus = {
        system: {
          status: 'healthy',
          uptime: 86400000,
          version: '1.0.0',
        },
        agents: {
          active: 8,
          available: 12,
          busy: THREE,
          failed: 0,
        },
        orchestrations: {
          active: TWO,
          completed_today: 47,
          average_duration: 15000,
          success_rate: 0.94,
        },
        knowledge: {
          total_entries: 1247,
          indexed: 1245,
          pending: TWO,
          last_update: '2024-01-15T10:30:00Z',
        },
        performance: {
          avg_response_time: 1200,
          throughput: 150,
          error_rate: 0.02,
        },
      };

      mockOrchestrator.getStatus.mockResolvedValue(mockStatus);

      const response = await request(app)
        .get('/api/orchestration/status')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('system');
      expect(response.body.data).toHaveProperty('agents');
      expect(response.body.data).toHaveProperty('orchestrations');
      expect(response.body.data.agents).toHaveProperty('active', 8);
    });

    it('should include health check details', async () => {
      mockOrchestrator.getStatus.mockResolvedValue({
        system: { status: 'degraded' },
        health_checks: [
          { service: 'database', status: 'healthy', response_time: 45 },
          { service: 'redis', status: 'warning', response_time: 250 },
          { service: 'llm_service', status: 'healthy', response_time: 890 },
        ],
      });

      const response = await request(app)
        .get('/api/orchestration/status')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.data.health_checks).toHaveLength(3);
      expect(response.body.data.health_checks[1]).toHaveProperty('status', 'warning');
    });
  });

  describe('Security and Performance', () => {
    it('should enforce rate limiting on orchestration requests', async () => {
      // Mock multiple rapid orchestration requests
      const promises = Array(5)
        .fill(null)
        .map(() =>
          request(app)
            .post('/api/orchestration/orchestrate')
            .set('Authorization', 'Bearer valid-token')
            .send({
              task: 'Quick task',
              agents: ['planner'],
            })
        );

      const responses = await Promise.all(promises);
      const rateLimited = responses.some((r) => r.status === 429);
      expect(rateLimited).toBe(true);
    });

    it('should validate agent permissions', async () => {
      const restrictedAgentRequest = {
        task: 'Access sensitive system data',
        agents: ['system_admin_agent'], // Restricted agent
      };

      const response = await request(app)
        .post('/api/orchestration/orchestrate')
        .set('Authorization', 'Bearer valid-token')
        .send(restrictedAgentRequest);

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('permission');
    });

    it('should log orchestration activities for audit', async () => {
      const auditableRequest = {
        task: 'Generate security report',
        agents: ['security_analyst'],
        context: { classification: 'confidential' },
      };

      mockOrchestrator.orchestrate.mockResolvedValue({
        id: 'audit-orchestration',
        status: 'completed',
        audit_logged: true,
      });

      const response = await request(app)
        .post('/api/orchestration/orchestrate')
        .set('Authorization', 'Bearer valid-token')
        .send(auditableRequest);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('audit_logged', true);
    });
  });
});
