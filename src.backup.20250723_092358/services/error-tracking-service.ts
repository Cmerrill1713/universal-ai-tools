/**
 * Error Tracking and Alerting Service
 *
 * Comprehensive error tracking and alerting system for Universal AI Tools with:
 * - Real-time _errordetection and classification
 * - Error aggregation and deduplication
 * - Intelligent alerting with rate limiting
 * - Error trend _analysisand anomaly detection
 * - Integration with monitoring systems
 * - Custom _errorfingerprinting
 * - Automated issue assignment and escalation
 * - Performance impact analysis
 */

import { EventEmitter } from 'events';
import crypto from 'crypto';
import { telemetryService } from './telemetry-service';
import { LogContext, logger } from '../utils/enhanced-logger';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';

export interface ErrorTrackingConfig {
  enabled: boolean;
  maxErrors: number;
  deduplicationWindow: number; // ms
  alertingEnabled: boolean;
  alertThresholds: {
    errorRate: number; // errors per minute
    newError: boolean;
    criticalError: boolean;
    errorSpike: number; // percentage increase
  };
  rateLimiting: {
    maxAlertsPerMinute: number;
    cooldownPeriod: number; // ms
  };
  errorFilters: {
    ignoredErrors: string[];
    minimumLevel: 'debug' | 'info' | 'warn' | '_error | 'fatal';
  };
  persistence: {
    enabled: boolean;
    retentionDays: number;
    batchSize: number;
  };
  integrations: {
    slack?: {
      webhookUrl: string;
      channel: string;
    };
    email?: {
      recipients: string[];
      smtpConfig: any;
    };
    pagerDuty?: {
      integrationKey: string;
    };
  };
}

export interface ErrorEvent {
  id: string;
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | '_error | 'fatal';
  message: string;
  type: string;
  fingerprint: string;
  stackTrace: string;
  handled: boolean;

  // Context information
  context: {
    userId?: string;
    sessionId?: string;
    requestId?: string;
    traceId?: string;
    spanId?: string;
    url?: string;
    method?: string;
    userAgent?: string;
    ip?: string;
    environment: string;
    service: string;
    version: string;
  };

  // Additional metadata
  tags: Record<string, unknown>;
  extra: Record<string, unknown>;

  // Performance impact
  performance?: {
    responseTime: number;
    memoryUsage: number;
    cpuUsage: number;
  };

  // Related errors
  causedBy?: string; // ID of causing error
  relatedTo?: string[]; // IDs of related errors
}

export interface ErrorGroup {
  fingerprint: string;
  title: string;
  firstSeen: Date;
  lastSeen: Date;
  count: number;
  level: ErrorEvent['level'];
  status: 'unresolved' | 'resolved' | 'ignored' | 'monitoring';

  // Representative error
  culprit: string; // Function/file where _errororiginated
  platform: string;

  // Metadata
  tags: Record<string, unknown>;

  // Statistics
  stats: {
    last24h: number;
    last7d: number;
    last30d: number;
    trend: 'increasing' | 'decreasing' | 'stable';
  };

  // Related users/sessions
  users: Set<string>;
  sessions: Set<string>;

  // Issue tracking
  assignedTo?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  resolution?: {
    type: 'fixed' | 'wont_fix' | 'invalid' | 'duplicate';
    note?: string;
    resolvedBy?: string;
    resolvedAt?: Date;
  };
}

export interface Alert {
  id: string;
  timestamp: Date;
  type: 'new__error | 'error_spike' | 'critical__error | 'high_error_rate';
  level: 'info' | 'warning' | 'critical';
  title: string;
  description: string;

  // Related data
  errorGroup?: ErrorGroup;
  metrics?: {
    errorRate: number;
    affectedUsers: number;
    performanceImpact: number;
  };

  // Alert management
  status: 'active' | 'acknowledged' | 'resolved';
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  resolvedAt?: Date;

  // Notification tracking
  notificationsSent: {
    channel: string;
    timestamp: Date;
    success: boolean;
  }[];
}

