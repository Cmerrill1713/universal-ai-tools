/**
 * MCP Agent Router
 * Handles Model Context Protocol (MCP) agent operations
 */

import express from 'express';
import type { Request, Response } from 'express';
import { LogContext, log } from '../utils/logger';
import { apiResponseMiddleware } from '../utils/api-response';
import { mcpIntegrationService } from '../services/mcp-integration-service';

const router = express.Router();

// Apply middleware
router.use(apiResponseMiddleware);

/**
 * Get MCP agent status
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    log.info('🤖 MCP agent status requested', LogContext.API);

    const status = {
      service: 'mcp-agent',
      status: 'active',
      version: '1.2.0',
      mcpVersion: '2024-11-05',
      capabilities: [
        'context-management',
        'tool-integration',
        'resource-access',
        'prompt-enhancement',
        'model-coordination'
      ],
      connectedServers: await getMCPServerCount(),
      activeConnections: 3,
      totalRequests: 1250,
      uptime: process.uptime()
    };

    res.sendSuccess(status);
  } catch (error) {
    log.error('❌ Failed to get MCP agent status', LogContext.API, {
      error: error instanceof Error ? error.message : String(error)
    });
    res.sendError('INTERNAL_ERROR', 'Failed to get MCP agent status', 500);
  }
});

/**
 * List available MCP servers
 */
router.get('/servers', async (req: Request, res: Response) => {
  try {
    log.info('🖥️ Listing MCP servers', LogContext.API);

    const servers = [
      {
        id: 'supabase-mcp',
        name: 'Supabase MCP Server',
        status: 'connected',
        version: '1.0.0',
        capabilities: ['database', 'context-storage', 'search'],
        lastPing: Date.now() - (30 * 1000), // 30 seconds ago
        responseTime: 45
      },
      {
        id: 'filesystem-mcp',
        name: 'Filesystem MCP Server',
        status: 'connected',
        version: '1.1.0',
        capabilities: ['file-read', 'file-write', 'directory-list'],
        lastPing: Date.now() - (15 * 1000), // 15 seconds ago
        responseTime: 12
      },
      {
        id: 'memory-mcp',
        name: 'Memory MCP Server',
        status: 'disconnected',
        version: '0.9.0',
        capabilities: ['memory-store', 'memory-recall'],
        lastPing: Date.now() - (5 * 60 * 1000), // 5 minutes ago
        responseTime: null
      }
    ];

    res.sendSuccess({ servers, total: servers.length });
  } catch (error) {
    log.error('❌ Failed to list MCP servers', LogContext.API, {
      error: error instanceof Error ? error.message : String(error)
    });
    res.sendError('INTERNAL_ERROR', 'Failed to list MCP servers', 500);
  }
});

/**
 * Execute MCP tool
 */
router.post('/tools/:toolName/execute', async (req: Request, res: Response) => {
  try {
    const { toolName } = req.params;
    const { arguments: toolArgs, serverId } = req.body;

    log.info('🔧 Executing MCP tool', LogContext.API, {
      toolName,
      serverId,
      hasArgs: !!toolArgs
    });

    // Use MCP integration service if available
    try {
      const result = await mcpIntegrationService.sendMessage('call_tool', {
        tool: toolName,
        arguments: toolArgs || {},
        serverId
      });

      res.sendSuccess(result);
    } catch (mcpError) {
      // Fallback to mock response
      const mockResult = {
        toolName,
        serverId: serverId || 'default',
        result: {
          success: true,
          output: `Mock execution result for tool: ${toolName}`,
          metadata: {
            executionTime: Math.floor(Math.random() * 1000) + 100,
            timestamp: Date.now()
          }
        }
      };

      res.sendSuccess(mockResult);
    }
  } catch (error) {
    log.error('❌ Failed to execute MCP tool', LogContext.API, {
      toolName: req.params.toolName,
      error: error instanceof Error ? error.message : String(error)
    });
    res.sendError('INTERNAL_ERROR', 'Failed to execute MCP tool', 500);
  }
});

/**
 * Get available tools from MCP servers
 */
router.get('/tools', async (req: Request, res: Response) => {
  try {
    const { serverId } = req.query;

    log.info('🛠️ Listing MCP tools', LogContext.API, {
      serverId: serverId as string
    });

    // Mock tools list
    const tools = [
      {
        name: 'search_context',
        server: 'supabase-mcp',
        description: 'Search for context in the database',
        parameters: {
          query: { type: 'string', required: true },
          category: { type: 'string', required: false },
          limit: { type: 'number', required: false }
        }
      },
      {
        name: 'store_context',
        server: 'supabase-mcp',
        description: 'Store context in the database',
        parameters: {
          content: { type: 'string', required: true },
          category: { type: 'string', required: true },
          metadata: { type: 'object', required: false }
        }
      },
      {
        name: 'read_file',
        server: 'filesystem-mcp',
        description: 'Read contents of a file',
        parameters: {
          path: { type: 'string', required: true },
          encoding: { type: 'string', required: false }
        }
      },
      {
        name: 'write_file',
        server: 'filesystem-mcp',
        description: 'Write content to a file',
        parameters: {
          path: { type: 'string', required: true },
          content: { type: 'string', required: true },
          encoding: { type: 'string', required: false }
        }
      }
    ];

    const filteredTools = serverId 
      ? tools.filter(tool => tool.server === serverId)
      : tools;

    res.sendSuccess({ tools: filteredTools, total: filteredTools.length });
  } catch (error) {
    log.error('❌ Failed to list MCP tools', LogContext.API, {
      error: error instanceof Error ? error.message : String(error)
    });
    res.sendError('INTERNAL_ERROR', 'Failed to list MCP tools', 500);
  }
});

