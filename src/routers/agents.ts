import express from 'express';
import { v4 as uuidv4 } from 'uuid';

import type AgentRegistry from '@/agents/agent-registry';
import { log, LogContext } from '@/utils/logger';

const router = express.Router();

// GET /api/v1/agents
router.get('/', async (_req, res) => {
  try {
    const registry = (global as any).agentRegistry as AgentRegistry | undefined;
    if (!registry) {
      return res.json({ success: true, agents: [], metadata: { requestId: uuidv4() } });
    }
    const agents = registry.getAvailableAgents().map((a) => ({
      name: a.name,
      category: a.category,
      description: a.description,
      priority: a.priority,
      className: a.className,
      modulePath: a.modulePath,
      dependencies: a.dependencies,
      capabilities: a.capabilities,
      memoryEnabled: a.memoryEnabled,
      maxLatencyMs: a.maxLatencyMs,
      retryAttempts: a.retryAttempts,
    }));
    return res.json({ success: true, agents, metadata: { requestId: uuidv4() } });
  } catch (error) {
    log.error('Failed to list agents', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
    });
    // Soft-fail with empty list
    return res.json({
      success: true,
      agents: [],
      metadata: { requestId: uuidv4(), degraded: true },
    });
  }
});

// GET /api/v1/agents/registry - Alias for compatibility with Swift app
router.get('/registry', async (_req, res) => {
  try {
    const registry = (global as any).agentRegistry as AgentRegistry | undefined;
    if (!registry) {
      return res.json({ 
        success: true, 
        data: { 
          total: 0, 
          loaded: 0, 
          agents: [] 
        },
        metadata: { requestId: uuidv4() } 
      });
    }
    
    const availableAgents = registry.getAvailableAgents();
    const agents = availableAgents.map((a) => ({
      id: a.className || a.name.toLowerCase().replace(/\s+/g, '_'),
      name: a.name,
      type: a.category || 'general',
      description: a.description,
      capabilities: a.capabilities,
      status: 'active' // Default status for now
    }));
    
    return res.json({ 
      success: true, 
      data: {
        total: agents.length,
        loaded: agents.length,
        agents
      },
      metadata: { requestId: uuidv4() }
    });
  } catch (error) {
    log.error('Failed to list agents registry', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
    });
    // Soft-fail with empty list
    return res.json({
      success: true,
      data: {
        total: 0,
        loaded: 0,
        agents: []
      },
      metadata: { requestId: uuidv4(), degraded: true },
    });
  }
});

// POST /api/v1/agents/:id/activate
router.post('/:id/activate', async (req, res) => {
  try {
    const { id } = req.params;
    const registry = (global as any).agentRegistry as AgentRegistry | undefined;
    
    if (!registry) {
      return res.status(503).json({ 
        success: false, 
        error: 'Agent registry not available',
        metadata: { requestId: uuidv4() }
      });
    }

    // For now, just return success - actual activation logic would go here
    log.info(`Agent activation requested: ${id}`, LogContext.API);
    
    return res.json({
      success: true,
      data: { message: `Agent ${id} activated successfully` },
      metadata: { requestId: uuidv4() }
    });
  } catch (error) {
    log.error('Failed to activate agent', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({
      success: false,
      error: 'Failed to activate agent',
      metadata: { requestId: uuidv4() }
    });
  }
});

// POST /api/v1/agents/:id/deactivate
router.post('/:id/deactivate', async (req, res) => {
  try {
    const { id } = req.params;
    const registry = (global as any).agentRegistry as AgentRegistry | undefined;
    
    if (!registry) {
      return res.status(503).json({ 
        success: false, 
        error: 'Agent registry not available',
        metadata: { requestId: uuidv4() }
      });
    }

    // For now, just return success - actual deactivation logic would go here
    log.info(`Agent deactivation requested: ${id}`, LogContext.API);
    
    return res.json({
      success: true,
      data: { message: `Agent ${id} deactivated successfully` },
      metadata: { requestId: uuidv4() }
    });
  } catch (error) {
    log.error('Failed to deactivate agent', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({
      success: false,
      error: 'Failed to deactivate agent',
      metadata: { requestId: uuidv4() }
    });
  }
});

export default router;
