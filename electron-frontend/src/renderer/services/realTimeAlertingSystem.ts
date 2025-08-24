/**
 * Real-Time Alerting System for Critical Restart Failures
 *
 * Provides comprehensive alerting capabilities for the proactive restart monitoring system.
 * Integrates with multiple notification channels and implements intelligent alert prioritization.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Core alert interfaces
export interface AlertDefinition {
  id: string;
  name: string;
  description: string;
  severity: AlertSeverity;
  conditions: AlertCondition[];
  channels: NotificationChannel[];
  escalation_rules: EscalationRule[];
  cooldown_period: number; // seconds
  auto_resolve: boolean;
  tags: string[];
  created_at: Date;
  updated_at: Date;
}

export interface AlertCondition {
  metric: string;
  operator: 'gt' | 'lt' | 'eq' | 'ne' | 'contains' | 'not_contains';
  threshold: any;
  duration_seconds?: number; // How long condition must persist
  evaluation_window?: number; // Time window to evaluate
}

export interface Alert {
  id: string;
  definition_id: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  status: AlertStatus;
  source_service: string;
  source_data: any;
  triggered_at: Date;
  acknowledged_at?: Date;
  resolved_at?: Date;
  escalated_at?: Date;
  metadata: Record<string, any>;
  fingerprint: string; // For deduplication
}

export interface NotificationChannel {
  id: string;
  type: ChannelType;
  name: string;
  config: ChannelConfig;
  enabled: boolean;
  filters?: AlertFilter[];
}

export interface EscalationRule {
  level: number;
  delay_minutes: number;
  channels: string[]; // Channel IDs
  conditions?: EscalationCondition[];
}

export interface EscalationCondition {
  type: 'time_based' | 'severity_based' | 'failure_count';
  value: any;
}

export interface AlertFilter {
  field: string;
  operator: string;
  value: any;
}

export interface ChannelConfig {
  // Email configuration
  email?: {
    recipients: string[];
    smtp_server?: string;
    template?: string;
  };

  // Slack configuration
  slack?: {
    webhook_url: string;
    channel: string;
    username?: string;
    icon_emoji?: string;
  };

  // PagerDuty configuration
  pagerduty?: {
    integration_key: string;
    service_key?: string;
  };

  // Discord configuration
  discord?: {
    webhook_url: string;
    username?: string;
    avatar_url?: string;
  };

  // Teams configuration
  teams?: {
    webhook_url: string;
  };

  // Webhook configuration
  webhook?: {
    url: string;
    headers?: Record<string, string>;
    auth?: {
      type: 'bearer' | 'basic' | 'api_key';
      token: string;
    };
  };
}

export enum AlertSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  INFO = 'info',
}

export enum AlertStatus {
  OPEN = 'open',
  ACKNOWLEDGED = 'acknowledged',
  RESOLVED = 'resolved',
  SUPPRESSED = 'suppressed',
}

export enum ChannelType {
  EMAIL = 'email',
  SLACK = 'slack',
  PAGERDUTY = 'pagerduty',
  DISCORD = 'discord',
  TEAMS = 'teams',
  WEBHOOK = 'webhook',
  SMS = 'sms',
  DESKTOP = 'desktop',
}

export interface AlertingMetrics {
  alerts_triggered_24h: number;
  alerts_resolved_24h: number;
  mean_resolution_time: number;
  escalations_count: number;
  top_alert_sources: { service: string; count: number }[];
  channel_delivery_rates: { channel: string; success_rate: number }[];
  notification_latency_p95: number;
}

export interface AlertingConfig {
  enabled: boolean;
  default_severity: AlertSeverity;
  max_alerts_per_minute: number;
  deduplication_window_seconds: number;
  auto_resolve_timeout_hours: number;
  escalation_enabled: boolean;
  maintenance_mode: boolean;
  global_filters: AlertFilter[];
}

/**
 * Real-Time Alerting System
 *
 * Manages alert definitions, evaluates conditions, sends notifications,
 * and handles escalations for the proactive restart monitoring system.
 */
