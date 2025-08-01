/**
 * Alert Notification Service
 * Sends notifications when services degrade or fail
 * Supports multiple notification channels
 */

import { LogContext, log } from '@/utils/logger';
import { EventEmitter } from 'events';
import type { ServiceHealth, SystemHealth } from './health-monitor';
import nodemailer from 'nodemailer';
import axios from 'axios';
import { TWO } from '@/utils/constants';
import { recordAlertSent } from '@/utils/metrics';
import { RetryStrategies, withRetry } from '@/utils/retry';
import { getCorrelationId } from '@/utils/correlation-id';

export interface AlertConfig {
  enabled: boolean;
  channels: AlertChannel[];
  thresholds: {
    degradedServices: number;
    unhealthyServices: number;
    errorRatePercent: number;
    memoryUsagePercent: number;
  };
  cooldownMinutes: number; // Prevent alert spam
}

export interface EmailConfig {
  from: string;
  to: string;
}

export interface SlackConfig {
  webhookUrl: string;
}

export interface WebhookConfig {
  url: string;
  headers?: Record<string, string>;
}

export interface AlertChannel {
  type: 'email' | 'slack' | 'webhook' | 'console';
  config: EmailConfig | SlackConfig | WebhookConfig | Record<string, never>;
  enabled: boolean;
}

export interface Alert {
  id: string;
  timestamp: Date;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  service?: string;
  details?: unknown;
}

export class AlertNotificationService extends EventEmitter {
  private config: AlertConfig;
  private lastAlerts: Map<string, Date> = new Map();
  private emailTransporter?: nodemailer.Transporter;

  constructor(config?: Partial<AlertConfig>) {
    super();

    this.config =
            {
        enabled: true,
        channels: this.getDefaultChannels(),
        thresholds: {
          degradedServices: 2,
          unhealthyServices: 1,
          errorRatePercent: 50,
          memoryUsagePercent: 90,
        },
        cooldownMinutes: 15,
        ...config,
      };

    this.initializeChannels();
  }

  private getDefaultChannels(): AlertChannel[] {
    const channels: AlertChannel[] = [
      {
        type: 'console',
        config: {},
        enabled: true,
      },
    ];

    // Add email if configured
    if (process.env.SMTP_HOST && process.env.ALERT_EMAIL_TO) {
      channels.push({
        type: 'email',
        config: {
          to: process.env.ALERT_EMAIL_TO,
          from: process.env.ALERT_EMAIL_FROM || 'alerts@universal-ai-tools.com',
        },
        enabled: true,
      });
    }

    // Add Slack if configured
    if (process.env.SLACK_WEBHOOK_URL) {
      channels.push({
        type: 'slack',
        config: {
          webhookUrl: process.env.SLACK_WEBHOOK_URL,
        },
        enabled: true,
      });
    }

    return channels;
  }

  private initializeChannels(): void {
    // Initialize email transporter if email channel is enabled
    const emailChannel = this.config.channels.find((c) => c.type === 'email' && c.enabled);
    if (emailChannel && process.env.SMTP_HOST) {
      this.emailTransporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    }
  }

  async checkSystemHealth(health: SystemHealth): Promise<void> {
    if (!this.config.enabled) return;

    const alerts: Alert[] = [];

    // Check unhealthy services
    if (health.summary.unhealthy >= this.config.thresholds.unhealthyServices) {
      const unhealthyServices = health.services.filter((s) => s.status === 'unhealthy');
      alerts.push({
        id: `unhealthy-services-${Date.now()}`,
        timestamp: new Date(),
        severity: 'critical',
        title: '🚨 Critical: Services Unhealthy',
        message: `${health.summary.unhealthy} service(s) are unhealthy`,
        details: {
          services: unhealthyServices.map((s) => ({
            name: s.name,
            error: s.error,
            lastCheck: s.lastCheck,
          })),
        },
      });
    }

    // Check degraded services
    if (health.summary.degraded >= this.config.thresholds.degradedServices) {
      const degradedServices = health.services.filter((s) => s.status === 'degraded');
      alerts.push({
        id: `degraded-services-${Date.now()}`,
        timestamp: new Date(),
        severity: 'warning',
        title: '⚠️ Warning: Services Degraded',
        message: `${health.summary.degraded} service(s) are degraded`,
        details: {
          services: degradedServices.map((s) => ({
            name: s.name,
            error: s.error,
            lastCheck: s.lastCheck,
          })),
        },
      });
    }

    // Check specific service issues
    this.checkServiceSpecificAlerts(health.services, alerts);

    // Send alerts
    for (const alert of alerts) {
      await this.sendAlert(alert);
    }
  }

