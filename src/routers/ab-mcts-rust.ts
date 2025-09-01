/**
 * AB-MCTS Rust Service API Router
 * 
 * Provides REST API endpoints for the high-performance AB-MCTS Rust service.
 * Enables TypeScript orchestration with Rust algorithmic performance.
 */

import express from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { log, LogContext } from '../utils/logger';
import { validateRequest } from '../middleware/validation';
import { abMCTSRustService, AgentContext, SearchOptions, RewardFeedback } from '../services/ab-mcts-rust-integration';
// import { performanceMonitor } from '../../scripts/performance-monitor';

// const logger = Logger.child({ router: 'ab-mcts-rust' });
const router = express.Router();

// Rate limiting for resource-intensive operations
const searchRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 searches per minute per IP
  message: { error: 'Too many search requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

const recommendRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 200, // 200 recommendations per minute per IP
  message: { error: 'Too many recommendation requests, please try again later' },
});

// Validation schemas
const AgentContextSchema = z.object({
  task: z.string().min(1).max(10000),
  requirements: z.array(z.string()).default([]),
  constraints: z.array(z.string()).default([]),
  contextData: z.record(z.any()).default({}),
  userPreferences: z.object({
    preferredAgents: z.array(z.string()).optional(),
    qualityVsSpeed: z.number().min(0).max(1).optional(),
    maxCost: z.number().positive().optional(),
    timeoutMs: z.number().positive().optional(),
  }).optional(),
  executionContext: z.object({
    sessionId: z.string().min(1),
    userId: z.string().optional(),
    timestamp: z.number().optional().default(Date.now),
    budget: z.number().positive().default(100),
    priority: z.enum(['Low', 'Normal', 'High', 'Critical']).default('Normal'),
  }),
});

const SearchOptionsSchema = z.object({
  maxIterations: z.number().positive().max(10000).optional(),
  maxDepth: z.number().positive().max(50).optional(),
  timeLimitMs: z.number().positive().max(300000).optional(), // Max 5 minutes
  explorationConstant: z.number().positive().optional(),
  discountFactor: z.number().min(0).max(1).optional(),
  parallelSimulations: z.number().positive().max(16).optional(),
  checkpointInterval: z.number().positive().optional(),
  enableCaching: z.boolean().optional(),
  verboseLogging: z.boolean().optional(),
});

const RewardFeedbackSchema = z.object({
  value: z.number().min(0).max(1),
  components: z.object({
    quality: z.number().min(0).max(1),
    speed: z.number().min(0).max(1),
    cost: z.number().min(0).max(1),
    userSatisfaction: z.number().min(0).max(1).optional(),
  }),
  metadata: z.object({
    tokensUsed: z.number().nonnegative(),
    apiCallsMade: z.number().nonnegative(),
    executionTimeMs: z.number().nonnegative(),
    agentPerformance: z.record(z.number()).default({}),
  }),
});

/**
 * POST /api/v1/ab-mcts-rust/search
 * Perform optimal agent search using MCTS algorithm
 */
