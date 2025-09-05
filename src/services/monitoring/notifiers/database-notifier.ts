/**
 * Database Alert Notifier
 * Stores alerts in database for persistence and querying
 */

import { Logger } from '../../../utils/logger';
import type { Alert, AlertChannel, AlertNotifier } from '../types';

export class DatabaseAlertNotifier implements AlertNotifier {
  public readonly type = 'database';
  private readonly logger: Logger;
  private supabase: any = null;

  constructor() {
    this.logger = new Logger('DatabaseAlertNotifier');
    this.initializeSupabase();
  }

  private async initializeSupabase(): Promise<void> {
    try {
      // Dynamic import to avoid dependency issues
      const { supabaseClient } = await import('../../../services/supabase-client');
      this.supabase = supabaseClient;

      if (this.supabase) {
        this.logger.info('Database notifier connected to Supabase');
      }
    } catch (error) {
      this.logger.warn('Supabase not available for database notifications', error);
    }
  }

  async send(alert: Alert, channel: AlertChannel): Promise<boolean> {
    if (!this.supabase) {
      this.logger.warn('Database not available for alert notification');
      return false;
    }

    try {
      const alertRecord = {
        alert_id: alert.id,
        rule_id: alert.ruleId,
        status: alert.status,
        severity: alert.severity,
        message: alert.message,
        start_time: alert.startTime.toISOString(),
        end_time: alert.endTime?.toISOString(),
        acknowledged_by: alert.acknowledgedBy,
        acknowledged_at: alert.acknowledgedAt?.toISOString(),
        metadata: alert.metadata || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Insert or upsert the alert record
      const { error } = await this.supabase.from('monitoring_alerts').upsert(alertRecord, {
        onConflict: 'alert_id',
        ignoreDuplicates: false,
      });

      if (error) {
        throw error;
      }

      // Also create an alert event record for timeline tracking
      const eventRecord = {
        alert_id: alert.id,
        event_type: alert.status,
        event_time: new Date().toISOString(),
        details: {
          severity: alert.severity,
          message: alert.message,
          channel_type: this.type,
          channel_config: channel.config,
        },
        created_at: new Date().toISOString(),
      };

      const { error: eventError } = await this.supabase
        .from('monitoring_alert_events')
        .insert(eventRecord);

      if (eventError) {
        this.logger.warn('Failed to create alert event record', eventError);
        // Don't fail the whole notification for event recording issues
      }

      this.logger.debug(`Stored alert ${alert.id} in database`);
      return true;
    } catch (error) {
      this.logger.error('Failed to send database alert notification', error);
      return false;
    }
  }

  async test(channel: AlertChannel): Promise<boolean> {
    if (!this.supabase) {
      this.logger.error('Database not available for testing');
      return false;
    }

    try {
      // Test database connectivity
      const { data, error } = await this.supabase
        .from('monitoring_alerts')
        .select('count')
        .limit(1);

      if (error) {
        throw error;
      }

      // Send a test alert
      const testAlert: Alert = {
        id: `test-${Date.now()}`,
        ruleId: 'test-rule',
        status: 'firing',
        severity: 'info',
        message: 'Database notifier connectivity test',
        startTime: new Date(),
      };

      const success = await this.send(testAlert, channel);

      if (success) {
        // Clean up test alert
        await this.supabase.from('monitoring_alerts').delete().eq('alert_id', testAlert.id);

        await this.supabase.from('monitoring_alert_events').delete().eq('alert_id', testAlert.id);

        this.logger.info('✅ Database notifier test successful');
      }

      return success;
    } catch (error) {
      this.logger.error('❌ Database notifier test failed', error);
      return false;
    }
  }

  // Additional utility methods for database operations
  async getAlertHistory(alertId: string): Promise<any[]> {
    if (!this.supabase) {
      return [];
    }

    try {
      const { data, error } = await this.supabase
        .from('monitoring_alert_events')
        .select('*')
        .eq('alert_id', alertId)
        .order('event_time', { ascending: true });

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      this.logger.error(`Failed to get alert history for ${alertId}`, error);
      return [];
    }
  }

  async getActiveAlerts(): Promise<any[]> {
    if (!this.supabase) {
      return [];
    }

    try {
      const { data, error } = await this.supabase
        .from('monitoring_alerts')
        .select('*')
        .eq('status', 'firing')
        .order('start_time', { ascending: false });

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      this.logger.error('Failed to get active alerts', error);
      return [];
    }
  }

  async getAlertsByTimeRange(start: Date, end: Date): Promise<any[]> {
    if (!this.supabase) {
      return [];
    }

    try {
      const { data, error } = await this.supabase
        .from('monitoring_alerts')
        .select('*')
        .gte('start_time', start.toISOString())
        .lte('start_time', end.toISOString())
        .order('start_time', { ascending: false });

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      this.logger.error('Failed to get alerts by time range', error);
      return [];
    }
  }

  async updateAlertStatus(
    alertId: string,
    status: 'firing' | 'resolved',
    metadata?: any
  ): Promise<boolean> {
    if (!this.supabase) {
      return false;
    }

    try {
      const updates: any = {
        status,
        updated_at: new Date().toISOString(),
      };

      if (status === 'resolved') {
        updates.end_time = new Date().toISOString();
      }

      if (metadata) {
        updates.metadata = metadata;
      }

      const { error } = await this.supabase
        .from('monitoring_alerts')
        .update(updates)
        .eq('alert_id', alertId);

      if (error) {
        throw error;
      }

      // Create status change event
      const eventRecord = {
        alert_id: alertId,
        event_type: status,
        event_time: new Date().toISOString(),
        details: { status, metadata },
        created_at: new Date().toISOString(),
      };

      await this.supabase.from('monitoring_alert_events').insert(eventRecord);

      this.logger.debug(`Updated alert ${alertId} status to ${status}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to update alert ${alertId} status`, error);
      return false;
    }
  }

  // Database schema creation helper
  async ensureTablesExist(): Promise<void> {
    if (!this.supabase) {
      return;
    }

    try {
      // Check if tables exist by trying to select from them
      const { error: alertsError } = await this.supabase
        .from('monitoring_alerts')
        .select('count')
        .limit(1);

      const { error: eventsError } = await this.supabase
        .from('monitoring_alert_events')
        .select('count')
        .limit(1);

      if (alertsError || eventsError) {
        this.logger.warn(
          'Monitoring database tables may not exist. Please run database migrations.'
        );
      } else {
        this.logger.info('Monitoring database tables are available');
      }
    } catch (error) {
      this.logger.error('Failed to check monitoring database tables', error);
    }
  }
}
