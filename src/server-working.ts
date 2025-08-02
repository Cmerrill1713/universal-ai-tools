import express from 'express';
import cors from 'cors';
import { LogContext, log } from './utils/logger.js';
import SimpleAgentRouter from './agents/simple-agent-router.js';

const app = express();
const port = process.env.PORT || 9999;

// Initialize the agent router
const agentRouter = new SimpleAgentRouter();

// Basic middleware
app.use(cors());
app.use(express.json());

// Chat endpoint with agent routing
app.post('/api/v1/chat', async (req, res) => {
  try {
    const { message, userId = 'anonymous' } = req.body;
    
    log.info('💬 Chat request received', LogContext.API, {
      userId,
      messageLength: message?.length || 0
    });

    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }

    // Route the message to the appropriate agent
    const agentResponse = await agentRouter.routeMessage(message, userId);
    
    const response = {
      success: agentResponse.success,
      data: {
        message: agentResponse.message,
        userId,
        timestamp: agentResponse.timestamp,
        model: agentResponse.model,
        confidence: agentResponse.confidence,
        agentType: agentResponse.agentType,
        selectedAgent: (agentResponse as any).selectedAgent,
        type: 'chat'
      }
    };

    log.info('✅ Chat response sent', LogContext.API, {
      userId,
      agent: agentResponse.agentType,
      model: agentResponse.model,
      confidence: agentResponse.confidence,
      responseLength: agentResponse.message.length
    });

    return res.json(response);
  } catch (error) {
    log.error('❌ Chat request failed', LogContext.API, {
      error: error instanceof Error ? error.message : String(error)
    });
    
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get available agents endpoint
app.get('/api/v1/agents', (req, res) => {
  const agentsInfo = agentRouter.getAvailableAgents();
  res.json({
    success: true,
    data: agentsInfo
  });
});

// Get user conversation history endpoint
app.get('/api/v1/memory/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;
    
    const memoryService = agentRouter.getMemoryService();
    const conversationHistory = await memoryService.getConversationHistory(userId, limit);
    
    if (!conversationHistory) {
      return res.json({
        success: true,
        data: {
          userId,
          messages: [],
          message: 'No conversation history found'
        }
      });
    }

    return res.json({
      success: true,
      data: conversationHistory
    });
  } catch (error) {
    log.error('❌ Failed to get conversation history', LogContext.API, {
      error: error instanceof Error ? error.message : String(error)
    });
    
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve conversation history'
    });
  }
});

// Health check
app.get('/api/v1/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '2.0.0-working'
    }
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      message: 'Universal AI Tools - Working Server',
      version: '2.0.0-working',
      endpoints: [
        'POST /api/v1/chat - Send a chat message',
        'GET /api/v1/health - Health check'
      ]
    }
  });
});

// Start server
app.listen(port, () => {
  log.info(`🚀 Universal AI Tools working server started`, LogContext.SERVER, {
    port,
    timestamp: new Date().toISOString()
  });
  console.log(`\n🟢 Server running at http://localhost:${port}`);
  console.log(`\n📝 Test the chat endpoint:`);
  console.log(`curl -X POST http://localhost:${port}/api/v1/chat \\`);
  console.log(`  -H "Content-Type: application/json" \\`);
  console.log(`  -d '{"message": "Hello, can you help me?", "userId": "test-user"}'`);
});

export default app;