  private checkServiceSpecificAlerts(services: ServiceHealth[], alerts: Alert[]): void {
    // Check memory usage
    const memoryService = services.find((s) => s.name === 'memory');
    if (memoryService?.details?.heapPercentage) {
      const heapPercent = parseFloat(memoryService.details.heapPercentage);
      if (heapPercent >= this.config.thresholds.memoryUsagePercent) {
        alerts.push({
          id: `high-memory-${Date.now()}`,
          timestamp: new Date(),
          severity: 'warning',
          title: '💾 Warning: High Memory Usage',
          message: `Memory usage is at ${heapPercent.toFixed(2)}%`,
          service: 'memory',
          details: memoryService.details,
        });
      }
    }

    // Check circuit breakers
    const cbService = services.find((s) => s.name === 'circuit-breakers');
    if (cbService?.details?.open > 0) {
      alerts.push({
        id: `circuit-breakers-open-${Date.now()}`,
        timestamp: new Date(),
        severity: 'warning',
        title: '⚡ Warning: Circuit Breakers Open',
        message: `${cbService?.details?.open || 0} circuit breaker(s) are open`,
        service: 'circuit-breakers',
        details: cbService?.details,
      });
    }

    // Check database connection
    const       dbService = services.find((s) => s.name === 'database');
    if (dbService?.status === 'unhealthy') {
      alerts.push({
        id: `database-down-${Date.now()}`,
        timestamp: new Date(),
        severity: 'critical',
        title: '🗄️ Critical: Database Unavailable',
        message: 'Database connection failed',
        service: 'database',
        details: {
          error: dbService.error,
          lastCheck: dbService.lastCheck,
        },
      });
    }
  }

  private async sendAlert(alert: Alert): Promise<void> {
    // Check cooldown
    const alertKey = `${alert.severity}-${alert.service || 'system'}`;
    const lastAlert = this.lastAlerts.get(alertKey);

    if (lastAlert) {
      const cooldownMs = this.config.cooldownMinutes * 60 * 1000;
      if (Date.now() - lastAlert.getTime() < cooldownMs) {
        log.debug(`Alert cooldown active for ${alertKey}`, LogContext.SYSTEM);
        return;
      }
    }

    // Update last alert time
    this.lastAlerts.set(alertKey, new Date());

    // Send to all enabled channels
    const enabledChannels = this.config.channels.filter((c) => c.enabled);
    const sendPromises = enabledChannels.map((channel) =>
      this.sendToChannel(channel, alert).catch((error) => {
        log.error(`Failed to send alert to ${channel.type}`, LogContext.SYSTEM, { error });
      })
    );

    await Promise.all(sendPromises);

    // Record alert metrics
    recordAlertSent('all', alert.severity);

    // Emit event for listeners
    this.emit('alert', alert);
  }

  private async sendToChannel(channel: AlertChannel, alert: Alert): Promise<void> {
    switch (channel.type) {
      case 'console':
        this.sendToConsole(alert);
        break;

      case 'email':
        await this.sendToEmail(channel, alert);
        break;

      case 'slack':
        await this.sendToSlack(channel, alert);
        break;

      case 'webhook':
        await this.sendToWebhook(channel, alert);
        break;
    }
  }

