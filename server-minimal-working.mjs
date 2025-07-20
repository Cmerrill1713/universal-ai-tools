#!/usr/bin/env node

import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment
config();

console.log('🚀 Starting Universal AI Tools - Minimal Working Version...');

const app = express();
const port = process.env.PORT || 9999;

// Basic middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

console.log('✅ Supabase client created');

// Simple authentication middleware for development
const simpleAuth = (req, res, next) => {
  req.aiService = { 
    id: 'dev-minimal', 
    name: 'Development Minimal',
    capabilities: ['memory', 'context', 'tools', 'ai_chat']
  };
  req.aiServiceId = 'dev-minimal';
  next();
};

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'Universal AI Tools Service - Minimal',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Basic stats endpoint
app.get('/api/stats', simpleAuth, async (req, res) => {
  try {
    const { count: memoryCount } = await supabase
      .from('ai_memories')
      .select('*', { count: 'exact', head: true });

    const stats = {
      activeAgents: 0,
      messagestoday: 0,
      totalMemories: memoryCount || 0,
      cpuUsage: process.cpuUsage(),
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime()
    };

    res.json({ success: true, stats });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch stats' });
  }
});

// Ollama status endpoint
app.get('/api/ollama/status', async (req, res) => {
  try {
    const response = await fetch('http://localhost:11434/api/tags');
    if (response.ok) {
      const data = await response.json();
      res.json({
        status: 'available',
        models: data.models?.map((m) => m.name) || []
      });
    } else {
      res.json({ status: 'unavailable', error: 'Ollama not responding' });
    }
  } catch (error) {
    res.json({ status: 'unavailable', error: 'Cannot connect to Ollama' });
  }
});

// Basic chat endpoint
app.post('/api/assistant/chat', async (req, res) => {
  try {
    const { message, model = 'llama3.2:3b', conversation_id } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Generate response using Ollama
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: message,
        stream: false,
        options: { temperature: 0.7, top_p: 0.9, top_k: 40 }
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`);
    }

    const data = await response.json();

    res.json({
      response: data.response,
      model,
      conversation_id,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Failed to generate response' });
  }
});

// Basic memory endpoints
app.post('/api/v1/memory', simpleAuth, async (req, res) => {
  try {
    const { content, memory_type = 'working', metadata = {} } = req.body;
    
    const { data, error } = await supabase
      .from('ai_memories')
      .insert({
        content,
        memory_type,
        metadata,
        service_id: req.aiServiceId
      })
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, memory: data });
  } catch (error) {
    console.error('Memory storage error:', error);
    res.status(500).json({ success: false, error: 'Failed to store memory' });
  }
});

app.get('/api/v1/memory', simpleAuth, async (req, res) => {
  try {
    const { limit = 50, memory_type } = req.query;
    
    let query = supabase
      .from('ai_memories')
      .select('*')
      .eq('service_id', req.aiServiceId)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (memory_type) {
      query = query.eq('memory_type', memory_type);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json({ success: true, memories: data || [] });
  } catch (error) {
    console.error('Memory retrieval error:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve memories' });
  }
});

// API docs endpoint
app.get('/api/docs', (req, res) => {
  res.json({
    service: 'Universal AI Tools - Minimal Working Version',
    version: '1.0.0-minimal',
    endpoints: {
      health: 'GET /health',
      stats: 'GET /api/stats',
      ollamaStatus: 'GET /api/ollama/status',
      chat: 'POST /api/assistant/chat',
      memory: {
        store: 'POST /api/v1/memory',
        retrieve: 'GET /api/v1/memory'
      }
    },
    note: 'This is a simplified version with core functionality only.'
  });
});

// Start server
const server = app.listen(port, () => {
  console.log(`✅ Universal AI Tools Service (Minimal) running on port ${port}`);
  console.log(`📚 API docs available at http://localhost:${port}/api/docs`);
  console.log(`🏥 Health check at http://localhost:${port}/health`);
  console.log(`💬 Chat interface ready at http://localhost:${port}/api/assistant/chat`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

console.log('🎉 Minimal server started successfully!');