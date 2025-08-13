/**
 * Calendar Integration Router
 * Exposes calendar and scheduling features
 */

import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { authenticate } from '@/middleware/auth';
import { calendarIntegrationService } from '@/services/calendar-integration-service';
import { log, LogContext } from '@/utils/logger';

const router = Router();

// GET /api/v1/calendar/status
router.get('/status', authenticate, async (req, res) => {
  try {
    const providers = calendarIntegrationService.getProviders();
    const upcomingEvents = await calendarIntegrationService.getUpcomingEvents(5);
    
    const status = {
      isInitialized: true,
      providers: providers.length,
      connectedProviders: providers.filter(p => p.isConnected).length,
      upcomingEvents: upcomingEvents.length,
      lastSync: providers.find(p => p.lastSync)?.lastSync || null
    };
    
    res.json({
      success: true,
      data: status,
      metadata: { requestId: uuidv4() }
    });
  } catch (error) {
    log.error('Failed to get calendar status', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get status',
      metadata: { requestId: uuidv4() }
    });
  }
});

// GET /api/v1/calendar/events
router.get('/events', authenticate, async (req, res) => {
  try {
    const { startDate, endDate, providers } = req.query;
    
    const start = startDate ? new Date(startDate as string) : new Date();
    const end = endDate ? new Date(endDate as string) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
    const providerFilter = providers ? (providers as string).split(',') : undefined;
    
    const events = await calendarIntegrationService.getEvents(start, end, providerFilter);
    
    res.json({
      success: true,
      data: events,
      metadata: { requestId: uuidv4() }
    });
  } catch (error) {
    log.error('Failed to get calendar events', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get events',
      metadata: { requestId: uuidv4() }
    });
  }
});

// POST /api/v1/calendar/events
router.post('/events', authenticate, async (req, res) => {
  try {
    const event = await calendarIntegrationService.createEvent(req.body);
    
    res.json({
      success: true,
      data: event,
      metadata: { requestId: uuidv4() }
    });
  } catch (error) {
    log.error('Failed to create calendar event', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: 'Failed to create event',
      metadata: { requestId: uuidv4() }
    });
  }
});

// GET /api/v1/calendar/availability
router.get('/availability', authenticate, async (req, res) => {
  try {
    const { date, duration, days } = req.query;
    
    const startDate = date ? new Date(date as string) : new Date();
    const daysToCheck = parseInt(days as string) || 7;
    const endDate = new Date(startDate.getTime() + daysToCheck * 24 * 60 * 60 * 1000);
    const durationMinutes = parseInt(duration as string) || 30;
    
    const slots = await calendarIntegrationService.findAvailableSlots(
      startDate,
      endDate,
      durationMinutes
    );
    
    res.json({
      success: true,
      data: slots,
      metadata: { requestId: uuidv4() }
    });
  } catch (error) {
    log.error('Failed to get availability', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get availability',
      metadata: { requestId: uuidv4() }
    });
  }
});

// POST /api/v1/calendar/schedule
router.post('/schedule', authenticate, async (req, res) => {
  try {
    const { title, duration, participants, preferences } = req.body;
    
    if (!title || !duration) {
      return res.status(400).json({
        success: false,
        error: 'Title and duration are required',
        metadata: { requestId: uuidv4() }
      });
    }
    
    const scheduling = await calendarIntegrationService.smartSchedule(
      title,
      duration,
      participants,
      preferences
    );
    
    return res.json({
      success: true,
      data: scheduling,
      metadata: { requestId: uuidv4() }
    });
  } catch (error) {
    log.error('Failed to schedule task', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({
      success: false,
      error: 'Failed to schedule task',
      metadata: { requestId: uuidv4() }
    });
  }
});

// POST /api/v1/calendar/providers
router.post('/providers', authenticate, async (req, res) => {
  try {
    const { name, type, credentials } = req.body;
    
    if (!name || !type || !credentials) {
      return res.status(400).json({
        success: false,
        error: 'Name, type, and credentials are required',
        metadata: { requestId: uuidv4() }
      });
    }
    
    const result = await calendarIntegrationService.addProvider({
      name,
      type,
      credentials
    });
    
    return res.json({
      success: true,
      data: { connected: result },
      metadata: { requestId: uuidv4() }
    });
  } catch (error) {
    log.error('Failed to add calendar provider', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({
      success: false,
      error: 'Failed to add calendar provider',
      metadata: { requestId: uuidv4() }
    });
  }
});

// POST /api/v1/calendar/sync
router.post('/sync', authenticate, async (req, res) => {
  try {
    await calendarIntegrationService.syncAllProviders();
    
    res.json({
      success: true,
      data: { message: 'Sync initiated for all connected providers' },
      metadata: { requestId: uuidv4() }
    });
  } catch (error) {
    log.error('Failed to sync calendar', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: 'Failed to sync calendar',
      metadata: { requestId: uuidv4() }
    });
  }
});

// GET /api/v1/calendar/providers
router.get('/providers', authenticate, async (req, res) => {
  try {
    const providers = calendarIntegrationService.getProviders();
    
    res.json({
      success: true,
      data: providers,
      metadata: { requestId: uuidv4() }
    });
  } catch (error) {
    log.error('Failed to get calendar providers', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get calendar providers',
      metadata: { requestId: uuidv4() }
    });
  }
});

