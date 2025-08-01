/**
 * Athena Router - AI Assistant with Dynamic Agent Management
 * Provides endpoints for spawning agents, creating tools, and autonomous operations
 */

import { Router } from 'express';
import type { Request, Response} from 'express';
import { NextFunction } from 'express';

import { LogContext, log } from '@/utils/logger';
import { apiResponseMiddleware } from '@/utils/api-response';
import { dynamicAgentSpawner } from '@/services/dynamic-agent-spawner';
import { toolCreationSystem } from '@/services/tool-creation-system';

const router = Router();

/**
 * POST /api/v1/athena/spawn
 * Spawn a new agent dynamically based on requirements
 */
router.post('/spawn', async (req: Request, res: Response) => {
  try {
    const { task, context, expertise_needed, autonomy_level, performance_requirements } = req.body;

    if (!task || !expertise_needed) {
      res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PARAMETERS',
          message: 'task and expertise_needed are required'
        }
      });
      return;
    }

    log.info('🤖 Spawning new agent', LogContext.AGENT, { task, expertise_needed });

    const spawnedAgent = await dynamicAgentSpawner.spawnAgent({
      task,
      context: context || '',
      expertise_needed: Array.isArray(expertise_needed) ? expertise_needed : [expertise_needed],
      autonomy_level: autonomy_level || 'intermediate',
      performance_requirements: performance_requirements || {}
    });

    res.json({
      success: true,
      data: {
        agent: {
          id: spawnedAgent.id,
          name: spawnedAgent.specification.name,
          purpose: spawnedAgent.specification.purpose,
          capabilities: spawnedAgent.specification.capabilities,
          tools: spawnedAgent.specification.tools.map(tool => ({
            name: tool.name,
            description: tool.description,
            type: tool.type
          })),
          autonomyLevel: spawnedAgent.specification.autonomyLevel,
          status: spawnedAgent.status,
          createdAt: spawnedAgent.createdAt
        }
      },
      metadata: {
        timestamp: new Date().toISOString(),
        agentId: spawnedAgent.id
      }
    });

  } catch (error) {
    log.error('❌ Failed to spawn agent', LogContext.AGENT, {
      error: error instanceof Error ? error.message : String(error)
    });
    
    res.status(500).json({
      success: false,
      error: {
        code: 'AGENT_SPAWN_FAILED',
        message: error instanceof Error ? error.message : 'Failed to spawn agent'
      }
    });
  }
});

/**
 * POST /api/v1/athena/execute
 * Execute a command using Athena's intelligent routing
 */
router.post('/execute', async (req: Request, res: Response) => {
  try {
    const { command, context } = req.body;

    if (!command) {
      res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PARAMETERS',
          message: 'command is required'
        }
      });
      return;
    }

    log.info('⚡ Executing Athena command', LogContext.AGENT, { command });

    // Use intelligent agent selector to route the command
    const { intelligentAgentSelector } = await import('@/services/intelligent-agent-selector');
    const result = await intelligentAgentSelector.executeWithOptimalAgent(command, context);

    res.json({
      success: true,
      data: {
        result: (result as any).result || (result as any).data || result,
        metadata: (result as any).metadata,
        serviceUsed: (result as any).serviceUsed,
        routingDecision: (result as any).routingDecision
      },
      metadata: {
        timestamp: new Date().toISOString(),
        executionTime: result.metadata?.executionTime,
        complexity: result.metadata?.complexity,
        taskType: result.metadata?.taskType
      }
    });

  } catch (error) {
    log.error('❌ Failed to execute Athena command', LogContext.AGENT, {
      error: error instanceof Error ? error.message : String(error)
    });
    
    res.status(500).json({
      success: false,
      error: {
        code: 'COMMAND_EXECUTION_FAILED',
        message: error instanceof Error ? error.message : 'Failed to execute command'
      }
    });
  }
});

/**
 * POST /api/v1/athena/suggestions
 * Get intelligent suggestions based on context
 */