router.post('/search', searchRateLimit, validateRequest(z.object({
  context: AgentContextSchema,
  availableAgents: z.array(z.string().min(1)).min(1).max(100),
  options: SearchOptionsSchema.optional(),
})), async (req, res) => {
  const startTime = performance.now();
  
  try {
    const { context, availableAgents, options } = req.body;
    
    log.info('AB-MCTS search requested', LogContext.API, {
      sessionId: context.executionContext.sessionId,
      agentCount: availableAgents.length,
      task: context.task.substring(0, 100) + (context.task.length > 100 ? '...' : ''),
    });

    // Check service health
    const isHealthy = await abMCTSRustService.isHealthy();
    if (!isHealthy) {
      return res.status(503).json({
        error: 'AB-MCTS Rust service is not available',
        fallback: 'TypeScript implementation available',
        timestamp: new Date().toISOString(),
      });
    }

    const result = await abMCTSRustService.searchOptimalAgents(context, availableAgents, options);
    
    const duration = performance.now() - startTime;
    
    // Record performance metrics
    // performanceMonitor.recordMetric('ab_mcts_api_search_duration', duration);
    // performanceMonitor.recordMetric('ab_mcts_api_search_confidence', result.confidence);
    
    log.info('AB-MCTS search completed successfully', LogContext.API, {
      sessionId: context.executionContext.sessionId,
      durationMs: duration.toFixed(2),
      confidence: result.confidence.toFixed(3),
      nodesExplored: result.searchStatistics.nodesExplored,
      bestPathLength: result.bestPath.length,
    });

    return res.json({
      success: true,
      result,
      metadata: {
        durationMs: duration,
        timestamp: new Date().toISOString(),
        version: 'rust-0.1.0',
      },
    });

  } catch (error) {
    const duration = performance.now() - startTime;
    log.error('AB-MCTS search failed', LogContext.API, { 
      error: error instanceof Error ? error.message : String(error),
      durationMs: duration.toFixed(2),
    });

    // performanceMonitor.recordMetric('ab_mcts_api_search_errors', 1);

    return res.status(500).json({
      error: 'Search operation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      durationMs: duration,
    });
  }
});

/**
 * POST /api/v1/ab-mcts-rust/recommend
 * Get quick agent recommendations
 */
router.post('/recommend', recommendRateLimit, validateRequest(z.object({
  context: AgentContextSchema,
  availableAgents: z.array(z.string().min(1)).min(1).max(100),
  maxRecommendations: z.number().positive().max(20).default(3),
})), async (req, res) => {
  const startTime = performance.now();
  
  try {
    const { context, availableAgents, maxRecommendations } = req.body;
    
    log.debug('AB-MCTS recommendations requested', LogContext.API, {
      sessionId: context.executionContext.sessionId,
      agentCount: availableAgents.length,
      maxRecommendations,
    });

    const isHealthy = await abMCTSRustService.isHealthy();
    if (!isHealthy) {
      return res.status(503).json({
        error: 'AB-MCTS Rust service is not available',
        fallback: 'TypeScript implementation available',
        timestamp: new Date().toISOString(),
      });
    }

    const result = await abMCTSRustService.recommendAgents(context, availableAgents, maxRecommendations);
    
    const duration = performance.now() - startTime;
    
    // performanceMonitor.recordMetric('ab_mcts_api_recommend_duration', duration);
    // performanceMonitor.recordMetric('ab_mcts_api_recommend_count', result.recommendations.length);
    
    log.debug('AB-MCTS recommendations completed', LogContext.API, {
      sessionId: context.executionContext.sessionId,
      durationMs: duration.toFixed(2),
      recommendationCount: result.recommendations.length,
    });

    return res.json({
      success: true,
      result,
      metadata: {
        durationMs: duration,
        timestamp: new Date().toISOString(),
        version: 'rust-0.1.0',
      },
    });

  } catch (error) {
    const duration = performance.now() - startTime;
    log.error('AB-MCTS recommendations failed', LogContext.API, { 
      error: error instanceof Error ? error.message : String(error),
      durationMs: duration.toFixed(2),
    });

    // performanceMonitor.recordMetric('ab_mcts_api_recommend_errors', 1);

    return res.status(500).json({
      error: 'Recommendation operation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      durationMs: duration,
    });
  }
});

/**
 * POST /api/v1/ab-mcts-rust/feedback
 * Update service with execution feedback
 */
