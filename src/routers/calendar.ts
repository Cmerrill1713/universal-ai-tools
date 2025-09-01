/**
 * Calendar Router - Personal Assistant Calendar Management
 * 
 * Provides comprehensive calendar management endpoints including:
 * - Multi-provider integration (Google, Outlook, Apple, CalDAV)
 * - Smart scheduling with AI-powered optimization
 * - Natural language event parsing
 * - Voice command integration
 * - Advanced calendar analytics
 */

import express, { Request, Response } from 'express';
import { LogContext, log } from '../utils/logger';
import { apiResponseMiddleware } from '../utils/api-response';
import authenticationMiddleware from '../middleware/auth';
import { calendarService } from '../services/calendar-service';

const router = express.Router();

// Apply middleware
router.use(apiResponseMiddleware);
router.use(authenticationMiddleware);

/**
 * GET /api/v1/calendar/status
 * Get calendar service status and configuration
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const providers = calendarService.getProviders();
    
    const status = {
      service: 'calendar',
      status: 'active', // calendarService status
      version: '1.0.0',
      capabilities: [
        'multi-provider-sync',
        'smart-scheduling',
        'natural-language-parsing',
        'conflict-resolution',
        'travel-time-calculation',
        'recurring-events',
        'voice-integration'
      ],
      providers: providers.map(p => ({
        id: p.id,
        type: p.type,
        name: p.name,
        email: p.email,
        isActive: p.isActive,
        lastSync: p.lastSync?.toISOString()
      })),
      totalProviders: providers.length,
      activeProviders: providers.filter(p => p.isActive).length
    };

    res.sendSuccess(status);
  } catch (error) {
    log.error('Failed to get calendar service status', LogContext.API, { error });
    res.sendError('INTERNAL_ERROR', 'Failed to get calendar service status', 500);
  }
});

/**
 * POST /api/v1/calendar/providers
 * Add a new calendar provider
 */
router.post('/providers', async (req: Request, res: Response) => {
  try {
    const { type, name, email, credentials, syncSettings } = req.body;

    if (!type || !name || !email) {
      return res.sendError('VALIDATION_ERROR', 'type, name, and email are required', 400);
    }

    const supportedTypes = ['google', 'outlook', 'apple', 'caldav', 'exchange'];
    if (!supportedTypes.includes(type)) {
      return res.sendError('VALIDATION_ERROR', `Unsupported provider type. Supported: ${supportedTypes.join(', ')}`, 400);
    }

    const provider = {
      type,
      name,
      email,
      isActive: true,
      credentials: credentials || {},
      syncSettings: {
        enabled: true,
        syncInterval: 15, // 15 minutes
        syncDirection: 'bidirectional',
        syncPastDays: 30,
        syncFutureDays: 365,
        defaultReminders: [15], // 15 minutes before
        ...syncSettings
      }
    };

    const providerId = await calendarService.addCalendarProvider(provider);

    log.info('📅 Calendar provider added', LogContext.API, {
      providerId,
      type,
      email,
      userId: (req as any).user?.id
    });

    res.sendSuccess({
      providerId,
      message: 'Calendar provider added successfully',
      provider: {
        id: providerId,
        ...provider
      }
    }, 201);
  } catch (error) {
    log.error('Failed to add calendar provider', LogContext.API, { error });
    res.sendError('INTERNAL_ERROR', 'Failed to add calendar provider', 500);
  }
});

/**
 * GET /api/v1/calendar/providers
 * Get all calendar providers for the user
 */
router.get('/providers', async (req: Request, res: Response) => {
  try {
    const providers = calendarService.getProviders();
    
    res.sendSuccess({
      providers: providers.map(p => ({
        id: p.id,
        type: p.type,
        name: p.name,
        email: p.email,
        isActive: p.isActive,
        lastSync: p.lastSync?.toISOString(),
        syncSettings: p.syncSettings
      })),
      total: providers.length
    });
  } catch (error) {
    log.error('Failed to get calendar providers', LogContext.API, { error });
    res.sendError('INTERNAL_ERROR', 'Failed to get calendar providers', 500);
  }
});

/**
 * DELETE /api/v1/calendar/providers/:providerId
 * Remove a calendar provider
 */
