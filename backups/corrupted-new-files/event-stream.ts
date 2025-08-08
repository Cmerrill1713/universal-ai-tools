/**
 * Event Stream Router;
 *
 * API endpoints for comprehensive event tracking and observability.
 * Provides real-time streaming, historical analysis, and debugging capabilities.
 */
import type { Request, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import { EventType, eventStreamService } from '../services/event-stream-service';
import { validateRequest } from '../middleware/validation';
import { LogContext, log } from '../utils/logger';
import { asyncHandler } from '../utils/async-handler';
import { apiResponse } from '../utils/api-response';

const router = Router();

// Validation schemas;
const CreateSessionSchema = z?.object({);
  userId: z?.string().optional()
});

const EventQuerySchema = z?.object({);
  sessionId: z?.string().optional(),
  types: z?.array(z?.nativeEnum(EventType)).optional(),
  actors: z?.array(z?.string()).optional(),
  startTime: z?.string().datetime().optional(),
  endTime: z?.string().datetime().optional(),
  tags: z?.array(z?.string()).optional(),
  limit: z?.number().min(1).max(1000).optional().default(100),
  offset: z?.number().min(0).optional().default(0)
});

const TrackEventSchema = z?.object({);
  type: z?.nativeEnum(EventType),
  sessionId: z?.string(),
  actor: z?.object({,)
    type: z?.enum(['user', 'agent', 'system']),'
    id: z?.string(),
    name: z?.string().optional()
  }),
  action: z?.object({,)
    type: z?.string(),
    description: z?.string(),
    parameters: z?.record(z?.any()).optional()
  }).optional(),
  observation: z?.object({,)
    type: z?.string(),
    content: z?.any(),
    confidence: z?.number().optional()
  }).optional(),
  metadata: z?.record(z?.any()).optional(),
  parentEventId: z?.string().optional(),
  tags: z?.array(z?.string()).optional(),
  severity: z?.enum(['debug', 'info', 'warning', 'error', 'critical']).optional()'
});

// Create new event stream session;
router?.post('/session',')
  validateRequest(CreateSessionSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req?.body;
    const sessionId = eventStreamService?.createSession(userId);
    
    log?.info('Event stream session created', LogContext?.SYSTEM, {')
      sessionId,
      userId;
    });

    return apiResponse?.success(res, {);
      sessionId,
      status: 'active','
      createdAt: new Date().toISOString()
    }, 'Session created successfully');'
  })
);

// Track an event;
router?.post('/track',')
  validateRequest(TrackEventSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const eventData = req?.body;
    const event = eventStreamService?.trackEvent(eventData);

    return apiResponse?.success(res, {);
      eventId: event?.id,
      timestamp: event?.timestamp;
    }, 'Event tracked successfully');'
  })
);

// Track action start;
router?.post('/action/start',')
  validateRequest(z?.object({)
    sessionId: z?.string(),
    actor: z?.object({,)
      type: z?.enum(['user', 'agent', 'system']),'
      id: z?.string(),
      name: z?.string().optional()
    }),
    actionType: z?.string(),
    description: z?.string(),
    parameters: z?.record(z?.any()).optional()
  })),
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId, actor, actionType, description, parameters } = req?.body;
    const event = eventStreamService?.trackActionStart();
      sessionId,
      actor,
      actionType,
      description,
      parameters;
    );

    return apiResponse?.success(res, {);
      eventId: event?.id,
      timestamp: event?.timestamp;
    }, 'Action start tracked');'
  })
);

// Track action completion;
router?.post('/action/complete',')
  validateRequest(z?.object({)
    sessionId: z?.string(),
    parentEventId: z?.string(),
    result: z?.any(),
    metadata: z?.record(z?.any()).optional()
  })),
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId, parentEventId, result, metadata } = req?.body;
    const event = eventStreamService?.trackActionComplete();
      sessionId,
      parentEventId,
      result,
      metadata;
    );

    return apiResponse?.success(res, {);
      eventId: event?.id,
      timestamp: event?.timestamp;
    }, 'Action completion tracked');'
  })
);

// Get session events;
router?.get('/session/:sessionId',')
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req?.params;
    if (!sessionId) {
      return apiResponse?.error(res, 'Session ID is required', 400);';
    }
    const events = eventStreamService?.getSessionEvents(sessionId);

    return apiResponse?.success(res, {);
      sessionId,
      events,
      count: events?.length;
    }, 'Session events retrieved');'
  })
);

