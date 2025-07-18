import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import path from 'path';
import { fileURLToPath } from 'url';
import { ToolRouter } from './routers/tools';
import { MemoryRouter } from './routers/memory';
import { ContextRouter } from './routers/context';
import { KnowledgeRouter } from './routers/knowledge';
import { OrchestrationRouter } from './routers/orchestration';
import { logger } from './utils/enhanced-logger';
import LoggingMiddleware from './middleware/logging-middleware';
import PrometheusMiddleware from './middleware/prometheus-middleware';
import DebugMiddleware from './middleware/debug-middleware';
import { getOllamaAssistant } from './services/ollama-assistant';
import { dspyService } from './services/dspy-service';
import { appConfig, config, configHealthCheck, initializeConfig } from './config';
import PerformanceMiddleware from './middleware/performance';
import { portIntegrationService, initializePortSystem } from './services/port-integration-service';

// Initialize configuration
initializeConfig();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const {port} = config.server;

// Supabase client
const supabase = createClient(
  config.database.supabaseUrl,
  config.database.supabaseServiceKey || ''
);

// Initialize performance middleware
const performanceMiddleware = new PerformanceMiddleware(supabase, {
  enableRequestTiming: true,
  enableMemoryMonitoring: true,
  enableCacheMetrics: true,
  enableDatabaseOptimization: true,
  slowRequestThreshold: 2000, // 2 seconds
  memoryThreshold: 1024, // 1GB
  requestTimeoutMs: 30000, // 30 seconds
});

// Middleware
app.use(cors({
  origin: config.security.corsOrigins,
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));

// Enhanced logging middleware (must be early in the stack)
app.use(LoggingMiddleware.requestLogger());
app.use(LoggingMiddleware.securityLogger());
app.use(LoggingMiddleware.databaseLogger());
app.use(LoggingMiddleware.memoryLogger());
app.use(LoggingMiddleware.athenaConversationLogger());

// Prometheus metrics middleware
app.use(PrometheusMiddleware.metricsCollector());
app.use(PrometheusMiddleware.athenaMetricsCollector());
app.use(PrometheusMiddleware.databaseMetricsCollector());
app.use(PrometheusMiddleware.memoryMetricsCollector());
app.use(PrometheusMiddleware.securityMetricsCollector());
app.use(PrometheusMiddleware.testMetricsCollector());

// Debug middleware (development only)
app.use(DebugMiddleware.debugSession());
app.use(DebugMiddleware.verboseLogging());
app.use(DebugMiddleware.athenaDebugger());
app.use(DebugMiddleware.performanceDebugger());
app.use(DebugMiddleware.testResultAggregator());

// Performance monitoring middleware
app.use(performanceMiddleware.requestTimer());
app.use(performanceMiddleware.compressionMiddleware());
app.use(performanceMiddleware.rateLimiter(900000, 1000)); // 15 minutes, 1000 requests
app.use(performanceMiddleware.databaseOptimizer());

// Serve static files (Chat UI)
app.use(express.static(path.join(__dirname, '../public')));

// Serve the chat UI at root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Authentication middleware
const authenticateAI = async (req: any, res: any, next: any) => {
  try {
    const apiKey = req.headers['x-api-key'];
    const aiService = req.headers['x-ai-service'];
    
    // Allow local development without authentication
    if (config.server.isDevelopment && apiKey === 'local-dev-key' && aiService === 'local-ui') {
      req.aiService = { 
        id: 'local-dev', 
        name: 'Local Development UI',
        capabilities: ['memory', 'context', 'tools', 'ai_chat']
      };
      req.aiServiceId = 'local-dev';
      return next();
    }
    
    if (!apiKey || !aiService) {
      return res.status(401).json({ error: 'Missing authentication headers' });
    }

    // Verify API key in Supabase
    const { data: keyData, error } = await supabase
      .from('ai_service_keys')
      .select('*, ai_services(*)')
      .eq('encrypted_key', apiKey) // In production, this should be properly encrypted
      .single();

    if (error || !keyData) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    // Attach service info to request
    req.aiService = keyData.ai_services;
    req.aiServiceId = keyData.service_id;
    
    // Log tool execution
    await supabase.from('ai_tool_executions').insert({
      service_id: keyData.service_id,
      tool_name: req.path,
      input_params: req.body,
      status: 'pending'
    });

    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'Universal AI Tools Service',
    timestamp: new Date().toISOString()
  });
});