router.delete('/providers/:providerId', async (req: Request, res: Response) => {
  try {
    const { providerId } = req.params;
    
    if (!providerId) {
      return res.status(400).json({ error: 'Provider ID is required' });
    }

    await calendarService.removeProvider(providerId);

    log.info('📅 Calendar provider removed', LogContext.API, {
      providerId,
      userId: (req as any).user?.id
    });

    return res.sendSuccess({
      message: 'Calendar provider removed successfully'
    });
  } catch (error) {
    log.error('Failed to remove calendar provider', LogContext.API, { error });
    return res.sendError('INTERNAL_ERROR', 'Failed to remove calendar provider', 500);
  }
});

/**
 * GET /api/v1/calendar/events/upcoming
 * Get upcoming calendar events
 */
router.get('/events/upcoming', async (req: Request, res: Response) => {
  try {
    const { limit = 10, timeframe = 24 } = req.query;

    const events = await calendarService.getUpcomingEvents(
      parseInt(limit as string, 10),
      parseInt(timeframe as string, 10)
    );

    res.sendSuccess({
      events: events.map(event => ({
        id: event.id,
        title: event.title,
        description: event.description,
        location: event.location,
        startTime: event.startTime.toISOString(),
        endTime: event.endTime.toISOString(),
        isAllDay: event.isAllDay,
        timeZone: event.timeZone,
        attendees: event.attendees,
        status: event.status,
        source: event.source
      })),
      total: events.length,
      timeframe: `${timeframe} hours`
    });
  } catch (error) {
    log.error('Failed to get upcoming events', LogContext.API, { error });
    res.sendError('INTERNAL_ERROR', 'Failed to get upcoming events', 500);
  }
});

/**
 * POST /api/v1/calendar/events
 * Create a new calendar event
 */
router.post('/events', async (req: Request, res: Response) => {
  try {
    const {
      providerId,
      calendarId = 'primary',
      title,
      description,
      location,
      startTime,
      endTime,
      isAllDay = false,
      timeZone,
      attendees = [],
      reminders = [{ type: 'popup', minutes: 15, isActive: true }],
      recurrence
    } = req.body;

    if (!providerId || !title || !startTime || !endTime) {
      return res.sendError('VALIDATION_ERROR', 'providerId, title, startTime, and endTime are required', 400);
    }

    // Validate dates
    const start = new Date(startTime);
    const end = new Date(endTime);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.sendError('VALIDATION_ERROR', 'Invalid date format', 400);
    }

    if (end <= start) {
      return res.sendError('VALIDATION_ERROR', 'endTime must be after startTime', 400);
    }

    const event = {
      providerId,
      calendarId,
      title,
      description,
      location,
      startTime: start,
      endTime: end,
      isAllDay,
      timeZone: timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      recurrence,
      attendees: attendees.map((email: string) => ({
        email,
        status: 'needs_action' as const,
        isOrganizer: false,
        isOptional: false
      })),
      reminders,
      status: 'confirmed' as const,
      visibility: 'private' as const,
      source: 'user' as const,
      metadata: {
        createdBy: (req as any).user?.id,
        createdVia: 'api'
      }
    };

    const eventId = await calendarService.createEvent(event);

    log.info('📅 Calendar event created', LogContext.API, {
      eventId,
      title,
      providerId,
      userId: (req as any).user?.id
    });

    res.sendSuccess({
      eventId,
      message: 'Event created successfully',
      event: {
        id: eventId,
        ...event
      }
    }, 201);
  } catch (error) {
    log.error('Failed to create calendar event', LogContext.API, { error });
    res.sendError('INTERNAL_ERROR', 'Failed to create calendar event', 500);
  }
});

/**
 * POST /api/v1/calendar/parse-event
 * Parse natural language text into event details
 */
router.post('/parse-event', async (req: Request, res: Response) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.sendError('VALIDATION_ERROR', 'text is required', 400);
    }

    const parsedEvent = await calendarService.parseNaturalLanguageEvent(text);

    log.info('🧠 Parsed natural language event', LogContext.API, {
      inputText: text.substring(0, 100),
      parsedTitle: parsedEvent.title,
      userId: (req as any).user?.id
    });

    res.sendSuccess({
      originalText: text,
      parsedEvent: {
        ...parsedEvent,
        startTime: parsedEvent.startTime?.toISOString(),
        endTime: parsedEvent.endTime?.toISOString()
      },
      confidence: 0.85, // Would come from actual NLP analysis
      suggestions: [
        'Add attendees by including email addresses',
        'Specify location for travel time calculation',
        'Set reminders for important events'
      ]
    });
  } catch (error) {
    log.error('Failed to parse natural language event', LogContext.API, { error });
    res.sendError('INTERNAL_ERROR', 'Failed to parse natural language event', 500);
  }
});