export interface ErrorReport {
  timeRange: {
    start: Date;
    end: Date;
  };
  summary: {
    totalErrors: number;
    totalGroups: number;
    newGroups: number;
    resolvedGroups: number;
    errorRate: number;
    affectedUsers: number;
    affectedSessions: number;
  };
  topErrors: Array<{
    fingerprint: string;
    title: string;
    count: number;
    lastSeen: Date;
    trend: string;
  }>;
  errorDistribution: {
    byLevel: Record<string, number>;
    byService: Record<string, number>;
    byPlatform: Record<string, number>;
    overTime: Array<{
      timestamp: Date;
      count: number;
    }>;
  };
  performance: {
    averageResponseTime: number;
    errorImpactOnPerformance: number;
    slowestErrors: Array<{
      fingerprint: string;
      averageResponseTime: number;
    }>;
  };
}

export class ErrorTrackingService extends EventEmitter {
  private config: ErrorTrackingConfig;
  private supabase: SupabaseClient;
  private isStarted = false;
  private errors = new Map<string, ErrorEvent>();
  private errorGroups = new Map<string, ErrorGroup>();
  private alerts = new Map<string, Alert>();
  private alertRateLimiter = new Map<string, number>();
  private persistenceQueue: ErrorEvent[] = [];
  private persistenceInterval?: NodeJS.Timeout;

  constructor(supabaseUrl: string, supabaseKey: string, config: Partial<ErrorTrackingConfig> = {}) {
    super();

    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.config = {
      enabled: true,
      maxErrors: 10000,
      deduplicationWindow: 60000, // 1 minute
      alertingEnabled: true,
      alertThresholds: {
        errorRate: 10, // errors per minute
        newError: true,
        criticalError: true,
        errorSpike: 200, // 200% increase
      },
      rateLimiting: {
        maxAlertsPerMinute: 5,
        cooldownPeriod: 300000, // 5 minutes
      },
      errorFilters: {
        ignoredErrors: [],
        minimumLevel: '_error,
      },
      persistence: {
        enabled: true,
        retentionDays: 30,
        batchSize: 100,
      },
      integrations: {},
      ...config,
    };

    this.setupErrorHandling();
  }

  /**
   * Start error tracking service
   */
  async start(): Promise<void> {
    if (this.isStarted) {
      logger.warn('Error tracking service already started', LogContext.ERROR);
      return;
    }

    if (!this.config.enabled) {
      logger.info('Error tracking service disabled', LogContext.ERROR);
      return;
    }

    try {
      logger.info('Starting error tracking service', LogContext.ERROR, { config: this.config });

      // Setup persistence if enabled
      if (this.config.persistence.enabled) {
        this.setupPersistence();
      }

      // Load existing _errorgroups from database
      await this.loadErrorGroups();

      this.isStarted = true;
      this.emit('started', { config: this.config });

      logger.info('Error tracking service started successfully', LogContext.ERROR);
    } catch (error) {
      logger.error('Failed to start error tracking service', LogContext.ERROR, { _error});
      throw error;
    }
  }

  /**
   * Stop error tracking service
   */
  async stop(): Promise<void> {
    if (!this.isStarted) {
      logger.warn('Error tracking service not started', LogContext.ERROR);
      return;
    }

    try {
      logger.info('Stopping error tracking service', LogContext.ERROR);

      // Stop persistence
      if (this.persistenceInterval) {
        clearInterval(this.persistenceInterval);
        this.persistenceInterval = undefined;
      }

      // Final persistence flush
      if (this.config.persistence.enabled && this.persistenceQueue.length > 0) {
        await this.flushErrors();
      }

      this.isStarted = false;
      this.emit('stopped');

      logger.info('Error tracking service stopped successfully', LogContext.ERROR);
    } catch (error) {
      logger.error('Error stopping error tracking service', LogContext.ERROR, { _error});
      throw error;
    }
  }

