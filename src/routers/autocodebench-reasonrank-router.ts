/**
 * AutoCodeBench and ReasonRank API Router
 * Provides REST endpoints for automated code generation, testing, and reasoning-intensive ranking
 */

import { Router } from 'express';
import { z } from 'zod';

import EnhancedReasoningAgent from '@/agents/enhanced-reasoning-agent';
import { autoCodeBenchService } from '@/services/autocodebench-service';
import { type Passage, type RankingQuery,reasonRankService } from '@/services/reasonrank-service';
import { log, LogContext } from '@/utils/logger';
import type { AgentContext } from '@/types';

// Create instance of the enhanced reasoning agent
const enhancedReasoningAgent = new EnhancedReasoningAgent();

const router = Router();

// Request validation schemas
const GenerateProblemRequestSchema = z.object({
  language: z.string().min(1),
  difficulty: z.enum(['easy', 'medium', 'hard', 'expert']).default('medium'),
  category: z.string().min(1),
  complexity: z.enum(['single', 'multi-logical']).default('single'),
});

const SolveProblemRequestSchema = z.object({
  problemId: z.string().optional(),
  language: z.string().min(1),
  approach: z.string().default('step_by_step'),
  customProblem: z.string().optional(),
});

const RankPassagesRequestSchema = z.object({
  query: z.string().min(1),
  passages: z.array(
    z.object({
      id: z.string().optional(),
      content: z.string().min(1),
      metadata: z.record(z.any()).optional(),
      source: z.string().optional(),
    })
  ),
  topK: z.number().min(1).max(100).default(10),
  domain: z.enum(['general', 'coding', 'math', 'qa', 'web-search']).default('general'),
  complexity: z.enum(['simple', 'moderate', 'complex']).default('moderate'),
});

const GenerateTestsRequestSchema = z.object({
  code: z.string().min(1),
  language: z.string().min(1),
  testType: z.enum(['basic', 'comprehensive', 'edge-cases', 'security']).default('comprehensive'),
});

const ExecuteCodeRequestSchema = z.object({
  code: z.string().min(1),
  language: z.string().min(1),
  testCases: z.array(
    z.object({
      input: z.string(),
      expectedOutput: z.string(),
    })
  ),
  timeout: z.number().min(1000).max(60000).default(30000),
});

const AnalyzeCodeRequestSchema = z.object({
  code: z.string().min(1),
  language: z.string().min(1),
  context: z.string().optional(),
});

const ImproveCodeRequestSchema = z.object({
  code: z.string().min(1),
  language: z.string().min(1),
  focus: z.enum(['all', 'performance', 'security', 'readability', 'structure']).default('all'),
});

const ExplainReasoningRequestSchema = z.object({
  query: z.string().min(1),
  context: z.string().optional(),
  approach: z.enum(['detailed', 'concise', 'step-by-step', 'analytical']).default('detailed'),
});

// Health check endpoint
router.get('/health', (req, res) => {
  return res.json({
    status: 'healthy',
    services: {
      autoCodeBench: 'active',
      reasonRank: 'active',
      enhancedReasoningAgent: 'active',
    },
    timestamp: new Date().toISOString(),
  });
});

// AutoCodeBench endpoints

/**
 * POST /api/autocodebench/generate-problem
 * Generate a new programming problem using AutoCodeBench
 */