// API Documentation
app.get('/api/docs', (req, res) => {
  res.json({
    version: '1.0.0',
    endpoints: {
      tools: {
        execute: 'POST /api/tools/execute',
        list: 'GET /api/tools',
        create: 'POST /api/tools'
      },
      memory: {
        store: 'POST /api/memory',
        retrieve: 'GET /api/memory',
        search: 'POST /api/memory/search'
      },
      context: {
        save: 'POST /api/context',
        get: 'GET /api/context/:type/:key',
        update: 'PUT /api/context/:type/:key'
      },
      knowledge: {
        add: 'POST /api/knowledge',
        search: 'POST /api/knowledge/search',
        verify: 'PUT /api/knowledge/:id/verify'
      },
      orchestration: {
        orchestrate: 'POST /api/orchestration/orchestrate',
        coordinate: 'POST /api/orchestration/coordinate',
        knowledgeSearch: 'POST /api/orchestration/knowledge/search',
        knowledgeExtract: 'POST /api/orchestration/knowledge/extract',
        knowledgeEvolve: 'POST /api/orchestration/knowledge/evolve',
        optimizePrompts: 'POST /api/orchestration/optimize/prompts',
        status: 'GET /api/orchestration/status'
      },
      ports: {
        status: 'GET /api/ports/status',
        report: 'GET /api/ports/report',
        healthCheck: 'POST /api/ports/health-check',
        resolveConflict: 'POST /api/ports/resolve-conflict'
      },
      performance: {
        metrics: 'GET /api/performance/metrics',
        report: 'GET /api/performance/report'
      },
      assistant: {
        chat: 'POST /api/assistant/chat',
        suggestTools: 'POST /api/assistant/suggest-tools',
        generateIntegration: 'POST /api/assistant/generate-integration',
        routeRequest: 'POST /api/assistant/route-request'
      }
    },
    authentication: {
      method: 'API Key',
      headers: {
        'X-API-Key': 'Your API key',
        'X-AI-Service': 'Your service identifier'
      }
    },
    webSocket: {
      portStatus: 'ws://localhost:' + port + '/ws/port-status',
      description: 'Real-time port status and health monitoring updates'
    }
  });
});

// Stats endpoint for dashboard
app.get('/api/stats', authenticateAI, async (req, res) => {
  try {
    // Get memory count
    const { count: memoryCount } = await supabase
      .from('ai_memories')
      .select('*', { count: 'exact', head: true });

    // Get agent count
    const { count: agentCount } = await supabase
      .from('ai_agents')
      .select('*', { count: 'exact', head: true });

    const stats = {
      activeAgents: agentCount || 0,
      messagestoday: Math.floor(Math.random() * 1000), // Placeholder
      totalMemories: memoryCount || 0,
      cpuUsage: process.cpuUsage(),
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
      typeBreakdown: {
        general: Math.floor((memoryCount || 0) * 0.4),
        code: Math.floor((memoryCount || 0) * 0.3),
        documentation: Math.floor((memoryCount || 0) * 0.2),
        personal: Math.floor((memoryCount || 0) * 0.1)
      }
    };

    res.json({ success: true, stats });
  } catch (error) {
    logger.error('Error fetching stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch stats' });
  }
});

// Prometheus metrics endpoint
app.get('/metrics', PrometheusMiddleware.metricsEndpoint());

// Health check endpoint with Prometheus integration
app.get('/api/health', PrometheusMiddleware.healthCheckEndpoint());

// Original health check endpoint for compatibility
app.get('/health', (req, res) => {
  const healthCheck = configHealthCheck();
  res.json({
    status: healthCheck.healthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: 'universal-ai-tools',
    config: healthCheck.checks,
  });
});

// Configuration endpoint
app.get('/api/config', (req, res) => {
  res.json({
    success: true,
    config: appConfig,
    timestamp: new Date().toISOString(),
  });
});

// Configuration health check endpoint
app.get('/api/config/health', (req, res) => {
  const healthCheck = configHealthCheck();
  res.json({
    success: true,
    healthy: healthCheck.healthy,
    checks: healthCheck.checks,
    timestamp: new Date().toISOString(),
  });
});