/**
 * POST /api/v1/calendar/schedule/find-time
 * Find optimal meeting times using AI scheduling
 */
router.post('/schedule/find-time', async (req: Request, res: Response) => {
  try {
    const {
      title,
      description,
      duration,
      location,
      attendees = [],
      timePreferences = [],
      constraints = [],
      priority = 'medium'
    } = req.body;

    if (!title || !duration) {
      return res.sendError('VALIDATION_ERROR', 'title and duration are required', 400);
    }

    if (duration < 15 || duration > 480) { // 15 minutes to 8 hours
      return res.sendError('VALIDATION_ERROR', 'duration must be between 15 and 480 minutes', 400);
    }

    const schedulingRequest = {
      title,
      description,
      duration: parseInt(duration as string, 10),
      location,
      attendees,
      timePreferences: timePreferences.length > 0 ? timePreferences : [
        {
          dayOfWeek: undefined,
          startTime: '09:00',
          endTime: '17:00',
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          weight: 8
        }
      ],
      constraints: [
        { type: 'no_conflicts', value: true, isRequired: true },
        { type: 'business_hours', value: true, isRequired: false },
        ...constraints
      ],
      priority
    };

    const suggestions = await calendarService.findOptimalMeetingTime(schedulingRequest);

    log.info('🤖 Generated scheduling suggestions', LogContext.API, {
      title,
      duration,
      attendeeCount: attendees.length,
      suggestionCount: suggestions.length,
      userId: (req as any).user?.id
    });

    res.sendSuccess({
      request: {
        ...schedulingRequest,
        attendees: attendees.length // Don't expose emails in response
      },
      suggestions: suggestions.map(s => ({
        startTime: s.startTime.toISOString(),
        endTime: s.endTime.toISOString(),
        confidence: s.confidence,
        conflicts: s.conflicts,
        reasoning: s.reasoning,
        travelTime: s.travelTime
      })),
      totalSuggestions: suggestions.length,
      bestOption: suggestions[0] ? {
        startTime: suggestions[0].startTime.toISOString(),
        endTime: suggestions[0].endTime.toISOString(),
        confidence: suggestions[0].confidence
      } : null
    });
  } catch (error) {
    log.error('Failed to find optimal meeting time', LogContext.API, { error });
    res.sendError('INTERNAL_ERROR', 'Failed to find optimal meeting time', 500);
  }
});

/**
 * GET /api/v1/calendar/analytics
 * Get calendar analytics and insights
 */
router.get('/analytics', async (req: Request, res: Response) => {
  try {
    const { timeframe = 30 } = req.query;
    const timeframeDays = parseInt(timeframe as string, 10);

    if (timeframeDays < 1 || timeframeDays > 365) {
      return res.sendError('VALIDATION_ERROR', 'timeframe must be between 1 and 365 days', 400);
    }

    const analytics = await calendarService.getCalendarAnalytics(timeframeDays);

    res.sendSuccess({
      timeframe: `${timeframeDays} days`,
      analytics: {
        ...analytics,
        insights: [
          analytics.busyPercentage > 70 ? 'Your calendar is quite busy. Consider blocking time for focused work.' : null,
          analytics.averageMeetingDuration > 60 ? 'Your meetings tend to be long. Consider shorter, more focused meetings.' : null,
          analytics.conflictCount > 5 ? 'You have several scheduling conflicts. Use smart scheduling to avoid them.' : null
        ].filter(Boolean),
        recommendations: [
          'Use "Nari Dia" voice for calendar reminders',
          'Enable smart scheduling for conflict-free meetings',
          'Set up travel time calculations for location-based events',
          'Consider recurring event patterns for regular meetings'
        ]
      }
    });
  } catch (error) {
    log.error('Failed to get calendar analytics', LogContext.API, { error });
    res.sendError('INTERNAL_ERROR', 'Failed to get calendar analytics', 500);
  }
});

/**
 * GET /api/v1/calendar/voice/today
 * Get today's schedule optimized for voice response (Nari Dia)
 */
