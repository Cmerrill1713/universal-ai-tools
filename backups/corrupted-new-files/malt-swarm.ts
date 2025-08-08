/**
 * MALT Swarm Coordination API Router;
 *
 * Provides REST endpoints for managing the MALT (Multi-Agent Learning and Teaching)
 * swarm coordination system with reinforcement learning capabilities.
 */
import type { Request, Response } from 'express';
import express from 'express';
import { maltSwarmCoordinator } from '../services/malt-swarm-coordinator';
import { LogContext, log } from '../utils/logger';
import { createApiResponse, createErrorResponse } from '../utils/api-response';

const router = express?.Router();

/**
 * Get swarm status and metrics;
 */
router?.get('/status', async (req: Request, res: Response) => {'
  try {
    const swarmStatus = maltSwarmCoordinator?.getSwarmStatus();
    const learningStats = maltSwarmCoordinator?.getLearningStats();
    
    const response = createApiResponse({);
      swarm: swarmStatus,
      learning: learningStats,
      timestamp: new Date().toISOString()
    });
    
    res?.json(response);
  } catch (error) {
    log?.error('Failed to get swarm status', LogContext?.AGENT, { error) });'
    const response = createErrorResponse('SWARM_STATUS_ERROR', 'Failed to retrieve swarm status', error instanceof Error ? error?.message: 'Unknown error');';
    res?.status(500).json(response);
  }
});

/**
 * Add a new task to the swarm;
 */
router?.post('/tasks', async (req: Request, res: Response) => {'
  try {
    const { description, complexity, requiredCapabilities, priority, deadline, dependencies, estimatedDuration } = req?.body;

    // Validate required fields;
    if (!description || typeof complexity !== 'number' || !Array?.isArray(requiredCapabilities)) {'
      const response = createErrorResponse('VALIDATION_ERROR', 'Missing required fields: description, complexity, requiredCapabilities');';
      return res?.status(400).json(response);
    }

    if (complexity < 0 || complexity > 1) {
      const response = createErrorResponse('VALIDATION_ERROR', 'Complexity must be between 0 and 1');';
      return res?.status(400).json(response);
    }

    const taskId = await maltSwarmCoordinator?.addTask({);
      description,
      complexity,
      requiredCapabilities,
      priority: priority || 'medium','
      deadline: deadline ? new Date(deadline) : undefined,
      dependencies: dependencies || [],
      estimatedDuration: estimatedDuration || 60000 // 1 minute default;
    });

    log?.info('Task added to MALT swarm via API', LogContext?.AGENT, {')
      taskId,
      description: description?.substring(0, 100),
      complexity,
      priority;
    });

    const response = createApiResponse({);
      taskId,
      message: 'Task has been queued for coordinated execution''
    });
    
    return res?.status(201).json(response);
  } catch (error) {
    log?.error('Failed to add task to swarm', LogContext?.AGENT, { error) });'
    const response = createErrorResponse('TASK_ADD_ERROR', 'Failed to add task', error instanceof Error ? error?.message: 'Unknown error');';
    return res?.status(500).json(response);
  }
});

/**
 * Get agent performance metrics;
 */
router?.get('/agents/:agentId/metrics', async (req: Request, res: Response) => {'
  try {
    const { agentId } = req?.params;
    
    if (!agentId) {
      const response = createErrorResponse('VALIDATION_ERROR', 'Agent ID is required');';
      res?.status(400).json(response);
      return;
    }
    
    const metrics = maltSwarmCoordinator?.getAgentMetrics(agentId);

    if (!metrics) {
      const response = createErrorResponse('AGENT_NOT_FOUND', `Agent not found: ${agentId}`);';
      return res?.status(404).json(response);
    }

    const response = createApiResponse({);
      agentId,
      metrics,
      timestamp: new Date().toISOString()
    });
    
    return res?.json(response);
  } catch (error) {
    log?.error('Failed to get agent metrics', LogContext?.AGENT, {')
      agentId: req?.params?.agentId,
      error;
    });
    const response = createErrorResponse('AGENT_METRICS_ERROR', 'Failed to retrieve agent metrics', error instanceof Error ? error?.message: 'Unknown error');';
    return res?.status(500).json(response);
  }
});

