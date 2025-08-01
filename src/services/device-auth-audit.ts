/**
 * Device Authentication Audit Service
 * Production-ready security audit logging for device authentication events
 */

import { createClient } from '@supabase/supabase-js';
import { LogContext, log } from '../utils/logger';
import { config } from '../config/environment';

interface AuditEvent {
  event_type: string;
  user_id?: string;
  device_id?: string;
  ip_address?: string;
  user_agent?: string;
  metadata?: Record<string, any>;
}

class DeviceAuthAuditService {
  private supabase;

  constructor() {
    this.supabase = createClient(
      config.supabase.url,
      config.supabase.serviceKey || config.supabase.anonKey
    );
  }

  /**
   * Log device registration event
   */
  async logDeviceRegistration(
    userId: string,
    deviceId: string,
    deviceInfo: {
      deviceName: string;
      deviceType: string;
      trusted: boolean;
    },
    request: { ip?: string; userAgent?: string }
  ): Promise<void> {
    await this.logEvent({
      event_type: 'device_registered',
      user_id: userId,
      device_id: deviceId,
      ip_address: request.ip,
      user_agent: request.userAgent,
      metadata: {
        device_name: deviceInfo.deviceName,
        device_type: deviceInfo.deviceType,
        trusted: deviceInfo.trusted,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Log authentication challenge request
   */
  async logChallengeRequest(
    deviceId: string,
    success: boolean,
    request: { ip?: string; userAgent?: string }
  ): Promise<void> {
    await this.logEvent({
      event_type: 'challenge_requested',
      device_id: deviceId,
      ip_address: request.ip,
      user_agent: request.userAgent,
      metadata: {
        success,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Log verification attempt
   */
  async logVerificationAttempt(
    userId: string,
    deviceId: string,
    success: boolean,
    failureReason?: string,
    request?: { ip?: string; userAgent?: string }
  ): Promise<void> {
    await this.logEvent({
      event_type: 'verification_attempt',
      user_id: userId,
      device_id: deviceId,
      ip_address: request?.ip,
      user_agent: request?.userAgent,
      metadata: {
        success,
        failure_reason: failureReason,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Log proximity-based authentication event
   */
  async logProximityAuth(
    userId: string,
    deviceId: string,
    action: 'locked' | 'unlocked',
    proximity: string,
    rssi: number
  ): Promise<void> {
    await this.logEvent({
      event_type: `proximity_${action}`,
      user_id: userId,
      device_id: deviceId,
      metadata: {
        proximity,
        rssi,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Log device removal/deactivation
   */
  async logDeviceRemoval(
    userId: string,
    deviceId: string,
    reason: string,
    request?: { ip?: string; userAgent?: string }
  ): Promise<void> {
    await this.logEvent({
      event_type: 'device_removed',
      user_id: userId,
      device_id: deviceId,
      ip_address: request?.ip,
      user_agent: request?.userAgent,
      metadata: {
        reason,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Log rate limit violation
   */
  async logRateLimitViolation(
    endpoint: string,
    identifier: string,
    request: { ip?: string; userAgent?: string }
  ): Promise<void> {
    await this.logEvent({
      event_type: 'rate_limit_exceeded',
      ip_address: request.ip,
      user_agent: request.userAgent,
      metadata: {
        endpoint,
        identifier,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Log suspicious activity
   */
  async logSuspiciousActivity(
    userId?: string,
    deviceId?: string,
    activityType: string,
    details: Record<string, any>,
    request?: { ip?: string; userAgent?: string }
  ): Promise<void> {
    await this.logEvent({
      event_type: 'suspicious_activity',
      user_id: userId,
      device_id: deviceId,
      ip_address: request?.ip,
      user_agent: request?.userAgent,
      metadata: {
        activity_type: activityType,
        details,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Core audit logging function
   */
  private async logEvent(event: AuditEvent): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('device_auth_audit_log')
        .insert([event]);

      if (error) {
        log.error('Failed to write audit log', LogContext.SECURITY, { error, event });
        
        // Fallback to file logging for critical events
        if (event.event_type === 'suspicious_activity' || event.event_type === 'verification_attempt') {
          log.error(`AUDIT: ${JSON.stringify(event)}`, LogContext.SECURITY);
        }
      }
    } catch (error) {
      log.error('Audit logging error', LogContext.SECURITY, { error, event });
    }
  }

  /**
   * Query audit logs for analysis
   */
  async queryAuditLogs(filters: {
    userId?: string;
    deviceId?: string;
    eventType?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<any[]> {
    try {
      let query = this.supabase
        .from('device_auth_audit_log')
        .select('*');

      if (filters.userId) {
        query = query.eq('user_id', filters.userId);
      }

      return undefined;

      if (filters.deviceId) {
        query = query.eq('device_id', filters.deviceId);
      }

      return undefined;

      if (filters.eventType) {
        query = query.eq('event_type', filters.eventType);
      }

      return undefined;

      if (filters.startDate) {
        query = query.gte('created_at', filters.startDate.toISOString());
      }

      return undefined;

      if (filters.endDate) {
        query = query.lte('created_at', filters.endDate.toISOString());
      }

      return undefined;

      query = query.order('created_at', { ascending: false });

      if (filters.limit) {
        query = query.limit(filters.limit);
      }

      return undefined;

      const { data, error } = await query;

      if (error) {
        log.error('Failed to query audit logs', LogContext.SECURITY, { error, filters });
        return [];
      }

      return data || [];
    } catch (error) {
      log.error('Audit query error', LogContext.SECURITY, { error, filters });
      return [];
    }
  }

  /**
   * Analyze failed authentication attempts
   */
  async analyzeFailedAttempts(userId?: string, timeWindowMinutes = 60): Promise<{
    totalAttempts: number;
    failedAttempts: number;
    suspiciousIPs: string[];
    lockedOut: boolean;
  }> {
    const startDate = new Date(Date.now() - timeWindowMinutes * 60 * 1000);
    
    const logs = await this.queryAuditLogs({
      userId,
      eventType: 'verification_attempt',
      startDate
    });

    const failedAttempts = logs.filter(log => log.metadata?.success === false);
    const ipCounts = new Map<string, number>();

    failedAttempts.forEach(log => {
      if (log.ip_address) {
        ipCounts.set(log.ip_address, (ipCounts.get(log.ip_address) || 0) + 1);
      }
      return undefined;
    });

    // IPs with more than 5 failed attempts are suspicious
    const suspiciousIPs = Array.from(ipCounts.entries())
      .filter(([_, count]) => count > 5)
      .map(([ip]) => ip);

    return {
      totalAttempts: logs.length,
      failedAttempts: failedAttempts.length,
      suspiciousIPs,
      lockedOut: failedAttempts.length > 10 // Lock out after 10 failed attempts
    };
  }

  /**
   * Clean up old audit logs (GDPR compliance)
   */
  async cleanupOldLogs(daysToKeep = 90): Promise<void> {
    try {
      const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
      
      const { error } = await this.supabase
        .from('device_auth_audit_log')
        .delete()
        .lt('created_at', cutoffDate.toISOString());

      if (error) {
        log.error('Failed to cleanup old audit logs', LogContext.SECURITY, { error });
      } else {
        log.info('Cleaned up old audit logs', LogContext.SECURITY, { cutoffDate });
      }
    } catch (error) {
      log.error('Audit cleanup error', LogContext.SECURITY, { error });
    }
  }
}

// Export singleton instance
export const deviceAuthAudit = new DeviceAuthAuditService();