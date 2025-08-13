import { EventEmitter } from 'events';
export interface ServiceHealth {
    name: string;
    status: 'healthy' | 'degraded' | 'unhealthy';
    lastCheck: Date;
    responseTime?: number;
    error?: string;
    details?: Record<string, any>;
}
export interface HealthMetrics {
    systemHealth: number;
    agentHealth: number;
    meshHealth: number;
    memoryUsage: number;
    cpuUsage: number;
    errorRate: number;
    responseTime: number;
    uptime: number;
    services: ServiceHealth[];
    alerts: HealthAlert[];
}
export interface HealthAlert {
    id: string;
    severity: 'info' | 'warning' | 'critical';
    message: string;
    service: string;
    timestamp: Date;
    resolved: boolean;
}
export interface HealthConfig {
    checkInterval: number;
    alertThresholds: {
        cpuUsage: number;
        memoryUsage: number;
        errorRate: number;
        responseTime: number;
    };
    autoHeal: boolean;
    services: string[];
}
declare class UnifiedHealthMonitor extends EventEmitter {
    private readonly config;
    private readonly services;
    private readonly alerts;
    private readonly metrics;
    private checkTimer?;
    private isInitialized;
    private circuitBreakers;
    private readonly startTime;
    constructor();
    initialize(): Promise<void>;
    private startHealthChecks;
    private startMetricsCollection;
    private performHealthChecks;
    private checkService;
    private performServiceCheck;
    private checkSupabase;
    private checkRedis;
    private checkLLMRouter;
    private checkMemoryService;
    private checkMCPIntegration;
    private checkGenericService;
    private collectSystemMetrics;
    private updateSystemHealth;
    private checkAlerts;
    private createAlert;
    private clearServiceAlerts;
    private attemptAutoHeal;
    private healSupabase;
    private healRedis;
    private healLLMRouter;
    getHealthStatus(): HealthMetrics;
    getServiceHealth(serviceName: string): ServiceHealth | null;
    getAlerts(includeResolved?: boolean): HealthAlert[];
    forceHealthCheck(serviceName?: string): Promise<void>;
    resolveAlert(alertId: string): void;
    updateConfig(newConfig: Partial<HealthConfig>): void;
    shutdown(): Promise<void>;
}
export declare const healthMonitor: UnifiedHealthMonitor;
export {};
//# sourceMappingURL=health-monitor.d.ts.map