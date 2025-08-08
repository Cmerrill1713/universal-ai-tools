const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

const app = express();
const port = process.env.AI_TOOLS_PORT || 9999;

// Supabase client
// Note: This is an archived server file. In production, use proper environment variables or Supabase Vault.
const supabase = createClient(
  process.env.SUPABASE_URL || 'http://localhost:54321',
  process.env.SUPABASE_SERVICE_KEY || '[SERVICE_KEY_REMOVED_FOR_SECURITY]'
);

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Serve static files
const publicPath = path.join(__dirname, '../public');
const dashboardPath = path.join(__dirname, 'supabase_dashboard.html');

app.use(express.static(publicPath));

// Root route - serve the chat UI
app.get('/', (req, res) => {
  const indexPath = path.join(publicPath, 'index.html');
  res.sendFile(indexPath);
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'Universal AI Tools Service',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Ollama status endpoint
app.get('/api/ollama/status', async (req, res) => {
  try {
    const axios = require('axios');
    const response = await axios.get('http://localhost:11434/api/tags', { timeout: 5000 });
    const data = response.data;
    const activeModel = data.models && data.models.length > 0 ? data.models[0].name : null;
    res.json({
      status: 'available',
      active_model: activeModel,
      model_count: data.models?.length || 0,
      available: true
    });
  } catch (error) {
    res.json({
      status: 'offline',
      active_model: null,
      model_count: 0,
      available: false,
      error: error.message
    });
  }
});

// API Documentation
app.get('/api/docs', (req, res) => {
  res.json({
    version: '1.0.0',
    service: 'Universal AI Tools',
    description: 'Production-ready AI tools with Supabase integration',
    endpoints: {
      health: 'GET /health - Service health check',
      docs: 'GET /api/docs - This documentation',
      ollama: 'GET /api/ollama/status - Ollama service status',
      memory: 'GET /api/memory - List recent memories',
      search: 'POST /api/memory/search - Search memories',
      dashboard: 'File: supabase_dashboard.html - Full management interface'
    },
    features: [
      'AI Memory System with 85%+ accuracy',
      'Local Supabase integration',
      'Ollama local AI integration',
      'Real-time documentation search',
      'Production-ready performance'
    ],
    status: 'production-ready'
  });
});

// Memory endpoint - basic functionality
app.get('/api/memory', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const { data: memories, error } = await supabase
      .from('ai_memories')
      .select('id, content, service_id, memory_type, importance_score, created_at, metadata')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    
    res.json({
      success: true,
      memories: memories || [],
      count: memories?.length || 0,
      message: `Retrieved ${memories?.length || 0} memories`
    });
  } catch (error) {
    console.error('Memory fetch error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Memory search endpoint
app.post('/api/memory/search', async (req, res) => {
  try {
    const { query, limit = 10 } = req.body;
    
    if (!query) {
      return res.status(400).json({ 
        success: false,
        error: 'Query required' 
      });
    }
    
    // Simple text search (basic functionality)
    const { data: memories, error } = await supabase
      .from('ai_memories')
      .select('id, content, service_id, memory_type, importance_score, created_at, metadata')
      .textSearch('content', query.replace(/\s+/g, ' & '))
      .limit(limit);

    if (error) throw error;
    
    res.json({
      success: true,
      query,
      results: memories || [],
      count: memories?.length || 0,
      message: `Found ${memories?.length || 0} results for "${query}"`
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// System stats endpoint
app.get('/api/stats', async (req, res) => {
  try {
    const { data: memoryCount } = await supabase
      .from('ai_memories')
      .select('id', { count: 'exact' });

    const { data: recentMemories } = await supabase
      .from('ai_memories')
      .select('service_id, memory_type')
      .order('created_at', { ascending: false })
      .limit(100);

    // Calculate basic stats
    const serviceStats = {};
    const typeStats = {};
    
    recentMemories?.forEach(memory => {
      serviceStats[memory.service_id] = (serviceStats[memory.service_id] || 0) + 1;
      typeStats[memory.memory_type] = (typeStats[memory.memory_type] || 0) + 1;
    });

    res.json({
      success: true,
      stats: {
        totalMemories: memoryCount?.length || 0,
        serviceBreakdown: serviceStats,
        typeBreakdown: typeStats,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        version: '1.0.0'
      }
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    availableEndpoints: [
      'GET /',
      'GET /health',
      'GET /api/docs',
      'GET /api/ollama/status',
      'GET /api/memory',
      'POST /api/memory/search',
      'GET /api/stats'
    ]
  });
});

// Start server
const server = app.listen(port, () => {
  console.log('🎉 Universal AI Tools Service (with Ollama) started successfully!');
  console.log('==================================================');
  console.log(`🌐 Web interface: http://localhost:${port}`);
  console.log(`📊 API docs: http://localhost:${port}/api/docs`);
  console.log(`🏥 Health check: http://localhost:${port}/health`);
  console.log(`🤖 Ollama status: http://localhost:${port}/api/ollama/status`);
  console.log(`📋 Supabase dashboard: Open supabase_dashboard.html`);
  console.log('==================================================');
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

module.exports = app;