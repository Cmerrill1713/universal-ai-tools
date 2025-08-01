const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');

const app = express();
const port = 9999;

// Basic middleware
app.use(cors());
app.use(express.json());

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Basic routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    service: 'Universal AI Tools Service',
    timestamp: new Date().toISOString(),
    port: port
  });
});

app.post('/api/register', (req, res) => {
  // Mock registration
  const { service_name, service_type } = req.body;
  res.json({
    service_id: 'test-' + Date.now(),
    service_name: service_name || 'test-service',
    api_key: 'test-api-key-' + Date.now(),
    endpoints: {
      base_url: `http://localhost:${port}/api`,
      docs: `http://localhost:${port}/api/docs`
    }
  });
});

app.get('/api/docs', (req, res) => {
  res.json({
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      register: '/api/register',
      chat: '/api/chat',
      suggest_tools: '/api/assistant/suggest-tools',
      ollama_status: '/api/ollama/status'
    }
  });
});

// Ollama status endpoint
app.get('/api/ollama/status', async (req, res) => {
  try {
    const response = await axios.get('http://localhost:11434/api/tags');
    const models = response.data.models || [];
    
    res.json({
      status: 'available',
      models: models.map(m => m.name),
      active_model: models.length > 0 ? models[0].name : null,
      total_models: models.length
    });
  } catch (error) {
    res.json({
      status: 'offline',
      error: 'Ollama not available',
      models: [],
      active_model: null,
      total_models: 0
    });
  }
});

// Enhanced Chat endpoint for general conversation
app.post('/api/chat', async (req, res) => {
  const { message, sessionId } = req.body;
  const requestId = `chat_${Date.now()}`;
  
  console.log(`💬 Processing chat message: ${requestId}`);
  
  try {
    // Determine if this is a setup request or general chat
    const isSetupRequest = await detectSetupIntent(message);
    
    if (isSetupRequest) {
      // Use enhanced cognitive framework for setup requests
      const cognitiveResponse = await processEnhancedCognitiveRequest({
        requestId,
        userRequest: message,
        sessionId: sessionId || 'default_session',
        timestamp: new Date()
      });
      
      res.json({
        response: cognitiveResponse.reasoning,
        type: 'setup_assistance',
        data: cognitiveResponse,
        confidence: cognitiveResponse.orchestration_analysis?.confidence || 0.8
      });
    } else {
      // Use Ollama for general conversation
      const chatResponse = await processGeneralChat(message, sessionId);
      res.json({
        response: chatResponse.message,
        type: 'general_chat',
        confidence: chatResponse.confidence,
        context: chatResponse.context
      });
    }
  } catch (error) {
    console.error('❌ Chat processing failed:', error);
    res.status(500).json({
      response: "I'm having trouble processing your message right now. Could you try rephrasing or asking something simpler?",
      type: 'error',
      error: error.message
    });
  }
});

// Enhanced 10-Agent Cognitive Framework endpoint
app.post('/api/assistant/suggest-tools', async (req, res) => {
  const { request } = req.body;
  const requestId = `req_${Date.now()}`;
  
  console.log(`🧠 Processing enhanced cognitive request: ${requestId}`);
  
  try {
    // Enhanced cognitive framework with memory integration
    const cognitiveResponse = await processEnhancedCognitiveRequest({
      requestId,
      userRequest: request,
      sessionId: req.sessionID || 'default_session',
      timestamp: new Date()
    });

    res.json(cognitiveResponse);
  } catch (error) {
    console.error('❌ Enhanced cognitive processing failed:', error);
    res.status(500).json({
      error: 'Enhanced cognitive processing failed',
      fallback: await fallbackResponse(request)
    });
  }
});

// Chat processing functions
async function detectSetupIntent(message) {
  const setupKeywords = [
    'setup', 'install', 'configure', 'create', 'build', 'implement', 'deploy',
    'how to set up', 'help me create', 'need to build', 'want to make',
    'trading', 'bot', 'database', 'web scraper', 'api', 'system'
  ];
  
  const messageLower = message.toLowerCase();
  return setupKeywords.some(keyword => messageLower.includes(keyword));
}

async function processGeneralChat(message, sessionId) {
  try {
    // Try to use Ollama for intelligent responses
    const ollamaResponse = await generateOllamaResponse(message);
    
    if (ollamaResponse && ollamaResponse.trim()) {
      return {
        message: ollamaResponse,
        confidence: 0.85,
        context: { source: 'ollama', model: 'local' }
      };
    }
  } catch (error) {
    console.log('Ollama not available, using intelligent fallback');
  }
  
  // Intelligent fallback responses
  return await generateIntelligentResponse(message, sessionId);
}

async function generateOllamaResponse(message) {
  try {
    const response = await axios.post('http://localhost:11434/api/generate', {
      model: 'gemma3n:e2b',
      prompt: `You are an expert AI assistant specializing in software development, system setup, and technical guidance. You have access to advanced multi-agent orchestration capabilities and memory systems.

Please provide helpful, accurate, and detailed responses. If asked about system setup or technical implementation, provide step-by-step guidance.

User: ${message}
Assistant:`,
      stream: false
    });
    
    return response.data.response;
  } catch (error) {
    console.error("Ollama generation error:", error);
    throw error;
  }
}