router.post('/suggestions', async (req: Request, res: Response) => {
  try {
    const { context, recentActivity } = req.body;

    log.info('💡 Generating Athena suggestions', LogContext.AGENT, { context });

    // Generate contextual suggestions
    const suggestions = [];
    
    if (context === 'dashboard') {
      suggestions.push(
        'Spawn a code analysis agent to review your project',
        'Create a workflow for automated testing',
        'Set up performance monitoring agents'
      );
    }
    
    if (recentActivity && recentActivity.length > 0) {
      suggestions.push(
        `Analyze performance of ${recentActivity[0].name}`,
        'Create backup agents for critical tasks'
      );
    }

    // Add general suggestions
    suggestions.push(
      'Optimize agent memory usage',
      'Schedule periodic health checks',
      'Export agent configurations'
    );

    res.json({
      success: true,
      data: {
        suggestions: suggestions.slice(0, 5),
        context,
        timestamp: new Date().toISOString()
      },
      metadata: {
        timestamp: new Date().toISOString(),
        totalSuggestions: suggestions.length
      }
    });

  } catch (error) {
    log.error('❌ Failed to generate suggestions', LogContext.AGENT, {
      error: error instanceof Error ? error.message : String(error)
    });
    
    res.status(500).json({
      success: false,
      error: {
        code: 'SUGGESTIONS_FAILED',
        message: 'Failed to generate suggestions'
      }
    });
  }
});

/**
 * GET /api/v1/athena/agents
 * List all spawned agents
 */
router.get('/agents', async (req: Request, res: Response) => {
  try {
    const agents = dynamicAgentSpawner.getSpawnedAgents();

    res.json({
      success: true,
      data: {
        agents: agents.map((agent: any) => ({
          id: agent.id,
          name: agent.specification.name,
          purpose: agent.specification.purpose,
          capabilities: agent.specification.capabilities,
          tools: agent.specification.tools.map((tool: any) => ({
            name: tool.name,
            description: tool.description,
            type: tool.type
          })),
          autonomyLevel: agent.specification.autonomyLevel,
          status: agent.status,
          performance: agent.performance,
          evolutionEvents: agent.evolutionHistory.length,
          createdAt: agent.createdAt,
          toolsCount: agent.specification.tools.length
        }))
      },
      metadata: {
        timestamp: new Date().toISOString(),
        total: agents.length,
        active: agents.filter((a: any) => a.status === 'active').length
      }
    });

  } catch (error) {
    log.error('❌ Failed to list agents', LogContext.AGENT, {
      error: error instanceof Error ? error.message : String(error)
    });
    
    res.status(500).json({
      success: false,
      error: {
        code: 'AGENT_LIST_FAILED',
        message: 'Failed to retrieve agents'
      }
    });
  }
});

/**
 * GET /api/v1/athena/agents/:agentId
 * Get detailed information about a specific agent
 */
router.get('/agents/:agentId', async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const agent = dynamicAgentSpawner.getAgent(agentId);

    if (!agent) {
      res.status(404).json({
        success: false,
        error: {
          code: 'AGENT_NOT_FOUND',
          message: `Agent ${agentId} not found`
        }
      });
      return;
    }

    res.json({
      success: true,
      data: {
        agent: {
          id: agent.id,
          specification: agent.specification,
          performance: agent.performance,
          evolutionHistory: agent.evolutionHistory,
          status: agent.status,
          createdAt: agent.createdAt
        }
      },
      metadata: {
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    log.error('❌ Failed to get agent details', LogContext.AGENT, {
      error: error instanceof Error ? error.message : String(error)
    });
    
    res.status(500).json({
      success: false,
      error: {
        code: 'AGENT_DETAILS_FAILED',
        message: 'Failed to retrieve agent details'
      }
    });
  }
});

/**
 * POST /api/v1/athena/tools/create
 * Create a new tool dynamically
 */
router.post('/tools/create', async (req: Request, res: Response) => {
  try {
    const { purpose, inputs, outputs, constraints, category, securityLevel, examples } = req.body;

    if (!purpose || !inputs || !outputs) {
      res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PARAMETERS',
          message: 'purpose, inputs, and outputs are required'
        }
      });
      return;
    }

    log.info('🔧 Creating new tool', LogContext.AI, { purpose, category: category || 'custom' });

    const tool = await toolCreationSystem.createTool({
      purpose,
      inputs: Array.isArray(inputs) ? inputs : [inputs],
      outputs: Array.isArray(outputs) ? outputs : [outputs],
      constraints: constraints || [],
      category: category || 'custom',
      securityLevel: securityLevel || 'sandboxed',
      examples: examples || []
    });

    res.json({
      success: true,
      data: {
        tool: {
          id: tool.id,
          name: tool.name,
          description: tool.description,
          category: tool.category,
          parameters: tool.parameters,
          securityLevel: tool.securityLevel,
          version: tool.version,
          createdAt: tool.createdAt
        }
      },
      metadata: {
        timestamp: new Date().toISOString(),
        toolId: tool.id
      }
    });

  } catch (error) {
    log.error('❌ Failed to create tool', LogContext.AI, {
      error: error instanceof Error ? error.message : String(error)
    });
    
    res.status(500).json({
      success: false,
      error: {
        code: 'TOOL_CREATION_FAILED',
        message: error instanceof Error ? error.message : 'Failed to create tool'
      }
    });
  }
});

