/**
 * System Metrics API Router
 * Provides real-time system performance and health metrics
 */

import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import { sendError, sendSuccess } from '../utils/api-response';
import { LogContext, log } from '../utils/logger';
import { abMCTSOrchestrator } from '../services/ab-mcts-orchestrator';
import { feedbackCollector } from '../services/feedback-collector';
import { multiTierLLM } from '../services/multi-tier-llm-service';
import { parameterAnalyticsService } from '../services/parameter-analytics-service';
import AgentRegistry from '../agents/agent-registry';
import os from 'os';

const   router = Router();

/**
 * Get system resource metrics
 */
const getSystemResources = () => {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const cpus = os.cpus();

  // Calculate CPU usage
  const cpuUsage =     cpus.reduce((acc, cpu) => {
      const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
      const { idle } = cpu.times;
      return acc + ((total - idle) / total) * 100;
    }, 0) / cpus.length;

  return {
    cpu: Math.round(cpuUsage * 10) / 10,
    memory: Math.round((usedMem / totalMem) * 100 * 10) / 10,
    memoryUsed: Math.round(usedMem / 1024 / 1024), // MB
    memoryTotal: Math.round(totalMem / 1024 / 1024), // MB
    uptime: Math.round(process.uptime()),
    platform: process.platform,
    nodeVersion: process.version,
  };
};

/**
 * @route GET /api/v1/system/metrics
 * @desc Get comprehensive system metrics
 */
router.get('/metrics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get system resources
    const resources = getSystemResources();

    // Get orchestrator statistics
    const orchestratorStats = abMCTSOrchestrator.getStatistics();

    // Get agent registry stats
    const agentRegistry = new AgentRegistry();
    const loadedAgents = agentRegistry.getLoadedAgents();
    const availableAgents = agentRegistry.getAvailableAgents();

    // Get feedback metrics
    const feedbackMetrics = feedbackCollector.getMetrics();

    // Calculate queue metrics
    const queuedTasks = feedbackMetrics.queueSize;

    // Get performance analytics
    const performanceData = await parameterAnalyticsService.getRecentPerformance(60); // Last 60 minutes

    // Calculate average response time from recent data
    const avgResponseTime =       performanceData.length > 0
        ? Math.round(
            performanceData.reduce((sum, p) => sum + (p.executionTime || 0), 0) /
              performanceData.length
          )
        : 0;

    // Calculate success rate
    const successCount = performanceData.filter((p) => p.success).length;
    const successRate =       performanceData.length > 0
        ? Math.round((successCount / performanceData.length) * 100 * 10) / 10
        : 100;

    const       metrics = {
        system: resources,
        orchestrator: {
          activeSearches: orchestratorStats.activeSearches,
          cachedResults: orchestratorStats.cachedResults,
          circuitBreakerState: orchestratorStats.circuitBreakerState,
          successRate: Math.round(orchestratorStats.successRate * 100 * 10) / 10,
        },
        agents: {
          loaded: loadedAgents.length,
          available: availableAgents.length,
          active: orchestratorStats.activeSearches,
          registry: loadedAgents,
        },
        performance: {
          avgResponseTime,
          successRate,
          totalRequests: performanceData.length,
          queuedTasks,
          recentRequests: performanceData.slice(-10).map((p) => ({
            timestamp: p.timestamp,
            executionTime: p.executionTime,
            success: p.success,
            agent: p.agent,
            confidence: p.confidence,
          })),
        },
        feedback: {
          totalProcessed: feedbackMetrics.totalProcessed,
          queueSize: feedbackMetrics.queueSize,
          aggregations: feedbackMetrics.aggregations.length,
        },
      };

    sendSuccess(res, metrics, 200, { message: 'System metrics retrieved successfully' });
  } catch (error) {
    log.error('❌ Failed to get system metrics', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
});

/**
 * @route GET /api/v1/system/performance
 * @desc Get performance time series data
 */
