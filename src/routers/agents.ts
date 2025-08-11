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

export default router;