router.post('/feedback', validateRequest(z.object({
  sessionId: z.string().min(1),
  agentName: z.string().min(1),
  reward: RewardFeedbackSchema,
})), async (req, res) => {
  try {
    const { sessionId, agentName, reward } = req.body;
    
    const isHealthy = await abMCTSRustService.isHealthy();
    if (!isHealthy) {
      return res.status(503).json({
        error: 'AB-MCTS Rust service is not available',
        timestamp: new Date().toISOString(),
      });
    }

    await abMCTSRustService.updateWithFeedback(sessionId, agentName, reward);
    
    log.debug('AB-MCTS feedback updated', LogContext.API, {
      sessionId,
      agentName,
      rewardValue: reward.value,
    });

    return res.json({
      success: true,
      message: 'Feedback updated successfully',
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    log.error('AB-MCTS feedback update failed', LogContext.API, { 
      error: error instanceof Error ? error.message : String(error),
    });

    return res.status(500).json({
      error: 'Feedback update failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/v1/ab-mcts-rust/health
 * Check service health and status
 */
router.get('/health', async (req, res) => {
  try {
    const isHealthy = await abMCTSRustService.isHealthy();
    const stats = isHealthy ? await abMCTSRustService.getPerformanceStats() : null;

    res.json({
      healthy: isHealthy,
      status: isHealthy ? 'operational' : 'unavailable',
      service: 'ab-mcts-rust-service',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
      performanceStats: stats,
    });

  } catch (error) {
    log.error('Health check failed', LogContext.API, { 
      error: error instanceof Error ? error.message : String(error),
    });

    res.status(503).json({
      healthy: false,
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/v1/ab-mcts-rust/stats
 * Get detailed performance statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const isHealthy = await abMCTSRustService.isHealthy();
    if (!isHealthy) {
      return res.status(503).json({
        error: 'AB-MCTS Rust service is not available',
        timestamp: new Date().toISOString(),
      });
    }

    const stats = await abMCTSRustService.getPerformanceStats();
    
    return res.json({
      success: true,
      stats,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    log.error('Failed to get performance stats', LogContext.API, { 
      error: error instanceof Error ? error.message : String(error),
    });

    return res.status(500).json({
      error: 'Failed to retrieve performance statistics',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * POST /api/v1/ab-mcts-rust/test
 * Test endpoint for development and validation
 */
router.post('/test', validateRequest(z.object({
  testType: z.enum(['simple', 'complex', 'load']).default('simple'),
  agentCount: z.number().positive().max(20).default(4),
})), async (req, res) => {
  try {
    const { testType, agentCount } = req.body;
    
    // Create test data
    const context: AgentContext = {
      task: `Test ${testType} scenario for AB-MCTS Rust service`,
      requirements: ['high_performance', 'accurate_results'],
      constraints: ['max_time_limit', 'resource_efficient'],
      contextData: { testType, agentCount },
      executionContext: {
        sessionId: `test-session-${Date.now()}`,
        userId: 'test-user',
        timestamp: Date.now(),
        budget: 100,
        priority: 'Normal' as const
      }
    };
    
    const availableAgents = Array.from({ length: agentCount }, (_, i) => 
      `test-agent-${i + 1}`
    );
    
    const options: SearchOptions = {
      maxIterations: testType === 'simple' ? 50 : testType === 'complex' ? 200 : 500,
      timeLimitMs: testType === 'simple' ? 1000 : testType === 'complex' ? 3000 : 10000,
      explorationConstant: 1.414,
      discountFactor: 0.9,
      enableCaching: true,
      verboseLogging: false
    };

    const startTime = performance.now();
    const result = await abMCTSRustService.searchOptimalAgents(context, availableAgents, options);
    const duration = performance.now() - startTime;
    
    log.info(`AB-MCTS test completed: ${testType}`, LogContext.API, {
      agentCount,
      durationMs: duration.toFixed(2),
      confidence: result.confidence.toFixed(3),
      nodesExplored: result.searchStatistics.nodesExplored,
    });

    return res.json({
      success: true,
      testType,
      result: {
        confidence: result.confidence,
        searchStatistics: result.searchStatistics,
        bestPathLength: result.bestPath.length,
        recommendationCount: result.agentRecommendations.length,
      },
      performance: {
        durationMs: duration,
        throughput: result.searchStatistics.nodesExplored / (duration / 1000),
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    log.error('AB-MCTS test failed', LogContext.API, { 
      error: error instanceof Error ? error.message : String(error),
    });

    return res.status(500).json({
      error: 'Test operation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;