router.get('/performance', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { timeRange = '1h' } = req.query;

    // Convert time range to minutes
    const minutes =       {
        '1h': 60,
        '6h': 360,
        '24h': 1440,
        '7d': 10080,
      }[timeRange as string] || 60;

    // Get performance data
    const performanceData = await parameterAnalyticsService.getRecentPerformance(minutes);

    // Group data by time intervals
    const interval = minutes > 1440 ? 60 : minutes > 360 ? 15 : 5; // 1h, 15m, or 5m intervals
    const grouped: unknown[] = [];

    const       now = Date.now();
    for (let i = 0; i < minutes / interval; i++) {
      const startTime = now - (i + 1) * interval * 60000;
      const endTime = now - i * interval * 60000;

      const intervalData = performanceData.filter(
        (p) => p.timestamp >= startTime && p.timestamp < endTime
      );

      if (intervalData.length > 0) {
        const successCount = intervalData.filter((p) => p.success).length;
        const avgTime =           intervalData.reduce((sum, p) => sum + (p.executionTime || 0), 0) / intervalData.length;
        const avgConfidence =           intervalData.reduce((sum, p) => sum + (p.confidence || 0), 0) / intervalData.length;

        grouped.push({
          time: new Date(endTime).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
          }),
          timestamp: endTime,
          requests: intervalData.length,
          responseTime: Math.round(avgTime),
          successRate: Math.round((successCount / intervalData.length) * 100),
          confidence: Math.round(avgConfidence * 100),
        });
      }
    }

    // Reverse to show oldest first
    grouped.reverse();

    sendSuccess(
      res,
      {
        timeRange,
        dataPoints: grouped.length,
        data: grouped,
      },
      200,
      { message: 'Performance data retrieved successfully' }
    );
  } catch (error) {
    log.error('❌ Failed to get performance data', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
});

/**
 * @route GET /api/v1/system/agents/performance
 * @desc Get individual agent performance metrics
 */
router.get('/agents/performance', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const agentRegistry = new AgentRegistry();
    const loadedAgents = agentRegistry.getLoadedAgents();

    // Get performance data for each agent
    const agentPerformance = await Promise.all(
      loadedAgents.map(async (agentName) => {
        const agent = await agentRegistry.getAgent(agentName);
        if (!agent) {
          return null;
        }

        // Get agent's performance metrics
        const metrics = 'getPerformanceMetrics' in agent && typeof agent.getPerformanceMetrics === 'function'
          ? agent.getPerformanceMetrics()
          : {
              totalCalls: 0,
              successRate: 1,
              averageExecutionTime: 0,
              averageConfidence: 0.8,
              lastUsed: null
            };

        return {
          name: agentName,
          calls: metrics.totalCalls || 0,
          successRate: Math.round((metrics.successRate || 0) * 100),
          avgTime: Math.round(metrics.averageExecutionTime || 0),
          confidence: Math.round((metrics.averageConfidence || 0) * 100),
          lastUsed: metrics.lastUsed || null,
        };
      })
    );

    const validAgents = agentPerformance.filter((a) => a !== null);

    sendSuccess(res, validAgents, 200, { message: 'Agent performance data retrieved' });
  } catch (error) {
    log.error('❌ Failed to get agent performance', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
});

/**
 * @route GET /api/v1/system/health
 * @desc Get system health status
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const       resources = getSystemResources();
    const orchestratorStats = abMCTSOrchestrator.getStatistics();

    // Determine health status
    const isHealthy =       resources.cpu < 90 &&
      resources.memory < 90 &&
      orchestratorStats.circuitBreakerState !== 'OPEN';

    sendSuccess(
      res,
      {
        status: isHealthy ? 'healthy' : 'degraded',
        timestamp: Date.now(),
        checks: {
          cpu: resources.cpu < 90 ? 'pass' : 'fail',
          memory: resources.memory < 90 ? 'pass' : 'fail',
          orchestrator: orchestratorStats.circuitBreakerState !== 'OPEN' ? 'pass' : 'fail',
        },
        details: {
          cpu: `${resources.cpu}%`,
          memory: `${resources.memory}%`,
          uptime: `${Math.floor(resources.uptime / 60)} minutes`,
          circuitBreaker: orchestratorStats.circuitBreakerState,
        },
      },
      200,
      { message: 'Health check completed' }
    );
  } catch (error) {
    sendError(res, 'INTERNAL_ERROR', 'Health check failed');
  }
});

export default router;
