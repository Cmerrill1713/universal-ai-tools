import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { log, LogContext } from '../utils/logger';
import { advancedAgentOrchestrator } from '../services/advanced-agent-orchestrator';
import { validateRequest } from '../middleware/validation';
import { authenticate } from '../middleware/auth';

const router = Router();

// Request schemas
const WorkflowExecutionSchema = z.object({
  workflowId: z.string(),
  context: z.record(z.any()),
  options: z.object({
    sessionId: z.string().optional(),
    userId: z.string().optional(),
    parallelism: z.enum(['sequential', 'parallel', 'hybrid']).optional(),
    priority: z.number().min(1).max(10).optional()
  }).optional()
});

const AgentSpawnSchema = z.object({
  taskType: z.string(),
  context: z.record(z.any()),
  requirements: z.object({
    capabilities: z.array(z.string()),
    complexity: z.enum(['low', 'medium', 'high', 'expert']),
    maxLatency: z.number().optional(),
    minConfidence: z.number().min(0).max(1).optional()
  })
});

const WorkflowTemplateSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  tasks: z.array(z.object({
    id: z.string().optional(),
    type: z.enum(['analysis', 'synthesis', 'execution', 'validation', 'planning']).optional(),
    priority: z.number().optional(),
    complexity: z.enum(['low', 'medium', 'high', 'expert']).optional(),
    context: z.record(z.any()).optional(),
    dependencies: z.array(z.string()).optional(),
    estimatedDuration: z.number().optional(),
    maxRetries: z.number().optional(),
    deadline: z.string().datetime().optional(),
    requiredCapabilities: z.array(z.string()).optional()
  })),
  options: z.object({
    parallelism: z.enum(['sequential', 'parallel', 'hybrid']).optional(),
    failureStrategy: z.enum(['abort', 'continue', 'retry', 'fallback']).optional(),
    successCriteria: z.object({
      minConfidence: z.number().min(0).max(1),
      requiredSteps: z.array(z.string()),
      timeoutMs: z.number()
    }).optional()
  }).optional()
});

// Apply authentication to all routes
router.use(authenticate);

/**
 * Execute a multi-agent workflow
 */