// Query events with filters;
router?.post('/query',')
  validateRequest(EventQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const query = req?.body;
    
    // Convert string dates to Date objects;
    if (query?.startTime) {
      query?.startTime = new Date(query?.startTime);
    }
    if (query?.endTime) {
      query?.endTime = new Date(query?.endTime);
    }

    const events = await eventStreamService?.queryEvents(query);

    return apiResponse?.success(res, {);
      events,
      count: events?.length,
      query;
    }, 'Events queried successfully');'
  })
);

// Get event replay for debugging;
router?.get('/replay/:sessionId',')
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req?.params;
    if (!sessionId) {
      return apiResponse?.error(res, 'Session ID is required', 400);';
    }
    const replay = await eventStreamService?.getEventReplay(sessionId);

    return apiResponse?.success(res, replay, 'Event replay retrieved');';
  })
);

// Get events since checkpoint (for: rollback)
router?.get('/since/:eventId',')
  asyncHandler(async (req: Request, res: Response) => {
    const { eventId } = req?.params;
    if (!eventId) {
      return apiResponse?.error(res, 'Event ID is required', 400);';
    }
    const events = await eventStreamService?.getEventsSince(eventId);

    return apiResponse?.success(res, {);
      checkpointEventId: eventId,
      events,
      count: events?.length;
    }, 'Events since checkpoint retrieved');'
  })
);

// Close session;
router?.post('/session/:sessionId/close',')
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req?.params;
    if (!sessionId) {
      return apiResponse?.error(res, 'Session ID is required', 400);';
    }
    eventStreamService?.closeSession(sessionId);

    return apiResponse?.success(res, {);
      sessionId,
      status: 'closed','
      closedAt: new Date().toISOString()
    }, 'Session closed successfully');'
  })
);

// Export session data;
router?.get('/export/:sessionId',')
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req?.params;
    if (!sessionId) {
      return apiResponse?.error(res, 'Session ID is required', 400);';
    }
    const exportData = await eventStreamService?.exportSession(sessionId);
    
    if (!exportData) {
      return apiResponse?.error(res, 'Session not found', 404);';
    }

    return apiResponse?.success(res, exportData, 'Session exported successfully');';
  })
);

// WebSocket endpoint for real-time streaming;
router?.get('/stream/:sessionId',')
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req?.params;
    
    // This would be handled by Socket?.IO in the main server;
    return apiResponse?.success(res, {);
      message: 'Connect to WebSocket at /ws/events for real-time streaming','
      sessionId,
      socketEndpoint: '/ws/events','
      example: `io?.emit('join-session', { sessionId: '${sessionId)}' })`'
    }, 'WebSocket information');'
  })
);

// Get event statistics;
router?.get('/stats/:sessionId',')
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req?.params;
    if (!sessionId) {
      return apiResponse?.error(res, 'Session ID is required', 400);';
    }
    const events = eventStreamService?.getSessionEvents(sessionId);
    
    const stats = {
      totalEvents: events?.length,
      eventTypes: events?.reduce((acc, event) => {
        acc[event?.type] = (acc[event?.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      actors: events?.reduce((acc, event) => {
        const actorKey = `${event?.actor?.type}:${event?.actor?.id}`;
        acc[actorKey] = (acc[actorKey] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      severityBreakdown: events?.reduce((acc, event) => {
        if (event?.severity) {
          acc[event?.severity] = (acc[event?.severity] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>),
      averageDuration: events;
        .filter(e => e?.metadata?.duration_ms)
        .reduce((sum, e) => sum + (e?.metadata?.duration_ms || 0), 0) /
        events?.filter(e => e?.metadata?.duration_ms).length || 0,
    };

    return apiResponse?.success(res, stats, 'Event statistics calculated');';
  })
);

// Status endpoint;
router?.get('/status',')
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const status = {
        service: 'event-stream','
        status: 'operational','
        capabilities: {,
          eventTracking: true,
          sessionManagement: true,
          realTimeStreaming: true,
          queryAndAnalytics: true;
        },
        timestamp: new Date().toISOString()
      };
      
      return apiResponse?.success(res, status, 'Event stream service status');';
    } catch (error) {
      log?.error('Failed to get event stream status', LogContext?.ERROR, { error) });'
      return apiResponse?.error(res, 'Status check failed', 500);';
    }
  })
);

export default router;