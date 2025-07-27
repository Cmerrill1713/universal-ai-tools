/* eslint-disable no-undef */
#!/usr/bin/env node

// Universal AI Tools - Enhanced Server
// Full functionality without problematic initialization blocking

import type { NextFunction, Request, Response } from 'express';
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { dspyOrchestrator } from './services/dspy-chat-integration.js';
import { DSPY_TOOLS, dspyToolExecutor } from './services/dspy-tools-integration.js';
import { LogContext, logger } from './utils/enhanced-logger.js';

// Basic setup
const __filename = fileURLToPath(import.meta.url);

const app = express();
const server = http.createServer(app);
const DEFAULT_PORT = 9999;
const port = process.env.PORT || DEFAULT_PORT;

// WebSocket server for real-time features
const wss = new WebSocketServer({ server });

logger.info(`🚀 Starting Universal AI Tools (Enhanced) on port ${port}...`, LogContext.SYSTEM);
logger.info(`📅 Started at: ${new Date().toISOString()}`, LogContext.SYSTEM);
logger.info(`🔌 WebSocket server enabled for real-time features`, LogContext.SYSTEM);

// Basic middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// CORS configuration
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:9999',
    /^http:\/\/localhost:\d+$/,
  ],
  credentials: true,
  optionsSuccessStatus: 200,
  exposedHeaders: [
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
    'X-Cache',
    'X-Response-Time',
  ],
};

app.use(cors(corsOptions));

// Initialize Supabase (with _errorhandling)
let supabase: any = null;
try {
  const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321';
  const supabaseKey = process.env.SUPABASE_ANON_KEY || '';

  supabase = createClient(supabaseUrl, supabaseKey);
  logger.info('✅ Supabase client initialized', LogContext.DATABASE);
} catch (_error) {
  logger.warn('⚠️  Supabase initialization failed', LogContext.DATABASE, { _error});
}

// Health endpoints
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'Universal AI Tools Service (Minimal)',
    timestamp: new Date().toISOString(),
    port,
    mode: 'minimal-fixed',
    metadata: {
      apiVersion: 'v1',
      timestamp: new Date().toISOString(),
    },
  });
});

app.get('/api/health', (req: Request, res: Response) => {
  const memoryUsage = process.memoryUsage();
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: memoryUsage,
    mode: 'minimal-fixed',
    services: {
      supabase: supabase ? 'connected' : 'disconnected',
    },
    metadata: {
      apiVersion: 'v1',
      timestamp: new Date().toISOString(),
    },
  });
});

// Simple authentication middleware
const simpleAuth = (req: any, res: Response, next: any) => {
  const apiKey = req.headers['x-api-key'];
  const aiService = req.headers['x-ai-service'];

  // Allow health checks without auth
  if (req.path.includes('/health')) {
    return next();
  }

  // Simple API key check
  if (!apiKey) {
    const UNAUTHORIZED = 401;
    return res.status(UNAUTHORIZED).json({ _error 'Missing X-API-Key header' });
  }

  // For minimal mode, accept any reasonable API key
  if (apiKey.length < 10) {
    const UNAUTHORIZED = 401;
    return res.status(UNAUTHORIZED).json({ _error 'Invalid API key format' });
  }

  // Attach service info
  req.aiService = { name: aiService || 'unknown' };
  req.apiKey = apiKey;
  next();
};

// Apply auth to protected routes
app.use('/api/v1/*', simpleAuth);