// GET /api/v1/calendar/upcoming
router.get('/upcoming', authenticate, async (req, res) => {
  try {
    const { limit } = req.query;
    const limitNum = limit ? parseInt(limit as string) : undefined;
    
    const events = await calendarIntegrationService.getUpcomingEvents(limitNum);
    
    res.json({
      success: true,
      data: events,
      metadata: { requestId: uuidv4() }
    });
  } catch (error) {
    log.error('Failed to get upcoming events', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get upcoming events',
      metadata: { requestId: uuidv4() }
    });
  }
});

// GET /api/v1/calendar/events/:id
router.get('/events/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Event ID is required',
        metadata: { requestId: uuidv4() }
      });
    }
    
    const event = await calendarIntegrationService.getEventById(id);
    
    if (!event) {
      return res.status(404).json({
        success: false,
        error: 'Event not found',
        metadata: { requestId: uuidv4() }
      });
    }
    
    return res.json({
      success: true,
      data: event,
      metadata: { requestId: uuidv4() }
    });
  } catch (error) {
    log.error('Failed to get event', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({
      success: false,
      error: 'Failed to get event',
      metadata: { requestId: uuidv4() }
    });
  }
});

// PUT /api/v1/calendar/events/:id
router.put('/events/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Event ID is required',
        metadata: { requestId: uuidv4() }
      });
    }
    
    const success = await calendarIntegrationService.updateEvent(id, updates);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Event not found or update failed',
        metadata: { requestId: uuidv4() }
      });
    }
    
    const updatedEvent = await calendarIntegrationService.getEventById(id);
    
    return res.json({
      success: true,
      data: updatedEvent,
      metadata: { requestId: uuidv4() }
    });
  } catch (error) {
    log.error('Failed to update event', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({
      success: false,
      error: 'Failed to update event',
      metadata: { requestId: uuidv4() }
    });
  }
});

// DELETE /api/v1/calendar/events/:id
router.delete('/events/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Event ID is required',
        metadata: { requestId: uuidv4() }
      });
    }
    
    const success = await calendarIntegrationService.deleteEvent(id);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Event not found',
        metadata: { requestId: uuidv4() }
      });
    }
    
    return res.json({
      success: true,
      data: { message: 'Event deleted successfully' },
      metadata: { requestId: uuidv4() }
    });
  } catch (error) {
    log.error('Failed to delete event', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({
      success: false,
      error: 'Failed to delete event',
      metadata: { requestId: uuidv4() }
    });
  }
});

// GET /api/v1/calendar/preferences/:userId
router.get('/preferences/:userId', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required',
        metadata: { requestId: uuidv4() }
      });
    }
    
    const preferences = calendarIntegrationService.getUserPreferences(userId);
    
    if (!preferences) {
      return res.status(404).json({
        success: false,
        error: 'User preferences not found',
        metadata: { requestId: uuidv4() }
      });
    }
    
    return res.json({
      success: true,
      data: preferences,
      metadata: { requestId: uuidv4() }
    });
  } catch (error) {
    log.error('Failed to get user preferences', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({
      success: false,
      error: 'Failed to get user preferences',
      metadata: { requestId: uuidv4() }
    });
  }
});

// POST /api/v1/calendar/preferences/:userId
router.post('/preferences/:userId', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;
    const preferences = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required',
        metadata: { requestId: uuidv4() }
      });
    }
    
    calendarIntegrationService.setUserPreferences(userId, preferences);
    
    return res.json({
      success: true,
      data: { message: 'Preferences updated successfully' },
      metadata: { requestId: uuidv4() }
    });
  } catch (error) {
    log.error('Failed to set user preferences', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({
      success: false,
      error: 'Failed to set user preferences',
      metadata: { requestId: uuidv4() }
    });
  }
});

// GET /api/v1/calendar/analytics/:userId
router.get('/analytics/:userId', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;
    const { days } = req.query;
    const daysNum = days ? parseInt(days as string) : 30;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required',
        metadata: { requestId: uuidv4() }
      });
    }
    
    const analytics = await calendarIntegrationService.analyzeBusyPatterns(userId, daysNum);
    
    return res.json({
      success: true,
      data: analytics,
      metadata: { requestId: uuidv4() }
    });
  } catch (error) {
    log.error('Failed to get calendar analytics', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({
      success: false,
      error: 'Failed to get calendar analytics',
      metadata: { requestId: uuidv4() }
    });
  }
});

export default router;