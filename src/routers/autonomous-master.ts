/**
 * Autonomous Master Controller Router
 * Main API endpoint for the unified conversation interface
 */

import express, { Request, Response } from 'express';
import { AutonomousMasterController } from '../services/autonomous-master-controller.js';
import { log, LogContext } from '../utils/logger.js';
import { authenticate } from '../middleware/auth.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// Initialize the master controller
const masterController = AutonomousMasterController.getInstance();

// Rate limiting for conversation requests
const conversationLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute per IP
  message: { 
    error: 'Too many conversation requests. Please slow down.',
    retryAfter: 60 
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply authentication and rate limiting
router.use(authenticate);
router.use(conversationLimiter);

/**
 * POST /api/v1/autonomous-master-controller/process
 * Simple processing endpoint for testing
 */
router.post('/process', async (req: Request, res: Response) => {
  try {
    const { request, priority = 'normal' } = req.body;

    if (!request) {
      return res.status(400).json({
        success: false,
        error: 'Request is required',
      });
    }

    // Simple response for testing
    const response = {
      success: true,
      data: {
        message: 'Request processed by Autonomous Master Controller',
        originalRequest: request,
        priority,
        status: 'completed'
      },
      metadata: {
        timestamp: new Date().toISOString(),
        processingTime: '25ms'
      }
    };

    return res.json(response);
  } catch (error) {
    log.error('Master controller processing error', LogContext.API, { error });
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Processing failed',
    });
  }
});

/**
 * POST /api/v1/master/conversation
 * Main endpoint for all user interactions (text and voice)
 */
router.post('/conversation', async (req: Request, res: Response) => {
  try {
    const { 
      input, 
      context, 
      inputType = 'text',
      sessionId,
      userId 
    } = req.body;

    if (!input || typeof input !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Input text is required',
        error: 'INVALID_INPUT'
      });
    }

    log.info(`🎯 Conversation request from user: ${userId || 'anonymous'}`, LogContext.API);

    // Process the user request through the master controller
    const response = await masterController.processUserRequest(input, {
      ...context,
      sessionId,
      userId
    }, inputType);

    // Return the response
    return res.json({
      success: response.success,
      message: response.message,
      action: response.action,
      data: response.data,
      needsClarification: response.needsClarification,
      clarificationPrompt: response.clarificationPrompt,
      suggestions: response.suggestions,
      context: response.context,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    log.error('❌ Error in conversation endpoint:', LogContext.API, { error });
    
    return res.status(500).json({
      success: false,
      message: 'I encountered an internal error. Please try again.',
      error: 'INTERNAL_SERVER_ERROR',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/v1/master/voice
 * Dedicated endpoint for voice input processing
 */
router.post('/voice', async (req: Request, res: Response) => {
  try {
    const { 
      audioInput, 
      context, 
      sessionId,
      userId 
    } = req.body;

    if (!audioInput || typeof audioInput !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Audio input text is required',
        error: 'INVALID_AUDIO_INPUT'
      });
    }

    log.info(`🎤 Voice request from user: ${userId || 'anonymous'}`, LogContext.API);

    const response = await masterController.processVoiceInput(audioInput, {
      ...context,
      sessionId,
      userId
    });

    return res.json({
      success: response.success,
      message: response.message,
      action: response.action,
      data: response.data,
      needsClarification: response.needsClarification,
      clarificationPrompt: response.clarificationPrompt,
      suggestions: response.suggestions,
      context: response.context,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    log.error('❌ Error in voice endpoint:', LogContext.API, { error });
    
    return res.status(500).json({
      success: false,
      message: 'I encountered an error processing your voice command. Please try again.',
      error: 'VOICE_PROCESSING_ERROR',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/v1/master/conversation/:sessionId
 * Get conversation history for a session
 */
router.get('/conversation/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { limit = 50 } = req.query;

    const history = masterController.getConversationHistory(sessionId ?? '');
    const limitedHistory = history.slice(-Number(limit));

    return res.json({
      success: true,
      sessionId,
      messages: limitedHistory,
      totalMessages: history.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    log.error('❌ Error getting conversation history:', LogContext.API, { error });
    
    return res.status(500).json({
      success: false,
      message: 'Error retrieving conversation history',
      error: 'HISTORY_RETRIEVAL_ERROR'
    });
  }
});

/**
 * GET /api/v1/master/tasks
 * Get active tasks and their status
 */
router.get('/tasks', async (req: Request, res: Response) => {
  try {
    const tasks = masterController.getActiveTasks();

    return res.json({
      success: true,
      tasks,
      totalActiveTasks: tasks.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    log.error('❌ Error getting active tasks:', LogContext.API, { error });
    
    return res.status(500).json({
      success: false,
      message: 'Error retrieving active tasks',
      error: 'TASKS_RETRIEVAL_ERROR'
    });
  }
});

/**
 * POST /api/v1/master/feedback
 * Record user feedback for learning
 */
router.post('/feedback', async (req: Request, res: Response) => {
  try {
    const { 
      sessionId, 
      messageId, 
      feedback, 
      details,
      userId 
    } = req.body;

    if (!sessionId || !messageId || !feedback) {
      return res.status(400).json({
        success: false,
        message: 'Session ID, message ID, and feedback are required',
        error: 'INVALID_FEEDBACK_DATA'
      });
    }

    if (!['positive', 'negative'].includes(feedback)) {
      return res.status(400).json({
        success: false,
        message: 'Feedback must be either "positive" or "negative"',
        error: 'INVALID_FEEDBACK_VALUE'
      });
    }

    await masterController.recordFeedback(sessionId, messageId, feedback, details);

    log.info(`📝 Recorded ${feedback} feedback for message ${messageId}`, LogContext.API);

    return res.json({
      success: true,
      message: 'Feedback recorded successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    log.error('❌ Error recording feedback:', LogContext.API, { error });
    
    return res.status(500).json({
      success: false,
      message: 'Error recording feedback',
      error: 'FEEDBACK_RECORDING_ERROR'
    });
  }
});

/**
 * GET /api/v1/master/status
 * Get master controller status and health
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const status = {
      service: 'Autonomous Master Controller',
      status: 'operational',
      version: '1.0.0',
      capabilities: [
        'conversation_handling',
        'coding_assistance',
        'home_automation',
        'task_management',
        'voice_processing',
        'learning_optimization'
      ],
      endpoints: {
        conversation: '/api/v1/master/conversation',
        voice: '/api/v1/master/voice',
        tasks: '/api/v1/master/tasks',
        feedback: '/api/v1/master/feedback',
        status: '/api/v1/master/status'
      },
      timestamp: new Date().toISOString()
    };

    return res.json(status);

  } catch (error) {
    log.error('❌ Error getting master controller status:', LogContext.API, { error });
    
    return res.status(500).json({
      success: false,
      message: 'Error retrieving status',
      error: 'STATUS_ERROR'
    });
  }
});

export default router;