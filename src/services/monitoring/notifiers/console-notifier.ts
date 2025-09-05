/**
 * Console Alert Notifier
 * Sends alerts to console/logs for development and debugging
 */

import { Logger } from '../../../utils/logger';
import type { Alert, AlertChannel, AlertNotifier } from '../types';

export class ConsoleAlertNotifier implements AlertNotifier {
  public readonly type = 'console';
  private readonly logger: Logger;

  constructor() {
    this.logger = new Logger('ConsoleAlertNotifier');
  }

  async send(alert: Alert, channel: AlertChannel): Promise<boolean> {
    try {
      const timestamp = new Date().toISOString();
      const duration = alert.endTime
        ? `Duration: ${alert.endTime.getTime() - alert.startTime.getTime()}ms`
        : 'Ongoing';

      const alertMessage = this.formatAlertMessage(alert, duration);

      // Log with appropriate level based on severity
      switch (alert.severity) {
        case 'critical':
          this.logger.error(`🚨 CRITICAL ALERT: ${alertMessage}`);
          break;
        case 'high':
          this.logger.error(`⚠️  HIGH ALERT: ${alertMessage}`);
          break;
        case 'medium':
          this.logger.warn(`⚡ MEDIUM ALERT: ${alertMessage}`);
          break;
        case 'low':
          this.logger.info(`ℹ️  LOW ALERT: ${alertMessage}`);
          break;
        case 'info':
          this.logger.info(`📋 INFO ALERT: ${alertMessage}`);
          break;
      }

      // Also output to console if configured
      if (channel.config.useConsole !== false) {
        const consoleMessage = `[${timestamp}] ${this.getSeverityEmoji(alert.severity)} ${alert.message}`;

        if (alert.severity === 'critical' || alert.severity === 'high') {
          console.error(consoleMessage);
        } else if (alert.severity === 'medium') {
          console.warn(consoleMessage);
        } else {
          console.log(consoleMessage);
        }
      }

      return true;
    } catch (error) {
      this.logger.error('Failed to send console alert notification', error);
      return false;
    }
  }

  async test(channel: AlertChannel): Promise<boolean> {
    try {
      const testAlert: Alert = {
        id: 'test-alert',
        ruleId: 'test-rule',
        status: 'firing',
        severity: 'info',
        message: 'This is a test alert from the console notifier',
        startTime: new Date(),
      };

      const success = await this.send(testAlert, channel);

      if (success) {
        this.logger.info('✅ Console notifier test successful');
      } else {
        this.logger.error('❌ Console notifier test failed');
      }

      return success;
    } catch (error) {
      this.logger.error('Console notifier test error', error);
      return false;
    }
  }

  private formatAlertMessage(alert: Alert, duration: string): string {
    const parts = [
      `ID: ${alert.id}`,
      `Status: ${alert.status.toUpperCase()}`,
      `Message: ${alert.message}`,
      `Started: ${alert.startTime.toISOString()}`,
      duration,
    ];

    if (alert.acknowledgedBy) {
      parts.push(
        `Acknowledged by: ${alert.acknowledgedBy} at ${alert.acknowledgedAt?.toISOString()}`
      );
    }

    return parts.join(' | ');
  }

  private getSeverityEmoji(severity: string): string {
    const emojiMap: Record<string, string> = {
      critical: '🔥',
      high: '⚠️',
      medium: '⚡',
      low: 'ℹ️',
      info: '📋',
    };

    return emojiMap[severity] || '📢';
  }
}
