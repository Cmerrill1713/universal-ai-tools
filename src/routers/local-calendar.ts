/**
 * Local Calendar Router - System Calendar Integration
 * 
 * Direct integration with the local calendar system (already connected to family calendars).
 * No OAuth or API keys required - perfect for personal assistant use.
 * 
 * Features:
 * - Voice command calendar management
 * - Natural language event creation
 * - Smart scheduling assistance
 * - Local system calendar integration
 * - Voice-optimized responses
 */

import express, { Request, Response } from 'express';
import { LogContext, log } from '../utils/logger';
import { apiResponseMiddleware } from '../utils/api-response';
import authenticate from '../middleware/auth';
import { localCalendarService } from '../services/local-calendar-service';

const router = express.Router();

// Apply middleware
router.use(apiResponseMiddleware);
router.use(authenticate);

/**
 * GET /api/v1/calendar/status
 * Get local calendar service status
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    log.info('📅 Calendar service status requested', LogContext.API);
    
    const status = localCalendarService.getServiceStatus();
    res.sendSuccess(status);
  } catch (error) {
    log.error('❌ Calendar status failed', LogContext.API, { error });
    res.sendError('INTERNAL_ERROR', 'Calendar status failed', 500);
  }
});

/**
 * POST /api/v1/calendar/voice/command
 * Process voice calendar commands
 */
router.post('/voice/command', async (req: Request, res: Response) => {
  try {
    const { command } = req.body;
    if (!command) {
      return res.sendError('VALIDATION_ERROR', 'Voice command is required', 400);
    }

    log.info('🎙️ Voice calendar command received', LogContext.API, { command });

    // Process the voice command
    const voiceCommand = await localCalendarService.processVoiceCalendarCommand(command);
    const response = await localCalendarService.executeVoiceCalendarCommand(voiceCommand);

    const voiceResponse = {
      originalCommand: command,
      intent: voiceCommand.intent,
      confidence: voiceCommand.confidence,
      response,
      voiceOptimized: true,
      preferredVoice: 'Nari Dia',
      parameters: voiceCommand.parameters
    };

    res.sendSuccess(voiceResponse);
  } catch (error) {
    log.error('❌ Voice calendar command failed', LogContext.API, { error });
    res.sendError('INTERNAL_ERROR', 'Voice calendar command failed', 500);
  }
});

/**
 * POST /api/v1/calendar/voice/schedule
 * Quick voice scheduling endpoint
 */
router.post('/voice/schedule', async (req: Request, res: Response) => {
  try {
    const { command } = req.body;
    if (!command) {
      return res.sendError('VALIDATION_ERROR', 'Scheduling command is required', 400);
    }

    log.info('📅 Voice scheduling request', LogContext.API, { command });

    // Force the intent to be create_event and process
    const voiceCommand = await localCalendarService.processVoiceCalendarCommand(command);
    voiceCommand.intent = 'create_event'; // Override intent for this endpoint
    
    const response = await localCalendarService.executeVoiceCalendarCommand(voiceCommand);

    const schedulingResponse = {
      originalCommand: command,
      response,
      success: voiceCommand.confidence > 0.7,
      confidence: voiceCommand.confidence,
      eventDetails: voiceCommand.parameters,
      voiceOptimized: true,
      preferredVoice: 'Nari Dia'
    };

    res.sendSuccess(schedulingResponse);
  } catch (error) {
    log.error('❌ Voice scheduling failed', LogContext.API, { error });
    res.sendError('INTERNAL_ERROR', 'Voice scheduling failed', 500);
  }
});

/**
 * POST /api/v1/calendar/voice/check
 * Check calendar via voice command
 */
router.post('/voice/check', async (req: Request, res: Response) => {
  try {
    const { command } = req.body;
    if (!command) {
      return res.sendError('VALIDATION_ERROR', 'Calendar check command is required', 400);
    }

    log.info('📊 Voice calendar check', LogContext.API, { command });

    // Force the intent to be check_schedule
    const voiceCommand = await localCalendarService.processVoiceCalendarCommand(command);
    voiceCommand.intent = 'check_schedule'; // Override intent
    
    const response = await localCalendarService.executeVoiceCalendarCommand(voiceCommand);

    const checkResponse = {
      originalCommand: command,
      response,
      scheduleInfo: voiceCommand.parameters,
      voiceOptimized: true,
      preferredVoice: 'Nari Dia'
    };

    res.sendSuccess(checkResponse);
  } catch (error) {
    log.error('❌ Voice calendar check failed', LogContext.API, { error });
    res.sendError('INTERNAL_ERROR', 'Voice calendar check failed', 500);
  }
});

/**
 * GET /api/v1/calendar/events/today
 * Get today's events (optimized for voice)
 */
