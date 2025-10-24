import express from 'express';
import { Request, Response } from 'express';
import chatRouter from './routers/chat';

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

// Routes
app.use('/api/chat', chatRouter);

// Basic routes
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    message: 'Server is running successfully',
    services: {
      chat: 'available',
      uatPrompt: 'available',
      neuroforge: 'available',
      contextEngineering: 'available'
    }
  });
});

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'Universal AI Tools - Chat Service with UAT-Prompt & Neuroforge Integration',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      chat: '/api/chat',
      chatMessage: '/api/chat/message',
      chatHistory: '/api/chat/history/:sessionId',
      chatContext: '/api/chat/context/:sessionId',
      chatStats: '/api/chat/stats',
      chatStream: '/api/chat/stream'
    }
  });
});

export { app };