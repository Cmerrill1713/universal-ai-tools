import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { log, LogContext } from '../utils/logger';
import { collaborationService } from '../services/collaboration-service';
import { validateRequest } from '../middleware/validation';
import { authenticate } from '../middleware/auth';

const router = Router();

// Request schemas
const CreateWorkspaceSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['chat', 'code', 'document', 'agent-session']),
  ownerId: z.string(),
  options: z.object({
    maxParticipants: z.number().min(1).max(500).optional(),
    allowAnonymous: z.boolean().optional(),
    requireApproval: z.boolean().optional(),
    persistence: z.boolean().optional(),
    initialState: z.record(z.any()).optional()
  }).optional()
});

const JoinWorkspaceSchema = z.object({
  workspaceId: z.string().uuid(),
  user: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string().email(),
    avatar: z.string().url().optional(),
    role: z.enum(['owner', 'editor', 'viewer']).default('editor')
  })
});

const SendEditSchema = z.object({
  workspaceId: z.string().uuid(),
  userId: z.string(),
  editData: z.object({
    operation: z.enum(['insert', 'delete', 'replace', 'format']),
    position: z.union([z.number(), z.object({
      line: z.number(),
      column: z.number()
    })]),
    content: z.string().optional(),
    length: z.number().optional(),
    metadata: z.record(z.any()).optional()
  })
});

const SendChatSchema = z.object({
  workspaceId: z.string().uuid(),
  userId: z.string(),
  message: z.object({
    content: z.string().min(1).max(10000),
    type: z.enum(['text', 'code', 'image', 'file']).default('text'),
    metadata: z.record(z.any()).optional(),
    replyTo: z.string().uuid().optional()
  })
});

const ShareAgentResultSchema = z.object({
  workspaceId: z.string().uuid(),
  userId: z.string(),
  agentResult: z.object({
    executionId: z.string(),
    agentType: z.string(),
    task: z.string(),
    result: z.any(),
    confidence: z.number().min(0).max(1),
    duration: z.number().min(0),
    model: z.string(),
    metadata: z.record(z.any()).optional()
  })
});

const UpdateCursorSchema = z.object({
  workspaceId: z.string().uuid(),
  userId: z.string(),
  cursor: z.object({
    x: z.number(),
    y: z.number(),
    selection: z.string().optional()
  })
});

// Apply authentication to all routes
router.use(authenticate);

/**
 * Create a new collaboration workspace
 */
router.post('/workspaces', validateRequest(CreateWorkspaceSchema), async (req: Request, res: Response) => {
  try {
    const { name, type, ownerId, options } = req.body;

    log.info('Creating collaboration workspace', LogContext.API, { name, type, ownerId });

    const workspaceId = await collaborationService.createWorkspace(
      name,
      type,
      ownerId,
      options
    );

    res.status(201).json({
      success: true,
      data: {
        workspaceId,
        name,
        type,
        ownerId,
        settings: options
      }
    });

  } catch (error) {
    log.error('Workspace creation failed', LogContext.API, { error });
    res.status(500).json({
      success: false,
      error: 'Workspace creation failed',
      details: (error as Error).message
    });
  }
});

/**
 * Get workspace information
 */
router.get('/workspaces/:workspaceId', async (req: Request, res: Response) => {
  try {
    const { workspaceId } = req.params;

    const workspace = await collaborationService.getWorkspace(workspaceId);

    if (!workspace) {
      return res.status(404).json({
        success: false,
        error: 'Workspace not found'
      });
    }

    // Get current participants with online status
    const participants = await collaborationService.getWorkspaceParticipants(workspaceId);

    res.json({
      success: true,
      data: {
        ...workspace,
        participants,
        participantCount: participants.length,
        onlineCount: participants.filter(p => p.status === 'online').length
      }
    });

  } catch (error) {
    log.error('Failed to get workspace:', LogContext.API, { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get workspace',
      details: (error as Error).message
    });
  }
});

/**
 * Join a workspace
 */
