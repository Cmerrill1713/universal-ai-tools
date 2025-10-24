import 'dotenv/config';
import express from 'express';
import { Request, Response } from 'express';
import athenaRouter from './routers/sweet-athena';
import dspyRouter from './routers/dspy';
import mlxRouter from './routers/mlx';
import intelligentParametersRouter from './routers/intelligent-parameters';
import gitlabRouter from './routers/gitlab';
import governanceRouter from './routers/governance';

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-API-Key');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Basic routes (must come before Athena router)
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    message: 'Server is running successfully',
    services: {
      athena: 'available',
      chat: 'available',
      uatPrompt: 'available',
      neuroforge: 'available',
      contextEngineering: 'available',
      governance: 'available',
      republic: 'available',
      dspy: 'available',
      mlx: 'available',
      intelligentParameters: 'available'
    }
  });
});

// Additional specialized routers (must come before Athena router)
app.use('/api/dspy', dspyRouter);
app.use('/api/mlx', mlxRouter);
app.use('/api/parameters', intelligentParametersRouter);
app.use('/api/gitlab', gitlabRouter);
app.use('/api/governance', governanceRouter);

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'Universal AI Tools - Athena Central Intelligence with UAT-Prompt, Neuroforge & Governance Integration',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      athena: '/api/athena',
      athenaStatus: '/api/athena/status',
      athenaIntelligence: '/api/athena/intelligence',
      athenaStats: '/api/athena/routing-stats',
      chat: '/api/chat',
      chatMessage: '/api/chat/message',
      chatHistory: '/api/chat/history/:sessionId',
      chatContext: '/api/chat/context/:sessionId',
      chatStats: '/api/chat/stats',
      chatStream: '/api/chat/stream',
      governance: '/api/governance',
      proposals: '/api/governance/proposals',
      votes: '/api/governance/votes',
      citizens: '/api/governance/citizens',
      republic: '/api/governance/republic',
      dspy: '/api/dspy',
      dspyOrchestrate: '/api/dspy/orchestrate',
      dspyChains: '/api/dspy/chains',
      dspyAgents: '/api/dspy/agents',
      mlx: '/api/mlx',
      mlxFineTune: '/api/mlx/fine-tune',
      mlxDatasets: '/api/mlx/datasets',
      parameters: '/api/parameters',
      parameterOptimize: '/api/parameters/optimize',
      parameterAnalytics: '/api/parameters/analytics',
      gitlab: '/api/gitlab',
      gitlabIssues: '/api/gitlab/issues',
      gitlabAnalysis: '/api/gitlab/analysis',
      gitlabContext: '/api/gitlab/context'
    }
  });
});

// Athena router (must come last to catch remaining routes)
app.use('/', athenaRouter);

// Start the server
const PORT = process.env.PORT || 9999;
app.listen(PORT, () => {
  console.log(`🚀 Universal AI Tools server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🌸 Athena routing: http://localhost:${PORT}/`);
  console.log(`💬 Chat API: http://localhost:${PORT}/api/chat`);
  console.log(`🏛️ Governance: http://localhost:${PORT}/api/governance`);
  console.log(`🤖 DSPy Orchestrator: http://localhost:${PORT}/api/dspy`);
  console.log(`🧠 MLX Integration: http://localhost:${PORT}/api/mlx`);
  console.log(`⚙️ Parameters: http://localhost:${PORT}/api/parameters`);
  console.log(`🔗 GitLab Integration: http://localhost:${PORT}/api/gitlab`);
});

export { app };