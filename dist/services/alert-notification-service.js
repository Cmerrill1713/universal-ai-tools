import axios from 'axios';
import { EventEmitter } from 'events';
import nodemailer from 'nodemailer';
import { TWO } from '@/utils/constants';
import { log, LogContext } from '@/utils/logger';
export class AlertNotificationService extends EventEmitter {
    config;
    lastAlerts = new Map();
    emailTransporter;
    constructor(config) {
        super();
        this.config = {
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
    getDefaultChannels() {
        const channels = [
            {
                type: 'console',
                config: {},
                enabled: true,
            },
        ];
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
    initializeChannels() {
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
    async checkSystemHealth(health) {
        if (!this.config.enabled)
            return;
        const alerts = [];
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
        this.checkServiceSpecificAlerts(health.services, alerts);
        for (const alert of alerts) {
            await this.sendAlert(alert);
        }
    }
    checkServiceSpecificAlerts(services, alerts) {
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
        const dbService = services.find((s) => s.name === 'database');
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
    async sendAlert(alert) {
        const alertKey = `${alert.severity}-${alert.service || 'system'}`;
        const lastAlert = this.lastAlerts.get(alertKey);
        if (lastAlert) {
            const cooldownMs = this.config.cooldownMinutes * 60 * 1000;
            if (Date.now() - lastAlert.getTime() < cooldownMs) {
                log.debug(`Alert cooldown active for ${alertKey}`, LogContext.SYSTEM);
                return;
            }
        }
        this.lastAlerts.set(alertKey, new Date());
        const enabledChannels = this.config.channels.filter((c) => c.enabled);
        const sendPromises = enabledChannels.map((channel) => this.sendToChannel(channel, alert).catch((error) => {
            log.error(`Failed to send alert to ${channel.type}`, LogContext.SYSTEM, { error });
        }));
        await Promise.all(sendPromises);
        this.emit('alert', alert);
    }
    async sendToChannel(channel, alert) {
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
    sendToConsole(alert) {
        const severityColor = {
            info: 'x1b[36m',
            warning: 'x1b[33m',
            critical: 'x1b[31m',
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
        console.log('---');
    }
    async sendToEmail(channel, alert) {
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
        const config = channel.config;
        await this.emailTransporter.sendMail({
            from: config.from,
            to: config.to,
            subject: `[${alert.severity.toUpperCase()}] ${alert.title}`,
            html,
        });
        log.info(`Email alert sent to ${config.to}`, LogContext.SYSTEM);
    }
    async sendToSlack(channel, alert) {
        const color = {
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
        const config = channel.config;
        await axios.post(config.webhookUrl, payload);
        log.info('Slack alert sent', LogContext.SYSTEM);
    }
    async sendToWebhook(channel, alert) {
        const config = channel.config;
        await axios.post(config.url, {
            ...alert,
            source: 'universal-ai-tools',
        }, {
            headers: config.headers || {},
        });
        log.info(`Webhook alert sent to ${config.url}`, LogContext.SYSTEM);
    }
    async sendTestAlert() {
        const testAlert = {
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
    getAlertHistory() {
        return Array.from(this.lastAlerts.entries()).map(([key, date]) => ({
            alertKey: key,
            lastSent: date,
        }));
    }
    updateConfig(config) {
        this.config = { ...this.config, ...config };
        this.initializeChannels();
    }
    setEnabled(enabled) {
        this.config.enabled = enabled;
        log.info(`Alert notifications ${enabled ? 'enabled' : 'disabled'}`, LogContext.SYSTEM);
    }
}
export const alertService = new AlertNotificationService();
//# sourceMappingURL=alert-notification-service.js.map