/**
 * POST /api/v1/athena/tools/execute
 * Execute a tool with parameters
 */
router.post('/tools/execute', async (req: Request, res: Response) => {
  try {
    const { toolId, parameters, userId } = req.body;

    if (!toolId || !parameters) {
      res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PARAMETERS',
          message: 'toolId and parameters are required'
        }
      });
      return;
    }

    log.info('⚡ Executing tool', LogContext.AI, { toolId });

    const result = await toolCreationSystem.executeTool(toolId, parameters, {
      userId: userId || 'anonymous',
      environment: 'production',
      permissions: ['safe_execution'],
      timeout: 10000
    });

    res.json({
      success: result.success,
      data: {
        result: result.result,
        executionTime: result.executionTime,
        memoryUsed: result.memoryUsed,
        suggestions: result.suggestions
      },
      error: result.success ? undefined : {
        code: 'TOOL_EXECUTION_ERROR',
        message: result.error
      },
      metadata: {
        timestamp: new Date().toISOString(),
        toolId,
        warnings: result.warnings
      }
    });

  } catch (error) {
    log.error('❌ Failed to execute tool', LogContext.AI, {
      error: error instanceof Error ? error.message : String(error)
    });
    
    res.status(500).json({
      success: false,
      error: {
        code: 'TOOL_EXECUTION_FAILED',
        message: error instanceof Error ? error.message : 'Failed to execute tool'
      }
    });
  }
});

/**
 * GET /api/v1/athena/tools
 * List all available tools
 */
router.get('/tools', async (req: Request, res: Response) => {
  try {
    const tools = toolCreationSystem.getTools();

    res.json({
      success: true,
      data: {
        tools: tools.map(tool => ({
          id: tool.id,
          name: tool.name,
          description: tool.description,
          category: tool.category,
          parameters: tool.parameters,
          securityLevel: tool.securityLevel,
          performance: tool.performance,
          version: tool.version,
          createdAt: tool.createdAt,
          usage: {
            totalCalls: tool.usage.totalCalls,
            uniqueUsers: tool.usage.uniqueUsers.size,
            successRate: tool.performance.successRate
          }
        }))
      },
      metadata: {
        timestamp: new Date().toISOString(),
        total: tools.length,
        categories: [...new Set(tools.map(t => t.category))]
      }
    });

  } catch (error) {
    log.error('❌ Failed to list tools', LogContext.AI, {
      error: error instanceof Error ? error.message : String(error)
    });
    
    res.status(500).json({
      success: false,
      error: {
        code: 'TOOL_LIST_FAILED',
        message: 'Failed to retrieve tools'
      }
    });
  }
});

/**
 * POST /api/v1/athena/workflow
 * Execute a complete autonomous workflow
 */
