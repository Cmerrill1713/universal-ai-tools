import express from 'express';
import { Request, Response } from 'express';
import athenaRouter from './routers/sweet-athena';

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

// Routes - Athena is the central router for everything
app.use('/', athenaRouter);

// Basic routes
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
      republic: 'available'
    }
  });
});

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
      republic: '/api/governance/republic'
    }
  });
});

export { app };