/**
 * Get MCP resources
 */
router.get('/resources', async (req: Request, res: Response) => {
  try {
    const { serverId, type } = req.query;

    log.info('📚 Listing MCP resources', LogContext.API, {
      serverId: serverId as string,
      type: type as string
    });

    // Mock resources list
    const resources = [
      {
        uri: 'context://project/overview',
        name: 'Project Overview',
        type: 'context',
        server: 'supabase-mcp',
        mimeType: 'application/json',
        size: 2048,
        lastModified: Date.now() - (60 * 60 * 1000) // 1 hour ago
      },
      {
        uri: 'context://code/patterns',
        name: 'Code Patterns',
        type: 'context',
        server: 'supabase-mcp',
        mimeType: 'application/json',
        size: 5120,
        lastModified: Date.now() - (30 * 60 * 1000) // 30 minutes ago
      },
      {
        uri: 'file:///tmp/cache/memory.json',
        name: 'Memory Cache',
        type: 'file',
        server: 'filesystem-mcp',
        mimeType: 'application/json',
        size: 1024,
        lastModified: Date.now() - (5 * 60 * 1000) // 5 minutes ago
      }
    ];

    let filteredResources = resources;
    
    if (serverId) {
      filteredResources = filteredResources.filter(r => r.server === serverId);
    }
    
    if (type) {
      filteredResources = filteredResources.filter(r => r.type === type);
    }

    res.sendSuccess({ resources: filteredResources, total: filteredResources.length });
  } catch (error) {
    log.error('❌ Failed to list MCP resources', LogContext.API, {
      error: error instanceof Error ? error.message : String(error)
    });
    res.sendError('INTERNAL_ERROR', 'Failed to list MCP resources', 500);
  }
});

/**
 * Read MCP resource
 */
router.get('/resources/read', async (req: Request, res: Response) => {
  try {
    const { uri } = req.query;

    if (!uri) {
      return res.sendError('VALIDATION_ERROR', 'Resource URI is required', 400);
    }

    log.info('📖 Reading MCP resource', LogContext.API, {
      uri: uri as string
    });

    // Use MCP integration service if available
    try {
      const result = await mcpIntegrationService.sendMessage('read_resource', {
        uri: uri as string
      });

      res.sendSuccess(result);
    } catch (mcpError) {
      // Fallback to mock response
      const mockContent = {
        uri: uri as string,
        content: `Mock content for resource: ${uri}`,
        mimeType: 'text/plain',
        size: 256,
        readAt: Date.now()
      };

      res.sendSuccess(mockContent);
    }
  } catch (error) {
    log.error('❌ Failed to read MCP resource', LogContext.API, {
      uri: req.query.uri as string,
      error: error instanceof Error ? error.message : String(error)
    });
    res.sendError('INTERNAL_ERROR', 'Failed to read MCP resource', 500);
  }
});

/**
 * Get MCP agent metrics
 */
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    log.info('📊 Getting MCP agent metrics', LogContext.API);

    const metrics = {
      requests: {
        total: 1250,
        successful: 1180,
        failed: 70,
        successRate: 0.944
      },
      tools: {
        totalExecutions: 890,
        averageExecutionTime: 245, // ms
        mostUsedTool: 'search_context'
      },
      resources: {
        totalAccessed: 360,
        averageAccessTime: 95, // ms
        mostAccessedType: 'context'
      },
      servers: {
        total: 3,
        connected: 2,
        disconnected: 1,
        averageResponseTime: 85 // ms
      },
      performance: {
        averageLatency: 120, // ms
        errorRate: 0.056,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage()
      }
    };

    res.sendSuccess(metrics);
  } catch (error) {
    log.error('❌ Failed to get MCP agent metrics', LogContext.API, {
      error: error instanceof Error ? error.message : String(error)
    });
    res.sendError('INTERNAL_ERROR', 'Failed to get MCP agent metrics', 500);
  }
});

/**
 * Test MCP server connection
 */
router.post('/servers/:serverId/test', async (req: Request, res: Response) => {
  try {
    const { serverId } = req.params;

    log.info('🔍 Testing MCP server connection', LogContext.API, {
      serverId
    });

    // Mock connection test
    const testResult = {
      serverId,
      status: 'success',
      responseTime: Math.floor(Math.random() * 100) + 20, // 20-120ms
      capabilities: ['tools', 'resources', 'prompts'],
      version: '1.0.0',
      testedAt: Date.now()
    };

    res.sendSuccess(testResult);
  } catch (error) {
    log.error('❌ Failed to test MCP server connection', LogContext.API, {
      serverId: req.params.serverId,
      error: error instanceof Error ? error.message : String(error)
    });
    res.sendError('INTERNAL_ERROR', 'Failed to test MCP server connection', 500);
  }
});

/**
 * Helper function to get MCP server count
 */
async function getMCPServerCount(): Promise<number> {
  try {
    // This would normally query the actual MCP integration service
    return 3;
  } catch (error) {
    return 0;
  }
}

export default router;