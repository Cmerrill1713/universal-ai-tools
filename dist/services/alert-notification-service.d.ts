import { EventEmitter } from 'events';
import type { SystemHealth } from './health-monitor';
export interface AlertConfig {
    enabled: boolean;
    channels: AlertChannel[];
    thresholds: {
        degradedServices: number;
        unhealthyServices: number;
        errorRatePercent: number;
        memoryUsagePercent: number;
    };
    cooldownMinutes: number;
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
export declare class AlertNotificationService extends EventEmitter {
    private config;
    private lastAlerts;
    private emailTransporter?;
    constructor(config?: Partial<AlertConfig>);
    private getDefaultChannels;
    private initializeChannels;
    checkSystemHealth(health: SystemHealth): Promise<void>;
    private checkServiceSpecificAlerts;
    private sendAlert;
    private sendToChannel;
    private sendToConsole;
    private sendToEmail;
    private sendToSlack;
    private sendToWebhook;
    sendTestAlert(): Promise<void>;
    getAlertHistory(): {
        alertKey: string;
        lastSent: Date;
    }[];
    updateConfig(config: Partial<AlertConfig>): void;
    setEnabled(enabled: boolean): void;
}
export declare const alertService: AlertNotificationService;
//# sourceMappingURL=alert-notification-service.d.ts.map