router.post('/workspaces/join', validateRequest(JoinWorkspaceSchema), async (req: Request, res: Response) => {
  try {
    const { workspaceId, user } = req.body;

    log.info('User joining workspace', LogContext.API, { workspaceId, userId: user.id, userName: user.name });

    const connectionId = `http_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const success = await collaborationService.joinWorkspace(workspaceId, user, connectionId);

    if (success) {
      const workspace = await collaborationService.getWorkspace(workspaceId);
      
      res.json({
        success: true,
        data: {
          workspaceId,
          user,
          workspace: workspace ? {
            id: workspace.id,
            name: workspace.name,
            type: workspace.type,
            participantCount: workspace.participants.length
          } : null
        }
      });
    } else {
      res.status(403).json({
        success: false,
        error: 'Failed to join workspace'
      });
    }

  } catch (error) {
    log.error('Workspace join failed:', LogContext.API, { error });
    res.status(500).json({
      success: false,
      error: 'Workspace join failed',
      details: (error as Error).message
    });
  }
});

/**
 * Leave a workspace
 */
router.post('/workspaces/:workspaceId/leave', async (req: Request, res: Response) => {
  try {
    const { workspaceId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required'
      });
    }

    log.info('User leaving workspace', LogContext.API, { workspaceId, userId });

    await collaborationService.leaveWorkspace(workspaceId, userId);

    res.json({
      success: true,
      data: {
        workspaceId,
        userId,
        leftAt: new Date().toISOString()
      }
    });

  } catch (error) {
    log.error('Workspace leave failed:', LogContext.API, { error });
    res.status(500).json({
      success: false,
      error: 'Workspace leave failed',
      details: (error as Error).message
    });
  }
});

/**
 * Send an edit to a workspace
 */
router.post('/workspaces/edit', validateRequest(SendEditSchema), async (req: Request, res: Response) => {
  try {
    const { workspaceId, userId, editData } = req.body;

    await collaborationService.sendEdit(workspaceId, userId, editData);

    res.json({
      success: true,
      data: {
        workspaceId,
        userId,
        operation: editData.operation,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    log.error('Edit send failed:', LogContext.API, { error });
    res.status(500).json({
      success: false,
      error: 'Edit send failed',
      details: (error as Error).message
    });
  }
});

/**
 * Update cursor position
 */
router.post('/workspaces/cursor', validateRequest(UpdateCursorSchema), async (req: Request, res: Response) => {
  try {
    const { workspaceId, userId, cursor } = req.body;

    await collaborationService.updateCursor(workspaceId, userId, cursor);

    res.json({
      success: true,
      data: {
        workspaceId,
        userId,
        cursor,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    log.error('Cursor update failed:', LogContext.API, { error });
    res.status(500).json({
      success: false,
      error: 'Cursor update failed',
      details: (error as Error).message
    });
  }
});

/**
 * Send a chat message
 */
router.post('/workspaces/chat', validateRequest(SendChatSchema), async (req: Request, res: Response) => {
  try {
    const { workspaceId, userId, message } = req.body;

    const messageId = await collaborationService.sendChatMessage(workspaceId, userId, message);

    res.json({
      success: true,
      data: {
        messageId,
        workspaceId,
        userId,
        content: message.content.substring(0, 100),
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    log.error('Chat message send failed:', LogContext.API, { error });
    res.status(500).json({
      success: false,
      error: 'Chat message send failed',
      details: (error as Error).message
    });
  }
});

/**
 * Share agent execution result
 */
router.post('/workspaces/agent-result', validateRequest(ShareAgentResultSchema), async (req: Request, res: Response) => {
  try {
    const { workspaceId, userId, agentResult } = req.body;

    await collaborationService.shareAgentResult(workspaceId, userId, agentResult);

    res.json({
      success: true,
      data: {
        workspaceId,
        userId,
        executionId: agentResult.executionId,
        agentType: agentResult.agentType,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    log.error('Agent result sharing failed:', LogContext.API, { error });
    res.status(500).json({
      success: false,
      error: 'Agent result sharing failed',
      details: (error as Error).message
    });
  }
});

/**
 * Get workspace participants
 */
router.get('/workspaces/:workspaceId/participants', async (req: Request, res: Response) => {
  try {
    const { workspaceId } = req.params;

    const participants = await collaborationService.getWorkspaceParticipants(workspaceId);

    res.json({
      success: true,
      data: {
        workspaceId,
        participants,
        totalCount: participants.length,
        onlineCount: participants.filter(p => p.status === 'online').length,
        statusCounts: {
          online: participants.filter(p => p.status === 'online').length,
          away: participants.filter(p => p.status === 'away').length,
          offline: participants.filter(p => p.status === 'offline').length
        }
      }
    });

  } catch (error) {
    log.error('Failed to get participants:', LogContext.API, { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get participants',
      details: (error as Error).message
    });
  }
});

/**
 * Get workspace history
 */
router.get('/workspaces/:workspaceId/history', async (req: Request, res: Response) => {
  try {
    const { workspaceId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const types = req.query.types ? (req.query.types as string).split(',') : undefined;
    const fromVersion = req.query.fromVersion ? parseInt(req.query.fromVersion as string) : undefined;

    const offset = (page - 1) * limit;

    const history = await collaborationService.getWorkspaceHistory(workspaceId, {
      limit,
      offset,
      types,
      fromVersion
    });

    res.json({
      success: true,
      data: {
        workspaceId,
        events: history.events,
        pagination: {
          page,
          limit,
          total: history.total,
          hasMore: history.hasMore,
          totalPages: Math.ceil(history.total / limit)
        }
      }
    });

  } catch (error) {
    log.error('Failed to get workspace history:', LogContext.API, { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get workspace history',
      details: (error as Error).message
    });
  }
});

/**
 * Get workspace statistics
 */
router.get('/workspaces/:workspaceId/stats', async (req: Request, res: Response) => {
  try {
    const { workspaceId } = req.params;
    const days = parseInt(req.query.days as string) || 7;

    const workspace = await collaborationService.getWorkspace(workspaceId);
    if (!workspace) {
      return res.status(404).json({
        success: false,
        error: 'Workspace not found'
      });
    }

    // Calculate statistics from history
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const recentEvents = workspace.history.filter(event => event.timestamp >= cutoffDate);

    const stats = {
      totalEvents: recentEvents.length,
      eventsByType: recentEvents.reduce((acc, event) => {
        acc[event.type] = (acc[event.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      uniqueParticipants: new Set(recentEvents.map(event => event.userId)).size,
      averageEventsPerDay: recentEvents.length / days,
      mostActiveUser: null as string | null,
      activityByHour: new Array(24).fill(0),
      lastActivity: workspace.history.length > 0 
        ? workspace.history[workspace.history.length - 1].timestamp
        : workspace.createdAt
    };

    // Find most active user
    const userEventCounts = recentEvents.reduce((acc, event) => {
      acc[event.userId] = (acc[event.userId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    if (Object.keys(userEventCounts).length > 0) {
      stats.mostActiveUser = Object.entries(userEventCounts)
        .sort(([,a], [,b]) => b - a)[0][0];
    }

    // Activity by hour
    recentEvents.forEach(event => {
      const hour = event.timestamp.getHours();
      stats.activityByHour[hour]++;
    });

    res.json({
      success: true,
      data: {
        workspaceId,
        periodDays: days,
        stats
      }
    });

  } catch (error) {
    log.error('Failed to get workspace stats:', LogContext.API, { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get workspace stats',
      details: (error as Error).message
    });
  }
});

/**
 * List user workspaces
 */
router.get('/users/:userId/workspaces', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const type = req.query.type as string;

    // This would typically query the database
    // For now, return a mock response
    const workspaces = [
      {
        id: 'workspace-1',
        name: 'Team Project Discussion',
        type: 'chat',
        role: 'owner',
        participantCount: 5,
        lastActivity: new Date(Date.now() - 3600000).toISOString(),
        unreadCount: 2
      },
      {
        id: 'workspace-2',
        name: 'Code Review Session',
        type: 'code',
        role: 'editor',
        participantCount: 3,
        lastActivity: new Date(Date.now() - 7200000).toISOString(),
        unreadCount: 0
      }
    ];

    const filtered = type ? workspaces.filter(w => w.type === type) : workspaces;
    const paginatedResults = filtered.slice((page - 1) * limit, page * limit);

    res.json({
      success: true,
      data: {
        workspaces: paginatedResults,
        pagination: {
          page,
          limit,
          total: filtered.length,
          totalPages: Math.ceil(filtered.length / limit)
        }
      }
    });

  } catch (error) {
    log.error('Failed to get user workspaces:', LogContext.API, { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get user workspaces',
      details: (error as Error).message
    });
  }
});

/**
 * Health check for collaboration service
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    // Get service statistics
    const stats = {
      status: 'healthy',
      activeWorkspaces: 0, // Would be calculated from service
      activeConnections: 0, // Would be calculated from service
      totalWorkspaces: 0,
      uptime: process.uptime() * 1000,
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
      },
      features: {
        realTimeEditing: true,
        chatMessages: true,
        agentSharing: true,
        cursorTracking: true,
        persistence: true
      }
    };

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    log.error('Collaboration health check failed:', LogContext.API, { error });
    res.status(500).json({
      success: false,
      error: 'Health check failed',
      details: (error as Error).message
    });
  }
});

export default router;