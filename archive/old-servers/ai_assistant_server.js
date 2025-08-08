const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const axios = require('axios');

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
app.use(express.static(path.join(__dirname, 'public')));

// Root route - serve the AI assistant interface
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'Universal AI Tools Assistant',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Ollama status endpoint
app.get('/api/ollama/status', async (req, res) => {
  try {
    const response = await axios.get('http://localhost:11434/api/tags', { 
      timeout: 3000,
      headers: { 'Content-Type': 'application/json' }
    });
    
    const data = response.data;
    const activeModel = data.models && data.models.length > 0 ? data.models[0].name : null;
    
    res.json({
      status: 'available',
      active_model: activeModel,
      model_count: data.models?.length || 0,
      available: true,
      models: data.models?.map(m => m.name) || []
    });
  } catch (error) {
    console.log('Ollama check failed:', error.message);
    res.json({
      status: 'offline',
      available: false,
      error: error.message,
      models: []
    });
  }
});

// AI Assistant Chat Endpoint - Connects to YOUR Universal AI Tools
app.post('/api/assistant/chat', async (req, res) => {
  try {
    const { message, context = [], useMemory = true } = req.body;
    
    // Search relevant memories if enabled
    let relevantMemories = [];
    if (useMemory) {
      const { data: memories } = await supabase
        .from('ai_memories')
        .select('content, memory_type, importance_score')
        .textSearch('content', message.replace(/\s+/g, ' & '))
        .limit(5);
      
      relevantMemories = memories || [];
    }
    
    // Build context with memories
    const contextPrompt = relevantMemories.length > 0 
      ? `\n\nRelevant memories:\n${relevantMemories.map(m => `- ${m.content}`).join('\n')}\n\n`
      : '';
    
    // Call Ollama with context
    const response = await axios.post('http://localhost:11434/api/generate', {
      model: 'qwen2.5:7b', // Your best general model
      prompt: `You are a helpful AI assistant with access to a memory system. ${contextPrompt}User: ${message}\n\nAssistant:`,
      stream: false
    });
    
    // Store the conversation in memory
    if (useMemory) {
      await supabase.from('ai_memories').insert({
        content: `Q: ${message}\nA: ${response.data.response}`,
        memory_type: 'conversation',
        importance_score: 5,
        service_id: 'ai-assistant',
        metadata: { timestamp: new Date().toISOString() }
      });
    }
    
    res.json({
      success: true,
      response: response.data.response,
      memoriesUsed: relevantMemories.length,
      model: 'qwen2.5:7b'
    });
  } catch (error) {
    console.error('Assistant error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to process request',
      details: error.message 
    });
  }
});

// API documentation
app.get('/api/docs', (req, res) => {
  res.json({
    version: '1.0.0',
    service: 'Universal AI Tools Assistant',
    description: 'Your personal AI assistant with memory and tool capabilities',
    endpoints: {
      'GET /': 'AI Assistant web interface',
      'GET /health': 'Service health check',
      'GET /api/ollama/status': 'Check Ollama service status',
      'POST /api/assistant/chat': 'Chat with AI assistant (with memory)',
      'GET /api/memory': 'List all memories',
      'POST /api/memory': 'Store new memory',
      'POST /api/memory/search': 'Search memories',
      'GET /api/stats': 'System statistics'
    }
  });
});

// Memory endpoints
app.get('/api/memory', async (req, res) => {
  try {
    const { data: memories, error } = await supabase
      .from('ai_memories')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;
    
    res.json({
      success: true,
      memories: memories || [],
      count: memories?.length || 0
    });
  } catch (error) {
    console.error('Memory fetch error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.post('/api/memory', async (req, res) => {
  try {
    const { content, memory_type = 'general', importance_score = 5, metadata = {} } = req.body;
    
    if (!content) {
      return res.status(400).json({ 
        success: false,
        error: 'Content is required' 
      });
    }
    
    // Generate embedding using Ollama
    const embeddingResponse = await axios.post('http://localhost:11434/api/embeddings', {
      model: 'all-minilm',
      prompt: content
    });
    
    const { data: memory, error } = await supabase
      .from('ai_memories')
      .insert({
        content,
        memory_type,
        importance_score,
        service_id: 'ai-assistant',
        embedding: embeddingResponse.data.embedding,
        metadata
      })
      .select()
      .single();
      
    if (error) throw error;
    
    res.json({
      success: true,
      memory,
      message: 'Memory stored successfully'
    });
  } catch (error) {
    console.error('Memory storage error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.post('/api/memory/search', async (req, res) => {
  try {
    const { query, limit = 10 } = req.body;
    
    if (!query) {
      return res.status(400).json({ 
        success: false,
        error: 'Query required' 
      });
    }
    
    // Simple text search
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

// System stats
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

// Start server
const server = app.listen(port, () => {
  console.log('🎉 Universal AI Tools Assistant ready!');
  console.log('==================================================');
  console.log(`🌐 AI Assistant Interface: http://localhost:${port}`);
  console.log(`📊 API docs: http://localhost:${port}/api/docs`);
  console.log(`🤖 Ollama status: http://localhost:${port}/api/ollama/status`);
  console.log('==================================================');
  console.log('Your AI Assistant is now ready to help!');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down AI Assistant...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

module.exports = app;