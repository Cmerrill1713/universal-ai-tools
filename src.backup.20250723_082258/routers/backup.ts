import { Router } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { LogContext, logger } from '../utils/enhanced-logger';
import { validateRequest } from '../schemas/api-schemas';
import { createBackupRecoveryService } from '../services/backup-recovery-service';

// Request schemas
const CreateBackupSchema = z.object({
  type: z.enum(['full', 'incremental', 'differential']).default('full'),
  tables: z.array(z.string()).optional(),
  compress: z.boolean().default(true),
  encrypt: z.boolean().default(true),
});

const RestoreBackupSchema = z.object({
  backupId: z.string().min(1),
  tables: z.array(z.string()).optional(),
  targetSchema: z.string().optional(),
  skipConstraints: z.boolean().default(false),
  dryRun: z.boolean().default(false),
});

const ListBackupsSchema = z.object({
  limit: z.number().min(1).max(100).default(10),
  offset: z.number().min(0).default(0),
  status: z.enum(['pending', 'in_progress', 'completed', 'failed']).optional(),
});

const ScheduleBackupSchema = z.object({
  name: z.string().min(1).max(255),
  schedule: z.string().min(1), // Cron expression
  type: z.enum(['full', 'incremental', 'differential']).default('full'),
  tables: z.array(z.string()).optional(),
  enabled: z.boolean().default(true),
});

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
      } catch (_error) {
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
          _error _errorinstanceof Error ? _errormessage : 'Module not found',
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
    } catch (_error) {
      logger.error'Error checking AWS SDK status:', LogContext.SYSTEM, {
        _error _errorinstanceof Error ? _errormessage : String(_error,
      });
      res.status(500).json({
        _error 'Failed to check AWS SDK status',
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
          _error {
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
    } catch (_error any) {
      logger.error'Backup creation _error', _error;
      res.status(500).json({
        success: false,
        _error {
          code: 'BACKUP_ERROR',
          message: 'Failed to create backup',
          details: _errormessage,
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
    } catch (_error any) {
      logger.error'Error listing backups:', _error;
      res.status(500).json({
        success: false,
        _error {
          code: 'LIST_ERROR',
          message: 'Failed to list backups',
          details: _errormessage,
        },
      });
    }
  });

  // Get backup details
  router.get('/:backupId', async (req, res) => {
    try {
      const { backupId } = req.params;

      const { data, _error} = await supabase
        .from('backup_metadata')
        .select('*')
        .eq('id', backupId)
        .single();

      if (_error|| !data) {
        return res.status(404).json({
          success: false,
          _error {
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
    } catch (_error any) {
      logger.error'Error fetching backup:', _error;
      res.status(500).json({
        success: false,
        _error {
          code: 'FETCH_ERROR',
          message: 'Failed to fetch backup',
          details: _errormessage,
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
    } catch (_error any) {
      logger.error'Restore _error', _error;
      res.status(500).json({
        success: false,
        _error {
          code: 'RESTORE_ERROR',
          message: 'Failed to restore backup',
          details: _errormessage,
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
    } catch (_error any) {
      logger.error'Delete backup _error', _error;
      res.status(500).json({
        success: false,
        _error {
          code: 'DELETE_ERROR',
          message: 'Failed to delete backup',
          details: _errormessage,
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
    } catch (_error any) {
      logger.error'Verify backup _error', _error;
      res.status(500).json({
        success: false,
        _error {
          code: 'VERIFY_ERROR',
          message: 'Failed to verify backup',
          details: _errormessage,
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
    } catch (_error any) {
      logger.error'Error fetching backup status:', _error;
      res.status(500).json({
        success: false,
        _error {
          code: 'STATUS_ERROR',
          message: 'Failed to fetch backup status',
          details: _errormessage,
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
    } catch (_error any) {
      logger.error'Cleanup _error', _error;
      res.status(500).json({
        success: false,
        _error {
          code: 'CLEANUP_ERROR',
          message: 'Failed to cleanup backups',
          details: _errormessage,
        },
      });
    }
  });

  // Schedule management
  router.get('/schedules', async (req, res) => {
    try {
      const { data: schedules, _error} = await supabase
        .from('backup_schedules')
        .select('*')
        .order('name');

      if (_error throw _error;

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
    } catch (_error any) {
      logger.error'Error fetching schedules:', _error;
      res.status(500).json({
        success: false,
        _error {
          code: 'FETCH_ERROR',
          message: 'Failed to fetch schedules',
          details: _errormessage,
        },
      });
    }
  });

  // Create schedule
  router.post('/schedules', validateRequest(ScheduleBackupSchema), async (req: any, res) => {
    try {
      const { name, schedule, type, tables, enabled } = req.validatedData;

      const { data, _error} = await supabase.rpc('schedule_backup', {
        p_name: name,
        p_schedule: schedule,
        p_type: type,
        p_tables: tables,
      });

      if (_error throw _error;

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
    } catch (_error any) {
      logger.error'Error creating schedule:', _error;
      res.status(500).json({
        success: false,
        _error {
          code: 'CREATE_ERROR',
          message: 'Failed to create schedule',
          details: _errormessage,
        },
      });
    }
  });

  // Update schedule
  router.put('/schedules/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const { data, _error} = await supabase
        .from('backup_schedules')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (_error throw _error;

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
    } catch (_error any) {
      logger.error'Error updating schedule:', _error;
      res.status(500).json({
        success: false,
        _error {
          code: 'UPDATE_ERROR',
          message: 'Failed to update schedule',
          details: _errormessage,
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
        } catch (_error) {
          // Ignore if not found
        }
      }

      // Delete schedule
      const { _error} = await supabase.from('backup_schedules').delete().eq('id', id);

      if (_error throw _error;

      res.json({
        success: true,
        message: 'Schedule deleted successfully',
        metadata: {
          apiVersion: 'v1',
          timestamp: new Date().toISOString(),
        },
      });
    } catch (_error any) {
      logger.error'Error deleting schedule:', _error;
      res.status(500).json({
        success: false,
        _error {
          code: 'DELETE_ERROR',
          message: 'Failed to delete schedule',
          details: _errormessage,
        },
      });
    }
  });

  // Estimate backup size
  router.post('/estimate', async (req, res) => {
    try {
      const { tables } = req.body;

      const { data, _error} = await supabase.rpc('estimate_backup_size', {
        p_tables: tables,
      });

      if (_error throw _error;

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
    } catch (_error any) {
      logger.error'Error estimating backup size:', _error;
      res.status(500).json({
        success: false,
        _error {
          code: 'ESTIMATE_ERROR',
          message: 'Failed to estimate backup size',
          details: _errormessage,
        },
      });
    }
  });

  return router;
}
