/**
 * Alpha Evolve Router
 * API endpoints for the self-improving evolution system
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { AlphaEvolveCoordinator } from '../services/alpha-evolve-coordinator.js';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { asyncHandler } from '../utils/async-wrapper.js';
import { sendError, sendSuccess } from '../utils/api-response.js';

const router = Router();

// Initialize Supabase client
const supabase = createClient(config.supabase.url, config.supabase.anonKey);

// Initialize Alpha Evolve Coordinator
let coordinator: AlphaEvolveCoordinator | null = null;

// Ensure coordinator is initialized
const ensureCoordinator = async () => {
  if (!coordinator) {
    coordinator = new AlphaEvolveCoordinator(supabase);
    logger.info('Alpha Evolve Coordinator initialized');
  }
  return coordinator;
};

/**
 * Submit a task for evolved processing
 */
router.post(
  '/tasks',
  asyncHandler(async (req: Request, res: Response) => {
    const { agentId, taskType, context, priority = 5 } = req.body;

    if (!agentId || !taskType || !context) {
      return res.status(400).json({ error: 'Missing required fields: agentId, taskType, context' });
    }

    try {
      const coord = await ensureCoordinator();
      const taskId = await coord.submitTask(agentId, taskType, context, priority);

      return res.status(200).json( {
        taskId,
        message: 'Task submitted successfully',
      });
    } catch (error) {
      logger.error('Failed to submit task:', error);
      return res.status(500).json({ error: 'Failed to submit task' });
    }
  })
);

/**
 * Get task status
 */
router.get(
  '/tasks/:taskId',
  asyncHandler(async (req: Request, res: Response) => {
    const { taskId } = req.params;

    try {
      const coord = await ensureCoordinator();
      const status = await coord.getTaskStatus(taskId);

      if (!status) {
        return res.status(404).json({ error: 'Task not found' });
      }

      return res.status(200).json( status);
    } catch (error) {
      logger.error('Failed to get task status:', error);
      return res.status(500).json({ error: 'Failed to get task status' });
    }
  })
);

/**
 * Get global evolution status
 */
router.get(
  '/status',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const coord = await ensureCoordinator();
      const status = await coord.getGlobalStatus();

      return res.status(200).json( status);
    } catch (error) {
      logger.error('Failed to get global status:', error);
      return res.status(500).json({ error: 'Failed to get global status' });
    }
  })
);

/**
 * Get agent-specific evolution details
 */
router.get(
  '/agents/:agentId/evolution',
  asyncHandler(async (req: Request, res: Response) => {
    const { agentId } = req.params;

    try {
      const coord = await ensureCoordinator();
      const evolution = await coord.getAgentEvolution(agentId);

      if (!evolution) {
        return res.status(404).json({ error: 'Agent not found' });
      }

      return res.status(200).json( evolution);
    } catch (error) {
      logger.error('Failed to get agent evolution:', error);
      return res.status(500).json({ error: 'Failed to get agent evolution' });
    }
  })
);

/**
 * Get cross-learning history
 */
router.get(
  '/cross-learning',
  asyncHandler(async (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string, 10) || 50;

    try {
      const coord = await ensureCoordinator();
      const history = await coord.getCrossLearningHistory(limit);

      return res.status(200).json( {
        history,
        total: history.length,
      });
    } catch (error) {
      logger.error('Failed to get cross-learning history:', error);
      return res.status(500).json({ error: 'Failed to get cross-learning history' });
    }
  })
);

/**
 * Trigger manual evolution for an agent
 */
router.post(
  '/agents/:agentId/evolve',
  asyncHandler(async (req: Request, res: Response) => {
    const { agentId } = req.params;

    try {
      const coord = await ensureCoordinator();

      // Submit a special evolution task
      const taskId = await coord.submitTask(
        agentId,
        'manual_evolution',
        { trigger: 'api', timestamp: new Date() },
        10 // Highest priority
      );

      return res.status(200).json( {
        message: 'Evolution triggered',
        taskId,
      });
    } catch (error) {
      logger.error('Failed to trigger evolution:', error);
      return res.status(500).json({ error: 'Failed to trigger evolution' });
    }
  })
);

/**
 * Get evolution insights and recommendations
 */
router.get(
  '/insights',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const coord = await ensureCoordinator();
      const status = await coord.getGlobalStatus();

      // Analyze current state and generate insights
      const insights = {
        performance: {
          globalSuccessRate:
            status.globalMetrics.successfulTasks / Math.max(1, status.globalMetrics.totalTasks),
          averageAgentFitness: calculateAverageAgentFitness(status.agents),
          evolutionProgress: status.globalMetrics.totalEvolutions,
        },
        recommendations: generateRecommendations(status),
        topPerformingAgents: getTopPerformingAgents(status.agents),
        learningTrends: {
          crossLearningEffectiveness: status.globalMetrics.crossLearningEvents > 0,
          patternsPerAgent: calculatePatternsPerAgent(status.agents),
        },
      };

      return res.status(200).json( insights);
    } catch (error) {
      logger.error('Failed to get insights:', error);
      return res.status(500).json({ error: 'Failed to get insights' });
    }
  })
);