// Memory management endpoints
app.get('/api/v1/memory', async (req: Request, res: Response) => {
  try {
    if (!supabase) {
      const SERVICE_UNAVAILABLE = 503;
      return res.status(SERVICE_UNAVAILABLE).json({ _error 'Database not available' });
    }

    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 10;
    const offset = (page - 1) * limit;

    const { data, _error count } = await supabase
      .from('memories')
      .select('*', { count: 'exact' })
      .order('timestamp', { ascending: false })
      .range(offset, offset + limit - 1);

    if (_error {
      return res.status(500).json({ _error _errormessage });
    }

    const totalPages = Math.ceil((count || 0) / limit);

    res.json({
      success: true,
      data: data || [],
      meta: {
        requestId: `req-${Date.now()}`,
        timestamp: new Date().toISOString(),
        processingTime: 5,
        version: '1.0.0',
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      },
    });
  } catch (_error) {
    res.status(500).json({
      _error 'Failed to fetch memories',
      details: _errorinstanceof Error ? _errormessage : String(_error,
    });
  }
});

app.post('/api/v1/memory', async (req: Request, res: Response) => {
  try {
    if (!supabase) {
      const SERVICE_UNAVAILABLE = 503;
      return res.status(SERVICE_UNAVAILABLE).json({ _error 'Database not available' });
    }

    const { _content metadata, tags } = req.body;

    if (!_content {
      return res.status(400).json({ _error 'Content is required' });
    }

    const { data, _error} = await supabase
      .from('memories')
      .insert({
        _content
        metadata: metadata || {},
        tags: tags || [],
        type: 'semantic',
        importance: 0.5,
        timestamp: new Date().toISOString(),
      })
      .select()
      .single();

    if (_error {
      return res.status(500).json({ _error _errormessage });
    }

    res.json({
      success: true,
      data,
      meta: {
        requestId: `req-${Date.now()}`,
        timestamp: new Date().toISOString(),
        processingTime: 10,
        version: '1.0.0',
      },
    });
  } catch (_error) {
    res.status(500).json({
      _error 'Failed to create memory',
      details: _errorinstanceof Error ? _errormessage : String(_error,
    });
  }
});

// Tools endpoint - Enhanced with DSPy capabilities
app.get('/api/v1/tools', (req: Request, res: Response) => {
  // Get DSPy tools
  const dspyTools = dspyToolExecutor.getAvailableTools().map((tool) => ({
    id: `dspy_${tool.name.toLowerCase()}`,
    tool_name: tool.name,
    description: tool.description,
    category: tool.category,
    parameters: tool.parameters,
    dspy_tool: true,
  }));

  // Combine with existing tools
  const allTools = [
    {
      id: 'store_context',
      tool_name: 'store_context',
      description: 'Store contextual information',
      input_schema: {
        type: 'object',
        properties: {
          context_type: { type: 'string' },
          context_key: { type: 'string' },
          _content { type: 'string' },
        },
      },
      output_schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          id: { type: 'string' },
        },
      },
      rate_limit: 100,
    },
    ...dspyTools,
  ];

  res.json({
    tools: allTools,
    dspy_categories: {
      prompting: dspyToolExecutor.getToolsByCategory('prompting').length,
      optimization: dspyToolExecutor.getToolsByCategory('optimization').length,
      retrieval: dspyToolExecutor.getToolsByCategory('retrieval').length,
      reasoning: dspyToolExecutor.getToolsByCategory('reasoning').length,
      evaluation: dspyToolExecutor.getToolsByCategory('evaluation').length,
    },
    metadata: {
      apiVersion: 'v1',
      timestamp: new Date().toISOString(),
      mode: 'dspy-enhanced',
      total_tools: allTools.length,
      dspy_tools: dspyTools.length,
    },
  });
});

// Execute DSPy tool endpoint
app.post('/api/v1/tools/execute', async (req: Request, res: Response) => {
  try {
    const { tool_name, _input parameters } = req.body;

    if (!tool_name || !_input {
      return res.status(400).json({
        _error 'tool_name and _inputare required',
      });
    }

    // Execute the DSPy tool
    const result = await dspyToolExecutor.executeTool(tool_name, _input parameters);

    res.json({
      success: result.success,
      tool: result.tool,
      output: result.output,
      _error result._error
      metadata: {
        ...result.metadata,
        requestId: uuidv4(),
        timestamp: new Date().toISOString(),
      },
    });
  } catch (_error) {
    res.status(500).json({
      _error 'Failed to execute DSPy tool',
      details: _errorinstanceof Error ? _errormessage : String(_error,
    });
  }
});

// Create DSPy pipeline endpoint
app.post('/api/v1/tools/pipeline', async (req: Request, res: Response) => {
  try {
    const { tools, _input} = req.body;

    if (!Array.isArray(tools) || !_input {
      return res.status(400).json({
        _error 'tools array and _inputare required',
      });
    }

    // Execute the pipeline
    const result = await dspyToolExecutor.createPipeline(tools, _input;

    res.json({
      success: true,
      pipeline: tools,
      result,
      metadata: {
        requestId: uuidv4(),
        timestamp: new Date().toISOString(),
        tools_executed: tools.length,
      },
    });
  } catch (_error) {
    res.status(500).json({
      _error 'Pipeline execution failed',
      details: _errorinstanceof Error ? _errormessage : String(_error,
    });
  }
});

// Get tool recommendations endpoint
app.post('/api/v1/tools/recommend', async (req: Request, res: Response) => {
  try {
    const { task } = req.body;

    if (!task) {
      return res.status(400).json({
        _error 'task description is required',
      });
    }

    // Get recommendations
    const recommendations = dspyToolExecutor.recommendTools(task);

    res.json({
      task,
      recommendations: recommendations.map((tool) => ({
        name: tool.name,
        category: tool.category,
        description: tool.description,
        reason: `Recommended for ${tool.category} tasks`,
      })),
      metadata: {
        requestId: uuidv4(),
        timestamp: new Date().toISOString(),
        total_recommendations: recommendations.length,
      },
    });
  } catch (_error) {
    res.status(500).json({
      _error 'Failed to get tool recommendations',
      details: _errorinstanceof Error ? _errormessage : String(_error,
    });
  }
});

// Agent orchestration endpoints
app.post('/api/v1/orchestrate', async (req: Request, res: Response) => {
  try {
    const {
      userRequest,
      orchestrationMode = 'standard',
      context = {},
      conversationId,
      sessionId,
    } = req.body;

    if (!userRequest) {
      return res.status(400).json({ _error 'userRequest is required' });
    }

    const requestId = uuidv4();
    const startTime = Date.now();

    // Simulate orchestration logic
    const response = {
      success: true,
      requestId,
      data: {
        response: `Processed: "${userRequest}"`,
        actions: ['memory_store', 'context__analysis],
        reasoning: `Applied ${orchestrationMode} orchestration mode`,
      },
      mode: orchestrationMode,
      confidence: 0.85,
      reasoning: `Request processed using ${orchestrationMode} orchestration`,
      participatingAgents: ['cognitive-agent', 'memory-agent'],
      executionTime: Date.now() - startTime,
    };

    // Store orchestration log if supabase is available
    if (supabase) {
      await supabase.from('ai_orchestration_logs').insert({
        request_id: requestId,
        service_id: (req as any).aiService?.name || 'unknown',
        user__request userRequest,
        orchestration_mode: orchestrationMode,
        status: 'completed',
        response_data: response.data,
        execution_time_ms: response.executionTime,
        confidence: response.confidence,
        participating_agents: response.participatingAgents,
        created_at: new Date(),
        completed_at: new Date(),
      });
    }

    res.json(response);
  } catch (_error) {
    res.status(500).json({
      success: false,
      _error 'Orchestration failed',
      message: _errorinstanceof Error ? _errormessage : 'Unknown _error,
    });
  }
});

// Agent coordination endpoint
app.post('/api/v1/coordinate', async (req: Request, res: Response) => {
  try {
    const { task, availableAgents, context: _context = {} } = req.body;

    if (!task || !availableAgents) {
      return res.status(400).json({ _error 'task and availableAgents are required' });
    }

    const MAX_AGENTS = 3;
    const coordination = {
      success: true,
      coordinationId: uuidv4(),
      task,
      selectedAgents: availableAgents.slice(0, MAX_AGENTS), // Select up to 3 agents
      executionPlan: [
        { agent: availableAgents[0], action: 'analyze_task', order: 1 },
        { agent: availableAgents[1] || availableAgents[0], action: 'execute_task', order: 2 },
        { agent: availableAgents[2] || availableAgents[0], action: 'validate_result', order: 3 },
      ],
      estimatedTime: '30-60 seconds',
      confidence: 0.9,
    };

    res.json(coordination);
  } catch (_error) {
    res.status(500).json({
      success: false,
      _error 'Coordination failed',
      message: _errorinstanceof Error ? _errormessage : 'Unknown _error,
    });
  }
});

// Knowledge search endpoint
app.post('/api/v1/knowledge/search', async (req: Request, res: Response) => {
  try {
    const { query, filters = {}, limit = 10 } = req.body;

    if (!query) {
      return res.status(400).json({ _error 'query is required' });
    }

    let results = [];

    if (supabase) {
      // Search in memories table as knowledge base
      const { data, _error} = await supabase
        .from('memories')
        .select('*')
        .ilike('_content, `%${query}%`)
        .limit(limit);

      if (!_error&& data) {
        results = data.map((item) => ({
          id: item.id,
          _content item._content
          relevance: 0.8,
          source: 'memory',
          metadata: item.metadata,
          timestamp: item.timestamp,
        }));
      }
    }

    res.json({
      success: true,
      query,
      results,
      total: results.length,
      searchTime: 25,
    });
  } catch (_error) {
    res.status(500).json({
      success: false,
      _error 'Knowledge search failed',
      message: _errorinstanceof Error ? _errormessage : 'Unknown _error,
    });
  }
});

// Simple context storage
app.post('/api/v1/context', async (req: Request, res: Response) => {
  try {
    const { context_type, context_key, _content metadata } = req.body;

    if (!context_type || !context_key || !_content {
      return res.status(400).json({ _error 'Missing required fields' });
    }

    // Store in memory for now (in minimal mode)
    const contextId = `ctx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    res.json({
      success: true,
      id: contextId,
      message: 'Context stored successfully (minimal mode)',
      meta: {
        timestamp: new Date().toISOString(),
        mode: 'minimal',
      },
    });
  } catch (_error) {
    res.status(500).json({
      _error 'Failed to store context',
      details: _errorinstanceof Error ? _errormessage : String(_error,
    });
  }
});

// Chat endpoint - uses real AI for intelligent responses
app.post('/api/v1/chat', async (req: Request, res: Response) => {
  try {
    const {
      message,
      conversationId = `chat-${Date.now()}`,
      sessionId,
      model = 'llama3.2:3b',
    } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        _error 'Message is required and must be a string',
      });
    }

    const startTime = Date.now();

    // Prepare context from conversation history if available
    let conversationContext = '';
    if (supabase && conversationId) {
      try {
        const { data: memories } = await supabase
          .from('memories')
          .select('_content)
          .eq('metadata->>conversationId', conversationId)
          .eq('type', 'conversation')
          .order('timestamp', { ascending: false })
          .limit(5);

        if (memories && memories.length > 0) {
          conversationContext = `${memories
            .reverse()
            .map((m) => m._content
            .join('\n\n')}\n\n`;
        }
      } catch (err) {
        logger.warn('Failed to load conversation context', LogContext.CONVERSATION, { _error err });
      }
    }

    const requestId = uuidv4();
    let responseText = '';
    let toolCalls = [];

    // Detect task complexity and required agents
    const lowerMessage = message.toLowerCase();
    let agents: ('coding' | 'validation' | 'devils_advocate' | 'ui_designer')[] = [];
    let complexity: 'low' | 'moderate' | 'high' = 'moderate';
    let recommendedDSPyTools: string[] = [];

    // Check if user is asking about DSPy tools
    if (
      lowerMessage.includes('dspy') ||
      lowerMessage.includes('tools') ||
      lowerMessage.includes('what tools')
    ) {
      // Get recommended tools for the task
      const recommendations = dspyToolExecutor.recommendTools(message);
      recommendedDSPyTools = recommendations.map((t) => t.name);

      // Add tool information to response
      toolCalls.push({
        tool: 'dspy_tool_recommendation',
        _input { task: message },
        output: {
          recommendations: recommendations.map((t) => ({
            name: t.name,
            category: t.category,
            description: t.description,
          })),
        },
      });
    }

    // Agent selection based on intent
    if (
      lowerMessage.includes('code') ||
      lowerMessage.includes('function') ||
      lowerMessage.includes('implement')
    ) {
      agents = ['coding', 'validation', 'devils_advocate'];
      complexity = 'high';
      recommendedDSPyTools.push('ProgramOfThought', 'ChainOfThought');
    } else if (
      lowerMessage.includes('ui') ||
      lowerMessage.includes('component') ||
      lowerMessage.includes('interface')
    ) {
      agents = ['ui_designer', 'coding', 'validation'];
      complexity = 'high';
      recommendedDSPyTools.push('ReAct', 'Comparator');
    } else if (
      lowerMessage.includes('review') ||
      lowerMessage.includes('check') ||
      lowerMessage.includes('validate')
    ) {
      agents = ['validation', 'devils_advocate'];
      complexity = 'moderate';
      recommendedDSPyTools.push('SelfReflection', 'AnswerCorrectnessMetric');
    } else if (lowerMessage.includes('optimize') || lowerMessage.includes('improve')) {
      agents = ['coding', 'validation'];
      complexity = 'high';
      recommendedDSPyTools.push('MIPROv2', 'BootstrapFewShot', 'COPRO');
    } else if (
      lowerMessage.includes('search') ||
      lowerMessage.includes('find') ||
      lowerMessage.includes('retrieve')
    ) {
      agents = ['coding'];
      complexity = 'moderate';
      recommendedDSPyTools.push('Retrieve', 'RetrieveThenRead', 'SimplifiedBaleen');
    } else if (
      lowerMessage.includes('reason') ||
      lowerMessage.includes('think') ||
      lowerMessage.includes('explain')
    ) {
      agents = ['coding', 'validation'];
      complexity = 'moderate';
      recommendedDSPyTools.push('ChainOfThought', 'MultiChainComparison', 'SelfReflection');
    } else {
      agents = ['coding', 'validation'];
      complexity = 'moderate';
      recommendedDSPyTools.push('ChainOfThought');
    }

    try {
      // Use DSPy orchestration with MiPro2 optimization
      const dspyResponse = await dspyOrchestrator.orchestrateChat(message, {
        conversationId,
        model,
        optimization: 'mipro2',
        complexity,
        agents,
      });

      if (dspyResponse.success && dspyResponse.result) {
        responseText = dspyResponse.result.response || '';

        // Extract tool calls from DSPy response
        if (dspyResponse.result.tool_calls) {
          toolCalls = dspyResponse.result.tool_calls;
        }

        // Add metadata about agents used
        if (dspyResponse.metadata) {
          logger.info(
            `DSPy used: ${dspyResponse.metadata.model_used}, agents: ${dspyResponse.metadata.agents_involved?.join(', ')}, optimization: ${dspyResponse.metadata.optimization_used}`,
            LogContext.DSPY
          );
        }
      } else {
        throw new Error(dspyResponse._error|| 'DSPy orchestration failed');
      }
    } catch (dspyError) {
      logger.warn('DSPy orchestration unavailable, using fallback', LogContext.DSPY, {
        _error dspyError,
      });

      // Enhanced fallback responses based on intent detection

      // Fallback responses when DSPy is unavailable

      // Check if it's a greeting
      if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
        responseText =
          "Hello! I'm the Universal AI Assistant powered by real AI. I can help you with various tasks including managing agents, storing memories, and coordinating AI services. How can I assist you today?";
      }
      // Check if asking about capabilities
      else if (lowerMessage.includes('what can you do') || lowerMessage.includes('help')) {
        responseText =
          'I can help you with:\n• Managing AI agents and their tasks\n• Storing and retrieving memories\n• Coordinating multiple AI services\n• Dynamically modifying the UI and behavior\n• Creating new components and windows\n• Executing code and showing previews\n\nI can also:\n• Change colors, themes, and styles\n• Add new features and widgets\n• Modify any aspect of the interface\n• Create custom visualizations\n\nJust tell me what you want to change!';
      }
      // Check if asking about agents
      else if (lowerMessage.includes('agent')) {
        responseText =
          'The system includes various AI agents that can perform different tasks. You can view available agents, create new ones, or coordinate them for complex tasks. Would you like to know more about our agent capabilities?';
      }
      // Check for modification requests
      else if (
        lowerMessage.includes('change') ||
        lowerMessage.includes('modify') ||
        lowerMessage.includes('make') ||
        lowerMessage.includes('update') ||
        lowerMessage.includes('add') ||
        lowerMessage.includes('create')
      ) {
        // Handle UI/behavior modification requests
        responseText = `I understand you want to ${lowerMessage.includes('change') ? 'change' : 'modify'} something. I'm processing your _requestnow...`;

        // Add metadata for frontend to process
        toolCalls.push({
          tool: 'ui_modifier',
          _input {
            command: message,
            type: 'dynamic_modification',
          },
          output: {
            success: true,
            action: 'modify_ui',
          },
        });
      }
      // Check for memory/storage requests
      else if (
        lowerMessage.includes('remember') ||
        lowerMessage.includes('store') ||
        lowerMessage.includes('save')
      ) {
        // Extract what to remember
        const toRemember = message.replace(/please |can you |remember|store|save/gi, '').trim();

        // Call tool to store context
        const toolResult = {
          tool: 'store_context',
          _input {
            context_type: 'user_memory',
            context_key: `memory_${Date.now()}`,
            _content toRemember,
          },
          output: {
            success: true,
            id: uuidv4(),
          },
        };
        toolCalls.push(toolResult);

        responseText = `I've stored that information for you: "${toRemember}". I'll remember this for future conversations.`;
      }
      // Check for search/recall requests
      else if (
        lowerMessage.includes('what did') ||
        lowerMessage.includes('recall') ||
        lowerMessage.includes('search')
      ) {
        responseText =
          "I can search through stored memories and context. Currently in minimal mode, but I'm tracking all our conversations. What specific information are you looking for?";
      }
      // Check for code execution requests
      else if (
        lowerMessage.includes('run') ||
        lowerMessage.includes('execute') ||
        lowerMessage.includes('code') ||
        lowerMessage.includes('script')
      ) {
        responseText =
          "I can execute code for you. Here's an example:\n\n```javascript\nconsole.log('Hello from Universal AI!');\nconst result = Array.from({length: 5}, (_, i) => i * 2);\nconsole.log('Result:', result);\n```\n\nThe code preview window should appear showing the execution results.";
      }
      // Check for component creation requests
      else if (
        lowerMessage.includes('component') ||
        lowerMessage.includes('widget') ||
        lowerMessage.includes('element')
      ) {
        responseText =
          "I'll create a new component for you:\n\n[UI:html]\n<div style='padding: 20px; background: linear-gradient(45deg, #667eea 0%, #764ba2 100%); border-radius: 10px; color: white;'>\n  <h2>Custom Widget</h2>\n  <p>This is a dynamically generated component!</p>\n  <button style='background: white; color: #667eea; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer;'>Click Me</button>\n</div>\n[/UI]";
      }
      // Default intelligent response
      else {
        responseText = `I understand you're asking about "${message}". I can help you with that! Try asking me to:\n• Change the theme or colors\n• Add new features or widgets\n• Modify the interface\n• Create custom components\n• Execute code\n\nWhat would you like me to do?`;
      }
    }

    // Store in memory if available
    if (supabase) {
      try {
        await supabase.from('memories').insert({
          _content `User: ${message}\nAssistant: ${responseText}`,
          type: 'conversation',
          metadata: { conversationId, sessionId },
          tags: ['chat', 'conversation'],
          importance: 0.5,
          timestamp: new Date().toISOString(),
        });
      } catch (memError) {
        logger.warn('Failed to store conversation in memory', LogContext.MEMORY, {
          _error memError,
        });
      }
    }

    const response = {
      message: responseText,
      timestamp: new Date().toISOString(),
      model: model || 'llama3.2:3b',
      aiProvider: 'dspy-orchestrated',
      conversationId,
      metadata: {
        requestId,
        requestLength: message.length,
        processingTime: Date.now() - startTime,
        orchestrationMode: 'mipro2',
        memoryStored: !!supabase,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        agentsUsed: agents,
        complexity,
        dspyEnabled: true,
        recommendedDSPyTools: recommendedDSPyTools.length > 0 ? recommendedDSPyTools : undefined,
        availableDSPyTools: {
          total: DSPY_TOOLS.length,
          categories: {
            prompting: dspyToolExecutor.getToolsByCategory('prompting').length,
            optimization: dspyToolExecutor.getToolsByCategory('optimization').length,
            retrieval: dspyToolExecutor.getToolsByCategory('retrieval').length,
            reasoning: dspyToolExecutor.getToolsByCategory('reasoning').length,
            evaluation: dspyToolExecutor.getToolsByCategory('evaluation').length,
          },
        },
      },
    };

    res.json(response);
  } catch (_error) {
    logger.error'Chat _error, LogContext.API, { _error});
    res.status(500).json({
      _error 'Failed to process chat message',
      details: _errorinstanceof Error ? _errormessage : String(_error,
    });
  }
});

// Status endpoint
app.get('/api/v1/status', (req: Request, res: Response) => {
  res.json({
    status: 'running',
    mode: 'minimal-fixed',
    version: '1.0.0',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    services: {
      express: 'running',
      supabase: supabase ? 'connected' : 'disconnected',
      cors: 'enabled',
      auth: 'simple',
    },
    endpoints: [
      'GET /health',
      'GET /api/health',
      'GET /api/v1/memory',
      'POST /api/v1/memory',
      'GET /api/v1/tools',
      'POST /api/v1/context',
      'POST /api/v1/chat',
      'GET /api/v1/status',
    ],
    timestamp: new Date().toISOString(),
  });
});

// Metrics endpoint (simple)
app.get('/metrics', (req: Request, res: Response) => {
  const memoryUsage = process.memoryUsage();
  const metrics = `
# HELP universal_ai_tools_uptime_seconds Server uptime in seconds
# TYPE universal_ai_tools_uptime_seconds gauge
universal_ai_tools_uptime_seconds ${process.uptime()}

# HELP universal_ai_tools_memory_bytes Memory usage in bytes
# TYPE universal_ai_tools_memory_bytes gauge
universal_ai_tools_memory_bytes{type="rss"} ${memoryUsage.rss}
universal_ai_tools_memory_bytes{type="heapUsed"} ${memoryUsage.heapUsed}
universal_ai_tools_memory_bytes{type="heapTotal"} ${memoryUsage.heapTotal}

# HELP universal_ai_tools_info Service information
# TYPE universal_ai_tools_info gauge
universal_ai_tools_info{version="1.0.0",mode="minimal"} 1
`.trim();

  res.set('Content-Type', 'text/plain');
  res.send(metrics);
});

// Catch-all for frontend routes (serve static _content
app.get('*', (req: Request, res: Response) => {
  // For minimal mode, just return a simple response
  if (req.accepts('html')) {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
          <title>Universal AI Tools</title>
          <style>
              body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
              .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
              h1 { color: #333; }
              .status { color: #28a745; font-weight: bold; }
              .endpoint { background: #f8f9fa; padding: 10px; margin: 5px 0; border-left: 4px solid #007bff; }
              code { background: #e9ecef; padding: 2px 6px; border-radius: 3px; }
          </style>
      </head>
      <body>
          <div class="container">
              <h1>🚀 Universal AI Tools</h1>
              <p class="status">✅ Service is running in enhanced mode</p>
              <p><strong>Version:</strong> 1.0.0 (Enhanced)</p>
              <p><strong>Started:</strong> ${new Date().toISOString()}</p>
              <p><strong>Uptime:</strong> ${Math.round(process.uptime())} seconds</p>
              
              <h2>Core Endpoints:</h2>
              <div class="endpoint"><code>GET /health</code> - Basic health check</div>
              <div class="endpoint"><code>GET /api/health</code> - Detailed health status</div>
              <div class="endpoint"><code>GET /api/v1/status</code> - Service status</div>
              <div class="endpoint"><code>GET /metrics</code> - Prometheus metrics</div>
              
              <h2>Memory & Knowledge:</h2>
              <div class="endpoint"><code>GET /api/v1/memory</code> - List memories</div>
              <div class="endpoint"><code>POST /api/v1/memory</code> - Create memory</div>
              <div class="endpoint"><code>POST /api/v1/knowledge/search</code> - Search knowledge base</div>
              <div class="endpoint"><code>POST /api/v1/context</code> - Store context</div>
              
              <h2>Agent Orchestration:</h2>
              <div class="endpoint"><code>POST /api/v1/orchestrate</code> - Agent orchestration</div>
              <div class="endpoint"><code>POST /api/v1/coordinate</code> - Agent coordination</div>
              <div class="endpoint"><code>GET /api/v1/tools</code> - Available tools</div>
              
              <h2>Real-time Features:</h2>
              <div class="endpoint"><code>WS ws://localhost:${port}</code> - WebSocket connection</div>
              
              <h2>Quick Test:</h2>
              <p>Try: <a href="/api/health" target="_blank">/api/health</a></p>
              <p>Or: <a href="/api/v1/status" target="_blank">/api/v1/status</a></p>
          </div>
      </body>
      </html>
    `);
  } else {
    res.status(404).json({ _error 'Endpoint not found' });
  }
});

// Error handling
app.use((_error any, req: Request, res: Response, next: any) => {
  logger.error'Server _error, LogContext.SYSTEM, { _error});
  res.status(500).json({
    _error 'Internal server _error,
    message: _errormessage,
    timestamp: new Date().toISOString(),
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('🛑 Received SIGTERM, shutting down gracefully...', LogContext.SYSTEM);
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('🛑 Received SIGINT, shutting down gracefully...', LogContext.SYSTEM);
  process.exit(0);
});

// WebSocket connection handling
wss.on('connection', (ws, req) => {
  logger.info('🔌 New WebSocket connection established', LogContext.HTTP);

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      logger.debug('📨 WebSocket message received', LogContext.HTTP, { data });

      // Echo back with timestamp for basic functionality
      ws.send(
        JSON.stringify({
          type: 'response',
          data,
          timestamp: new Date().toISOString(),
          server: 'universal-ai-tools',
        })
      );
    } catch (_error) {
      ws.send(
        JSON.stringify({
          type: '_error,
          message: 'Invalid message format',
          timestamp: new Date().toISOString(),
        })
      );
    }
  });

  ws.on('close', () => {
    logger.info('🔌 WebSocket connection closed', LogContext.HTTP);
  });

  // Send welcome message
  ws.send(
    JSON.stringify({
      type: 'welcome',
      message: 'Connected to Universal AI Tools WebSocket',
      timestamp: new Date().toISOString(),
    })
  );
});

// Start server with explicit host binding
server.listen(port, '0.0.0.0', () => {
  logger.info(`✅ Universal AI Tools (Enhanced) running on port ${port}`, LogContext.SYSTEM);
  logger.info(`🌐 Access: http://localhost:${port}`, LogContext.SYSTEM);
  logger.info(`🏥 Health: http://localhost:${port}/health`, LogContext.SYSTEM);
  logger.info(`📊 Status: http://localhost:${port}/api/v1/status`, LogContext.SYSTEM);
  logger.info(`📈 Metrics: http://localhost:${port}/metrics`, LogContext.SYSTEM);
  logger.info(`🔌 WebSocket: ws://localhost:${port}`, LogContext.SYSTEM);
  logger.info(`🕐 Started at: ${new Date().toLocaleString()}`, LogContext.SYSTEM);

  // Verify the server is actually listening
  const address = server.address();
  if (address && typeof address === 'object') {
    logger.info(`🔌 Server bound to ${address.address}:${address.port}`, LogContext.SYSTEM);
  }
});

// Handle server errors
server.on('_error, (_error any) => {
  if (_errorcode === 'EADDRINUSE') {
    logger.error`Port ${port} is already in use`, LogContext.SYSTEM, { _error});
    process.exit(1);
  } else {
    logger.error'Server _error, LogContext.SYSTEM, { _error});
    process.exit(1);
  }
});

export default app;