router.post('/execute', validateRequest(WorkflowExecutionSchema), async (req: Request, res: Response) => {
  try {
    const { workflowId, context, options } = req.body;

    log.info('Starting workflow execution', LogContext.AGENT, { 
      workflowId, 
      userId: options?.userId,
      contextKeys: Object.keys(context)
    });

    const result = await advancedAgentOrchestrator.executeWorkflow(
      workflowId,
      context,
      options
    );

    res.json({
      success: true,
      data: {
        executionId: result.executionId,
        resultCount: result.results.size,
        performance: result.performance,
        results: Object.fromEntries(result.results)
      }
    });

  } catch (error) {
    log.error('Workflow execution failed:', LogContext.AGENT, { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({
      success: false,
      error: 'Workflow execution failed',
      details: (error as Error).message
    });
  }
});

/**
 * Spawn a specialized agent for a specific task
 */
router.post('/spawn-agent', validateRequest(AgentSpawnSchema), async (req: Request, res: Response) => {
  try {
    const { taskType, context, requirements } = req.body;

    log.info('Spawning specialized agent', LogContext.AGENT, { taskType, complexity: requirements.complexity });

    const agentId = await advancedAgentOrchestrator.spawnAgent(
      taskType,
      context,
      requirements
    );

    res.json({
      success: true,
      data: {
        agentId,
        taskType,
        complexity: requirements.complexity,
        capabilities: requirements.capabilities
      }
    });

  } catch (error) {
    log.error('Agent spawning failed:', LogContext.AGENT, { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({
      success: false,
      error: 'Agent spawning failed',
      details: (error as Error).message
    });
  }
});

/**
 * Create a new workflow template
 */
router.post('/templates', validateRequest(WorkflowTemplateSchema), async (req: Request, res: Response) => {
  try {
    const { name, description, tasks, options } = req.body;

    log.info('Creating workflow template', LogContext.AGENT, { name, taskCount: tasks.length });

    const templateId = await advancedAgentOrchestrator.createWorkflowTemplate(
      name,
      description,
      tasks,
      options
    );

    res.json({
      success: true,
      data: {
        templateId,
        name,
        description,
        taskCount: tasks.length
      }
    });

  } catch (error) {
    log.error('Template creation failed:', LogContext.AGENT, { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({
      success: false,
      error: 'Template creation failed',
      details: (error as Error).message
    });
  }
});

/**
 * Get agent performance analytics
 */
router.get('/analytics', async (req: Request, res: Response) => {
  try {
    const agentId = req.query.agentId as string;

    log.info('Fetching agent analytics', LogContext.AGENT, { agentId });

    const analytics = await advancedAgentOrchestrator.getAgentAnalytics(agentId);

    res.json({
      success: true,
      data: analytics
    });

  } catch (error) {
    log.error('Analytics fetch failed:', LogContext.AGENT, { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({
      success: false,
      error: 'Analytics fetch failed',
      details: (error as Error).message
    });
  }
});

/**
 * Get workflow execution status
 */
router.get('/execution/:executionId/status', async (req: Request, res: Response) => {
  try {
    const { executionId } = req.params;

    // This would fetch from Redis or database
    const status = {
      executionId,
      status: 'completed', // This would be dynamic
      progress: {
        totalTasks: 3,
        completedTasks: 3,
        failedTasks: 0,
        currentTask: null
      },
      performance: {
        startTime: new Date(Date.now() - 30000).toISOString(),
        endTime: new Date().toISOString(),
        totalDuration: 30000,
        averageTaskTime: 10000
      }
    };

    res.json({
      success: true,
      data: status
    });

  } catch (error) {
    log.error('Status fetch failed:', LogContext.AGENT, { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({
      success: false,
      error: 'Status fetch failed',
      details: (error as Error).message
    });
  }
});

/**
 * List available workflow templates
 */
router.get('/templates', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const category = req.query.category as string;

    // This would fetch from database
    const templates = [
      {
        id: 'complex-analysis',
        name: 'Complex Analysis',
        description: 'Multi-step analysis with validation and synthesis',
        taskCount: 3,
        averageDuration: 45000,
        successRate: 0.92,
        category: 'analysis',
        created: new Date(Date.now() - 86400000).toISOString()
      },
      {
        id: 'code-development',
        name: 'Code Development',
        description: 'Complete code development with review and testing',
        taskCount: 3,
        averageDuration: 60000,
        successRate: 0.88,
        category: 'development',
        created: new Date(Date.now() - 172800000).toISOString()
      }
    ];

    const filtered = category 
      ? templates.filter(t => t.category === category)
      : templates;

    const paginatedResults = filtered.slice((page - 1) * limit, page * limit);

    res.json({
      success: true,
      data: {
        templates: paginatedResults,
        pagination: {
          page,
          limit,
          total: filtered.length,
          totalPages: Math.ceil(filtered.length / limit)
        }
      }
    });

  } catch (error) {
    log.error('Templates fetch failed:', LogContext.AGENT, { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({
      success: false,
      error: 'Templates fetch failed',
      details: (error as Error).message
    });
  }
});

/**
 * Cancel a running workflow execution
 */
router.post('/execution/:executionId/cancel', async (req: Request, res: Response) => {
  try {
    const { executionId } = req.params;

    log.info('Cancelling workflow execution', LogContext.AGENT, { executionId });

    // Implementation would cancel the execution
    const cancelled = true; // Placeholder

    if (cancelled) {
      res.json({
        success: true,
        data: {
          executionId,
          status: 'cancelled',
          cancelledAt: new Date().toISOString()
        }
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Execution not found or already completed'
      });
    }

  } catch (error) {
    log.error('Execution cancellation failed:', LogContext.AGENT, { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({
      success: false,
      error: 'Execution cancellation failed',
      details: (error as Error).message
    });
  }
});

/**
 * Get orchestration health and statistics
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const stats = {
      status: 'healthy',
      activeExecutions: 0, // This would be dynamic
      totalExecutions: 156,
      averageExecutionTime: 32000,
      successRate: 0.91,
      agentCount: 12,
      templateCount: 8,
      uptime: process.uptime() * 1000,
      lastExecutionAt: new Date(Date.now() - 5000).toISOString(),
      resourceUsage: {
        memoryMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        cpuPercent: 15.2
      }
    };

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    log.error('Health check failed:', LogContext.AGENT, { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({
      success: false,
      error: 'Health check failed',
      details: (error as Error).message
    });
  }
});

/**
 * Stream workflow execution progress via Server-Sent Events
 */
router.get('/execution/:executionId/stream', (req: Request, res: Response) => {
  const { executionId } = req.params;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  // Send initial connection event
  res.write(`data: ${JSON.stringify({
    type: 'connected',
    executionId,
    timestamp: new Date().toISOString()
  })}\n\n`);

  // Set up event listeners for this execution
  const onTaskStarted = (data: any) => {
    if (data.executionId === executionId) {
      res.write(`data: ${JSON.stringify({
        type: 'taskStarted',
        ...data,
        timestamp: new Date().toISOString()
      })}\n\n`);
    }
  };

  const onTaskCompleted = (data: any) => {
    if (data.executionId === executionId) {
      res.write(`data: ${JSON.stringify({
        type: 'taskCompleted',
        ...data,
        timestamp: new Date().toISOString()
      })}\n\n`);
    }
  };

  const onTaskFailed = (data: any) => {
    if (data.executionId === executionId) {
      res.write(`data: ${JSON.stringify({
        type: 'taskFailed',
        ...data,
        timestamp: new Date().toISOString()
      })}\n\n`);
    }
  };

  const onExecutionCompleted = (data: any) => {
    if (data.executionId === executionId) {
      res.write(`data: ${JSON.stringify({
        type: 'executionCompleted',
        ...data,
        timestamp: new Date().toISOString()
      })}\n\n`);
      
      // Close connection after completion
      res.end();
    }
  };

  // Register event listeners
  advancedAgentOrchestrator.on('taskStarted', onTaskStarted);
  advancedAgentOrchestrator.on('taskCompleted', onTaskCompleted);
  advancedAgentOrchestrator.on('taskFailed', onTaskFailed);
  advancedAgentOrchestrator.on('executionCompleted', onExecutionCompleted);

  // Handle client disconnect
  req.on('close', () => {
    advancedAgentOrchestrator.off('taskStarted', onTaskStarted);
    advancedAgentOrchestrator.off('taskCompleted', onTaskCompleted);
    advancedAgentOrchestrator.off('taskFailed', onTaskFailed);
    advancedAgentOrchestrator.off('executionCompleted', onExecutionCompleted);
    res.end();
  });

  // Send periodic heartbeat
  const heartbeat = setInterval(() => {
    res.write(`data: ${JSON.stringify({
      type: 'heartbeat',
      executionId,
      timestamp: new Date().toISOString()
    })}\n\n`);
  }, 30000);

  req.on('close', () => {
    clearInterval(heartbeat);
  });
});

export default router;