router.post('/workflow', async (req: Request, res: Response) => {
  try {
    const { objective, context, constraints, maxAgents } = req.body;

    if (!objective) {
      res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PARAMETERS',
          message: 'objective is required'
        }
      });
      return;
    }

    log.info('🔄 Starting autonomous workflow', LogContext.AGENT, { objective });

    // This is a simplified autonomous workflow
    // In a full implementation, this would orchestrate multiple agents
    
    // Step 1: Spawn a coordinator agent
    const coordinatorAgent = await dynamicAgentSpawner.spawnAgent({
      task: `Coordinate autonomous workflow for: ${objective}`,
      context: context || '',
      expertise_needed: ['planning', 'coordination', 'task_management'],
      autonomy_level: 'autonomous'
    });

    // Step 2: Let the coordinator break down the task
    const breakdownResult = await dynamicAgentSpawner.executeWithAgent(
      coordinatorAgent.id,
      `Break down this objective into actionable steps: ${objective}`,
      { constraints, maxAgents: maxAgents || 3 }
    );

    // Step 3: Create specialized agents for each step (simplified)
    const workflowResults = {
      coordinatorAgent: coordinatorAgent.id,
      breakdown: breakdownResult.result,
      status: 'in_progress'
    };

    res.json({
      success: true,
      data: {
        workflow: workflowResults,
        coordinatorAgent: {
          id: coordinatorAgent.id,
          name: coordinatorAgent.specification.name
        }
      },
      metadata: {
        timestamp: new Date().toISOString(),
        objective,
        status: 'workflow_initiated'
      }
    });

  } catch (error) {
    log.error('❌ Failed to start autonomous workflow', LogContext.AGENT, {
      error: error instanceof Error ? error.message : String(error)
    });
    
    res.status(500).json({
      success: false,
      error: {
        code: 'WORKFLOW_FAILED',
        message: error instanceof Error ? error.message : 'Failed to start workflow'
      }
    });
  }
});

/**
 * GET /api/v1/athena/status
 * Get overall Athena system status
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const agents = dynamicAgentSpawner.getSpawnedAgents();
    const tools = toolCreationSystem.getTools();
    const activeAgents = agents.filter(a => a.status === 'active').length;

    // Calculate system health based on memory usage and active agents
    const memUsage = process.memoryUsage();
    const heapUsedPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    
    let systemHealth: 'healthy' | 'degraded' | 'error' = 'healthy';
    if (heapUsedPercent > 90) {
      systemHealth = 'error';
    } else if (heapUsedPercent > 70) {
      systemHealth = 'degraded';
    }

    const status = {
      connected: true,
      activeAgents,
      totalAgents: agents.length,
      systemHealth,
      uptime: process.uptime(),
      memoryUsage: memUsage,
      cpuUsage: process.cpuUsage(),
      agents: {
        total: agents.length,
        active: activeAgents,
        evolving: agents.filter(a => a.status === 'evolving').length,
        learning: agents.filter(a => a.status === 'learning').length
      },
      tools: {
        total: tools.length,
        categories: [...new Set(tools.map(t => t.category))],
        averageSuccessRate: tools.length > 0 
          ? tools.reduce((sum, t) => sum + t.performance.successRate, 0) / tools.length 
          : 1.0
      },
      performance: {
        totalTasksCompleted: agents.reduce((sum: any, a: any) => sum + (a.performance?.tasksCompleted || 0), 0),
        totalToolExecutions: tools.reduce((sum: any, t: any) => sum + (t.performance?.executionCount || 0), 0),
        averageAgentSuccessRate: agents.length > 0
          ? agents.reduce((sum: any, a: any) => sum + (a.performance?.successRate || 0), 0) / agents.length
          : 1.0
      },
      evolution: {
        totalEvolutionEvents: agents.reduce((sum: any, a: any) => sum + (a.evolutionHistory?.length || 0), 0),
        recentEvolutions: agents
          .flatMap((a: any) => a.evolutionHistory || [])
          .sort((a: any, b: any) => (b.timestamp?.getTime?.() || 0) - (a.timestamp?.getTime?.() || 0))
          .slice(0, 5)
      }
    };

    res.json({
      success: true,
      data: status,
      metadata: {
        timestamp: new Date().toISOString(),
        systemHealth
      }
    });

  } catch (error) {
    log.error('❌ Failed to get Athena status', LogContext.AGENT, {
      error: error instanceof Error ? error.message : String(error)
    });
    
    res.status(500).json({
      success: false,
      error: {
        code: 'STATUS_FAILED',
        message: 'Failed to retrieve system status'
      }
    });
  }
});

export default router;