router.get('/voice/today', async (req: Request, res: Response) => {
  try {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const events = await calendarService.getUpcomingEvents(20, 24);
    const todayEvents = events.filter(event => {
      const eventDate = new Date(event.startTime);
      return eventDate.toDateString() === today.toDateString();
    });

    // Format for voice response
    let voiceResponse = '';
    if (todayEvents.length === 0) {
      voiceResponse = "You have no scheduled events today. Your calendar is completely free.";
    } else if (todayEvents.length === 1) {
      const event = todayEvents[0];
      if (event) {
        const startTime = new Date(event.startTime).toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: true 
        });
        voiceResponse = `You have one event today: ${event.title} at ${startTime}`;
        if (event.location) {
          voiceResponse += ` at ${event.location}`;
        }
        voiceResponse += '.';
      }
    } else {
      voiceResponse = `You have ${todayEvents.length} events today. `;
      const nextEvent = todayEvents.find(e => new Date(e.startTime) > today);
      if (nextEvent) {
        const startTime = new Date(nextEvent.startTime).toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: true 
        });
        voiceResponse += `Your next event is ${nextEvent.title} at ${startTime}.`;
      } else {
        const firstEvent = todayEvents[0];
        if (firstEvent) {
          voiceResponse += 'Your first event is ' + firstEvent.title + ' at ' + 
            new Date(firstEvent.startTime).toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit',
            hour12: true 
            }) + '.';
        }
      }
    }

    res.sendSuccess({
      date: today.toDateString(),
      eventCount: todayEvents.length,
      events: todayEvents.map(event => ({
        id: event.id,
        title: event.title,
        startTime: event.startTime.toISOString(),
        endTime: event.endTime.toISOString(),
        location: event.location,
        isAllDay: event.isAllDay
      })),
      voiceResponse,
      preferredVoice: 'Nari Dia',
      speechOptimized: voiceResponse
    });
  } catch (error) {
    log.error('Failed to get today\'s calendar for voice', LogContext.API, { error });
    res.sendError('INTERNAL_ERROR', 'Failed to get today\'s calendar', 500);
  }
});

/**
 * POST /api/v1/calendar/voice/quick-event
 * Create event from voice command (optimized for Nari Dia responses)
 */
router.post('/voice/quick-event', async (req: Request, res: Response) => {
  try {
    const { voiceCommand, providerId } = req.body;

    if (!voiceCommand) {
      return res.sendError('VALIDATION_ERROR', 'voiceCommand is required', 400);
    }

    // Parse voice command into event
    const parsedEvent = await calendarService.parseNaturalLanguageEvent(voiceCommand);

    if (!providerId) {
      const providers = calendarService.getProviders().filter(p => p.isActive);
      if (providers.length === 0) {
        return res.sendError('VALIDATION_ERROR', 'No active calendar providers found', 400);
      }
      parsedEvent.providerId = providers[0].id;
    } else {
      parsedEvent.providerId = providerId;
    }

    // Create the event
    if (parsedEvent.title && parsedEvent.startTime && parsedEvent.endTime) {
      const eventId = await calendarService.createEvent({
        ...parsedEvent,
        calendarId: 'primary',
        attendees: [],
        reminders: [{ type: 'popup', minutes: 15, isActive: true }],
        status: 'confirmed',
        visibility: 'private',
        source: 'user'
      });

      const startTime = new Date(parsedEvent.startTime).toLocaleString();
      const voiceResponse = `I've created "${parsedEvent.title}" for ${startTime}. The event has been added to your calendar.`;

      log.info('📅 Voice event created', LogContext.API, {
        eventId,
        voiceCommand: voiceCommand.substring(0, 100),
        userId: (req as any).user?.id
      });

      res.sendSuccess({
        eventId,
        voiceCommand,
        parsedEvent: {
          ...parsedEvent,
          startTime: parsedEvent.startTime?.toISOString(),
          endTime: parsedEvent.endTime?.toISOString()
        },
        voiceResponse,
        preferredVoice: 'Nari Dia',
        success: true
      }, 201);
    } else {
      const voiceResponse = "I couldn't parse all the details from your request. Could you please specify the event title, date, and time more clearly?";
      
      res.sendSuccess({
        voiceCommand,
        parsedEvent: {
          ...parsedEvent,
          startTime: parsedEvent.startTime?.toISOString(),
          endTime: parsedEvent.endTime?.toISOString()
        },
        voiceResponse,
        preferredVoice: 'Nari Dia',
        success: false,
        needsClarification: true,
        suggestions: [
          'Try: "Schedule a meeting with John tomorrow at 2 PM"',
          'Try: "Create lunch appointment Friday at noon"',
          'Try: "Add dentist appointment next Tuesday at 10 AM"'
        ]
      });
    }
  } catch (error) {
    log.error('Failed to create quick event from voice', LogContext.API, { error });
    res.sendError('INTERNAL_ERROR', 'Failed to create quick event', 500);
  }
});

export default router;