router.get('/events/today', async (req: Request, res: Response) => {
  try {
    log.info('📅 Today\'s events requested', LogContext.API);

    // Use the voice command system to get today's schedule
    const voiceCommand = await localCalendarService.processVoiceCalendarCommand('check my schedule for today');
    const response = await localCalendarService.executeVoiceCalendarCommand(voiceCommand);

    const eventsResponse = {
      date: new Date().toISOString().split('T')[0],
      response,
      voiceOptimized: true,
      preferredVoice: 'Nari Dia'
    };

    res.sendSuccess(eventsResponse);
  } catch (error) {
    log.error('❌ Today\'s events failed', LogContext.API, { error });
    res.sendError('INTERNAL_ERROR', 'Failed to get today\'s events', 500);
  }
});

/**
 * GET /api/v1/calendar/events/tomorrow
 * Get tomorrow's events (optimized for voice)
 */
router.get('/events/tomorrow', async (req: Request, res: Response) => {
  try {
    log.info('📅 Tomorrow\'s events requested', LogContext.API);

    const voiceCommand = await localCalendarService.processVoiceCalendarCommand('check my schedule for tomorrow');
    const response = await localCalendarService.executeVoiceCalendarCommand(voiceCommand);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const eventsResponse = {
      date: tomorrow.toISOString().split('T')[0],
      response,
      voiceOptimized: true,
      preferredVoice: 'Nari Dia'
    };

    res.sendSuccess(eventsResponse);
  } catch (error) {
    log.error('❌ Tomorrow\'s events failed', LogContext.API, { error });
    res.sendError('INTERNAL_ERROR', 'Failed to get tomorrow\'s events', 500);
  }
});

/**
 * POST /api/v1/calendar/smart-schedule
 * AI-powered smart scheduling
 */
router.post('/smart-schedule', async (req: Request, res: Response) => {
  try {
    const { title, description, duration, preferredTimes, participants } = req.body;

    if (!title) {
      return res.sendError('VALIDATION_ERROR', 'Event title is required', 400);
    }

    log.info('🤖 Smart scheduling request', LogContext.API, { title, duration });

    // Convert to voice command format for processing
    const voiceCommand = `schedule ${title} ${duration ? `for ${duration} minutes` : ''} ${preferredTimes ? `at ${preferredTimes[0]}` : ''}`;
    const processedCommand = await localCalendarService.processVoiceCalendarCommand(voiceCommand);
    const response = await localCalendarService.executeVoiceCalendarCommand(processedCommand);

    const smartResponse = {
      title,
      schedulingResult: response,
      confidence: processedCommand.confidence,
      suggestedTime: processedCommand.parameters.date || processedCommand.parameters.time,
      voiceOptimized: true,
      preferredVoice: 'Nari Dia'
    };

    res.sendSuccess(smartResponse);
  } catch (error) {
    log.error('❌ Smart scheduling failed', LogContext.API, { error });
    res.sendError('INTERNAL_ERROR', 'Smart scheduling failed', 500);
  }
});

/**
 * GET /api/v1/calendar/available-times
 * Find available time slots
 */
router.get('/available-times', async (req: Request, res: Response) => {
  try {
    const { duration = 60, date } = req.query;

    log.info('🔍 Available times requested', LogContext.API, { duration, date });

    const queryCommand = date 
      ? `find available time on ${date} for ${duration} minutes`
      : `find available time for ${duration} minutes`;

    const voiceCommand = await localCalendarService.processVoiceCalendarCommand(queryCommand);
    const response = await localCalendarService.executeVoiceCalendarCommand(voiceCommand);

    const availabilityResponse = {
      duration: parseInt(duration as string),
      date: date || 'flexible',
      response,
      voiceOptimized: true,
      preferredVoice: 'Nari Dia'
    };

    res.sendSuccess(availabilityResponse);
  } catch (error) {
    log.error('❌ Available times query failed', LogContext.API, { error });
    res.sendError('INTERNAL_ERROR', 'Available times query failed', 500);
  }
});

/**
 * GET /api/v1/calendar/calendars
 * List available local calendars
 */
router.get('/calendars', async (req: Request, res: Response) => {
  try {
    log.info('📋 Available calendars requested', LogContext.API);
    
    const status = localCalendarService.getServiceStatus();
    
    const calendarsResponse = {
      calendars: status.calendars.map(name => ({
        name,
        type: 'local',
        isConnected: true,
        isSynced: true
      })),
      platform: status.platform,
      totalCalendars: status.calendars.length,
      integration: 'local-system-calendar'
    };

    res.sendSuccess(calendarsResponse);
  } catch (error) {
    log.error('❌ Calendar list failed', LogContext.API, { error });
    res.sendError('INTERNAL_ERROR', 'Failed to list calendars', 500);
  }
});

/**
 * POST /api/v1/calendar/initialize
 * Initialize calendar service
 */
router.post('/initialize', async (req: Request, res: Response) => {
  try {
    log.info('🚀 Calendar service initialization requested', LogContext.API);
    
    await localCalendarService.initialize();
    const status = localCalendarService.getServiceStatus();
    
    res.sendSuccess({
      message: 'Calendar service initialized successfully',
      status
    });
  } catch (error) {
    log.error('❌ Calendar initialization failed', LogContext.API, { error });
    res.sendError('INTERNAL_ERROR', 'Calendar initialization failed', 500);
  }
});

export default router;