import type { Request, Response } from 'express';
import { Router } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { MCPServerService } from '../services/mcp-server-service';
import { LogContext, logger } from '../utils/enhanced-logger';

export function createMCPRouter(supabase: SupabaseClient, mcpService: MCPServerService) {
  const router = Router();

  // Get all registered MCP agents
  router.get('/agents', async (req: Request, res: Response) => {
    try {
      const agents = await mcpService.getAgents();

      res.json({
        success: true,
        agents: agents.map((agent) => ({
          id: agent.id,
          name: agent.name,
          icon: agent.icon,
          description: agent.description,
          capabilities: agent.capabilities,
          status: agent.status,
          endpoint: agent.endpoint,
          requiredKeys: agent.requiredKeys.map((key) => ({
            name: key.name,
            description: key.description,
            type: key.type,
          })),
        })),
        total: agents.length,
      });
    } catch (error) {
      logger.error('Failed to get MCP agents', LogContext.API, { error });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve MCP agents',
      });
    }
  });

  // Get specific MCP agent
  router.get('/agents/:agentId', async (req: Request, res: Response) => {
    try {
      const { agentId } = req.params;
      const agent = await mcpService.getAgent(agentId);

      if (!agent) {
        return res.status(404).json({
          success: false,
          error: 'Agent not found',
        });
      }

      res.json({
        success: true,
        agent: {
          id: agent.id,
          name: agent.name,
          icon: agent.icon,
          description: agent.description,
          capabilities: agent.capabilities,
          status: agent.status,
          endpoint: agent.endpoint,
          requiredKeys: agent.requiredKeys.map((key) => ({
            name: key.name,
            description: key.description,
            type: key.type,
          })),
          lastHeartbeat: agent.lastHeartbeat,
        },
      });
    } catch (error) {
      logger.error('Failed to get MCP agent', LogContext.API, {
        error,
        agentId: req.params.agentId,
      });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve MCP agent',
      });
    }
  });

  // Store agent keys in vault
  router.post('/agents/:agentId/keys', async (req: Request, res: Response) => {
    try {
      const { agentId } = req.params;
      const { keys } = req.body;

      if (!keys || typeof keys !== 'object') {
        return res.status(400).json({
          success: false,
          error: 'Invalid keys format',
        });
      }

      const agent = await mcpService.getAgent(agentId);
      if (!agent) {
        return res.status(404).json({
          success: false,
          error: 'Agent not found',
        });
      }

      // Validate all required keys are provided
      const missingKeys = agent.requiredKeys
        .filter((reqKey) => !keys[reqKey.name])
        .map((key) => key.name);

      if (missingKeys.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Missing required keys',
          missingKeys,
        });
      }

      // Store keys in vault (handled internally by service)
      await supabase.from('mcp_key_vault').upsert(
        Object.entries(keys).map(([keyName, keyValue]) => ({
          agent_id: agentId,
          key_name: keyName,
          encrypted_value: keyValue, // Service will handle encryption
          updated_at: new Date().toISOString(),
        }))
      );

      res.json({
        success: true,
        message: 'Keys stored successfully',
      });

      logger.info('MCP agent keys stored', LogContext.SECURITY, { agentId });
    } catch (error) {
      logger.error('Failed to store MCP agent keys', LogContext.SECURITY, {
        error,
        agentId: req.params.agentId,
      });
      res.status(500).json({
        success: false,
        error: 'Failed to store agent keys',
      });
    }
  });

  // Execute agent action
  router.post('/agents/:agentId/execute', async (req: Request, res: Response) => {
    try {
      const { agentId } = req.params;
      const { action, params } = req.body;

      if (!action) {
        return res.status(400).json({
          success: false,
          error: 'Action is required',
        });
      }

      const result = await mcpService.executeAgentAction(agentId, action, params);

      res.json({
        success: true,
        result,
      });
    } catch (error) {
      logger.error('Failed to execute MCP agent action', LogContext.API, {
        error,
        agentId: req.params.agentId,
        action: req.body.action,
      });

      const errorMessage = error instanceof Error ? error.message : 'Failed to execute action';
      const statusCode = errorMessage === 'Agent not available' ? 503 : 500;

      res.status(statusCode).json({
        success: false,
        error: errorMessage,
      });
    }
  });

  // Get agent connection status
  router.get('/status', async (req: Request, res: Response) => {
    try {
      const agents = await mcpService.getAgents();
      const connectedCount = agents.filter((a) => a.status === 'connected').length;
      const disconnectedCount = agents.filter((a) => a.status === 'disconnected').length;
      const errorCount = agents.filter((a) => a.status === 'error').length;
      const pendingCount = agents.filter((a) => a.status === 'pending').length;

      res.json({
        success: true,
        status: {
          total: agents.length,
          connected: connectedCount,
          disconnected: disconnectedCount,
          error: errorCount,
          pending: pendingCount,
        },
        agents: agents.map((a) => ({
          id: a.id,
          name: a.name,
          status: a.status,
          lastHeartbeat: a.lastHeartbeat,
        })),
      });
    } catch (error) {
      logger.error('Failed to get MCP status', LogContext.API, { error });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve MCP status',
      });
    }
  });

  // Update agent configuration
  router.put('/agents/:agentId', async (req: Request, res: Response) => {
    try {
      const { agentId } = req.params;
      const { name, description, icon, capabilities } = req.body;

      const { error } = await supabase
        .from('mcp_agents')
        .update({
          name,
          description,
          icon,
          capabilities,
          updated_at: new Date().toISOString(),
        })
        .eq('id', agentId);

      if (error) throw error;

      res.json({
        success: true,
        message: 'Agent updated successfully',
      });
    } catch (error) {
      logger.error('Failed to update MCP agent', LogContext.API, {
        error,
        agentId: req.params.agentId,
      });
      res.status(500).json({
        success: false,
        error: 'Failed to update agent',
      });
    }
  });

  // Delete agent
  router.delete('/agents/:agentId', async (req: Request, res: Response) => {
    try {
      const { agentId } = req.params;

      // Delete keys first
      await supabase.from('mcp_key_vault').delete().eq('agent_id', agentId);

      // Delete agent
      const { error } = await supabase.from('mcp_agents').delete().eq('id', agentId);

      if (error) throw error;

      res.json({
        success: true,
        message: 'Agent deleted successfully',
      });

      logger.info('MCP agent deleted', LogContext.API, { agentId });
    } catch (error) {
      logger.error('Failed to delete MCP agent', LogContext.API, {
        error,
        agentId: req.params.agentId,
      });
      res.status(500).json({
        success: false,
        error: 'Failed to delete agent',
      });
    }
  });

  // Test agent connection
  router.post('/agents/:agentId/test', async (req: Request, res: Response) => {
    try {
      const { agentId } = req.params;

      // Try to execute a simple test action
      const result = await mcpService.executeAgentAction(agentId, 'test', {});

      res.json({
        success: true,
        message: 'Agent connection test successful',
        result,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Test failed';
      res.status(503).json({
        success: false,
        error: errorMessage,
      });
    }
  });

  return router;
}

export const MCPRouter = (supabase: SupabaseClient, mcpService: MCPServerService) =>
  createMCPRouter(supabase, mcpService);