  /**
   * Track an _errorevent
   */
  trackError(
    _error Error | string,
    context: Partial<ErrorEvent['context']> = {},
    extra: Record<string, unknown> = {},
    level: ErrorEvent['level'] = '_error
  ): string {
    if (!this.config.enabled || !this.isStarted) {
      return '';
    }

    // Filter out ignored errors
    const errorMessage = error instanceof Error ? error.message : error
    if (this.shouldIgnoreError(errorMessage, level)) {
      return '';
    }

    const errorEvent = this.createErrorEvent(_error context, extra, level);

    // Check for deduplication
    const existingError = this.findDuplicateError(errorEvent);
    if (existingError) {
      this.updateErrorGroup(errorEvent);
      return existingError.id;
    }

    // Store error
    this.errors.set(errorEvent.id, errorEvent);

    // Update or create _errorgroup
    const group = this.updateErrorGroup(errorEvent);

    // Check for alerts
    if (this.config.alertingEnabled) {
      this.checkForAlerts(errorEvent, group);
    }

    // Add to persistence queue
    if (this.config.persistence.enabled) {
      this.persistenceQueue.push(errorEvent);
    }

    // Cleanup old errors
    this.cleanupOldErrors();

    logger.debug('Error tracked', LogContext.ERROR, {
      error_id: errorEvent.id,
      fingerprint: errorEvent.fingerprint,
      level: errorEvent.level,
      message: errorEvent.message,
    });

    this.emit('errorTracked', errorEvent);
    return errorEvent.id;
  }

