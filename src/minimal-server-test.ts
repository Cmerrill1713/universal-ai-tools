#!/usr/bin/env node
/**
 * Minimal Server for Context Management Testing
 * Skips problematic async routes that might be hanging
 */

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { log, LogContext } from './utils/logger.js';

const app = express();
const server = createServer(app);

// Basic middleware
app.use(cors());
app.use(express.json());

// Health endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// Context management test endpoint
app.post('/api/v1/llm/context-info', async (req, res) => {
  try {
    const { contextLengthManager } = await import('./services/context-length-manager.js');
    
    const {
      modelId,
      provider,
      taskType,
      inputLength,
      preferredOutputLength,
      priority = 'balanced'
    } = req.body;

    if (!modelId || !provider || !taskType || inputLength === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: modelId, provider, taskType, inputLength'
      });
    }

    const contextRequest = {
      modelId,
      provider,
      taskType,
      inputLength,
      preferredOutputLength,
      priority
    };

    const optimalContext = contextLengthManager.getOptimalContextLength(contextRequest);
    const modelInfo = contextLengthManager.getModelInfo(modelId, provider);

    return res.json({
      success: true,
      data: {
        request: contextRequest,
        optimization: optimalContext,
        modelInfo: modelInfo,
        recommendations: {
          shouldTruncate: optimalContext.truncationStrategy !== 'none',
          efficiency: optimalContext.efficiency,
          reasoning: optimalContext.reasoning
        }
      }
    });

  } catch (error) {
    log.error('Context info error', LogContext.API, { error });
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Context info request failed'
    });
  }
});

// Start server
const PORT = 9999;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Minimal server running on http://localhost:${PORT}`);
  console.log(`✅ Context management API available at /api/v1/llm/context-info`);
  console.log(`🔍 Health check: http://localhost:${PORT}/health`);
});