/**
 * Submit batch tasks for evolution testing
 */
router.post(
  '/batch-tasks',
  asyncHandler(async (req: Request, res: Response) => {
    const { tasks } = req.body;

    if (!Array.isArray(tasks)) {
      return res.status(400).json({ error: 'Tasks must be an array' });
    }

    try {
      const coord = await ensureCoordinator();
      const taskIds = [];

      for (const task of tasks) {
        const { agentId, taskType, context, priority = 5 } = task;
        if (agentId && taskType && context) {
          const taskId = await coord.submitTask(agentId, taskType, context, priority);
          taskIds.push(taskId);
        }
      }

      return res.status(200).json( {
        taskIds,
        message: `${taskIds.length} tasks submitted successfully`,
      });
    } catch (error) {
      logger.error('Failed to submit batch tasks:', error);
      return res.status(500).json({ error: 'Failed to submit batch tasks' });
    }
  })
);

/**
 * Get _pattern_analysisfor a specific _patterntype
 */
router.get(
  '/patterns/:patternType',
  asyncHandler(async (req: Request, res: Response) => {
    const { patternType } = req.params;

    try {
      // Query patterns from database
      const { data: patterns, error } = await supabase
        .from('ai_learning_patterns')
        .select('*')
        .ilike('_pattern, `%${patternType}%`)
        .order('confidence', { ascending: false })
        .limit(20);

      if (error) throw error;

      return res.status(200).json( {
        patterns,
        total: patterns?.length || 0,
      });
    } catch (error) {
      logger.error('Failed to get patterns:', error);
      return res.status(500).json({ error: 'Failed to get patterns' });
    }
  })
);

/**
 * Get performance metrics for a time range
 */
router.get(
  '/metrics',
  asyncHandler(async (req: Request, res: Response) => {
    const { start, end, agentId } = req.query;

    try {
      let query = supabase.from('ai_performance_metrics').select('*');

      if (start) {
        query = query.gte('timestamp', start);
      }

      if (end) {
        query = query.lte('timestamp', end);
      }

      if (agentId) {
        query = query.eq('agent_id', agentId);
      }

      const { data: metrics, error } = await query
        .order('timestamp', { ascending: false })
        .limit(1000);

      if (error) throw error;

      // Calculate aggregated metrics
      const aggregated = aggregateMetrics(metrics || []);

      return res.status(200).json( {
        metrics,
        aggregated,
      });
    } catch (error) {
      logger.error('Failed to get metrics:', error);
      return res.status(500).json({ error: 'Failed to get metrics' });
    }
  })
);

// Helper functions
function calculateAverageAgentFitness(agents: any): number {
  const fitnessValues = Object.values(agents)
    .map((agent: any) => agent.averageFitness || 0)
    .filter((f) => f > 0);

  if (fitnessValues.length === 0) return 0;
  return fitnessValues.reduce((sum, f) => sum + f, 0) / fitnessValues.length;
}

function generateRecommendations(status: any): string[] {
  const recommendations = [];
  const avgFitness = calculateAverageAgentFitness(status.agents);

  if (avgFitness < 0.5) {
    recommendations.push('Consider increasing population size for better diversity');
  }

  if (status.globalMetrics.crossLearningEvents < 5) {
    recommendations.push('Enable more cross-agent learning opportunities');
  }

  if (status.taskQueueLength > 100) {
    recommendations.push('Consider scaling up processing capacity');
  }

  const successRate =
    status.globalMetrics.successfulTasks / Math.max(1, status.globalMetrics.totalTasks);

  if (successRate < 0.7) {
    recommendations.push('Review and optimize agent strategies for better success rates');
  }

  return recommendations;
}

function getTopPerformingAgents(agents: any): any[] {
  return Object.entries(agents)
    .map(([id, agent]: [string, any]) => ({
      agentId: id,
      fitness: agent.averageFitness || 0,
      generation: agent.generation || 0,
    }))
    .sort((a, b) => b.fitness - a.fitness)
    .slice(0, 5);
}

function calculatePatternsPerAgent(agents: any): number {
  const patternCounts = Object.values(agents).map((agent: any) => agent.patternsLearned || 0);

  if (patternCounts.length === 0) return 0;
  return patternCounts.reduce((sum, c) => sum + c, 0) / patternCounts.length;
}

function aggregateMetrics(metrics: any[]): any {
  if (metrics.length === 0) return {};

  const totalLatency = metrics.reduce((sum, m) => sum + (m.latency_ms || 0), 0);
  const successCount = metrics.filter((m) => m.success).length;
  const errorCount = metrics.filter((m) => m.error.length;

  const byOperation = metrics.reduce((acc, m) => {
    const op = m.operation_type;
    if (!acc[op]) {
      acc[op] = { count: 0, totalLatency: 0, errors: 0 };
    }
    acc[op].count++;
    acc[op].totalLatency += m.latency_ms || 0;
    if (m.error acc[op].errors++;
    return acc;
  }, {});

  return {
    total: metrics.length,
    averageLatency: totalLatency / metrics.length,
    successRate: successCount / metrics.length,
    errorRate: errorCount / metrics.length,
    byOperation,
  };
}

export default router;
