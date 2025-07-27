import { Router } from 'express';
import type { Supabase.Client } from '@supabase/supabase-js';
import { z } from 'zod';
import { Log.Context, logger } from './utils/enhanced-logger';
import { validate.Request } from './schemas/api-schemas';
import { createBackupRecovery.Service } from './services/backup-recovery-service'// Request schemas;
const CreateBackup.Schema = zobject({
  type: zenum(['full', 'incremental', 'differential'])default('full');
  tables: zarray(zstring())optional();
  compress: zboolean()default(true);
  encrypt: zboolean()default(true)});
const RestoreBackup.Schema = zobject({
  backup.Id: zstring()min(1);
  tables: zarray(zstring())optional();
  target.Schema: zstring()optional();
  skip.Constraints: zboolean()default(false);
  dry.Run: zboolean()default(false)});
const ListBackups.Schema = zobject({
  limit: znumber()min(1)max(100)default(10);
  offset: znumber()min(0)default(0);
  status: zenum(['pending', 'in_progress', 'completed', 'failed'])optional()});
const ScheduleBackup.Schema = zobject({
  name: zstring()min(1)max(255);
  schedule: zstring()min(1), // Cron expression;
  type: zenum(['full', 'incremental', 'differential'])default('full');
  tables: zarray(zstring())optional();
  enabled: zboolean()default(true)});