router.post('/generate-problem', async (req, res) => {
  try {
    const validatedData = GenerateProblemRequestSchema.parse(req.body);

    log.info('🚀 Generating programming problem via API', LogContext.API, {
      language: validatedData.language,
      difficulty: validatedData.difficulty,
      category: validatedData.category,
      complexity: validatedData.complexity,
    });

    const problem = await autoCodeBenchService.generateProblem(validatedData);

    return res.json({
      success: true,
      data: problem,
      metadata: {
        generatedAt: new Date().toISOString(),
        service: 'AutoCodeBench',
        language: problem.language,
        difficulty: problem.difficulty,
      },
    });
  } catch (error) {
    log.error('❌ Failed to generate problem via API', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
      body: req.body,
    });

    return res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * POST /api/autocodebench/solve-problem
 * Solve a programming problem with reasoning
 */
router.post('/solve-problem', async (req, res) => {
  try {
    const validatedData = SolveProblemRequestSchema.parse(req.body);

    log.info('🧩 Solving programming problem via API', LogContext.API, {
      language: validatedData.language,
      approach: validatedData.approach,
      hasCustomProblem: !!validatedData.customProblem,
    });

    let result;
    if (validatedData.customProblem) {
      // Use the enhanced reasoning agent for custom problems
      result = await enhancedReasoningAgent.execute({
        query: `Solve this ${validatedData.language} problem: ${validatedData.customProblem}`,
        userRequest: validatedData.customProblem,
        requestId: 'autocodebench-' + Date.now(),
      });
    } else {
      // Use AutoCodeBench service
      result = await autoCodeBenchService.generateProblem({
        language: validatedData.language,
        difficulty: 'medium',
        category: 'algorithms',
        complexity: 'single',
      });
    }

    return res.json({
      success: true,
      data: result,
      metadata: {
        solvedAt: new Date().toISOString(),
        service: 'AutoCodeBench',
        language: validatedData.language,
        approach: validatedData.approach,
      },
    });
  } catch (error) {
    log.error('❌ Failed to solve problem via API', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
      body: req.body,
    });

    return res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * POST /api/autocodebench/execute-code
 * Execute code in sandbox environment
 */
router.post('/execute-code', async (req, res) => {
  try {
    const validatedData = ExecuteCodeRequestSchema.parse(req.body);

    log.info('🔒 Executing code in sandbox via API', LogContext.API, {
      language: validatedData.language,
      testCaseCount: validatedData.testCases.length,
      timeout: validatedData.timeout,
    });

    const results = await autoCodeBenchService.executeInSandbox(
      validatedData.code,
      validatedData.language,
      validatedData.testCases
    );

    return res.json({
      success: true,
      data: {
        results,
        summary: {
          totalTests: results.length,
          passedTests: results.filter((r) => r.passed).length,
          failedTests: results.filter((r) => !r.passed).length,
          successRate: (results.filter((r) => r.passed).length / results.length) * 100,
          averageExecutionTime:
            results.reduce((sum, r) => sum + r.executionTime, 0) / results.length,
        },
      },
      metadata: {
        executedAt: new Date().toISOString(),
        service: 'AutoCodeBench',
        language: validatedData.language,
        executionTime: Date.now() - Date.now(), // Will be calculated properly
      },
    });
  } catch (error) {
    log.error('❌ Failed to execute code via API', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
      body: req.body,
    });

    return res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/autocodebench/problems
 * Get all generated problems
 */
router.get('/problems', (req, res) => {
  try {
    const problems = autoCodeBenchService.getProblems();

    return res.json({
      success: true,
      data: problems,
      metadata: {
        count: problems.length,
        retrievedAt: new Date().toISOString(),
        service: 'AutoCodeBench',
      },
    });
  } catch (error) {
    log.error('❌ Failed to retrieve problems via API', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
    });

    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/autocodebench/problems/:id
 * Get a specific problem by ID
 */
router.get('/problems/:id', (req, res) => {
  try {
    const { id } = req.params;
    const problem = autoCodeBenchService.getProblem(id);

    if (!problem) {
      return res.status(404).json({
        success: false,
        error: 'Problem not found',
        timestamp: new Date().toISOString(),
      });
    }

    return res.json({
      success: true,
      data: problem,
      metadata: {
        retrievedAt: new Date().toISOString(),
        service: 'AutoCodeBench',
      },
    });
  } catch (error) {
    log.error('❌ Failed to retrieve problem via API', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
      problemId: req.params.id,
    });

    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/autocodebench/metrics
 * Get AutoCodeBench performance metrics
 */
router.get('/metrics', (req, res) => {
  try {
    const metrics = autoCodeBenchService.getPerformanceMetrics();

    return res.json({
      success: true,
      data: metrics,
      metadata: {
        retrievedAt: new Date().toISOString(),
        service: 'AutoCodeBench',
      },
    });
  } catch (error) {
    log.error('❌ Failed to retrieve metrics via API', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
    });

    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date().toISOString(),
    });
  }
});

// ReasonRank endpoints

/**
 * POST /api/reasonrank/rank-passages
 * Rank passages using reasoning-intensive approach
 */
router.post('/rank-passages', async (req, res) => {
  try {
    const validatedData = RankPassagesRequestSchema.parse(req.body);

    log.info('📊 Ranking passages via API', LogContext.API, {
      query: validatedData.query.substring(0, 100),
      passageCount: validatedData.passages.length,
      topK: validatedData.topK,
      domain: validatedData.domain,
      complexity: validatedData.complexity,
    });

    // Convert to ReasonRank format
    const passages: Passage[] = validatedData.passages.map((p, index) => ({
      id: p.id || `passage_${index}`,
      content: p.content,
      metadata: p.metadata || {},
      source: p.source,
    }));

    const rankingQuery: RankingQuery = {
      query: validatedData.query,
      domain: validatedData.domain,
      complexity: validatedData.complexity,
      reasoningRequired: true,
    };

    const results = await reasonRankService.rankPassages(rankingQuery, passages, {
      topK: validatedData.topK,
      includeReasoning: true,
      useMultiViewRewards: true,
    });

    return res.json({
      success: true,
      data: {
        results,
        summary: {
          totalPassages: passages.length,
          rankedPassages: results.length,
          query: validatedData.query,
          domain: validatedData.domain,
          complexity: validatedData.complexity,
        },
      },
      metadata: {
        rankedAt: new Date().toISOString(),
        service: 'ReasonRank',
        reasoningEnabled: true,
        multiViewRewardsEnabled: true,
      },
    });
  } catch (error) {
    log.error('❌ Failed to rank passages via API', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
      body: req.body,
    });

    return res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * POST /api/reasonrank/generate-training-data
 * Generate training data for fine-tuning
 */
router.post('/generate-training-data', async (req, res) => {
  try {
    const {
      queries,
      passages,
      domain = 'general',
      complexity = 'moderate',
      maxExamples = 100,
    } = req.body;

    if (!Array.isArray(queries) || !Array.isArray(passages)) {
          return res.status(400).json({
        success: false,
        error: 'queries and passages must be arrays',
        timestamp: new Date().toISOString(),
      });
    }

    log.info('📚 Generating training data via API', LogContext.API, {
      queryCount: queries.length,
      passageCount: passages.length,
      domain,
      complexity,
      maxExamples,
    });

    // Convert to ReasonRank format
    const reasonRankPassages: Passage[] = passages.map((p: any, index: number) => ({
      id: p.id || `passage_${index}`,
      content: p.content,
      metadata: p.metadata || {},
      source: p.source,
      timestamp: p.timestamp ? new Date(p.timestamp) : new Date(),
    }));

    const trainingData = await reasonRankService.generateTrainingData(queries, reasonRankPassages, {
      domain,
      complexity,
      maxExamples,
    });

    return res.json({
      success: true,
      data: {
        trainingData,
        summary: {
          generatedExamples: trainingData.length,
          totalQueries: queries.length,
          totalPassages: passages.length,
          domain,
          complexity,
        },
      },
      metadata: {
        generatedAt: new Date().toISOString(),
        service: 'ReasonRank',
      },
    });
  } catch (error) {
    log.error('❌ Failed to generate training data via API', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
      body: req.body,
    });

    return res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/reasonrank/training-data
 * Get generated training data
 */
router.get('/training-data', (req, res) => {
  try {
    const trainingData = reasonRankService.getTrainingData();

    return res.json({
      success: true,
      data: trainingData,
      metadata: {
        count: trainingData.length,
        retrievedAt: new Date().toISOString(),
        service: 'ReasonRank',
      },
    });
  } catch (error) {
    log.error('❌ Failed to retrieve training data via API', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
    });

    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/reasonrank/metrics
 * Get ReasonRank performance metrics
 */
router.get('/metrics', (req, res) => {
  try {
    const metrics = reasonRankService.getPerformanceMetrics();

    return res.json({
      success: true,
      data: metrics,
      metadata: {
        retrievedAt: new Date().toISOString(),
        service: 'ReasonRank',
      },
    });
  } catch (error) {
    log.error('❌ Failed to retrieve metrics via API', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
    });

    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date().toISOString(),
    });
  }
});

// Enhanced Reasoning Agent endpoints

/**
 * POST /api/reasoning-agent/execute
 * Execute reasoning-intensive tasks using the enhanced agent
 */
router.post('/execute', async (req, res) => {
  try {
    const { query, context, capabilities } = req.body;

    if (!query) {
          return res.status(400).json({
        success: false,
        error: 'query is required',
        timestamp: new Date().toISOString(),
      });
    }

    log.info('🧠 Executing reasoning agent via API', LogContext.API, {
      query: query.substring(0, 100),
      hasContext: !!context,
      capabilities: capabilities || 'default',
    });

    const agentContext: AgentContext = {
      userRequest: query,
      requestId: `reasoning-${Date.now()}`,
      metadata: {
        context,
        capabilities,
        endpoint: '/execute'
      }
    };

    const result = await enhancedReasoningAgent.execute(agentContext);

    return res.json({
      success: result.success,
      data: result.content,
      metadata: {
        executedAt: new Date().toISOString(),
        service: 'Enhanced Reasoning Agent',
        agent: enhancedReasoningAgent.getName(),
        capabilities: enhancedReasoningAgent.getCapabilities(),
        reasoningHistory: [], // TODO: Implement reasoning history tracking
      },
      error: !result.success ? (result as any).error || 'Operation failed' : undefined,
    });
  } catch (error) {
    log.error('❌ Failed to execute reasoning agent via API', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
      body: req.body,
    });

    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * POST /api/reasoning-agent/generate-tests
 * Generate automated tests for code
 */
router.post('/generate-tests', async (req, res) => {
  try {
    const validatedData = GenerateTestsRequestSchema.parse(req.body);

    log.info('🧪 Generating tests via reasoning agent API', LogContext.API, {
      language: validatedData.language,
      testType: validatedData.testType,
      codeLength: validatedData.code.length,
    });

    const result = await enhancedReasoningAgent.execute({
      query: `Generate ${validatedData.testType} tests for this ${validatedData.language} code`,
      userRequest: validatedData.code,
      requestId: 'test-generation-' + Date.now(),
    });

    return res.json({
      success: result.success,
      data: result.content,
      metadata: {
        generatedAt: new Date().toISOString(),
        service: 'Enhanced Reasoning Agent',
        agent: enhancedReasoningAgent.getName(),
        language: validatedData.language,
        testType: validatedData.testType,
      },
      error: !result.success ? (result as any).error || 'Operation failed' : undefined,
    });
  } catch (error) {
    log.error('❌ Failed to generate tests via API', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
      body: req.body,
    });

    return res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * POST /api/reasoning-agent/analyze-code
 * Analyze code for quality and improvements
 */
router.post('/analyze-code', async (req, res) => {
  try {
    const validatedData = AnalyzeCodeRequestSchema.parse(req.body);

    log.info('🔍 Analyzing code via reasoning agent API', LogContext.API, {
      language: validatedData.language,
      codeLength: validatedData.code.length,
      hasContext: !!validatedData.context,
    });

    const result = await enhancedReasoningAgent.execute({
      query: `Analyze this ${validatedData.language} code for quality, efficiency, maintainability, and security`,
      userRequest: validatedData.context || validatedData.code,
      requestId: 'code-analysis-' + Date.now(),
    });

    return res.json({
      success: result.success,
      data: result.content,
      metadata: {
        analyzedAt: new Date().toISOString(),
        service: 'Enhanced Reasoning Agent',
        agent: enhancedReasoningAgent.getName(),
        language: validatedData.language,
      },
      error: !result.success ? (result as any).error || 'Operation failed' : undefined,
    });
  } catch (error) {
    log.error('❌ Failed to analyze code via API', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
      body: req.body,
    });

    return res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * POST /api/reasoning-agent/improve-code
 * Improve code quality using reasoning
 */
router.post('/improve-code', async (req, res) => {
  try {
    const validatedData = ImproveCodeRequestSchema.parse(req.body);

    log.info('✨ Improving code via reasoning agent API', LogContext.API, {
      language: validatedData.language,
      focus: validatedData.focus,
      codeLength: validatedData.code.length,
    });

    const result = await enhancedReasoningAgent.execute({
      query: `Improve this ${validatedData.language} code focusing on ${validatedData.focus}`,
      userRequest: validatedData.code,
      requestId: 'code-improvement-' + Date.now(),
    });

    return res.json({
      success: result.success,
      data: result.content,
      metadata: {
        improvedAt: new Date().toISOString(),
        service: 'Enhanced Reasoning Agent',
        agent: enhancedReasoningAgent.getName(),
        language: validatedData.language,
        focus: validatedData.focus,
      },
      error: !result.success ? (result as any).error || 'Operation failed' : undefined,
    });
  } catch (error) {
    log.error('❌ Failed to improve code via API', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
      body: req.body,
    });

    return res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * POST /api/reasoning-agent/explain-reasoning
 * Get detailed explanation of reasoning process
 */
router.post('/explain-reasoning', async (req, res) => {
  try {
    const validatedData = ExplainReasoningRequestSchema.parse(req.body);

    log.info('💭 Explaining reasoning via API', LogContext.API, {
      query: validatedData.query.substring(0, 100),
      approach: validatedData.approach,
      hasContext: !!validatedData.context,
    });

    const result = await enhancedReasoningAgent.execute({
      query: `Explain your reasoning process for: ${validatedData.query}`,
      userRequest: validatedData.context || validatedData.query,
      requestId: 'reasoning-explanation-' + Date.now(),
    });

    return res.json({
      success: result.success,
      data: result.content,
      metadata: {
        explainedAt: new Date().toISOString(),
        service: 'Enhanced Reasoning Agent',
        agent: enhancedReasoningAgent.getName(),
        approach: validatedData.approach,
      },
      error: !result.success ? (result as any).error || 'Operation failed' : undefined,
    });
  } catch (error) {
    log.error('❌ Failed to explain reasoning via API', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
      body: req.body,
    });

    return res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/reasoning-agent/capabilities
 * Get agent capabilities and status
 */
router.get('/capabilities', (req, res) => {
  try {
    const capabilities = enhancedReasoningAgent.getCapabilities();
    const reasoningHistory: any[] = []; // TODO: Implement reasoning history tracking

    return res.json({
      success: true,
      data: {
        agent: {
          name: enhancedReasoningAgent.getName(),
          description: enhancedReasoningAgent.getDescription(),
          capabilities,
          priority: enhancedReasoningAgent.getPriority(),
        },
        status: {
          isInitialized: true,
          totalReasoningTasks: reasoningHistory.length,
          recentReasoningTasks: reasoningHistory.slice(-10), // Last 10 tasks
        },
      },
      metadata: {
        retrievedAt: new Date().toISOString(),
        service: 'Enhanced Reasoning Agent',
      },
    });
  } catch (error) {
    log.error('❌ Failed to retrieve capabilities via API', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
    });

    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date().toISOString(),
    });
  }
});

// Utility endpoints

/**
 * GET /api/status
 * Get overall system status
 */
router.get('/status', (req, res) => {
  try {
    const autoCodeBenchMetrics = autoCodeBenchService.getPerformanceMetrics();
    const reasonRankMetrics = reasonRankService.getPerformanceMetrics();

    return res.json({
      success: true,
      data: {
        services: {
          autoCodeBench: {
            status: 'active',
            metrics: autoCodeBenchMetrics,
          },
          reasonRank: {
            status: 'active',
            metrics: reasonRankMetrics,
          },
          enhancedReasoningAgent: {
            status: 'active',
            capabilities: enhancedReasoningAgent.getCapabilities(),
          },
        },
        system: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          timestamp: new Date().toISOString(),
        },
      },
      metadata: {
        retrievedAt: new Date().toISOString(),
        version: '1.0.0',
      },
    });
  } catch (error) {
    log.error('❌ Failed to retrieve system status via API', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
    });

    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