export class RealTimeAlertingSystem {
  private static instance: RealTimeAlertingSystem;
  private supabase: SupabaseClient;
  private config: AlertingConfig;
  private alertDefinitions: Map<string, AlertDefinition> = new Map();
  private activeAlerts: Map<string, Alert> = new Map();
  private notificationChannels: Map<string, NotificationChannel> = new Map();
  private evaluationInterval: NodeJS.Timeout | null = null;
  private escalationInterval: NodeJS.Timeout | null = null;
  private alertCooldowns: Map<string, number> = new Map();
  private isInitialized = false;

  private constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL || 'http://127.0.0.1:54321',
      process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key'
    );

    this.config = {
      enabled: true,
      default_severity: AlertSeverity.MEDIUM,
      max_alerts_per_minute: 50,
      deduplication_window_seconds: 300,
      auto_resolve_timeout_hours: 24,
      escalation_enabled: true,
      maintenance_mode: false,
      global_filters: [],
    };
  }

  public static getInstance(): RealTimeAlertingSystem {
    if (!RealTimeAlertingSystem.instance) {
      RealTimeAlertingSystem.instance = new RealTimeAlertingSystem();
    }
    return RealTimeAlertingSystem.instance;
  }

  /**
   * Initialize the alerting system
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('🚨 Initializing Real-Time Alerting System...');

      // Load configuration from Supabase
      await this.loadConfiguration();

      // Load alert definitions
      await this.loadAlertDefinitions();

      // Load notification channels
      await this.loadNotificationChannels();

      // Load active alerts
      await this.loadActiveAlerts();

      // Start evaluation loop
      this.startEvaluationLoop();

      // Start escalation processor
      this.startEscalationProcessor();

      // Initialize default alert definitions for restart monitoring
      await this.initializeDefaultAlerts();

      this.isInitialized = true;
      console.log('✅ Real-Time Alerting System initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Real-Time Alerting System:', error);
      throw error;
    }
  }

  /**
   * Load alerting configuration from Supabase
   */
  private async loadConfiguration(): Promise<void> {
    try {
      const { data, error } = await this.supabase
        .from('alerting_config')
        .select('*')
        .eq('active', true)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        this.config = { ...this.config, ...data };
      }
    } catch (error) {
      console.warn('Using default alerting configuration:', error);
    }
  }

  /**
   * Load alert definitions from Supabase
   */
  private async loadAlertDefinitions(): Promise<void> {
    try {
      const { data, error } = await this.supabase
        .from('alert_definitions')
        .select('*')
        .eq('enabled', true);

      if (error) throw error;

      if (data) {
        data.forEach(def => {
          this.alertDefinitions.set(def.id, def);
        });
      }
    } catch (error) {
      console.warn('Could not load alert definitions from Supabase:', error);
    }
  }

  /**
   * Load notification channels from Supabase
   */
  private async loadNotificationChannels(): Promise<void> {
    try {
      const { data, error } = await this.supabase
        .from('notification_channels')
        .select('*')
        .eq('enabled', true);

      if (error) throw error;

      if (data) {
        data.forEach(channel => {
          this.notificationChannels.set(channel.id, channel);
        });
      }
    } catch (error) {
      console.warn('Could not load notification channels from Supabase:', error);
    }
  }

  /**
   * Load active alerts from Supabase
   */
  private async loadActiveAlerts(): Promise<void> {
    try {
      const { data, error } = await this.supabase
        .from('alerts')
        .select('*')
        .in('status', [AlertStatus.OPEN, AlertStatus.ACKNOWLEDGED]);

      if (error) throw error;

      if (data) {
        data.forEach(alert => {
          this.activeAlerts.set(alert.id, alert);
        });
      }
    } catch (error) {
      console.warn('Could not load active alerts from Supabase:', error);
    }
  }

  /**
   * Initialize default alert definitions for restart monitoring
   */
  private async initializeDefaultAlerts(): Promise<void> {
    const defaultAlerts: Omit<AlertDefinition, 'id' | 'created_at' | 'updated_at'>[] = [
      // Critical service restart failures
      {
        name: 'Critical Service Restart Failure',
        description: 'A critical service has failed to restart multiple times',
        severity: AlertSeverity.CRITICAL,
        conditions: [
          {
            metric: 'restart_failures',
            operator: 'gt',
            threshold: 3,
            duration_seconds: 300,
          },
        ],
        channels: ['email', 'pagerduty', 'slack'],
        escalation_rules: [
          {
            level: 1,
            delay_minutes: 5,
            channels: ['pagerduty'],
          },
          {
            level: 2,
            delay_minutes: 15,
            channels: ['email', 'slack'],
          },
        ],
        cooldown_period: 900,
        auto_resolve: false,
        tags: ['restart', 'critical', 'service-failure'],
      },

      // Port conflicts
      {
        name: 'Port Conflict Detection',
        description: 'Service startup blocked by port conflicts',
        severity: AlertSeverity.HIGH,
        conditions: [
          {
            metric: 'port_conflicts',
            operator: 'gt',
            threshold: 0,
            duration_seconds: 60,
          },
        ],
        channels: ['slack', 'email'],
        escalation_rules: [
          {
            level: 1,
            delay_minutes: 10,
            channels: ['email'],
          },
        ],
        cooldown_period: 300,
        auto_resolve: true,
        tags: ['port-conflict', 'startup', 'network'],
      },

      // Memory issues during startup
      {
        name: 'Startup Memory Issues',
        description: 'High memory usage or OOM during service startup',
        severity: AlertSeverity.HIGH,
        conditions: [
          {
            metric: 'startup_memory_failures',
            operator: 'gt',
            threshold: 1,
            duration_seconds: 120,
          },
        ],
        channels: ['slack', 'email'],
        escalation_rules: [
          {
            level: 1,
            delay_minutes: 15,
            channels: ['email'],
          },
        ],
        cooldown_period: 600,
        auto_resolve: false,
        tags: ['memory', 'startup', 'performance'],
      },

      // Service dependency failures
      {
        name: 'Service Dependency Failure',
        description: 'Service startup blocked by dependency failures',
        severity: AlertSeverity.MEDIUM,
        conditions: [
          {
            metric: 'dependency_failures',
            operator: 'gt',
            threshold: 2,
            duration_seconds: 180,
          },
        ],
        channels: ['slack'],
        escalation_rules: [
          {
            level: 1,
            delay_minutes: 20,
            channels: ['email'],
          },
        ],
        cooldown_period: 600,
        auto_resolve: true,
        tags: ['dependency', 'startup', 'orchestration'],
      },

      // Long startup sequences
      {
        name: 'Long Startup Sequence',
        description: 'Service taking too long to complete startup sequence',
        severity: AlertSeverity.MEDIUM,
        conditions: [
          {
            metric: 'startup_duration_seconds',
            operator: 'gt',
            threshold: 300,
            duration_seconds: 60,
          },
        ],
        channels: ['slack'],
        escalation_rules: [],
        cooldown_period: 1800,
        auto_resolve: true,
        tags: ['performance', 'startup', 'timeout'],
      },

      // Recovery action failures
      {
        name: 'Automated Recovery Failure',
        description: 'Automated recovery actions are failing repeatedly',
        severity: AlertSeverity.HIGH,
        conditions: [
          {
            metric: 'recovery_failures',
            operator: 'gt',
            threshold: 5,
            duration_seconds: 600,
          },
        ],
        channels: ['email', 'slack'],
        escalation_rules: [
          {
            level: 1,
            delay_minutes: 10,
            channels: ['pagerduty'],
          },
        ],
        cooldown_period: 1200,
        auto_resolve: false,
        tags: ['recovery', 'automation', 'failure'],
      },
    ];

    for (const alertDef of defaultAlerts) {
      const id = `default_${alertDef.name.toLowerCase().replace(/\s+/g, '_')}`;

      if (!this.alertDefinitions.has(id)) {
        const fullAlert: AlertDefinition = {
          id,
          ...alertDef,
          created_at: new Date(),
          updated_at: new Date(),
        };

        this.alertDefinitions.set(id, fullAlert);

        try {
          await this.supabase.from('alert_definitions').upsert(fullAlert);
        } catch (error) {
          console.warn(`Could not save alert definition ${id} to Supabase:`, error);
        }
      }
    }
  }

  /**
   * Start the alert evaluation loop
   */
  private startEvaluationLoop(): void {
    if (this.evaluationInterval) {
      clearInterval(this.evaluationInterval);
    }

    this.evaluationInterval = setInterval(async () => {
      if (this.config.enabled && !this.config.maintenance_mode) {
        await this.evaluateAlerts();
      }
    }, 10000); // Evaluate every 10 seconds
  }

  /**
   * Start the escalation processor
   */
  private startEscalationProcessor(): void {
    if (this.escalationInterval) {
      clearInterval(this.escalationInterval);
    }

    this.escalationInterval = setInterval(async () => {
      if (this.config.escalation_enabled && !this.config.maintenance_mode) {
        await this.processEscalations();
      }
    }, 30000); // Check escalations every 30 seconds
  }

  /**
   * Evaluate all alert conditions
   */
  private async evaluateAlerts(): Promise<void> {
    try {
      // Get current metrics from monitoring services
      const metrics = await this.collectMetrics();

      for (const [defId, definition] of this.alertDefinitions) {
        await this.evaluateAlert(definition, metrics);
      }
    } catch (error) {
      console.error('Error evaluating alerts:', error);
    }
  }

  /**
   * Collect current metrics from monitoring services
   */
  private async collectMetrics(): Promise<Record<string, any>> {
    const metrics: Record<string, any> = {};

    try {
      // Get metrics from ProactiveRestartMonitor
      const { ProactiveRestartMonitor } = await import('./proactiveRestartMonitor');
      const restartMonitor = ProactiveRestartMonitor.getInstance();
      const restartMetrics = await restartMonitor.getMetrics();

      metrics.restart_failures = restartMetrics.failures_24h;
      metrics.startup_duration_seconds = restartMetrics.avg_startup_time;
      metrics.recovery_failures = restartMetrics.recovery_failures_24h;

      // Get metrics from ServiceStartupSequencer
      const { ServiceStartupSequencer } = await import('./serviceStartupSequencer');
      const sequencer = ServiceStartupSequencer.getInstance();
      const sequencerMetrics = await sequencer.getMetrics();

      metrics.port_conflicts = sequencerMetrics.port_conflicts_24h;
      metrics.dependency_failures = sequencerMetrics.dependency_failures_24h;
      metrics.startup_memory_failures = sequencerMetrics.memory_failures_24h;
    } catch (error) {
      console.warn('Could not collect all metrics:', error);
    }

    return metrics;
  }

  /**
   * Evaluate a specific alert definition
   */
  private async evaluateAlert(
    definition: AlertDefinition,
    metrics: Record<string, any>
  ): Promise<void> {
    try {
      // Check cooldown period
      const cooldownKey = `${definition.id}_cooldown`;
      const lastTriggered = this.alertCooldowns.get(cooldownKey);
      if (lastTriggered && Date.now() - lastTriggered < definition.cooldown_period * 1000) {
        return;
      }

      // Evaluate all conditions
      const conditionsMet = definition.conditions.every(condition => {
        return this.evaluateCondition(condition, metrics);
      });

      const existingAlert = Array.from(this.activeAlerts.values()).find(
        alert => alert.definition_id === definition.id && alert.status === AlertStatus.OPEN
      );

      if (conditionsMet && !existingAlert) {
        // Trigger new alert
        await this.triggerAlert(definition, metrics);
        this.alertCooldowns.set(cooldownKey, Date.now());
      } else if (!conditionsMet && existingAlert && definition.auto_resolve) {
        // Auto-resolve alert
        await this.resolveAlert(existingAlert.id, 'Conditions no longer met (auto-resolve)');
      }
    } catch (error) {
      console.error(`Error evaluating alert ${definition.id}:`, error);
    }
  }

  /**
   * Evaluate a single alert condition
   */
  private evaluateCondition(condition: AlertCondition, metrics: Record<string, any>): boolean {
    const value = metrics[condition.metric];
    if (value === undefined) return false;

    switch (condition.operator) {
      case 'gt':
        return value > condition.threshold;
      case 'lt':
        return value < condition.threshold;
      case 'eq':
        return value === condition.threshold;
      case 'ne':
        return value !== condition.threshold;
      case 'contains':
        return String(value).includes(String(condition.threshold));
      case 'not_contains':
        return !String(value).includes(String(condition.threshold));
      default:
        return false;
    }
  }

  /**
   * Trigger a new alert
   */
  private async triggerAlert(
    definition: AlertDefinition,
    metrics: Record<string, any>
  ): Promise<void> {
    try {
      const alertId = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const fingerprint = this.generateFingerprint(definition, metrics);

      // Check for duplicate alerts within deduplication window
      const existingAlert = Array.from(this.activeAlerts.values()).find(
        alert =>
          alert.fingerprint === fingerprint &&
          Date.now() - alert.triggered_at.getTime() <
            this.config.deduplication_window_seconds * 1000
      );

      if (existingAlert) {
        console.log(`Alert deduplicated: ${definition.name} (fingerprint: ${fingerprint})`);
        return;
      }

      const alert: Alert = {
        id: alertId,
        definition_id: definition.id,
        title: definition.name,
        message: this.generateAlertMessage(definition, metrics),
        severity: definition.severity,
        status: AlertStatus.OPEN,
        source_service: 'restart_monitoring',
        source_data: metrics,
        triggered_at: new Date(),
        metadata: {
          definition: definition,
          triggering_metrics: metrics,
        },
        fingerprint,
      };

      // Store alert
      this.activeAlerts.set(alertId, alert);

      try {
        await this.supabase.from('alerts').insert(alert);
      } catch (error) {
        console.warn('Could not save alert to Supabase:', error);
      }

      // Send notifications
      await this.sendNotifications(alert, definition);

      console.log(`🚨 Alert triggered: ${alert.title} (${alert.severity})`);
    } catch (error) {
      console.error('Error triggering alert:', error);
    }
  }

  /**
   * Generate alert fingerprint for deduplication
   */
  private generateFingerprint(definition: AlertDefinition, metrics: Record<string, any>): string {
    const key = `${definition.id}_${definition.name}_${JSON.stringify(definition.conditions)}`;
    return Buffer.from(key).toString('base64').substring(0, 16);
  }

  /**
   * Generate alert message
   */
  private generateAlertMessage(definition: AlertDefinition, metrics: Record<string, any>): string {
    let message = definition.description;

    // Add relevant metric values to message
    const relevantMetrics = definition.conditions
      .map(condition => `${condition.metric}: ${metrics[condition.metric]}`)
      .join(', ');

    if (relevantMetrics) {
      message += `\n\nCurrent values: ${relevantMetrics}`;
    }

    return message;
  }

  /**
   * Send notifications for an alert
   */
  private async sendNotifications(alert: Alert, definition: AlertDefinition): Promise<void> {
    const promises = definition.channels.map(async channelId => {
      const channel = this.notificationChannels.get(channelId);
      if (!channel || !channel.enabled) return;

      try {
        await this.sendNotification(channel, alert);
      } catch (error) {
        console.error(`Failed to send notification via ${channel.type}:`, error);
      }
    });

    await Promise.allSettled(promises);
  }

  /**
   * Send notification via specific channel
   */
  private async sendNotification(channel: NotificationChannel, alert: Alert): Promise<void> {
    switch (channel.type) {
      case ChannelType.EMAIL:
        await this.sendEmailNotification(channel, alert);
        break;
      case ChannelType.SLACK:
        await this.sendSlackNotification(channel, alert);
        break;
      case ChannelType.DISCORD:
        await this.sendDiscordNotification(channel, alert);
        break;
      case ChannelType.TEAMS:
        await this.sendTeamsNotification(channel, alert);
        break;
      case ChannelType.WEBHOOK:
        await this.sendWebhookNotification(channel, alert);
        break;
      case ChannelType.DESKTOP:
        await this.sendDesktopNotification(alert);
        break;
      default:
        console.warn(`Unsupported notification channel type: ${channel.type}`);
    }
  }

  /**
   * Send Slack notification
   */
  private async sendSlackNotification(channel: NotificationChannel, alert: Alert): Promise<void> {
    if (!channel.config.slack?.webhook_url) {
      throw new Error('Slack webhook URL not configured');
    }

    const color = this.getSeverityColor(alert.severity);
    const payload = {
      channel: channel.config.slack.channel || '#alerts',
      username: channel.config.slack.username || 'Alert System',
      icon_emoji: channel.config.slack.icon_emoji || ':warning:',
      attachments: [
        {
          color: color,
          title: alert.title,
          text: alert.message,
          fields: [
            {
              title: 'Severity',
              value: alert.severity.toUpperCase(),
              short: true,
            },
            {
              title: 'Service',
              value: alert.source_service,
              short: true,
            },
            {
              title: 'Triggered',
              value: alert.triggered_at.toISOString(),
              short: true,
            },
          ],
          footer: 'Universal AI Tools Alert System',
          ts: Math.floor(alert.triggered_at.getTime() / 1000),
        },
      ],
    };

    const response = await fetch(channel.config.slack.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Slack notification failed: ${response.statusText}`);
    }
  }

  /**
   * Send Discord notification
   */
  private async sendDiscordNotification(channel: NotificationChannel, alert: Alert): Promise<void> {
    if (!channel.config.discord?.webhook_url) {
      throw new Error('Discord webhook URL not configured');
    }

    const color = this.getSeverityColorDecimal(alert.severity);
    const payload = {
      username: channel.config.discord.username || 'Alert System',
      avatar_url: channel.config.discord.avatar_url,
      embeds: [
        {
          title: alert.title,
          description: alert.message,
          color: color,
          fields: [
            {
              name: 'Severity',
              value: alert.severity.toUpperCase(),
              inline: true,
            },
            {
              name: 'Service',
              value: alert.source_service,
              inline: true,
            },
            {
              name: 'Triggered',
              value: alert.triggered_at.toISOString(),
              inline: true,
            },
          ],
          footer: {
            text: 'Universal AI Tools Alert System',
          },
          timestamp: alert.triggered_at.toISOString(),
        },
      ],
    };

    const response = await fetch(channel.config.discord.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Discord notification failed: ${response.statusText}`);
    }
  }

  /**
   * Send Teams notification
   */
  private async sendTeamsNotification(channel: NotificationChannel, alert: Alert): Promise<void> {
    if (!channel.config.teams?.webhook_url) {
      throw new Error('Teams webhook URL not configured');
    }

    const color = this.getSeverityColor(alert.severity);
    const payload = {
      '@type': 'MessageCard',
      '@context': 'https://schema.org/extensions',
      summary: alert.title,
      themeColor: color.replace('#', ''),
      sections: [
        {
          activityTitle: alert.title,
          activitySubtitle: `Severity: ${alert.severity.toUpperCase()}`,
          text: alert.message,
          facts: [
            {
              name: 'Service',
              value: alert.source_service,
            },
            {
              name: 'Triggered',
              value: alert.triggered_at.toISOString(),
            },
          ],
        },
      ],
    };

    const response = await fetch(channel.config.teams.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Teams notification failed: ${response.statusText}`);
    }
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(channel: NotificationChannel, alert: Alert): Promise<void> {
    if (!channel.config.email?.recipients?.length) {
      throw new Error('Email recipients not configured');
    }

    // This is a simplified implementation
    // In a real system, you'd integrate with an email service like SendGrid, SES, etc.
    console.log(
      `📧 Email notification would be sent to: ${channel.config.email.recipients.join(', ')}`
    );
    console.log(`Subject: [${alert.severity.toUpperCase()}] ${alert.title}`);
    console.log(`Body: ${alert.message}`);
  }

  /**
   * Send webhook notification
   */
  private async sendWebhookNotification(channel: NotificationChannel, alert: Alert): Promise<void> {
    if (!channel.config.webhook?.url) {
      throw new Error('Webhook URL not configured');
    }

    const payload = {
      alert_id: alert.id,
      title: alert.title,
      message: alert.message,
      severity: alert.severity,
      status: alert.status,
      service: alert.source_service,
      triggered_at: alert.triggered_at.toISOString(),
      metadata: alert.metadata,
    };

    const headers = {
      'Content-Type': 'application/json',
      ...(channel.config.webhook.headers || {}),
    };

    // Add authentication if configured
    if (channel.config.webhook.auth) {
      const auth = channel.config.webhook.auth;
      switch (auth.type) {
        case 'bearer':
          headers['Authorization'] = `Bearer ${auth.token}`;
          break;
        case 'api_key':
          headers['X-API-Key'] = auth.token;
          break;
        case 'basic':
          headers['Authorization'] = `Basic ${Buffer.from(auth.token).toString('base64')}`;
          break;
      }
    }

    const response = await fetch(channel.config.webhook.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Webhook notification failed: ${response.statusText}`);
    }
  }

  /**
   * Send desktop notification
   */
  private async sendDesktopNotification(alert: Alert): Promise<void> {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        new Notification(alert.title, {
          body: alert.message,
          icon: this.getSeverityIcon(alert.severity),
          tag: alert.id,
        });
      }
    }
  }

  /**
   * Process escalations for active alerts
   */
  private async processEscalations(): Promise<void> {
    const now = new Date();

    for (const [alertId, alert] of this.activeAlerts) {
      if (alert.status !== AlertStatus.OPEN) continue;

      const definition = this.alertDefinitions.get(alert.definition_id);
      if (!definition || !definition.escalation_rules.length) continue;

      const minutesSinceTriggered = Math.floor(
        (now.getTime() - alert.triggered_at.getTime()) / 1000 / 60
      );

      for (const rule of definition.escalation_rules) {
        if (minutesSinceTriggered >= rule.delay_minutes && !alert.escalated_at) {
          await this.escalateAlert(alert, rule);
          break;
        }
      }
    }
  }

  /**
   * Escalate an alert
   */
  private async escalateAlert(alert: Alert, rule: EscalationRule): Promise<void> {
    try {
      console.log(`⚠️ Escalating alert: ${alert.title} (Level ${rule.level})`);

      // Send notifications to escalation channels
      for (const channelId of rule.channels) {
        const channel = this.notificationChannels.get(channelId);
        if (channel && channel.enabled) {
          const escalatedAlert = {
            ...alert,
            title: `[ESCALATED Level ${rule.level}] ${alert.title}`,
            message: `This alert has been escalated to level ${rule.level}.\n\n${alert.message}`,
          };

          await this.sendNotification(channel, escalatedAlert);
        }
      }

      // Update alert with escalation timestamp
      alert.escalated_at = new Date();
      this.activeAlerts.set(alert.id, alert);

      try {
        await this.supabase
          .from('alerts')
          .update({ escalated_at: alert.escalated_at })
          .eq('id', alert.id);
      } catch (error) {
        console.warn('Could not update alert escalation in Supabase:', error);
      }
    } catch (error) {
      console.error('Error escalating alert:', error);
    }
  }

  /**
   * Acknowledge an alert
   */
  public async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<void> {
    const alert = this.activeAlerts.get(alertId);
    if (!alert || alert.status !== AlertStatus.OPEN) {
      throw new Error('Alert not found or already acknowledged/resolved');
    }

    alert.status = AlertStatus.ACKNOWLEDGED;
    alert.acknowledged_at = new Date();
    alert.metadata = {
      ...alert.metadata,
      acknowledged_by: acknowledgedBy,
    };

    this.activeAlerts.set(alertId, alert);

    try {
      await this.supabase
        .from('alerts')
        .update({
          status: alert.status,
          acknowledged_at: alert.acknowledged_at,
          metadata: alert.metadata,
        })
        .eq('id', alertId);
    } catch (error) {
      console.warn('Could not update alert acknowledgment in Supabase:', error);
    }

    console.log(`✅ Alert acknowledged: ${alert.title}`);
  }

  /**
   * Resolve an alert
   */
  public async resolveAlert(alertId: string, resolution: string): Promise<void> {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      throw new Error('Alert not found');
    }

    alert.status = AlertStatus.RESOLVED;
    alert.resolved_at = new Date();
    alert.metadata = {
      ...alert.metadata,
      resolution,
    };

    this.activeAlerts.set(alertId, alert);

    try {
      await this.supabase
        .from('alerts')
        .update({
          status: alert.status,
          resolved_at: alert.resolved_at,
          metadata: alert.metadata,
        })
        .eq('id', alertId);
    } catch (error) {
      console.warn('Could not update alert resolution in Supabase:', error);
    }

    console.log(`✅ Alert resolved: ${alert.title} - ${resolution}`);
  }

  /**
   * Get color for alert severity
   */
  private getSeverityColor(severity: AlertSeverity): string {
    switch (severity) {
      case AlertSeverity.CRITICAL:
        return '#FF0000';
      case AlertSeverity.HIGH:
        return '#FF8800';
      case AlertSeverity.MEDIUM:
        return '#FFAA00';
      case AlertSeverity.LOW:
        return '#00AA00';
      case AlertSeverity.INFO:
        return '#0088AA';
      default:
        return '#888888';
    }
  }

  /**
   * Get decimal color for alert severity
   */
  private getSeverityColorDecimal(severity: AlertSeverity): number {
    switch (severity) {
      case AlertSeverity.CRITICAL:
        return 16711680; // Red
      case AlertSeverity.HIGH:
        return 16746496; // Orange
      case AlertSeverity.MEDIUM:
        return 16755200; // Yellow
      case AlertSeverity.LOW:
        return 43520; // Green
      case AlertSeverity.INFO:
        return 35498; // Blue
      default:
        return 8947848; // Gray
    }
  }

  /**
   * Get icon for alert severity
   */
  private getSeverityIcon(severity: AlertSeverity): string {
    switch (severity) {
      case AlertSeverity.CRITICAL:
        return '🔴';
      case AlertSeverity.HIGH:
        return '🟠';
      case AlertSeverity.MEDIUM:
        return '🟡';
      case AlertSeverity.LOW:
        return '🟢';
      case AlertSeverity.INFO:
        return '🔵';
      default:
        return '⚪';
    }
  }

  /**
   * Get alerting metrics
   */
  public async getMetrics(): Promise<AlertingMetrics> {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const alerts24h = Array.from(this.activeAlerts.values()).filter(
      alert => alert.triggered_at >= yesterday
    );

    const resolved24h = alerts24h.filter(
      alert => alert.status === AlertStatus.RESOLVED && alert.resolved_at
    );

    const meanResolutionTime =
      resolved24h.length > 0
        ? resolved24h.reduce((sum, alert) => {
            const resolutionTime = alert.resolved_at!.getTime() - alert.triggered_at.getTime();
            return sum + resolutionTime;
          }, 0) /
          resolved24h.length /
          1000 /
          60 // Convert to minutes
        : 0;

    const escalations = Array.from(this.activeAlerts.values()).filter(
      alert => alert.escalated_at && alert.escalated_at >= yesterday
    );

    const sourceCount = alerts24h.reduce(
      (acc, alert) => {
        acc[alert.source_service] = (acc[alert.source_service] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const topSources = Object.entries(sourceCount)
      .map(([service, count]) => ({ service, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      alerts_triggered_24h: alerts24h.length,
      alerts_resolved_24h: resolved24h.length,
      mean_resolution_time: Math.round(meanResolutionTime),
      escalations_count: escalations.length,
      top_alert_sources: topSources,
      channel_delivery_rates: [], // Would need to track delivery success/failure
      notification_latency_p95: 0, // Would need to track notification timing
    };
  }

  /**
   * Get active alerts
   */
  public getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * Get alert definitions
   */
  public getAlertDefinitions(): AlertDefinition[] {
    return Array.from(this.alertDefinitions.values());
  }

  /**
   * Get notification channels
   */
  public getNotificationChannels(): NotificationChannel[] {
    return Array.from(this.notificationChannels.values());
  }

  /**
   * Shutdown the alerting system
   */
  public shutdown(): void {
    if (this.evaluationInterval) {
      clearInterval(this.evaluationInterval);
      this.evaluationInterval = null;
    }

    if (this.escalationInterval) {
      clearInterval(this.escalationInterval);
      this.escalationInterval = null;
    }

    console.log('🚨 Real-Time Alerting System shut down');
  }
}

// Export singleton instance
export const realTimeAlertingSystem = new RealTimeAlertingSystem();
export default realTimeAlertingSystem;