// Performance metrics endpoint
app.get('/api/performance/metrics', async (req, res) => {
  try {
    const metrics = await performanceMiddleware.getMetrics();
    res.json({
      success: true,
      metrics,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error fetching performance metrics:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch performance metrics' 
    });
  }
});

// Performance report endpoint
app.get('/api/performance/report', async (req, res) => {
  try {
    const report = await performanceMiddleware.generatePerformanceReport();
    const format = req.query.format as string || 'text';
    
    if (format === 'json') {
      const metrics = await performanceMiddleware.getMetrics();
      res.json({
        success: true,
        report: {
          text: report,
          metrics,
        },
        timestamp: new Date().toISOString(),
      });
    } else {
      res.set('Content-Type', 'text/plain');
      res.send(report);
    }
  } catch (error) {
    logger.error('Error generating performance report:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to generate performance report' 
    });
  }
});

// Port Management endpoints
app.get('/api/ports/status', async (req, res) => {
  try {
    const status = portIntegrationService.getPortSystemStatus();
    res.json({
      success: true,
      status,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error fetching port status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch port status'
    });
  }
});

app.get('/api/ports/report', async (req, res) => {
  try {
    const report = await portIntegrationService.generatePortManagementReport();
    res.json({
      success: true,
      report,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error generating port report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate port report'
    });
  }
});

app.post('/api/ports/health-check', async (req, res) => {
  try {
    const { service } = req.body;
    await portIntegrationService.triggerHealthCheck(service);
    res.json({
      success: true,
      message: service ? `Health check triggered for ${service}` : 'Full health check triggered'
    });
  } catch (error) {
    logger.error('Error triggering health check:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to trigger health check'
    });
  }
});

app.post('/api/ports/resolve-conflict', async (req, res) => {
  try {
    const { service, requestedPort } = req.body;
    if (!service || !requestedPort) {
      return res.status(400).json({
        success: false,
        error: 'Service name and requested port are required'
      });
    }
    
    const resolvedPort = await portIntegrationService.resolveSpecificPortConflict(service, requestedPort);
    res.json({
      success: true,
      resolvedPort,
      message: `Port conflict resolved for ${service}: ${requestedPort} → ${resolvedPort}`
    });
  } catch (error) {
    logger.error('Error resolving port conflict:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to resolve port conflict'
    });
  }
});