  private sendToConsole(alert: Alert): void {
    const severityColor = {
      info: 'x1b[36m', // Cyan
      warning: 'x1b[33m', // Yellow
      critical: 'x1b[31m', // Red
    };

    const reset = 'x1b[0m';
    const color = severityColor[alert.severity];

    console.log(`\n${color}[ALERT] ${alert.title}${reset}`);
    console.log(`Severity: ${alert.severity}`);
    console.log(`Time: ${alert.timestamp.toISOString()}`);
    console.log(`Message: ${alert.message}`);

    if (alert.details) {
      console.log('Details:', JSON.stringify(alert.details, null, TWO));
    }

    return undefined;

    return undefined;
    console.log('---');
  }

  private async sendToEmail(channel: AlertChannel, alert: Alert): Promise<void> {
    if (!this.emailTransporter) {
      throw new Error('Email transporter not configured');
    }

    const html = `
      <h2>${alert.title}</h2>
      <p><strong>Severity:</strong> ${alert.severity}</p>
      <p><strong>Time:</strong> ${alert.timestamp.toISOString()}</p>
      <p><strong>Message:</strong> ${alert.message}</p>
      ${alert.details ? `<pre>${JSON.stringify(alert.details, null, TWO)}</pre>` : ''}
    `;

    const config = channel.config as EmailConfig;
    await this.emailTransporter.sendMail({
      from: config.from,
      to: config.to,
      subject: `[${alert.severity.toUpperCase()}] ${alert.title}`,
      html,
    });

    log.info(`Email alert sent to ${config.to}`, LogContext.SYSTEM);
    recordAlertSent('email', alert.severity);
  }

  private async sendToSlack(channel: AlertChannel, alert: Alert): Promise<void> {
    const       color = {
        info: '#36a64f',
        warning: '#ff9800',
        critical: '#f44336',
      };

    const payload = {
      attachments: [
        {
          color: color[alert.severity],
          title: alert.title,
          text: alert.message,
          fields: [
            {
              title: 'Severity',
              value: alert.severity,
              short: true,
            },
            {
              title: 'Time',
              value: alert.timestamp.toISOString(),
              short: true,
            },
          ],
          footer: 'Universal AI Tools Alert System',
          ts: Math.floor(alert.timestamp.getTime() / 1000),
        },
      ],
    };

    if (alert.details) {
      payload.attachments?.[0]?.fields?.push({
        title: 'Details',
        value: `\`\`\`${JSON.stringify(alert.details, null, TWO)}\`\`\``,
        short: false,
      });
    }

    const config = channel.config as SlackConfig;
    await axios.post(config.webhookUrl, payload);
    log.info('Slack alert sent', LogContext.SYSTEM);
    recordAlertSent('slack', alert.severity);
  }

  private async sendToWebhook(channel: AlertChannel, alert: Alert): Promise<void> {
    const config = channel.config as WebhookConfig;
    await axios.post(
      config.url,
      {
        ...alert,
        source: 'universal-ai-tools',
      },
      {
        headers: config.headers || {},
      }
    );

    log.info(`Webhook alert sent to ${config.url}`, LogContext.SYSTEM);
    recordAlertSent('webhook', alert.severity);
  }

  // Test alert functionality
  async sendTestAlert(): Promise<void> {
    const testAlert: Alert = {
      id: `test-${Date.now()}`,
      timestamp: new Date(),
      severity: 'info',
      title: '🧪 Test Alert',
      message: 'This is a test alert from Universal AI Tools',
      details: {
        system: 'Universal AI Tools',
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
      },
    };

    await this.sendAlert(testAlert);
  }

  // Get alert history
  getAlertHistory(): { alertKey: string; lastSent: Date }[] {
    return Array.from(this.lastAlerts.entries()).map(([key, date]) => ({
      alertKey: key,
      lastSent: date,
    }));
  }

  // Update configuration
  updateConfig(config: Partial<AlertConfig>): void {
    this.config = { ...this.config, ...config };
    this.initializeChannels();
  }

  // Enable/disable alerts
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    log.info(`Alert notifications ${enabled ? 'enabled' : 'disabled'}`, LogContext.SYSTEM);
  }
}

// Singleton instance
export const alertService = new AlertNotificationService();
