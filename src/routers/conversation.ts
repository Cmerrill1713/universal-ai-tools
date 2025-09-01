/**
 * Simple Conversation Router
 * Provides a simple /conversation endpoint that routes to the Autonomous Master Controller
 */

import express, { Request, Response } from 'express';
import { AutonomousMasterController } from '../services/autonomous-master-controller.js';
import { log, LogContext } from '../utils/logger.js';

const router = express.Router();
const masterController = AutonomousMasterController.getInstance();

/**
 * POST /conversation
 * Simple endpoint for conversation requests
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { 
      message,
      input, 
      userId,
      sessionId,
      inputType = 'text'
    } = req.body;

    // Support both 'message' and 'input' fields
    const userInput = message || input;

    if (!userInput || typeof userInput !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Message is required',
        error: 'INVALID_INPUT'
      });
    }

    log.info(`🎯 Conversation request from user: ${userId || 'anonymous'}`, LogContext.API);

    // Process through master controller
    const response = await masterController.processUserRequest(userInput, {
      sessionId,
      userId
    }, inputType);

    return res.json({
      success: response.success,
      message: response.message,
      response: response.message, // For compatibility
      action: response.action,
      data: response.data,
      sessionId: sessionId || `session_${Date.now()}`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    log.error('❌ Error in conversation endpoint:', LogContext.API, { error });
    
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /conversation/:sessionId
 * Get conversation history
 */
router.get('/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const history = masterController.getConversationHistory(sessionId ?? '');

    return res.json({
      success: true,
      sessionId,
      messages: history,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    log.error('❌ Error getting conversation history:', LogContext.API, { error });
    
    return res.status(500).json({
      success: false,
      message: 'Error retrieving conversation history'
    });
  }
});

/**
 * GET /conversation/status
 * Get conversation system status
 */
router.get('/status', async (_req: Request, res: Response) => {
  try {
    const tasks = masterController.getActiveTasks();
    
    return res.json({
      success: true,
      status: 'operational',
      activeTasks: tasks.length,
      capabilities: [
        'text_conversation',
        'voice_commands',
        'project_creation',
        'home_automation',
        'task_management'
      ],
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log.error('❌ Error getting conversation status:', LogContext.API, { error });
    
    return res.status(500).json({
      success: false,
      message: 'Error retrieving conversation status'
    });
  }
});

export default router;