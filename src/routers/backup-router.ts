export function BackupRouter(supabase: SupabaseClient) {
  const router = Router();
  const backupService = createBackupRecoveryService(supabase);

  // Self-help endpoint for AWS SDK installation
  router.get('/help/aws-sdk', async (req: any, res) => {
    try {
      // Try to dynamically import AWS SDK
      let sdkStatus = 'available';
      let installationHelp = null;

      try {
        await import('@aws-sdk/client-s3');
      } catch (error) {
        sdkStatus = 'missing';
        installationHelp = {
          missing_dependency: '@aws-sdk/client-s3',
          installation_command: 'npm install @aws-sdk/client-s3',
          description: 'AWS SDK is required for S3 backup functionality',
          documentation: 'https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/s3/',
          alternatives: [
            'Use local file system backups (always available)',
            'Use Supabase storage for backups (configured automatically)',
          ],
          error errorinstanceof Error ? errormessage : 'Module not found',
        };
      }

      res.json({
        aws_sdk_status: sdkStatus,
        s3_functionality: sdkStatus === 'available' ? 'enabled' : 'disabled',
        installation_help: installationHelp,
        system_message:
          sdkStatus === 'available'
            ? 'AWS SDK is properly installed. S3 backup functionality is available.'
            : 'AWS SDK is not installed. S3 backup functionality is disabled. Use the installation command above to enable it.',
      });
    } catch (error) {
      logger.error(Error checking AWS SDK status:', LogContext.SYSTEM, {
        error errorinstanceof Error ? errormessage : String(error,
      });
      res.status(500).json({
        error 'Failed to check AWS SDK status',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Create a new backup
  router.post('/create', validateRequest(CreateBackupSchema), async (req: any, res) => {
    try {
      const { type, tables, compress, encrypt } = req.validatedData;

      // Check if backup is already running
      const status = await backupService.getBackupStatus();
      if (status.isRunning) {
        return res.status(409).json({
          success: false,
          error {
            code: 'BACKUP_IN_PROGRESS',
            message: 'A backup is already in progress',
          },
        });
      }

      // Start backup
      const result = await backupService.createBackup({
        type,
        tables,
        compress,
      });

      res.json({
        success: true,
        data: {
          backup: result,
        },
        metadata: {
          apiVersion: 'v1',
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error any) {
      logger.error(Backup creation error', error;
      res.status(500).json({
        success: false,
        error {
          code: 'BACKUP_ERROR',
          message: 'Failed to create backup',
          details: errormessage,
        },
      });
    }
  });

  // List backups
  router.get('/list', validateRequest(ListBackupsSchema), async (req: any, res) => {
    try {
      const { limit, offset, status } = req.validatedData;

      const result = await backupService.listBackups({
        limit,
        offset,
        status,
      });

      res.json({
        success: true,
        data: {
          backups: result.backups,
          total: result.total,
          limit,
          offset,
        },
        metadata: {
          apiVersion: 'v1',
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error any) {
      logger.error(Error listing backups:', error;
      res.status(500).json({
        success: false,
        error {
          code: 'LIST_ERROR',
          message: 'Failed to list backups',
          details: errormessage,
        },
      });
    }
  });

  // Get backup details
  router.get('/:backupId', async (req, res) => {
    try {
      const { backupId } = req.params;

      const { data, error} = await supabase
        .from('backup_metadata')
        .select('*')
        .eq('id', backupId)
        .single();

      if (error|| !data) {
        return res.status(404).json({
          success: false,
          error {
            code: 'NOT_FOUND',
            message: 'Backup not found',
          },
        });
      }

      res.json({
        success: true,
        data: { backup: data },
        metadata: {
          apiVersion: 'v1',
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error any) {
      logger.error(Error fetching backup:', error;
      res.status(500).json({
        success: false,
        error {
          code: 'FETCH_ERROR',
          message: 'Failed to fetch backup',
          details: errormessage,
        },
      });
    }
  });

  // Restore from backup
  router.post('/restore', validateRequest(RestoreBackupSchema), async (req: any, res) => {
    try {
      const restoreOptions = req.validatedData;

      // Log restore attempt
      logger.info('Restore requested', LogContext.SYSTEM, {
        backupId: restoreOptions.backupId,
        dryRun: restoreOptions.dryRun,
        userId: req.aiServiceId,
      });

      const result = await backupService.restoreBackup(restoreOptions);

      res.json({
        success: true,
        data: {
          restore: result,
        },
        metadata: {
          apiVersion: 'v1',
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error any) {
      logger.error(Restore error', error;
      res.status(500).json({
        success: false,
        error {
          code: 'RESTORE_ERROR',
          message: 'Failed to restore backup',
          details: errormessage,
        },
      });
    }
  });

  // Delete backup
  router.delete('/:backupId', async (req, res) => {
    try {
      const { backupId } = req.params;

      await backupService.deleteBackup(backupId);

      res.json({
        success: true,
        message: 'Backup deleted successfully',
        metadata: {
          apiVersion: 'v1',
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error any) {
      logger.error(Delete backup error', error;
      res.status(500).json({
        success: false,
        error {
          code: 'DELETE_ERROR',
          message: 'Failed to delete backup',
          details: errormessage,
        },
      });
    }
  });

  // Verify backup
  router.post('/:backupId/verify', async (req, res) => {
    try {
      const { backupId } = req.params;

      const result = await backupService.verifyBackup(backupId);

      res.json({
        success: true,
        data: {
          valid: result.valid,
          errors: result.errors,
        },
        metadata: {
          apiVersion: 'v1',
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error any) {
      logger.error(Verify backup error', error;
      res.status(500).json({
        success: false,
        error {
          code: 'VERIFY_ERROR',
          message: 'Failed to verify backup',
          details: errormessage,
        },
      });
    }
  });

  // Get backup status
  router.get('/status/summary', async (req, res) => {
    try {
      const status = await backupService.getBackupStatus();

      // Get health status from database
      const { data: health } = await supabase.rpc('check_backup_health');

      res.json({
        success: true,
        data: {
          status: {
            ...status,
            health: health || null,
          },
        },
        metadata: {
          apiVersion: 'v1',
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error any) {
      logger.error(Error fetching backup status:', error;
      res.status(500).json({
        success: false,
        error {
          code: 'STATUS_ERROR',
          message: 'Failed to fetch backup status',
          details: errormessage,
        },
      });
    }
  });

  // Cleanup old backups
  router.post('/cleanup', async (req, res) => {
    try {
      const deletedCount = await backupService.cleanupOldBackups();

      res.json({
        success: true,
        data: {
          deletedCount,
          message: `Cleaned up ${deletedCount} old backups`,
        },
        metadata: {
          apiVersion: 'v1',
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error any) {
      logger.error(Cleanup error', error;
      res.status(500).json({
        success: false,
        error {
          code: 'CLEANUP_ERROR',
          message: 'Failed to cleanup backups',
          details: errormessage,
        },
      });
    }
  });

  // Schedule management
  router.get('/schedules', async (req, res) => {
    try {
      const { data: schedules, error} = await supabase
        .from('backup_schedules')
        .select('*')
        .order('name');

      if (error throw error

      res.json({
        success: true,
        data: {
          schedules: schedules || [],
        },
        metadata: {
          apiVersion: 'v1',
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error any) {
      logger.error(Error fetching schedules:', error;
      res.status(500).json({
        success: false,
        error {
          code: 'FETCH_ERROR',
          message: 'Failed to fetch schedules',
          details: errormessage,
        },
      });
    }
  });

  // Create schedule
  router.post('/schedules', validateRequest(ScheduleBackupSchema), async (req: any, res) => {
    try {
      const { name, schedule, type, tables, enabled } = req.validatedData;

      const { data, error} = await supabase.rpc('schedule_backup', {
        p_name: name,
        p_schedule: schedule,
        p_type: type,
        p_tables: tables,
      });

      if (error throw error

      res.json({
        success: true,
        data: {
          scheduleId: data,
          message: 'Backup schedule created successfully',
        },
        metadata: {
          apiVersion: 'v1',
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error any) {
      logger.error(Error creating schedule:', error;
      res.status(500).json({
        success: false,
        error {
          code: 'CREATE_ERROR',
          message: 'Failed to create schedule',
          details: errormessage,
        },
      });
    }
  });

  // Update schedule
  router.put('/schedules/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const { data, error} = await supabase
        .from('backup_schedules')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error throw error

      res.json({
        success: true,
        data: {
          schedule: data,
        },
        metadata: {
          apiVersion: 'v1',
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error any) {
      logger.error(Error updating schedule:', error;
      res.status(500).json({
        success: false,
        error {
          code: 'UPDATE_ERROR',
          message: 'Failed to update schedule',
          details: errormessage,
        },
      });
    }
  });

  // Delete schedule
  router.delete('/schedules/:id', async (req, res) => {
    try {
      const { id } = req.params;

      // First, unschedule from pg_cron
      const { data: schedule } = await supabase
        .from('backup_schedules')
        .select('name')
        .eq('id', id)
        .single();

      if (schedule) {
        try {
          await supabase.rpc('cron.unschedule', {
            name: `backup_${schedule.name}`,
          });
        } catch (error) {
          // Ignore if not found
        }
      }

      // Delete schedule
      const { error} = await supabase.from('backup_schedules').delete().eq('id', id);

      if (error throw error

      res.json({
        success: true,
        message: 'Schedule deleted successfully',
        metadata: {
          apiVersion: 'v1',
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error any) {
      logger.error(Error deleting schedule:', error;
      res.status(500).json({
        success: false,
        error {
          code: 'DELETE_ERROR',
          message: 'Failed to delete schedule',
          details: errormessage,
        },
      });
    }
  });

  // Estimate backup size
  router.post('/estimate', async (req, res) => {
    try {
      const { tables } = req.body;

      const { data, error} = await supabase.rpc('estimate_backup_size', {
        p_tables: tables,
      });

      if (error throw error

      const totalSize =
        data?.reduce((sum: number, t: any) => sum + (t.estimated_size || 0), 0) || 0;
      const totalRows = data?.reduce((sum: number, t: any) => sum + (t.row_count || 0), 0) || 0;

      res.json({
        success: true,
        data: {
          tables: data || [],
          summary: {
            totalSize,
            totalRows,
            estimatedDuration: Math.max(1000, (totalSize / 1024 / 1024) * 100), // Rough estimate
          },
        },
        metadata: {
          apiVersion: 'v1',
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error any) {
      logger.error(Error estimating backup size:', error;
      res.status(500).json({
        success: false,
        error {
          code: 'ESTIMATE_ERROR',
          message: 'Failed to estimate backup size',
          details: errormessage,
        },
      });
    }
  });

  return router;
}
/**
 * Knowledge Monitoring Router with Lazy Initialization
 * API endpoints for knowledge base health monitoring and management
 */

import type { Request, Response } from 'express';
import { Router } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';
import { initializeWithTimeout } from '../utils/timeout-utils';

// Lazy-loaded services
let knowledgeManager: any = null;
let feedbackService: any = null;
let updateAutomation: any = null;
let knowledgeScraperService: any = null;
let knowledgeValidationService: any = null;
let servicesInitialized = false;
let initializationPromise: Promise<boolean> | null = null;

async function initializeServices(supabase: SupabaseClient): Promise<boolean> {
  if (servicesInitialized) return true;

  // Return existing promise if initialization is already in progress
  if (initializationPromise) return initializationPromise;

  initializationPromise = (async () => {
    try {
      logger.info('Lazy loading knowledge monitoring services...');

      // Import services
      const [
        { DSPyKnowledgeManager },
        { createKnowledgeFeedbackService },
        knowledgeScraperModule,
        { createKnowledgeUpdateAutomation },
        knowledgeValidationModule,
      ] = await Promise.all([
        import('../core/knowledge/dspy-knowledge-manager'),
        import('../services/knowledge-feedback-service'),
        import('../services/knowledge-scraper-service'),
        import('../services/knowledge-update-automation'),
        import('../services/knowledge-validation-service'),
      ]);

      knowledgeScraperService = knowledgeScraperModule.knowledgeScraperService;
      knowledgeValidationService = knowledgeValidationModule.knowledgeValidationService;

      // Initialize services with timeout protection
      knowledgeManager = await initializeWithTimeout(
        async () => new DSPyKnowledgeManager({}),
        'DSPyKnowledgeManager',
        5000
      );

      feedbackService = await initializeWithTimeout(
        async () => createKnowledgeFeedbackService(supabase, logger),
        'KnowledgeFeedbackService',
        5000
      );

      if (knowledgeManager && feedbackService) {
        updateAutomation = await initializeWithTimeout(
          async () =>
            createKnowledgeUpdateAutomation(
              knowledgeScraperService,
              knowledgeValidationService,
              feedbackService,
              knowledgeManager
            ),
          'KnowledgeUpdateAutomation',
          5000
        );
      }

      servicesInitialized = !!(knowledgeManager && feedbackService && updateAutomation);
      return servicesInitialized;
    } catch (error) {
      logger.error(Failed to initialize knowledge monitoring services:', {
        error errorinstanceof Error ? errormessage : String(error,
      });
      return false;
    }
  })();

  return initializationPromise;
}

// Helper function to ensure services are initialized
async function ensureServicesInitialized(
  supabase: SupabaseClient,
  res: Response
): Promise<boolean> {
  if (!servicesInitialized) {
    const initialized = await initializeServices(supabase);
    if (!initialized) {
      res.status(503).json({
        error 'Knowledge monitoring services are not available',
        message: 'The service is still initializing or failed to start',
      });
      return false;
    }
  }
  return true;
}

// Time range helper
function getTimeSince(timeRange: string): Date {
  const now = new Date();
  const ranges: Record<string, number> = {
    '1h': 60 * 60 * 1000,
    '6h': 6 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
  };

  const offset = ranges[timeRange] || ranges['24h'];
  return new Date(now.getTime() - offset);
}

export default function createKnowledgeMonitoringRouter(supabase: SupabaseClient) {
  const router = Router();

  /**
   * GET /api/knowledge-monitoring/status
   * Get service initialization status
   */
  router.get('/status', async (req: Request, res: Response) => {
    res.json({
      initialized: servicesInitialized,
      services: {
        knowledgeManager: !!knowledgeManager,
        feedbackService: !!feedbackService,
        updateAutomation: !!updateAutomation,
      },
    });
  });

  /**
   * GET /api/knowledge-monitoring/dashboard
   * Get comprehensive dashboard data
   */
  router.get('/dashboard', async (req: Request, res: Response) => {
    if (!(await ensureServicesInitialized(supabase, res))) return;

    try {
      const timeRange = (req.query.timeRange as string) || '24h';
      const since = getTimeSince(timeRange);

      // Fetch all dashboard data in parallel
      const [
        overview,
        sourceHealth,
        validationMetrics,
        usageAnalytics,
        performanceMetrics,
        activeAlerts,
        updateQueue,
        insights,
      ] = await Promise.all([
        feedbackService.getSystemOverview(since),
        feedbackService.getSourceHealthMetrics(since),
        knowledgeValidationService.getValidationMetrics(since),
        feedbackService.getUsageAnalytics(since),
        knowledgeManager.getPerformanceMetrics(),
        knowledgeValidationService.getActiveAlerts(),
        updateAutomation.getUpdateQueue(),
        feedbackService.generateInsights(),
      ]);

      res.json({
        timestamp: new Date().toISOString(),
        timeRange,
        overview,
        sourceHealth,
        validationMetrics,
        usageAnalytics,
        performanceMetrics,
        activeAlerts,
        updateQueue,
        insights,
      });
    } catch (error) {
      logger.error(Dashboard data fetch failed:', error;
      res.status(500).json({
        error 'Failed to fetch dashboard data',
        details: errorinstanceof Error ? errormessage : 'Unknown error,
      });
    }
  });

  // Add other routes similarly with lazy initialization checks...
  // (Keeping the router small for this example, but all routes should follow this _pattern

  return router;
}
/**
 * Athena Tools API Router
 *
 * Unified API for Sweet Athena's conversation and tool creation capabilities
 */

import type { Request, Response } from 'express';
import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';
import { AthenaToolIntegrationService } from '../services/athena-tool-integration';
import AuthMiddleware, { type AuthRequest } from '../middleware/auth';
import ValidationMiddleware from '../middleware/validation';
import type { ConversationRequest } from '../services/athena-conversation-engine';
import { z } from 'zod';

const router = Router();

// Initialize services
let athenaToolService: AthenaToolIntegrationService;
let authMiddleware: AuthMiddleware;

// Initialize auth middleware
const initAuthMiddleware = () => {
  if (!authMiddleware) {
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    authMiddleware = new AuthMiddleware(supabase);
  }
  return authMiddleware;
};

// Initialize on first request
const ensureInitialized = async () => {
  if (!athenaToolService) {
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    athenaToolService = new AthenaToolIntegrationService(supabase, logger);
    await athenaToolService.initialize();
  }
};

/**
 * Process a conversation message (might lead to tool creation)
 */
router.post(
  '/chat',
  (req, res, next) => initAuthMiddleware().authenticate()(req as AuthRequest, res, next),
  ValidationMiddleware.validate({
    body: z.object({
      message: z.string().min(1),
      conversationId: z.string().optional(),
      context: z.object({}).optional(),
    }),
  }),
  async (req: Request, res: Response) => {
    try {
      await ensureInitialized();

      const { message, conversationId, context } = req.body;
      const userId = (req as any).user?.id || 'anonymous';

      const _request ConversationRequest = {
        userId,
        conversationId: conversationId || `conv_${Date.now()}`,
        message,
        context,
      };

      const response = await athenaToolService.processMessage(_request;

      res.json({
        success: true,
        response,
      });
    } catch (error) {
      logger.error(Error processing Athena chat:', error;
      res.status(500).json({
        success: false,
        error 'Failed to process message',
      });
    }
  }
);

/**
 * Get active tool creation sessions for a user
 */
router.get(
  '/tool-sessions',
  (req, res, next) => initAuthMiddleware().authenticate()(req as AuthRequest, res, next),
  async (req: Request, res: Response) => {
    try {
      await ensureInitialized();

      const userId = (req as any).user?.id;
      const supabaseUrl = process.env.SUPABASE_URL || '';
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const { data: sessions, error} = await supabase
        .from('athena_tool_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error {
        throw error
      }

      res.json({
        success: true,
        sessions: sessions || [],
      });
    } catch (error) {
      logger.error(Error fetching tool sessions:', error;
      res.status(500).json({
        success: false,
        error 'Failed to fetch tool sessions',
      });
    }
  }
);

/**
 * Get user's created tools
 */
router.get(
  '/my-tools',
  (req, res, next) => initAuthMiddleware().authenticate()(req as AuthRequest, res, next),
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      const supabaseUrl = process.env.SUPABASE_URL || '';
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const { data: tools, error} = await supabase
        .from('ai_custom_tools')
        .select('*')
        .eq('created_by', userId)
        .order('created_at', { ascending: false });

      if (error {
        throw error
      }

      res.json({
        success: true,
        tools: tools || [],
      });
    } catch (error) {
      logger.error(Error fetching user tools:', error;
      res.status(500).json({
        success: false,
        error 'Failed to fetch tools',
      });
    }
  }
);

/**
 * Get tool templates
 */
router.get(
  '/templates',
  (req, res, next) => initAuthMiddleware().authenticate()(req as AuthRequest, res, next),
  async (req: Request, res: Response) => {
    try {
      const supabaseUrl = process.env.SUPABASE_URL || '';
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const { data: templates, error} = await supabase
        .from('ai_tool_templates')
        .select('*')
        .order('category', { ascending: true });

      if (error {
        throw error
      }

      res.json({
        success: true,
        templates: templates || [],
      });
    } catch (error) {
      logger.error(Error fetching tool templates:', error;
      res.status(500).json({
        success: false,
        error 'Failed to fetch templates',
      });
    }
  }
);

/**
 * Deploy a tool
 */
router.post(
  '/deploy/:toolId',
  (req, res, next) => initAuthMiddleware().authenticate()(req as AuthRequest, res, next),
  ValidationMiddleware.validate({
    body: z.object({
      target: z.enum(['local', 'api', 'function']),
    }),
  }),
  async (req: Request, res: Response) => {
    try {
      await ensureInitialized();

      const { toolId } = req.params;
      const { target } = req.body;
      const userId = (req as any).user?.id;

      // Verify tool ownership
      const supabaseUrl = process.env.SUPABASE_URL || '';
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const { data: tool, error} = await supabase
        .from('ai_custom_tools')
        .select('*')
        .eq('id', toolId)
        .eq('created_by', userId)
        .single();

      if (error|| !tool) {
        return res.status(404).json({
          success: false,
          error 'Tool not found',
        });
      }

      // Deploy through tool maker agent
      const deploymentRequest: ConversationRequest = {
        userId,
        conversationId: `deploy_${toolId}`,
        message: `Deploy tool ${toolId} to ${target}`,
      };

      const response = await athenaToolService.processMessage(deploymentRequest);

      res.json({
        success: true,
        deployment: response,
      });
    } catch (error) {
      logger.error(Error deploying tool:', error;
      res.status(500).json({
        success: false,
        error 'Failed to deploy tool',
      });
    }
  }
);

/**
 * Get conversation history
 */
router.get(
  '/conversations/:conversationId',
  (req, res, next) => initAuthMiddleware().authenticate()(req as AuthRequest, res, next),
  async (req: Request, res: Response) => {
    try {
      const { conversationId } = req.params;
      const userId = (req as any).user?.id;

      const supabaseUrl = process.env.SUPABASE_URL || '';
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const { data: messages, error} = await supabase
        .from('athena_conversations')
        .select('*')
        .eq('user_id', userId)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error {
        throw error
      }

      res.json({
        success: true,
        messages: messages || [],
      });
    } catch (error) {
      logger.error(Error fetching conversation:', error;
      res.status(500).json({
        success: false,
        error 'Failed to fetch conversation',
      });
    }
  }
);

/**
 * Cancel a tool creation session
 */
router.post(
  '/tool-sessions/:sessionId/cancel',
  (req, res, next) => initAuthMiddleware().authenticate()(req as AuthRequest, res, next),
  async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const userId = (req as any).user?.id;

      const supabaseUrl = process.env.SUPABASE_URL || '';
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const { error} = await supabase
        .from('athena_tool_sessions')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', sessionId)
        .eq('user_id', userId);

      if (error {
        throw error
      }

      res.json({
        success: true,
        message: 'Tool creation session cancelled',
      });
    } catch (error) {
      logger.error(Error cancelling session:', error;
      res.status(500).json({
        success: false,
        error 'Failed to cancel session',
      });
    }
  }
);

export default router;
import { Router } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { validateRequest } from '../schemas/api-schemas';

// Request schemas
const SearchDocsSchema = z.object({
  query: z.string().min(1).max(500),
  category: z.string().optional(),
  language: z.string().optional(),
  tags: z.array(z.string()).optional(),
  limit: z.number().min(1).max(50).default(10),
});

const GetFeatureDocsSchema = z.object({
  category: z.string().optional(),
  includeExamples: z.boolean().default(true),
});

const GetIntegrationPatternsSchema = z.object({
  language: z.string().optional(),
  framework: z.string().optional(),
  features: z.array(z.string()).optional(),
});

