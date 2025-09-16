#!/usr/bin/env node

/**
 * Simple Universal AI Tools Server - Minimal Working Version
 * This is a simplified version to test basic functionality
 */

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';

const app = express();
const server = createServer(app);

// Basic middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API base route
app.get('/api/v1', (req, res) => {
  res.json({
    message: 'Universal AI Tools API v1',
    timestamp: new Date().toISOString(),
    availableEndpoints: [
      '/api/v1',
      '/health',
      '/api/v1/chat',
      '/api/v1/vision',
      '/api/v1/browser',
      '/api/v1/audio',
    ],
  });
});

// Simple chat endpoint
app.post('/api/v1/chat', (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  // Simple echo response for testing
  res.json({
    response: `Echo: ${message}`,
    timestamp: new Date().toISOString(),
  });
});

// Vision endpoint placeholder
app.post('/api/v1/vision', (req, res) => {
  res.json({
    message: 'Vision endpoint ready',
    timestamp: new Date().toISOString(),
  });
});

// Browser endpoint placeholder
app.post('/api/v1/browser/fetch', (req, res) => {
  res.json({
    message: 'Browser endpoint ready',
    timestamp: new Date().toISOString(),
  });
});

// Audio endpoint placeholder
app.post('/api/v1/audio/synthesize', (req, res) => {
  res.json({
    message: 'Audio endpoint ready',
    timestamp: new Date().toISOString(),
  });
});

// Start server
const PORT = process.env.PORT || 8080;

server.listen(PORT, () => {
  console.log(`🚀 Simple Universal AI Tools Server running on http://localhost:${PORT}`);
  console.log(`📚 API Documentation available at http://localhost:${PORT}/api/v1`);
  console.log(`❤️  Health check available at http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
