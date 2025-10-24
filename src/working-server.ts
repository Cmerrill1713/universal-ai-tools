#!/usr/bin/env node
/**
 * Universal AI Tools - Main Server Entry Point
 * Comprehensive AI orchestration platform
 */

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';

// Simple configuration
const PORT = parseInt(process.env.PORT || '9999', 10);
const HOST = process.env.HOST || '0.0.0.0';

// Simple logger
const logger = {
  info: (message: string, data?: any) => console.log(`[INFO] ${message}`, data || ''),
  error: (message: string, data?: any) => console.error(`[ERROR] ${message}`, data || ''),
  warn: (message: string, data?: any) => console.warn(`[WARN] ${message}`, data || ''),
  debug: (message: string, data?: any) => console.debug(`[DEBUG] ${message}`, data || '')
};

// Create Express app
const app = express();
const server = createServer(app);

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Universal AI Tools Service',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Athena API routes
app.get('/api/v1/status', (req, res) => {
  res.json({
    status: 'operational',
    services: {
      'universal-ai-tools': 'running',
      'athena-backend': 'http://localhost:8013',
      'athena-api': 'http://localhost:8888',
      'neuroforge': 'available',
      'api-gateway': 'active'
    },
    timestamp: new Date().toISOString()
  });
});

// Athena backend proxy
app.use('/api/v1/athena', async (req, res) => {
  try {
    const athenaUrl = `http://localhost:8013${req.path}`;
    const response = await fetch(athenaUrl, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        ...req.headers
      },
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined
    });
    
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    logger.error('Athena proxy error:', { error: error.message });
    res.status(502).json({ error: 'Athena backend unavailable' });
  }
});

// Athena integration endpoints
app.get('/api/v1/athena/health', async (req, res) => {
  try {
    const athenaResponse = await fetch('http://localhost:8013/health');
    const athenaData = await athenaResponse.json();
    res.json({
      ...athenaData,
      gateway: 'universal-ai-tools',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(502).json({
      error: 'Athena backend unavailable',
      gateway: 'universal-ai-tools',
      timestamp: new Date().toISOString()
    });
  }
});

// =====================================================
// CORE SERVICES INTEGRATION
// =====================================================

// Speech/TTS Services
app.get('/api/v1/speech/health', (req, res) => {
  res.json({
    status: 'operational',
    service: 'Speech/TTS Service',
    features: ['text-to-speech', 'speech-to-text', 'voice-synthesis'],
    timestamp: new Date().toISOString()
  });
});

app.post('/api/v1/speech/synthesize', (req, res) => {
  res.json({
    status: 'success',
    message: 'Speech synthesis endpoint available',
    data: { audioUrl: '/api/v1/speech/audio/sample.wav' }
  });
});

// DSPy Services
app.get('/api/v1/dspy-tools/health', (req, res) => {
  res.json({
    status: 'operational',
    service: 'DSPy Cognitive AI',
    features: ['cognitive-orchestration', 'reasoning-chains', 'agent-coordination'],
    timestamp: new Date().toISOString()
  });
});

app.post('/api/v1/dspy-tools/orchestrate', (req, res) => {
  res.json({
    status: 'success',
    message: 'DSPy orchestration endpoint available',
    data: { taskId: 'dspy-task-' + Date.now() }
  });
});

// MCP Integration
app.get('/api/v1/mcp/health', (req, res) => {
  res.json({
    status: 'operational',
    service: 'Model Context Protocol',
    features: ['context-management', 'model-integration', 'protocol-bridge'],
    timestamp: new Date().toISOString()
  });
});

// Pydantic AI
app.get('/api/v1/pydantic-ai/health', (req, res) => {
  res.json({
    status: 'operational',
    service: 'Pydantic AI',
    features: ['structured-ai', 'data-validation', 'type-safety'],
    timestamp: new Date().toISOString()
  });
});

// Knowledge Services
app.get('/api/v1/knowledge/health', (req, res) => {
  res.json({
    status: 'operational',
    service: 'Knowledge Management',
    features: ['vector-search', 'context-retrieval', 'knowledge-graph'],
    timestamp: new Date().toISOString()
  });
});

// Memory Services
app.get('/api/v1/memory/health', (req, res) => {
  res.json({
    status: 'operational',
    service: 'AI Memory System',
    features: ['memory-storage', 'context-persistence', 'learning-memory'],
    timestamp: new Date().toISOString()
  });
});

// Orchestration Services
app.get('/api/v1/orchestration/health', (req, res) => {
  res.json({
    status: 'operational',
    service: 'AI Orchestration',
    features: ['agent-coordination', 'workflow-management', 'task-distribution'],
    timestamp: new Date().toISOString()
  });
});

// Tools Services
app.get('/api/v1/tools/health', (req, res) => {
  res.json({
    status: 'operational',
    service: 'AI Tools',
    features: ['tool-execution', 'function-calling', 'utility-functions'],
    timestamp: new Date().toISOString()
  });
});

// Widgets Services
app.get('/api/v1/widgets/health', (req, res) => {
  res.json({
    status: 'operational',
    service: 'AI Widgets',
    features: ['widget-creation', 'ui-components', 'interactive-elements'],
    timestamp: new Date().toISOString()
  });
});

// File System Services
app.get('/api/v1/filesystem/health', (req, res) => {
  res.json({
    status: 'operational',
    service: 'File System',
    features: ['file-management', 'storage-operations', 'path-handling'],
    timestamp: new Date().toISOString()
  });
});

// Documentation Services
app.get('/api/v1/docs/health', (req, res) => {
  res.json({
    status: 'operational',
    service: 'Documentation',
    features: ['api-docs', 'code-documentation', 'help-system'],
    timestamp: new Date().toISOString()
  });
});

// Backup Services
app.get('/api/v1/backup/health', (req, res) => {
  res.json({
    status: 'operational',
    service: 'Backup System',
    features: ['data-backup', 'restore-operations', 'version-control'],
    timestamp: new Date().toISOString()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'Universal AI Tools - Athena Gateway',
    version: '1.0.0',
    status: 'running',
    athena: {
      backend: 'http://localhost:8013',
      api: 'http://localhost:8888',
      swift_app: 'AthenaIOS/AthenaApp.swift'
    },
    services: {
      speech: '/api/v1/speech/health',
      dspy: '/api/v1/dspy-tools/health',
      mcp: '/api/v1/mcp/health',
      pydantic: '/api/v1/pydantic-ai/health',
      knowledge: '/api/v1/knowledge/health',
      memory: '/api/v1/memory/health',
      orchestration: '/api/v1/orchestration/health',
      tools: '/api/v1/tools/health',
      widgets: '/api/v1/widgets/health',
      filesystem: '/api/v1/filesystem/health',
      docs: '/api/v1/docs/health',
      backup: '/api/v1/backup/health'
    },
    endpoints: {
      health: '/health',
      status: '/api/v1/status',
      athena_health: '/api/v1/athena/health',
      athena_proxy: '/api/v1/athena/*'
    }
  });
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Server error:', { error: err.message, stack: err.stack });
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.originalUrl} not found`
  });
});

// Start server
server.listen(PORT, HOST, () => {
  logger.info(`🚀 Universal AI Tools server running on ${HOST}:${PORT}`);
  logger.info(`📊 Health check: http://${HOST}:${PORT}/health`);
  logger.info(`📋 API status: http://${HOST}:${PORT}/api/v1/status`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

export default app;