// Ollama status endpoint
app.get('/api/ollama/status', async (req, res) => {
  try {
    const response = await fetch('http://localhost:11434/api/tags');
    if (response.ok) {
      const data = await response.json() as { models?: Array<{ name: string }> };
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

// Ollama models endpoint (alias for compatibility)
app.get('/api/ollama/models', async (req, res) => {
  try {
    const response = await fetch('http://localhost:11434/api/tags');
    if (response.ok) {
      const data = await response.json() as { models?: Array<{ name: string }> };
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

// Register AI Service endpoint (public)
app.post('/api/register', async (req, res) => {
  try {
    const schema = z.object({
      service_name: z.string(),
      service_type: z.enum(['claude', 'openai', 'gemini', 'cohere', 'custom']),
      capabilities: z.array(z.string()).optional()
    });

    const data = schema.parse(req.body);
    
    // Create service
    const { data: service, error: serviceError } = await supabase
      .from('ai_services')
      .insert(data)
      .select()
      .single();

    if (serviceError) throw serviceError;

    // Generate API key
    const apiKey = jwt.sign(
      { service_id: service.id, service_name: service.service_name },
      config.security.jwtSecret
    );

    // Store encrypted key
    const { error: keyError } = await supabase
      .from('ai_service_keys')
      .insert({
        service_id: service.id,
        key_name: 'default',
        encrypted_key: apiKey, // In production, encrypt this
        permissions: ['read', 'write', 'execute']
      });

    if (keyError) throw keyError;

    res.json({
      service_id: service.id,
      service_name: service.service_name,
      api_key: apiKey,
      endpoints: {
        base_url: `http://localhost:${port}/api`,
        docs: `http://localhost:${port}/api/docs`
      }
    });
  } catch (error) {
    logger.error('Registration error:', error);
    res.status(400).json({ error: 'Registration failed' });
  }
});

// Initialize Ollama Assistant
const ollamaAssistant = getOllamaAssistant(supabase);

// Ollama-powered endpoints (no auth required for helper endpoints)
app.post('/api/assistant/suggest-tools', async (req, res) => {
  try {
    const { request } = req.body;
    
    // Get available tools
    const { data: tools } = await supabase
      .from('ai_custom_tools')
      .select('tool_name, description')
      .eq('is_active', true);
    
    const suggestions = await ollamaAssistant.suggestTools(request, tools || []);
    res.json(suggestions);
  } catch (error: any) {
    logger.error('Tool suggestion error:', error);
    res.status(500).json({ error: 'Failed to suggest tools' });
  }
});

app.post('/api/assistant/generate-integration', async (req, res) => {
  try {
    const { language, framework, purpose } = req.body;
    const code = await ollamaAssistant.generateConnectionCode(language, framework, purpose);
    res.json({ code });
  } catch (error: any) {
    logger.error('Integration generation error:', error);
    res.status(500).json({ error: 'Failed to generate integration code' });
  }
});

app.post('/api/assistant/analyze-codebase', async (req, res) => {
  try {
    const { structure } = req.body;
    const analysis = await ollamaAssistant.analyzeIntegrationPoints(structure);
    res.json({ analysis });
  } catch (error: any) {
    logger.error('Codebase analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze codebase' });
  }
});

app.post('/api/assistant/create-tool', async (req, res) => {
  try {
    const { name, description, requirements } = req.body;
    const tool = await ollamaAssistant.createToolImplementation(name, description, requirements);
    
    // Optionally save the tool
    if (req.body.save) {
      const { data, error } = await supabase
        .from('ai_custom_tools')
        .insert(tool)
        .select()
        .single();
      
      if (error) throw error;
      res.json({ tool: data });
    } else {
      res.json({ tool });
    }
  } catch (error: any) {
    logger.error('Tool creation error:', error);
    res.status(500).json({ error: 'Failed to create tool' });
  }
});

app.post('/api/assistant/route-request', authenticateAI, async (req: any, res) => {
  try {
    const { request, context } = req.body;
    
    // Use DSPy service for advanced orchestration
    const orchestrationResult = await dspyService.orchestrate({
      requestId: `route-${Date.now()}`,
      userRequest: request,
      userId: req.aiServiceId,
      orchestrationMode: 'adaptive',
      context: context || {},
      timestamp: new Date()
    });
    
    res.json({
      success: orchestrationResult.success,
      routing: {
        mode: orchestrationResult.mode,
        agents: orchestrationResult.participatingAgents,
        confidence: orchestrationResult.confidence
      },
      result: orchestrationResult.result,
      reasoning: orchestrationResult.reasoning
    });
  } catch (error: any) {
    logger.error('Request routing error:', error);
    res.status(500).json({ error: 'Failed to route request' });
  }
});

// Chat endpoint for AI conversation
app.post('/api/assistant/chat', authenticateAI, async (req: any, res) => {
  try {
    const { message, model, conversation_id } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Get recent conversation history
    const { data: recentHistory } = await supabase
      .from('ai_memories')
      .select('content, created_at')
      .eq('memory_type', 'working')
      .contains('metadata', { conversation_id })
      .order('created_at', { ascending: false })
      .limit(10);

    // Build conversation context
    let contextPrompt = '';
    if (recentHistory && recentHistory.length > 0) {
      const conversationHistory = recentHistory
        .reverse()
        .map(memory => memory.content)
        .join('\n');
      contextPrompt = `Previous conversation:\n${conversationHistory}\n\nCurrent message: ${message}`;
    } else {
      contextPrompt = message;
    }

    // Store the user message in memory
    await supabase.from('ai_memories').insert({
      memory_type: 'working',
      content: `User: ${message}`,
      service_id: req.aiServiceId,
      metadata: {
        conversation_id,
        model,
        timestamp: new Date().toISOString()
      }
    });

    // Generate response using Ollama
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model || 'llama3.2:3b',
        prompt: contextPrompt,
        stream: false,
        options: {
          temperature: 0.7,
          top_p: 0.9,
          top_k: 40,
        }
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`);
    }

    const data = await response.json() as { response: string };
    const assistantResponse = data.response;

    // Store the assistant response in memory
    await supabase.from('ai_memories').insert({
      memory_type: 'working',
      content: `Assistant: ${assistantResponse}`,
      service_id: req.aiServiceId,
      metadata: {
        conversation_id,
        model,
        timestamp: new Date().toISOString()
      }
    });

    res.json({
      response: assistantResponse,
      model,
      conversation_id,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    logger.error('Chat error:', error);
    res.status(500).json({ error: 'Failed to generate response' });
  }
});

// Get conversation history endpoint
app.get('/api/assistant/conversation/:id', authenticateAI, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { limit = 50 } = req.query;

    const { data: history, error } = await supabase
      .from('ai_memories')
      .select('content, created_at, metadata')
      .eq('memory_type', 'working')
      .contains('metadata', { conversation_id: id })
      .order('created_at', { ascending: true })
      .limit(parseInt(limit as string));

    if (error) throw error;

    // Parse messages from stored content
    const messages = history?.map(memory => {
      const isUser = memory.content.startsWith('User: ');
      return {
        id: memory.created_at,
        role: isUser ? 'user' : 'assistant',
        content: memory.content.replace(/^(User: |Assistant: )/, ''),
        timestamp: new Date(memory.created_at),
        model: memory.metadata?.model
      };
    }) || [];

    res.json({ messages, conversation_id: id });
  } catch (error: any) {
    logger.error('Conversation history error:', error);
    res.status(500).json({ error: 'Failed to fetch conversation history' });
  }
});

// Agents endpoints
app.get('/api/agents', authenticateAI, async (req: any, res) => {
  try {
    const { data: agents, error } = await supabase
      .from('ai_agents')
      .select('*')
      .eq('created_by', req.aiServiceId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ success: true, agents: agents || [] });
  } catch (error) {
    logger.error('Error fetching agents:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch agents' });
  }
});

app.post('/api/agents', authenticateAI, async (req: any, res) => {
  try {
    const { name, description, capabilities, instructions, model } = req.body;
    
    const { data: agent, error } = await supabase
      .from('ai_agents')
      .insert({
        name,
        description,
        capabilities: capabilities || [],
        instructions,
        model: model || 'llama3.2:3b',
        created_by: req.aiServiceId,
        is_active: true
      })
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, agent });
  } catch (error) {
    logger.error('Error creating agent:', error);
    res.status(500).json({ success: false, error: 'Failed to create agent' });
  }
});

app.put('/api/agents/:id', authenticateAI, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { name, description, capabilities, instructions, model, is_active } = req.body;
    
    const { data: agent, error } = await supabase
      .from('ai_agents')
      .update({
        name,
        description,
        capabilities,
        instructions,
        model,
        is_active,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('created_by', req.aiServiceId)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, agent });
  } catch (error) {
    logger.error('Error updating agent:', error);
    res.status(500).json({ success: false, error: 'Failed to update agent' });
  }
});

app.delete('/api/agents/:id', authenticateAI, async (req: any, res) => {
  try {
    const { id } = req.params;
    
    const { error } = await supabase
      .from('ai_agents')
      .delete()
      .eq('id', id)
      .eq('created_by', req.aiServiceId);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    logger.error('Error deleting agent:', error);
    res.status(500).json({ success: false, error: 'Failed to delete agent' });
  }
});

app.post('/api/agents/:id/execute', authenticateAI, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { input, context } = req.body;
    
    // Get the agent
    const { data: agent, error: agentError } = await supabase
      .from('ai_agents')
      .select('*')
      .eq('id', id)
      .eq('created_by', req.aiServiceId)
      .single();

    if (agentError || !agent) {
      return res.status(404).json({ success: false, error: 'Agent not found' });
    }

    // Execute the agent with Ollama
    const prompt = `${agent.instructions}\n\nUser input: ${input}\n\nContext: ${context || 'None'}\n\nResponse:`;
    
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: agent.model || 'llama3.2:3b',
        prompt,
        stream: false,
        options: {
          temperature: 0.7,
          top_p: 0.9,
          top_k: 40,
        }
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`);
    }

    const data = await response.json() as { response: string };
    
    // Log the execution
    await supabase.from('ai_agent_executions').insert({
      agent_id: id,
      input,
      output: data.response,
      context,
      model: agent.model,
      service_id: req.aiServiceId
    });

    res.json({ 
      success: true, 
      output: data.response,
      agent: agent.name,
      model: agent.model
    });
  } catch (error) {
    logger.error('Error executing agent:', error);
    res.status(500).json({ success: false, error: 'Failed to execute agent' });
  }
});

// Error logging middleware (must be before routers but after other middleware)
app.use(LoggingMiddleware.errorLogger());

// Mount routers with authentication
app.use('/api/tools', authenticateAI, ToolRouter(supabase));
app.use('/api/memory', authenticateAI, MemoryRouter(supabase));
app.use('/api/context', authenticateAI, ContextRouter(supabase));
app.use('/api/knowledge', authenticateAI, KnowledgeRouter(supabase));
app.use('/api/orchestration', authenticateAI, OrchestrationRouter(supabase));

// WebSocket support for real-time updates
import { createServer } from 'http';
import { WebSocketServer } from 'ws';

const server = createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      
      // Handle real-time subscriptions
      if (data.type === 'subscribe') {
        // Subscribe to Supabase real-time changes
        supabase
          .channel(`ai-${data.channel}`)
          .on('postgres_changes', 
            { event: '*', schema: 'public', table: data.table },
            (payload) => {
              ws.send(JSON.stringify({
                type: 'update',
                channel: data.channel,
                payload
              }));
            }
          )
          .subscribe();
      }
    } catch (error) {
      ws.send(JSON.stringify({ error: 'Invalid message format' }));
    }
  });
});