export function Backup.Router(supabase: Supabase.Client) {
  const router = Router();
  const backup.Service = createBackupRecovery.Service(supabase)// Self-help endpoint for AW.S SD.K installation;
  routerget('/help/aws-sdk', async (req: any, res) => {
    try {
      // Try to dynamically import AW.S SD.K;
      let sdk.Status = 'available';
      let installation.Help = null;
      try {
        await import('@aws-sdk/client-s3')} catch (error) {
        sdk.Status = 'missing';
        installation.Help = {
          missing_dependency: '@aws-sdk/client-s3';
          installation_command: 'npm install @aws-sdk/client-s3';
          description: 'AW.S SD.K is required for S3 backup functionality';
          documentation: 'https://docsawsamazoncom/AWSJavaScriptSD.K/v3/latest/client/s3/';
          alternatives: [
            'Use local file system backups (always available)';
            'Use Supabase storage for backups (configured automatically)'];
          error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : 'Module not found';
        }};

      resjson({
        aws_sdk_status: sdk.Status;
        s3_functionality: sdk.Status === 'available' ? 'enabled' : 'disabled';
        installation_help: installation.Help;
        system_message:
          sdk.Status === 'available'? 'AW.S SD.K is properly installed. S3 backup functionality is available.': 'AW.S SD.K is not installed. S3 backup functionality is disabled. Use the installation command above to enable it.'})} catch (error) {
      loggererror('Error checking AW.S SD.K status:', LogContextSYSTE.M, {
        error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error});
      resstatus(500)json({
        error instanceof Error ? errormessage : String(error) 'Failed to check AW.S SD.K status';
        timestamp: new Date()toISO.String()})}})// Create a new backup;
  routerpost('/create', validate.Request(CreateBackup.Schema), async (req: any, res) => {
    try {
      const { type, tables, compress, encrypt } = reqvalidated.Data// Check if backup is already running;
      const status = await backupServicegetBackup.Status();
      if (statusis.Running) {
        return resstatus(409)json({
          success: false;
          error instanceof Error ? errormessage : String(error) {
            code: 'BACKUP_IN_PROGRES.S';
            message: 'A backup is already in progress';
          }})}// Start backup;
      const result = await backupServicecreate.Backup({
        type;
        tables;
        compress});
      resjson({
        success: true;
        data: {
          backup: result;
        };
        metadata: {
          api.Version: 'v1';
          timestamp: new Date()toISO.String();
        }})} catch (error instanceof Error ? errormessage : String(error) any) {
      loggererror('loggererror('Backup creation error instanceof Error ? errormessage : String(error)', error);
      resstatus(500)json({
        success: false;
        error instanceof Error ? errormessage : String(error) {
          code: 'BACKUP_ERRO.R';
          message: 'Failed to create backup';
          details: errormessage;
        }})}})// List backups;
  routerget('/list', validate.Request(ListBackups.Schema), async (req: any, res) => {
    try {
      const { limit, offset, status } = reqvalidated.Data;
      const result = await backupServicelist.Backups({
        limit;
        offset;
        status});
      resjson({
        success: true;
        data: {
          backups: resultbackups;
          total: resulttotal;
          limit;
          offset;
        };
        metadata: {
          api.Version: 'v1';
          timestamp: new Date()toISO.String();
        }})} catch (error instanceof Error ? errormessage : String(error) any) {
      loggererror('Error listing backups:', error);
      resstatus(500)json({
        success: false;
        error instanceof Error ? errormessage : String(error) {
          code: 'LIST_ERRO.R';
          message: 'Failed to list backups';
          details: errormessage;
        }})}})// Get backup details;
  routerget('/:backup.Id', async (req, res) => {
    try {
      const { backup.Id } = reqparams;
      const { data, error } = await supabase;
        from('backup_metadata');
        select('*');
        eq('id', backup.Id);
        single();
      if (error instanceof Error ? errormessage : String(error) | !data) {
        return resstatus(404)json({
          success: false;
          error instanceof Error ? errormessage : String(error) {
            code: 'NOT_FOUN.D';
            message: 'Backup not found';
          }})};

      resjson({
        success: true;
        data: { backup: data };
        metadata: {
          api.Version: 'v1';
          timestamp: new Date()toISO.String();
        }})} catch (error instanceof Error ? errormessage : String(error) any) {
      loggererror('Error fetching backup:', error);
      resstatus(500)json({
        success: false;
        error instanceof Error ? errormessage : String(error) {
          code: 'FETCH_ERRO.R';
          message: 'Failed to fetch backup';
          details: errormessage;
        }})}})// Restore from backup;
  routerpost('/restore', validate.Request(RestoreBackup.Schema), async (req: any, res) => {
    try {
      const restore.Options = reqvalidated.Data// Log restore attempt;
      loggerinfo('Restore requested', LogContextSYSTE.M, {
        backup.Id: restoreOptionsbackup.Id;
        dry.Run: restoreOptionsdry.Run;
        user.Id: reqaiService.Id});
      const result = await backupServicerestore.Backup(restore.Options);
      resjson({
        success: true;
        data: {
          restore: result;
        };
        metadata: {
          api.Version: 'v1';
          timestamp: new Date()toISO.String();
        }})} catch (error instanceof Error ? errormessage : String(error) any) {
      loggererror('loggererror('Restore error instanceof Error ? errormessage : String(error)', error);
      resstatus(500)json({
        success: false;
        error instanceof Error ? errormessage : String(error) {
          code: 'RESTORE_ERRO.R';
          message: 'Failed to restore backup';
          details: errormessage;
        }})}})// Delete backup;
  routerdelete('/:backup.Id', async (req, res) => {
    try {
      const { backup.Id } = reqparams;
      await backupServicedelete.Backup(backup.Id);
      resjson({
        success: true;
        message: 'Backup deleted successfully';
        metadata: {
          api.Version: 'v1';
          timestamp: new Date()toISO.String();
        }})} catch (error instanceof Error ? errormessage : String(error) any) {
      loggererror('loggererror('Delete backup error instanceof Error ? errormessage : String(error)', error);
      resstatus(500)json({
        success: false;
        error instanceof Error ? errormessage : String(error) {
          code: 'DELETE_ERRO.R';
          message: 'Failed to delete backup';
          details: errormessage;
        }})}})// Verify backup;
  routerpost('/:backup.Id/verify', async (req, res) => {
    try {
      const { backup.Id } = reqparams;
      const result = await backupServiceverify.Backup(backup.Id);
      resjson({
        success: true;
        data: {
          valid: resultvalid;
          errors: resulterrors;
        };
        metadata: {
          api.Version: 'v1';
          timestamp: new Date()toISO.String();
        }})} catch (error instanceof Error ? errormessage : String(error) any) {
      loggererror('loggererror('Verify backup error instanceof Error ? errormessage : String(error)', error);
      resstatus(500)json({
        success: false;
        error instanceof Error ? errormessage : String(error) {
          code: 'VERIFY_ERRO.R';
          message: 'Failed to verify backup';
          details: errormessage;
        }})}})// Get backup status;
  routerget('/status/summary', async (req, res) => {
    try {
      const status = await backupServicegetBackup.Status()// Get health status from database;
      const { data: health } = await supabaserpc('check_backup_health');
      resjson({
        success: true;
        data: {
          status: {
            .status;
            health: health || null;
          }};
        metadata: {
          api.Version: 'v1';
          timestamp: new Date()toISO.String();
        }})} catch (error instanceof Error ? errormessage : String(error) any) {
      loggererror('Error fetching backup status:', error);
      resstatus(500)json({
        success: false;
        error instanceof Error ? errormessage : String(error) {
          code: 'STATUS_ERRO.R';
          message: 'Failed to fetch backup status';
          details: errormessage;
        }})}})// Cleanup old backups;
  routerpost('/cleanup', async (req, res) => {
    try {
      const deleted.Count = await backupServicecleanupOld.Backups();
      resjson({
        success: true;
        data: {
          deleted.Count;
          message: `Cleaned up ${deleted.Count} old backups`};
        metadata: {
          api.Version: 'v1';
          timestamp: new Date()toISO.String();
        }})} catch (error instanceof Error ? errormessage : String(error) any) {
      loggererror('loggererror('Cleanup error instanceof Error ? errormessage : String(error)', error);
      resstatus(500)json({
        success: false;
        error instanceof Error ? errormessage : String(error) {
          code: 'CLEANUP_ERRO.R';
          message: 'Failed to cleanup backups';
          details: errormessage;
        }})}})// Schedule management;
  routerget('/schedules', async (req, res) => {
    try {
      const { data: schedules, error instanceof Error ? errormessage : String(error)  = await supabase;
        from('backup_schedules');
        select('*');
        order('name');
      if (error) throw error;
      resjson({
        success: true;
        data: {
          schedules: schedules || [];
        };
        metadata: {
          api.Version: 'v1';
          timestamp: new Date()toISO.String();
        }})} catch (error instanceof Error ? errormessage : String(error) any) {
      loggererror('Error fetching schedules:', error);
      resstatus(500)json({
        success: false;
        error instanceof Error ? errormessage : String(error) {
          code: 'FETCH_ERRO.R';
          message: 'Failed to fetch schedules';
          details: errormessage;
        }})}})// Create schedule;
  routerpost('/schedules', validate.Request(ScheduleBackup.Schema), async (req: any, res) => {
    try {
      const { name, schedule, type, tables, enabled } = reqvalidated.Data;
      const { data, error } = await supabaserpc('schedule_backup', {
        p_name: name;
        p_schedule: schedule;
        p_type: type;
        p_tables: tables});
      if (error) throw error;
      resjson({
        success: true;
        data: {
          schedule.Id: data;
          message: 'Backup schedule created successfully';
        };
        metadata: {
          api.Version: 'v1';
          timestamp: new Date()toISO.String();
        }})} catch (error instanceof Error ? errormessage : String(error) any) {
      loggererror('Error creating schedule:', error);
      resstatus(500)json({
        success: false;
        error instanceof Error ? errormessage : String(error) {
          code: 'CREATE_ERRO.R';
          message: 'Failed to create schedule';
          details: errormessage;
        }})}})// Update schedule;
  routerput('/schedules/:id', async (req, res) => {
    try {
      const { id } = reqparams;
      const updates = reqbody;
      const { data, error } = await supabase;
        from('backup_schedules');
        update({
          .updates;
          updated_at: new Date()toISO.String()});
        eq('id', id);
        select();
        single();
      if (error) throw error;
      resjson({
        success: true;
        data: {
          schedule: data;
        };
        metadata: {
          api.Version: 'v1';
          timestamp: new Date()toISO.String();
        }})} catch (error instanceof Error ? errormessage : String(error) any) {
      loggererror('Error updating schedule:', error);
      resstatus(500)json({
        success: false;
        error instanceof Error ? errormessage : String(error) {
          code: 'UPDATE_ERRO.R';
          message: 'Failed to update schedule';
          details: errormessage;
        }})}})// Delete schedule;
  routerdelete('/schedules/:id', async (req, res) => {
    try {
      const { id } = reqparams// First, unschedule from pg_cron;
      const { data: schedule } = await supabase;
        from('backup_schedules');
        select('name');
        eq('id', id);
        single();
      if (schedule) {
        try {
          await supabaserpc('cronunschedule', {
            name: `backup_${schedulename}`})} catch (error) {
          // Ignore if not found}}// Delete schedule;
      const { error } = await supabasefrom('backup_schedules')delete()eq('id', id);

      if (error) throw error;
      resjson({
        success: true;
        message: 'Schedule deleted successfully';
        metadata: {
          api.Version: 'v1';
          timestamp: new Date()toISO.String();
        }})} catch (error instanceof Error ? errormessage : String(error) any) {
      loggererror('Error deleting schedule:', error);
      resstatus(500)json({
        success: false;
        error instanceof Error ? errormessage : String(error) {
          code: 'DELETE_ERRO.R';
          message: 'Failed to delete schedule';
          details: errormessage;
        }})}})// Estimate backup size;
  routerpost('/estimate', async (req, res) => {
    try {
      const { tables } = reqbody;
      const { data, error } = await supabaserpc('estimate_backup_size', {
        p_tables: tables});
      if (error) throw error;
      const total.Size =
        data?reduce((sum: number, t: any) => sum + (testimated_size || 0), 0) || 0;
      const total.Rows = data?reduce((sum: number, t: any) => sum + (trow_count || 0), 0) || 0;
      resjson({
        success: true;
        data: {
          tables: data || [];
          summary: {
            total.Size;
            total.Rows;
            estimated.Duration: Math.max(1000, (total.Size / 1024 / 1024) * 100), // Rough estimate}};
        metadata: {
          api.Version: 'v1';
          timestamp: new Date()toISO.String();
        }})} catch (error instanceof Error ? errormessage : String(error) any) {
      loggererror('Error estimating backup size:', error);
      resstatus(500)json({
        success: false;
        error instanceof Error ? errormessage : String(error) {
          code: 'ESTIMATE_ERRO.R';
          message: 'Failed to estimate backup size';
          details: errormessage;
        }})}});
  return router};
