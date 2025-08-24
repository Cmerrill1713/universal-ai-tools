/**
 * Minimal Test Server - Basic functionality test
 * Tests core API endpoints without heavy dependencies
 */

import express from 'express';
import cors from 'cors';
import { logger } from './utils/enhanced-logger.js';
import { huggingfaceKnowledgeRouter as huggingFaceKnowledgeRouter } from './migration/compatibility-stubs';
import imageGenerationRouter from './routers/image-generation-router.js';
import hrmAgentIntegrationRouter from './routers/hrm-agent-integration.js';
import aiLibrariesRouter from './routers/ai-libraries.js';

const app = express();
const PORT = process.env.PORT || 9999;

// Basic middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'universal-ai-tools',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    mode: 'minimal-test'
  });
});

// Basic API info endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'Universal AI Tools API',
    version: '1.0.0',
    status: 'running',
    endpoints: [
      '/health',
      '/api',
      '/api/chat',
      '/api/agents',
      '/api/image-generation',
      '/api/huggingface-knowledge/ingest/model',
      '/api/huggingface-knowledge/ingest/dataset',
      '/api/huggingface-knowledge/ingest/batch',
      '/api/huggingface-knowledge/ingest/trending',
      '/api/huggingface-knowledge/query',
      '/api/huggingface-knowledge/popular',
      '/api/huggingface-knowledge/status',
      '/api/hrm/decision',
      '/api/agents/system-health',
      '/api/agents/execute-task',
      '/api/agents/execute-chain',
      '/api/agents/available',
      '/api/dspy/cognitive-reasoning',
      '/api/libraries/swift',
      '/api/libraries/all',
      '/api/libraries/frameworks',
      '/api/libraries/categories',
      '/api/libraries/discover',
      '/api/libraries/analyze'
    ]
  });
});

// Simple chat endpoint
app.post('/api/chat', (req, res): any => {
  const { message, model = 'gpt-3.5-turbo' } = req.body;
  
  if (!message) {
    return res.status(400).json({
      error: 'Message is required',
      code: 'MISSING_MESSAGE'
    });
  }

  // Mock response
  return res.json({
    id: `chat_${Date.now()}`,
    response: `Hello! You said: "${message}". This is a test response from the Universal AI Tools minimal server.`,
    model,
    timestamp: new Date().toISOString(),
    tokens_used: Math.floor(Math.random() * 100) + 50
  });
});

// Agents endpoint
app.get('/api/agents', (req, res) => {
  res.json({
    agents: [
      {
        id: 'assistant',
        name: 'Assistant',
        type: 'general',
        status: 'available',
        description: 'General purpose AI assistant'
      },
      {
        id: 'coder',
        name: 'Code Assistant',
        type: 'coding',
        status: 'available',
        description: 'Specialized coding assistant'
      }
    ],
    total: 2
  });
});

// Real Image generation router with multiple backends
app.use('/api/image-generation', imageGenerationRouter);

// HuggingFace Knowledge Ingestion routes
app.use('/api/huggingface-knowledge', huggingFaceKnowledgeRouter);

// HRM Agent Integration routes (Phase 2: Rust Agent Registry coordination)
app.use('/', hrmAgentIntegrationRouter);

// AI Libraries router
app.use('/api/libraries', aiLibrariesRouter);

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    code: 'SERVER_ERROR'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    code: 'NOT_FOUND',
    path: req.path
  });
});

// Start server
const server = app.listen(PORT, () => {
  logger.info(`🚀 Minimal test server started on port ${PORT}`);
  logger.info(`📍 Health check: http://localhost:${PORT}/health`);
  logger.info(`📍 API info: http://localhost:${PORT}/api`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

export default app;