// Initialize Port Management System
async function initializeServices() {
  try {
    logger.info('🚀 Initializing Universal AI Tools Services...');
    
    // Initialize port management system
    await portIntegrationService.initialize();
    
    // Log startup results
    const startupResults = portIntegrationService.getStartupResults();
    const systemStatus = portIntegrationService.getPortSystemStatus();
    
    logger.info('📊 Service Startup Summary:');
    logger.info(`  ✅ Services configured: ${systemStatus.smartPortManager.servicesConfigured}`);
    logger.info(`  🔍 Health monitoring: ${systemStatus.healthMonitor.monitoring ? 'Active' : 'Inactive'}`);
    logger.info(`  📡 WebSocket clients: ${systemStatus.webSocket.clients}`);
    logger.info(`  💯 Health score: ${systemStatus.healthMonitor.healthScore}/100`);
    
    // Log any conflicts resolved
    const conflicts = startupResults.filter(r => r.status === 'conflict_resolved');
    if (conflicts.length > 0) {
      logger.info('🔧 Port conflicts resolved:');
      conflicts.forEach(conflict => {
        logger.info(`  ${conflict.service}: ${conflict.originalPort} → ${conflict.port}`);
      });
    }
    
    logger.info('🎉 All services initialized successfully');
    
  } catch (error) {
    logger.error('❌ Failed to initialize services:', error);
    throw error;
  }
}

// Start server with service initialization
server.listen(port, async () => {
  logger.info(`Universal AI Tools Service running on port ${port}`);
  logger.info(`API docs available at http://localhost:${port}/api/docs`);
  logger.info(`Performance metrics available at http://localhost:${port}/api/performance/metrics`);
  logger.info(`Performance report available at http://localhost:${port}/api/performance/report`);
  logger.info(`Port management available at http://localhost:${port}/api/ports/status`);
  
  // Initialize all services after server starts
  try {
    await initializeServices();
  } catch (error) {
    logger.error('Service initialization failed, server will continue but with limited functionality');
  }
});

// Graceful shutdown handling
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  
  try {
    // Shutdown port integration service
    await portIntegrationService.shutdown();
    
    // Shutdown DSPy service
    await dspyService.shutdown();
    
    // Close performance middleware
    await performanceMiddleware.close();
    
    // Shutdown enhanced logger
    await logger.shutdown();
    
    // Close WebSocket server
    wss.close();
    
    // Close HTTP server
    server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });
    
    // Force exit after timeout
    setTimeout(() => {
      logger.error('Graceful shutdown timed out, forcing exit');
      process.exit(1);
    }, 30000);
    
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});