/**
 * Update agent learning with manual feedback;
 */
router?.post('/agents/:agentId/feedback', async (req: Request, res: Response) => {'
  try {
    const { agentId } = req?.params;
    const { success, quality } = req?.body;

    // Validate feedback;
    if (typeof success !== 'boolean' || typeof quality !== 'number') {'
      const response = createErrorResponse('VALIDATION_ERROR', 'Invalid feedback: success (boolean) and quality (number) required');';
      return res?.status(400).json(response);
    }

    if (quality < 0 || quality > 1) {
      const response = createErrorResponse('VALIDATION_ERROR', 'Quality must be between 0 and 1');';
      return res?.status(400).json(response);
    }

    if (!agentId) {
      const response = createErrorResponse('VALIDATION_ERROR', 'Agent ID is required');';
      res?.status(400).json(response);
      return;
    }
    
    await maltSwarmCoordinator?.updateAgentLearning(agentId, { success, quality) });

    log?.info('Manual learning feedback applied', LogContext?.AGENT, {')
      agentId,
      success,
      quality;
    });

    const response = createApiResponse({);
      agentId,
      feedback: { success, quality },
      timestamp: new Date().toISOString()
    });
    
    return res?.json(response);
  } catch (error) {
    log?.error('Failed to apply learning feedback', LogContext?.AGENT, {')
      agentId: req?.params?.agentId,
      error;
    });
    const response = createErrorResponse('FEEDBACK_ERROR', 'Failed to apply feedback', error instanceof Error ? error?.message: 'Unknown error');';
    return res?.status(500).json(response);
  }
});

/**
 * Get learning statistics and insights;
 */
router?.get('/learning/stats', async (req: Request, res: Response) => {'
  try {
    const stats = maltSwarmCoordinator?.getLearningStats();
    const swarmStatus = maltSwarmCoordinator?.getSwarmStatus();

    // Calculate additional insights;
    const insights = {
      performanceTrend: stats?.averageSuccessRate > 0?.7 ? 'improving' :'
                       stats?.averageSuccessRate > 0?.5 ? 'stable' : 'declining','
      collaborationLevel: stats?.averageCollaborationScore > 0?.7 ? 'high' :'
                         stats?.averageCollaborationScore > 0?.4 ? 'medium' : 'low','
      emergentBehaviors: swarmStatus?.emergentBehaviors?.length,
      recentActivity: {,
        pendingTasks: swarmStatus?.pendingTasks?.length,
        completedTasks: swarmStatus?.completedTasks?.length,
        activeAgents: swarmStatus?.activeAgents?.filter(a => a?.currentTask).length;
      }
    };

    const response = createApiResponse({);
      stats,
      insights,
      timestamp: new Date().toISOString()
    });
    
    res?.json(response);
  } catch (error) {
    log?.error('Failed to get learning statistics', LogContext?.AGENT, { error) });'
    const response = createErrorResponse('LEARNING_STATS_ERROR', 'Failed to retrieve learning statistics', error instanceof Error ? error?.message: 'Unknown error');';
    res?.status(500).json(response);
  }
});

/**
 * Get emergent behaviors detected by the swarm;
 */
