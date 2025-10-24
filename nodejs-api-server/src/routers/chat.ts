/**
 * Chat API Router
 * Exposes chat endpoints with UAT-Prompt and Neuroforge integration
 */

import { Router, Request, Response } from 'express';
import { ChatService, ChatServiceConfig } from '../services/chat-service';

const router = Router();

// Initialize chat service
const chatServiceConfig: ChatServiceConfig = {
  supabaseUrl: process.env.SUPABASE_URL || 'http://127.0.0.1:54321',
  supabaseKey: process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
  neuroforgeConfig: {
    modelPath: process.env.NEUROFORGE_MODEL_PATH || './models/neuroforge',
    maxTokens: parseInt(process.env.NEUROFORGE_MAX_TOKENS || '2000'),
    temperature: parseFloat(process.env.NEUROFORGE_TEMPERATURE || '0.7'),
    enableLearning: process.env.NEUROFORGE_ENABLE_LEARNING === 'true',
    contextWindow: parseInt(process.env.NEUROFORGE_CONTEXT_WINDOW || '4000'),
    mlxEnabled: process.env.ENABLE_MLX === 'true',
    defaultModel: process.env.MLX_DEFAULT_MODEL || 'llama3.2-3b'
  },
  ollamaConfig: {
    baseUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
    defaultModel: process.env.OLLAMA_DEFAULT_MODEL || 'llama3.2:3b',
    timeout: parseInt(process.env.OLLAMA_TIMEOUT || '30000')
  },
  enableUATPrompt: process.env.ENABLE_UAT_PROMPT !== 'false',
  enableNeuroforge: process.env.ENABLE_NEUROFORGE !== 'false',
  enableContextEngineering: process.env.ENABLE_CONTEXT_ENGINEERING !== 'false',
  enableOllama: process.env.ENABLE_OLLAMA !== 'false',
  defaultModel: process.env.DEFAULT_LLM_MODEL || 'llama3.2:3b',
  defaultModelProvider: (process.env.DEFAULT_LLM_PROVIDER as 'ollama' | 'mlx' | 'openai' | 'anthropic') || 'ollama'
};

const chatService = new ChatService(chatServiceConfig);

// Initialize chat service
chatService.initialize().catch(error => {
  console.error('Failed to initialize chat service:', error);
});

/**
 * POST /api/chat/message
 * Send a message and get AI response
 */
router.post('/message', async (req: Request, res: Response) => {
  try {
    const { userId, sessionId, message, projectPath } = req.body;

    if (!userId || !sessionId || !message) {
      return res.status(400).json({
        error: 'Missing required fields: userId, sessionId, message'
      });
    }

    console.log(`💬 Processing chat message for user ${userId} in session ${sessionId}`);

    const response = await chatService.processMessage(
      userId,
      sessionId,
      message,
      projectPath
    );

    res.json({
      success: true,
      message: response,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error processing chat message:', error);
    res.status(500).json({
      error: 'Failed to process chat message',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/chat/history/:sessionId
 * Get chat history for a session
 */
router.get('/history/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const history = await chatService.getChatHistory(sessionId);

    res.json({
      success: true,
      sessionId,
      messages: history,
      count: history.length
    });

  } catch (error) {
    console.error('Error getting chat history:', error);
    res.status(500).json({
      error: 'Failed to get chat history',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/chat/context/:sessionId
 * Get session context
 */
router.get('/context/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const context = await chatService.getSessionContext(sessionId);

    if (!context) {
      return res.status(404).json({
        error: 'Session not found'
      });
    }

    res.json({
      success: true,
      sessionId,
      context
    });

  } catch (error) {
    console.error('Error getting session context:', error);
    res.status(500).json({
      error: 'Failed to get session context',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * PUT /api/chat/context/:sessionId
 * Update session context
 */
router.put('/context/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const updates = req.body;

    await chatService.updateSessionContext(sessionId, updates);

    res.json({
      success: true,
      message: 'Session context updated'
    });

  } catch (error) {
    console.error('Error updating session context:', error);
    res.status(500).json({
      error: 'Failed to update session context',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * DELETE /api/chat/session/:sessionId
 * Clear a chat session
 */
router.delete('/session/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    await chatService.clearSession(sessionId);

    res.json({
      success: true,
      message: 'Session cleared'
    });

  } catch (error) {
    console.error('Error clearing session:', error);
    res.status(500).json({
      error: 'Failed to clear session',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/chat/stats
 * Get chat service statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await chatService.getServiceStats();

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('Error getting chat stats:', error);
    res.status(500).json({
      error: 'Failed to get chat stats',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/chat/stream
 * WebSocket-like streaming chat (for real-time responses)
 */
router.post('/stream', async (req: Request, res: Response) => {
  try {
    const { userId, sessionId, message, projectPath } = req.body;

    if (!userId || !sessionId || !message) {
      return res.status(400).json({
        error: 'Missing required fields: userId, sessionId, message'
      });
    }

    // Set up Server-Sent Events
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Send initial connection event
    res.write('data: {"type": "connected", "message": "Chat stream connected"}\n\n');

    // Process message and stream response
    const response = await chatService.processMessage(
      userId,
      sessionId,
      message,
      projectPath
    );

    // Send response in chunks for streaming effect
    const chunks = response.content.split(' ');
    for (let i = 0; i < chunks.length; i++) {
      const chunk = {
        type: 'chunk',
        content: chunks[i] + ' ',
        isComplete: i === chunks.length - 1
      };
      
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      
      // Small delay for streaming effect
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    // Send completion event
    res.write('data: {"type": "complete", "message": "Response complete"}\n\n');
    res.end();

  } catch (error) {
    console.error('Error in streaming chat:', error);
    res.write(`data: {"type": "error", "message": "Error: ${error instanceof Error ? error.message : 'Unknown error'}"}\n\n`);
    res.end();
  }
});

/**
 * GET /api/chat/health
 * Health check for chat service
 */
router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'chat-service',
    timestamp: new Date().toISOString(),
    features: {
      uatPrompt: chatServiceConfig.enableUATPrompt,
      neuroforge: chatServiceConfig.enableNeuroforge,
      contextEngineering: chatServiceConfig.enableContextEngineering
    }
  });
});

export default router;