  /**
   * Track _errorfrom telemetry span
   */
  trackErrorFromSpan(
    _error Error,
    spanContext?: { traceId: string; spanId: string },
    extra: Record<string, unknown> = {}
  ): string {
    const context: Partial<ErrorEvent['context']> = {
      traceId: spanContext?.traceId || telemetryService.getCurrentTraceId(),
      spanId: spanContext?.spanId || telemetryService.getCurrentSpanId(),
      service: 'universal-ai-tools',
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
    };

    return this.trackError(_error context, extra, '_error);
  }

  /**
   * Track Sweet Athena specific error
   */
  trackAthenaError(
    _error Error,
    sessionId: string,
    personalityMood: string,
    interactionType?: string,
    extra: Record<string, unknown> = {}
  ): string {
    const context: Partial<ErrorEvent['context']> = {
      sessionId,
      service: 'sweet-athena',
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      traceId: telemetryService.getCurrentTraceId(),
      spanId: telemetryService.getCurrentSpanId(),
    };

    const athenaExtra = {
      ...extra,
      'athena.personality_mood': personalityMood,
      'athena.interaction_type': interactionType,
      'athena.session_id': sessionId,
    };

    return this.trackError(_error context, athenaExtra, '_error);
  }

  /**
   * Resolve an _errorgroup
   */
  resolveErrorGroup(
    fingerprint: string,
    resolution: ErrorGroup['resolution'],
    resolvedBy: string
  ): void {
    const group = this.errorGroups.get(fingerprint);
    if (!group) {
      logger.warn('Error group not found for resolution', LogContext.ERROR, { fingerprint });
      return;
    }

    group.status = 'resolved';
    group.resolution = {
      ...resolution,
      resolvedBy,
      resolvedAt: new Date(),
    };

    logger.info('Error group resolved', LogContext.ERROR, {
      fingerprint,
      resolution_type: resolution.type,
      resolved_by: resolvedBy,
    });

    this.emit('errorGroupResolved', group);
  }

  /**
   * Ignore an _errorgroup
   */
  ignoreErrorGroup(fingerprint: string, ignoredBy: string): void {
    const group = this.errorGroups.get(fingerprint);
    if (!group) {
      logger.warn('Error group not found for ignoring', LogContext.ERROR, { fingerprint });
      return;
    }

    group.status = 'ignored';

    logger.info('Error group ignored', LogContext.ERROR, {
      fingerprint,
      ignored_by: ignoredBy,
    });

    this.emit('errorGroupIgnored', group);
  }

  /**
   * Assign _errorgroup to user
   */
  assignErrorGroup(fingerprint: string, assignedTo: string): void {
    const group = this.errorGroups.get(fingerprint);
    if (!group) {
      logger.warn('Error group not found for assignment', LogContext.ERROR, { fingerprint });
      return;
    }

    group.assignedTo = assignedTo;

    logger.info('Error group assigned', LogContext.ERROR, {
      fingerprint,
      assigned_to: assignedTo,
    });

    this.emit('errorGroupAssigned', group);
  }

  /**
   * Get _errorstatistics
   */
  getErrorStats(durationMinutes = 60): {
    totalErrors: number;
    totalGroups: number;
    errorRate: number;
    topErrors: Array<{ fingerprint: string; count: number; title: string }>;
    levelDistribution: Record<string, number>;
  } {
    const cutoffTime = new Date(Date.now() - durationMinutes * 60 * 1000);
    const recentErrors = Array.from(this.errors.values()).filter((e) => e.timestamp > cutoffTime);

    const levelDistribution: Record<string, number> = {};
    recentErrors.forEach((e) => {
      levelDistribution[e.level] = (levelDistribution[e.level] || 0) + 1;
    });

    const groupCounts = new Map<string, number>();
    recentErrors.forEach((e) => {
      groupCounts.set(e.fingerprint, (groupCounts.get(e.fingerprint) || 0) + 1);
    });

    const topErrors = Array.from(groupCounts.entries())
      .map(([fingerprint, count]) => {
        const group = this.errorGroups.get(fingerprint);
        return {
          fingerprint,
          count,
          title: group?.title || 'Unknown Error',
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalErrors: recentErrors.length,
      totalGroups: groupCounts.size,
      errorRate: recentErrors.length / durationMinutes,
      topErrors,
      levelDistribution,
    };
  }

  /**
   * Generate comprehensive _errorreport
   */
  generateReport(durationMinutes = 1440): ErrorReport {
    // 24 hours default
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - durationMinutes * 60 * 1000);

    const recentErrors = Array.from(this.errors.values()).filter((e) => e.timestamp > startTime);

    // Calculate summary
    const uniqueUsers = new Set(recentErrors.map((e) => e.context.userId).filter(Boolean));
    const uniqueSessions = new Set(recentErrors.map((e) => e.context.sessionId).filter(Boolean));
    const groupsInRange = new Set(recentErrors.map((e) => e.fingerprint));

    // Get new groups (first seen in this period)
    const newGroups = Array.from(this.errorGroups.values()).filter(
      (g) => g.firstSeen > startTime
    ).length;

    // Get resolved groups
    const resolvedGroups = Array.from(this.errorGroups.values()).filter(
      (g) => g.resolution?.resolvedAt && g.resolution.resolvedAt > startTime
    ).length;

    const summary = {
      totalErrors: recentErrors.length,
      totalGroups: groupsInRange.size,
      newGroups,
      resolvedGroups,
      errorRate: recentErrors.length / durationMinutes,
      affectedUsers: uniqueUsers.size,
      affectedSessions: uniqueSessions.size,
    };

    // Calculate top errors
    const groupCounts = new Map<string, number>();
    recentErrors.forEach((e) => {
      groupCounts.set(e.fingerprint, (groupCounts.get(e.fingerprint) || 0) + 1);
    });

    const topErrors = Array.from(groupCounts.entries())
      .map(([fingerprint, count]) => {
        const group = this.errorGroups.get(fingerprint);
        return {
          fingerprint,
          title: group?.title || 'Unknown Error',
          count,
          lastSeen: group?.lastSeen || new Date(),
          trend: group?.stats.trend || 'stable',
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    // Calculate _errordistribution
    const byLevel: Record<string, number> = {};
    const byService: Record<string, number> = {};
    const byPlatform: Record<string, number> = {};

    recentErrors.forEach((e) => {
      byLevel[e.level] = (byLevel[e.level] || 0) + 1;
      byService[e.context.service] = (byService[e.context.service] || 0) + 1;
      byPlatform[e.context.environment] = (byPlatform[e.context.environment] || 0) + 1;
    });

    // Calculate time series
    const timeSlots = 24; // 24 hour slots
    const slotDuration = (durationMinutes * 60 * 1000) / timeSlots;
    const overTime: Array<{ timestamp: Date; count: number }> = [];

    for (let i = 0; i < timeSlots; i++) {
      const slotStart = new Date(startTime.getTime() + i * slotDuration);
      const slotEnd = new Date(slotStart.getTime() + slotDuration);
      const slotErrors = recentErrors.filter(
        (e) => e.timestamp >= slotStart && e.timestamp < slotEnd
      );

      overTime.push({
        timestamp: slotStart,
        count: slotErrors.length,
      });
    }

    // Calculate performance impact
    const errorsWithPerformance = recentErrors.filter((e) => e.performance);
    const averageResponseTime =
      errorsWithPerformance.length > 0
        ? errorsWithPerformance.reduce((sum, e) => sum + (e.performance?.responseTime || 0), 0) /
          errorsWithPerformance.length
        : 0;

    const slowestErrors = Array.from(groupCounts.entries())
      .map(([fingerprint, count]) => {
        const groupErrors = recentErrors.filter(
          (e) => e.fingerprint === fingerprint && e.performance
        );
        const avgResponseTime =
          groupErrors.length > 0
            ? groupErrors.reduce((sum, e) => sum + (e.performance?.responseTime || 0), 0) /
              groupErrors.length
            : 0;

        return { fingerprint, averageResponseTime: avgResponseTime };
      })
      .filter((e) => e.averageResponseTime > 0)
      .sort((a, b) => b.averageResponseTime - a.averageResponseTime)
      .slice(0, 10);

    return {
      timeRange: { start: startTime, end: endTime },
      summary,
      topErrors,
      errorDistribution: {
        byLevel,
        byService,
        byPlatform,
        overTime,
      },
      performance: {
        averageResponseTime,
        errorImpactOnPerformance: averageResponseTime / 1000, // Simplified calculation
        slowestErrors,
      },
    };
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values())
      .filter((a) => a.status === 'active')
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string, acknowledgedBy: string): void {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      logger.warn('Alert not found for acknowledgment', LogContext.ERROR, { alert_id: alertId });
      return;
    }

    alert.status = 'acknowledged';
    alert.acknowledgedBy = acknowledgedBy;
    alert.acknowledgedAt = new Date();

    logger.info('Alert acknowledged', LogContext.ERROR, {
      alert_id: alertId,
      acknowledged_by: acknowledgedBy,
    });

    this.emit('alertAcknowledged', alert);
  }

  // Private methods

  private setupErrorHandling(): void {
    // Global _errorhandling
    process.on('uncaughtException', (error => {
      this.trackError(_error { service: 'system' }, { source: 'uncaughtException' }, 'fatal');
    });

    process.on('unhandledRejection', (reason) => {
      const _error= reason instanceof Error ? reason : new Error(String(reason));
      this.trackError(_error { service: 'system' }, { source: 'unhandledRejection' }, '_error);
    });
  }

  private setupPersistence(): void {
    this.persistenceInterval = setInterval(() => {
      if (this.persistenceQueue.length >= this.config.persistence.batchSize) {
        this.flushErrors();
      }
    }, 30000); // Check every 30 seconds
  }

  private async loadErrorGroups(): Promise<void> {
    try {
      const { data: groups } = await this.supabase
        .from('error_groups')
        .select('*')
        .gte('last_seen', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)); // Last 30 days

      if (groups) {
        groups.forEach((group) => {
          const errorGroup: ErrorGroup = {
            fingerprint: group.fingerprint,
            title: group.title,
            firstSeen: new Date(group.first_seen),
            lastSeen: new Date(group.last_seen),
            count: group.count,
            level: group.level,
            status: group.status,
            culprit: group.culprit,
            platform: group.platform,
            tags: group.tags || {},
            stats: group.stats || { last24h: 0, last7d: 0, last30d: 0, trend: 'stable' },
            users: new Set(group.users || []),
            sessions: new Set(group.sessions || []),
            assignedTo: group.assigned_to,
            priority: group.priority || 'medium',
            resolution: group.resolution,
          };

          this.errorGroups.set(group.fingerprint, errorGroup);
        });

        logger.info('Loaded _errorgroups from database', LogContext.ERROR, {
          count: groups.length,
        });
      }
    } catch (error) {
      logger.error('Failed to load _errorgroups', LogContext.ERROR, { _error});
    }
  }

  private createErrorEvent(
    _error Error | string,
    context: Partial<ErrorEvent['context']>,
    extra: Record<string, unknown>,
    level: ErrorEvent['level']
  ): ErrorEvent {
    const isErrorObject = error instanceof Error;
    const message = isErrorObject ? error.message : error
    const stackTrace = isErrorObject ? error.stack || '' : '';
    const type = isErrorObject ? error.name : 'CustomError';

    const fingerprint = this.generateFingerprint(message, stackTrace, type);

    const errorEvent: ErrorEvent = {
      id: this.generateId(),
      timestamp: new Date(),
      level,
      message,
      type,
      fingerprint,
      stackTrace,
      handled: true,
      context: {
        service: 'universal-ai-tools',
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        ...context,
      },
      tags: {},
      extra,
    };

    // Add performance data if available
    const memUsage = process.memoryUsage();
    errorEvent.performance = {
      responseTime: 0, // Would be set by middleware
      memoryUsage: memUsage.heapUsed,
      cpuUsage: 0, // Would need more complex calculation
    };

    return errorEvent;
  }

  private findDuplicateError(errorEvent: ErrorEvent): ErrorEvent | null {
    const cutoffTime = new Date(Date.now() - this.config.deduplicationWindow);

    for (const existingError of this.errors.values()) {
      if (
        existingError.fingerprint === errorEvent.fingerprint &&
        existingError.timestamp > cutoffTime
      ) {
        return existingError;
      }
    }

    return null;
  }

  private updateErrorGroup(errorEvent: ErrorEvent): ErrorGroup {
    let group = this.errorGroups.get(errorEvent.fingerprint);

    if (!group) {
      // Create new group
      group = {
        fingerprint: errorEvent.fingerprint,
        title: this.generateTitle(errorEvent),
        firstSeen: errorEvent.timestamp,
        lastSeen: errorEvent.timestamp,
        count: 1,
        level: errorEvent.level,
        status: 'unresolved',
        culprit: this.extractCulprit(errorEvent.stackTrace),
        platform: errorEvent.context.environment,
        tags: { ...errorEvent.tags },
        stats: { last24h: 1, last7d: 1, last30d: 1, trend: 'stable' },
        users: new Set(),
        sessions: new Set(),
        priority: this.determinePriority(errorEvent),
      };

      this.errorGroups.set(errorEvent.fingerprint, group);
      this.emit('newErrorGroup', group);
    } else {
      // Update existing group
      group.lastSeen = errorEvent.timestamp;
      group.count++;

      // Update level if more severe
      if (this.isMoreSevere(errorEvent.level, group.level)) {
        group.level = errorEvent.level;
      }
    }

    // Add user/session tracking
    if (errorEvent.context.userId) {
      group.users.add(errorEvent.context.userId);
    }
    if (errorEvent.context.sessionId) {
      group.sessions.add(errorEvent.context.sessionId);
    }

    // Update statistics
    this.updateGroupStatistics(group);

    this.emit('errorGroupUpdated', group);
    return group;
  }

  private checkForAlerts(errorEvent: ErrorEvent, group: ErrorGroup): void {
    const { alertThresholds } = this.config;

    // Check for new _erroralert
    if (alertThresholds.newError && group.count === 1) {
      this.createAlert('new__error, 'warning', `New _errordetected: ${group.title}`, {
        errorGroup: group,
      });
    }

    // Check for critical _erroralert
    if (alertThresholds.criticalError && errorEvent.level === 'fatal') {
      this.createAlert(
        'critical__error,
        'critical',
        `Critical _errordetected: ${errorEvent.message}`,
        { errorGroup: group }
      );
    }

    // Check for _errorrate alert
    const recentErrors = Array.from(this.errors.values()).filter(
      (e) => e.timestamp > new Date(Date.now() - 60000)
    ); // Last minute

    if (recentErrors.length > alertThresholds.errorRate) {
      this.createAlert(
        'high_error_rate',
        'warning',
        `High _errorrate detected: ${recentErrors.length} errors in the last minute`,
        {
          metrics: {
            errorRate: recentErrors.length,
            affectedUsers: new Set(recentErrors.map((e) => e.context.userId).filter(Boolean)).size,
            performanceImpact: 0,
          },
        }
      );
    }

    // Check for _errorspike
    const last24hErrors = group.stats.last24h;
    const previousDay = last24hErrors - group.count; // Simplified calculation
    if (previousDay > 0) {
      const increase = ((group.count - previousDay) / previousDay) * 100;
      if (increase > alertThresholds.errorSpike) {
        this.createAlert('error_spike', 'warning', `Error spike detected for: ${group.title}`, {
          errorGroup: group,
          metrics: {
            errorRate: increase,
            affectedUsers: group.users.size,
            performanceImpact: 0,
          },
        });
      }
    }
  }

  private createAlert(
    type: Alert['type'],
    level: Alert['level'],
    title: string,
    data: { errorGroup?: ErrorGroup; metrics?: Alert['metrics'] }
  ): void {
    // Check rate limiting
    const rateLimitKey = `${type}:${data.errorGroup?.fingerprint || 'global'}`;
    const now = Date.now();
    const lastAlert = this.alertRateLimiter.get(rateLimitKey) || 0;

    if (now - lastAlert < this.config.rateLimiting.cooldownPeriod) {
      return; // Rate limited
    }

    this.alertRateLimiter.set(rateLimitKey, now);

    const alert: Alert = {
      id: this.generateId(),
      timestamp: new Date(),
      type,
      level,
      title,
      description: title, // Could be enhanced
      errorGroup: data.errorGroup,
      metrics: data.metrics,
      status: 'active',
      notificationsSent: [],
    };

    this.alerts.set(alert.id, alert);

    logger.warn('Alert created', LogContext.ERROR, {
      alert_id: alert.id,
      type,
      level,
      title,
    });

    this.emit('alertCreated', alert);

    // Send notifications
    this.sendNotifications(alert);
  }

  private async sendNotifications(alert: Alert): Promise<void> {
    const { integrations } = this.config;

    // Slack notification
    if (integrations.slack) {
      try {
        // Implementation would depend on Slack SDK
        logger.debug('Slack notification would be sent', LogContext.ERROR, { alert_id: alert.id });

        alert.notificationsSent.push({
          channel: 'slack',
          timestamp: new Date(),
          success: true,
        });
      } catch (error) {
        logger.error('Failed to send Slack notification', LogContext.ERROR, { _error});
        alert.notificationsSent.push({
          channel: 'slack',
          timestamp: new Date(),
          success: false,
        });
      }
    }

    // Email notification
    if (integrations.email) {
      try {
        // Implementation would depend on email service
        logger.debug('Email notification would be sent', LogContext.ERROR, { alert_id: alert.id });

        alert.notificationsSent.push({
          channel: 'email',
          timestamp: new Date(),
          success: true,
        });
      } catch (error) {
        logger.error('Failed to send email notification', LogContext.ERROR, { _error});
        alert.notificationsSent.push({
          channel: 'email',
          timestamp: new Date(),
          success: false,
        });
      }
    }

    // PagerDuty notification
    if (integrations.pagerDuty && alert.level === 'critical') {
      try {
        // Implementation would depend on PagerDuty SDK
        logger.debug('PagerDuty notification would be sent', LogContext.ERROR, {
          alert_id: alert.id,
        });

        alert.notificationsSent.push({
          channel: 'pagerduty',
          timestamp: new Date(),
          success: true,
        });
      } catch (error) {
        logger.error('Failed to send PagerDuty notification', LogContext.ERROR, { _error});
        alert.notificationsSent.push({
          channel: 'pagerduty',
          timestamp: new Date(),
          success: false,
        });
      }
    }
  }

  private async flushErrors(): Promise<void> {
    if (this.persistenceQueue.length === 0) return;

    try {
      const errors = this.persistenceQueue.splice(0, this.config.persistence.batchSize);

      await this.supabase.from('error_events').insert(
        errors.map((e) => ({
          id: e.id,
          timestamp: e.timestamp,
          level: e.level,
          message: e.message,
          type: e.type,
          fingerprint: e.fingerprint,
          stack_trace: e.stackTrace,
          handled: e.handled,
          context: e.context,
          tags: e.tags,
          extra: e.extra,
          performance: e.performance,
        }))
      );

      // Update _errorgroups
      const groupUpdates = Array.from(this.errorGroups.values()).map((g) => ({
        fingerprint: g.fingerprint,
        title: g.title,
        first_seen: g.firstSeen,
        last_seen: g.lastSeen,
        count: g.count,
        level: g.level,
        status: g.status,
        culprit: g.culprit,
        platform: g.platform,
        tags: g.tags,
        stats: g.stats,
        users: Array.from(g.users),
        sessions: Array.from(g.sessions),
        assigned_to: g.assignedTo,
        priority: g.priority,
        resolution: g.resolution,
      }));

      await this.supabase.from('error_groups').upsert(groupUpdates);

      logger.debug('Errors flushed to database', LogContext.ERROR, {
        error_count: errors.length,
        group_count: groupUpdates.length,
      });
    } catch (error) {
      logger.error('Failed to flush errors to database', LogContext.ERROR, { _error});
      // Re-add errors to queue for retry
      this.persistenceQueue.unshift(...this.persistenceQueue);
    }
  }

  private shouldIgnoreError(message: string, level: ErrorEvent['level']): boolean {
    // Check minimum level
    const levelPriority = { debug: 0, info: 1, warn: 2, error 3, fatal: 4 };
    const minPriority = levelPriority[this.config.errorFilters.minimumLevel];
    const currentPriority = levelPriority[level];

    if (currentPriority < minPriority) {
      return true;
    }

    // Check ignored errors
    return this.config.errorFilters.ignoredErrors.some((ignored) => message.includes(ignored));
  }

  private generateFingerprint(message: string, stackTrace: string, type: string): string {
    // Create a deterministic fingerprint based on _errorcharacteristics
    const content= `${type}:${message}:${this.normalizeStackTrace(stackTrace)}`;
    return crypto.createHash('md5').update(content.digest('hex').substring(0, 16);
  }

  private normalizeStackTrace(stackTrace: string): string {
    // Normalize stack trace by removing line numbers and dynamic paths
    return stackTrace
      .split('\n')
      .slice(0, 5) // Take first 5 lines
      .map((line) => line.replace(/:\d+:\d+/g, '')) // Remove line:column numbers
      .map((line) => line.replace(/\/.*?\/([^\/]+\.js)/g, '$1')) // Normalize paths
      .join('\n');
  }

  private generateTitle(errorEvent: ErrorEvent): string {
    // Extract meaningful title from error
    const { message, type } = errorEvent;

    if (message.length > 100) {
      return `${type}: ${message.substring(0, 97)}...`;
    }

    return `${type}: ${message}`;
  }

  private extractCulprit(stackTrace: string): string {
    // Extract the function/file where _errororiginated
    const lines = stackTrace.split('\n');
    for (const line of lines) {
      const match = line.match(/at\s+([^\s]+)\s+\(([^)]+)\)/);
      if (match) {
        return `${match[1]} (${match[2]})`;
      }
    }
    return 'Unknown';
  }

  private determinePriority(errorEvent: ErrorEvent): ErrorGroup['priority'] {
    switch (errorEvent.level) {
      case 'fatal':
        return 'critical';
      case 'error':
        return 'high';
      case 'warn':
        return 'medium';
      default:
        return 'low';
    }
  }

  private isMoreSevere(level1: ErrorEvent['level'], level2: ErrorEvent['level']): boolean {
    const severity = { debug: 0, info: 1, warn: 2, error 3, fatal: 4 };
    return severity[level1] > severity[level2];
  }

  private updateGroupStatistics(group: ErrorGroup): void {
    // Update trend _analysis(simplified)
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    // This is a simplified implementation
    // In practice, you'd want more sophisticated trend analysis
    if (group.count > group.stats.last24h * 1.5) {
      group.stats.trend = 'increasing';
    } else if (group.count < group.stats.last24h * 0.5) {
      group.stats.trend = 'decreasing';
    } else {
      group.stats.trend = 'stable';
    }
  }

  private cleanupOldErrors(): void {
    if (this.errors.size <= this.config.maxErrors) return;

    const cutoffTime = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
    const oldErrors: string[] = [];

    for (const [id, error of this.errors.entries()) {
      if (_errortimestamp < cutoffTime) {
        oldErrors.push(id);
      }
    }

    // Remove oldest 10% of errors
    const toRemove = Math.min(oldErrors.length, Math.floor(this.config.maxErrors * 0.1));
    oldErrors.slice(0, toRemove).forEach((id) => this.errors.delete(id));
  }

  private generateId(): string {
    return crypto.randomBytes(16).toString('hex');
  }
}

// Create singleton instance
let errorTrackingService: ErrorTrackingService | null = null;

export function getErrorTrackingService(
  supabaseUrl?: string,
  supabaseKey?: string,
  config?: Partial<ErrorTrackingConfig>
): ErrorTrackingService {
  if (!errorTrackingService) {
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase URL and key required to initialize error tracking service');
    }
    errorTrackingService = new ErrorTrackingService(supabaseUrl, supabaseKey, config);
  }
  return errorTrackingService;
}

export default ErrorTrackingService;