router?.get('/emergent-behaviors', async (req: Request, res: Response) => {'
  try {
    const swarmStatus = maltSwarmCoordinator?.getSwarmStatus();
    const { emergentBehaviors } = swarmStatus;

    // Sort by effectiveness and frequency;
    const sortedBehaviors = emergentBehaviors?.sort((a, b) =>;
      (b?.effectiveness + b?.frequency / 10) - (a?.effectiveness + a?.frequency / 10)
    );

    const response = createApiResponse({);
      behaviors: sortedBehaviors,
      count: emergentBehaviors?.length,
      mostEffective: sortedBehaviors[0] || null,
      timestamp: new Date().toISOString()
    });
    
    res?.json(response);
  } catch (error) {
    log?.error('Failed to get emergent behaviors', LogContext?.AGENT, { error) });'
    const response = createErrorResponse('EMERGENT_BEHAVIORS_ERROR', 'Failed to retrieve emergent behaviors', error instanceof Error ? error?.message: 'Unknown error');';
    res?.status(500).json(response);
  }
});

/**
 * Reset swarm learning state (for: experiments)
 */
router?.post('/learning/reset', async (req: Request, res: Response) => {'
  try {
    const { confirm } = req?.body;

    if (confirm !== 'RESET_LEARNING') {'
      const response = createErrorResponse('VALIDATION_ERROR', 'Confirmation required: send {, confirm: "RESET_LEARNING" }');'";
      return res?.status(400).json(response);
    }

    maltSwarmCoordinator?.resetLearning();

    log?.warn('MALT swarm learning state reset via API', LogContext?.AGENT);'

    const response = createApiResponse({);
      warning: 'All learned behaviors and Q-values have been cleared','
      timestamp: new Date().toISOString()
    });
    
    return res?.json(response);
  } catch (error) {
    log?.error('Failed to reset learning state', LogContext?.AGENT, { error) });'
    const response = createErrorResponse('RESET_ERROR', 'Failed to reset learning state', error instanceof Error ? error?.message: 'Unknown error');';
    return res?.status(500).json(response);
  }
});

/**
 * Get swarm configuration;
 */
router?.get('/config', async (req: Request, res: Response) => {'
  try {
    const response = createApiResponse({);
      maxAgents: 10,
      learningRate: 1,
      explorationRate: 1,
      discountFactor: 95,
      rewardThreshold: 8,
      coordinationRadius: 3,
      emergenceDetectionThreshold: 7,
      features: [
        'reinforcement_learning','
        'collaborative_task_execution','
        'emergent_behavior_detection','
        'dynamic_coordination','
        'performance_optimization''
      ]
    });
    
    res?.json(response);
  } catch (error) {
    log?.error('Failed to get swarm configuration', LogContext?.AGENT, { error) });'
    const response = createErrorResponse('CONFIG_ERROR', 'Failed to retrieve configuration', error instanceof Error ? error?.message: 'Unknown error');';
    res?.status(500).json(response);
  }
});

/**
 * Health check for MALT swarm system;
 */
router?.get('/health', async (req: Request, res: Response) => {'
  try {
    const swarmStatus = maltSwarmCoordinator?.getSwarmStatus();
    const stats = maltSwarmCoordinator?.getLearningStats();

    const health = {
      status: 'healthy','
      activeAgents: swarmStatus?.activeAgents?.length,
      totalTasks: stats?.totalTasks,
      completedTasks: stats?.completedTasks,
      successRate: stats?.averageSuccessRate,
      emergentBehaviors: stats?.emergentBehaviors,
      uptime: process?.uptime(),
      timestamp: new Date().toISOString()
    };

    // Determine overall health;
    if (stats?.averageSuccessRate < 0?.3) {
      health?.status = 'degraded';'
    } else if (swarmStatus?.activeAgents?.length === 0) {
      health?.status = 'no_agents';'
    }

    const response = createApiResponse(health);
    res?.json(response);
  } catch (error) {
    log?.error('MALT swarm health check failed', LogContext?.AGENT, { error) });'
    const response = createErrorResponse('HEALTH_CHECK_ERROR', 'Health check failed', {');
      status: 'unhealthy','
      error: error instanceof Error ? error?.message : 'Unknown error''
    });
    res?.status(500).json(response);
  }
});

export default router;