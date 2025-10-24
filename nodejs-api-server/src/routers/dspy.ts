/**
 * DSPy Router
 * API endpoints for DSPy Orchestrator cognitive reasoning chains
 */

import express, { Request, Response } from 'express';
import { DSPyOrchestrator, DSPyRequest } from '../services/dspy-orchestrator';

const router = express.Router();

// Initialize DSPy Orchestrator
const dspyOrchestrator = new DSPyOrchestrator(
  process.env.SUPABASE_URL || 'http://127.0.0.1:54321',
  process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
);

// Initialize DSPy service
dspyOrchestrator.initialize().catch(error => {
  console.error('Failed to initialize DSPy Orchestrator:', error);
});

/**
 * POST /api/dspy/orchestrate
 * Execute a reasoning chain
 */
router.post('/orchestrate', async (req: Request, res: Response) => {
  try {
    const { task, context, reasoningChain, maxIterations, convergenceThreshold, enableLearning, userId, sessionId, model, modelProvider } = req.body;

    if (!task || !userId || !sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: task, userId, sessionId'
      });
    }

    const request: DSPyRequest = {
      task,
      context: context || {},
      reasoningChain: reasoningChain || 'comprehensive_analysis',
      maxIterations: maxIterations || 1,
      convergenceThreshold: convergenceThreshold || 0.8,
      enableLearning: enableLearning || false,
      userId,
      sessionId,
      model: model || process.env.DEFAULT_LLM_MODEL,
      modelProvider: modelProvider || (process.env.DEFAULT_LLM_PROVIDER as 'ollama' | 'mlx' | 'openai' | 'anthropic') || 'ollama'
    };

    const response = await dspyOrchestrator.executeReasoningChain(request);

    res.json({
      success: response.success,
      data: response,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('DSPy orchestration error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/dspy/chains
 * Get available reasoning chains
 */
router.get('/chains', async (req: Request, res: Response) => {
  try {
    const chains = dspyOrchestrator.getAvailableChains();
    
    res.json({
      success: true,
      data: chains,
      count: chains.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error getting reasoning chains:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/dspy/agents
 * Get available agents
 */
router.get('/agents', async (req: Request, res: Response) => {
  try {
    const agents = dspyOrchestrator.getAvailableAgents();
    
    res.json({
      success: true,
      data: agents,
      count: agents.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error getting agents:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/dspy/status
 * Get DSPy service status
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const status = await dspyOrchestrator.getStatus();
    
    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error getting DSPy status:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/dspy/quick-analysis
 * Quick analysis using rapid prototyping chain
 */
router.post('/quick-analysis', async (req: Request, res: Response) => {
  try {
    const { task, context, userId, sessionId } = req.body;

    if (!task || !userId || !sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: task, userId, sessionId'
      });
    }

    const request: DSPyRequest = {
      task,
      context: context || {},
      reasoningChain: 'rapid_prototyping',
      maxIterations: 2,
      convergenceThreshold: 0.7,
      enableLearning: false,
      userId,
      sessionId
    };

    const response = await dspyOrchestrator.executeReasoningChain(request);

    res.json({
      success: response.success,
      data: response,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('DSPy quick analysis error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/dspy/ethical-review
 * Ethical review using ethics-focused chain
 */
router.post('/ethical-review', async (req: Request, res: Response) => {
  try {
    const { task, context, userId, sessionId } = req.body;

    if (!task || !userId || !sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: task, userId, sessionId'
      });
    }

    const request: DSPyRequest = {
      task,
      context: context || {},
      reasoningChain: 'ethical_review',
      maxIterations: 1,
      convergenceThreshold: 0.9,
      enableLearning: false,
      userId,
      sessionId
    };

    const response = await dspyOrchestrator.executeReasoningChain(request);

    res.json({
      success: response.success,
      data: response,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('DSPy ethical review error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/dspy/strategic-planning
 * Strategic planning using planning-focused chain
 */
router.post('/strategic-planning', async (req: Request, res: Response) => {
  try {
    const { task, context, userId, sessionId } = req.body;

    if (!task || !userId || !sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: task, userId, sessionId'
      });
    }

    const request: DSPyRequest = {
      task,
      context: context || {},
      reasoningChain: 'strategic_planning',
      maxIterations: 1,
      convergenceThreshold: 0.8,
      enableLearning: false,
      userId,
      sessionId
    };

    const response = await dspyOrchestrator.executeReasoningChain(request);

    res.json({
      success: response.success,
      data: response,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('DSPy strategic planning error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/dspy/health
 * Health check endpoint
 */
router.get('/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    service: 'DSPy Orchestrator',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    endpoints: [
      'POST /api/dspy/orchestrate',
      'GET /api/dspy/chains',
      'GET /api/dspy/agents',
      'GET /api/dspy/status',
      'POST /api/dspy/quick-analysis',
      'POST /api/dspy/ethical-review',
      'POST /api/dspy/strategic-planning',
      'GET /api/dspy/health'
    ]
  });
});

export default router;