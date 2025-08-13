export interface ServiceHealth {
    name: string;
    status: 'healthy' | 'degraded' | 'unhealthy';
    lastCheck: Date;
    responseTime?: number;
    error?: string;
    details?: Record<string, any>;
}
export interface SystemHealth {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: Date;
    services: ServiceHealth[];
    summary: {
        healthy: number;
        degraded: number;
        unhealthy: number;
        total: number;
    };
}
export declare class HealthMonitor {
    private services;
    private checkInterval;
    private readonly CHECK_INTERVAL;
    private readonly TIMEOUT;
    constructor();
    private registerServices;
    start(): Promise<void>;
    stop(): void;
    checkAllServices(): Promise<SystemHealth>;
    private checkDatabase;
    private checkRedis;
    private checkOllama;
    private checkLFM2;
    private checkCircuitBreakers;
    private checkMemory;
    getSystemHealth(): SystemHealth;
    getServiceHealth(serviceName: string): ServiceHealth | undefined;
    checkService(serviceName: string): Promise<ServiceHealth | undefined>;
}
export declare const healthMonitor: HealthMonitor;
//# sourceMappingURL=health-monitor.d.ts.map