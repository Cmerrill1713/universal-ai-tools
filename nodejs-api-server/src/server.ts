import express from 'express';
import { Request, Response } from 'express';

const app = express();

// Middleware
app.use(express.json());

// Basic routes
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    message: 'Server is running successfully'
  });
});

export { app };