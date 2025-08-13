import { EventEmitter } from 'events';
export interface BaseService {
    name: string;
    version: string;
    status: 'active' | 'inactive' | 'error' | 'initializing';
    initialize(): Promise<void>;
    shutdown(): Promise<void>;
    healthCheck(): Promise<boolean>;
}
export interface ServiceInfo {
    name: string;
    version: string;
    status: string;
    type: string;
    domain: string;
    instance: BaseService;
    metadata: Record<string, any>;
    registeredAt: Date;
    lastHealthCheck?: Date;
    dependencies?: string[];
}
export interface ServiceDependency {
    serviceName: string;
    required: boolean;
    version?: string;
}
declare class ServiceRegistry extends EventEmitter {
    private readonly services;
    private readonly dependencies;
    private isShuttingDown;
    private healthCheckInterval?;
    constructor();
    register(service: BaseService, options: {
        type: string;
        domain: string;
        metadata?: Record<string, any>;
        dependencies?: ServiceDependency[];
    }): void;
    unregister(serviceName: string): void;
    get<T extends BaseService>(serviceName: string): T | null;
    getByType<T extends BaseService>(type: string): T[];
    getByDomain<T extends BaseService>(domain: string): T[];
    getAll(): ServiceInfo[];
    getAllActive(): ServiceInfo[];
    exists(serviceName: string): boolean;
    getServiceInfo(serviceName: string): ServiceInfo | null;
    initializeAll(): Promise<void>;
    initializeService(serviceName: string): Promise<void>;
    shutdownAll(): Promise<void>;
    shutdownService(serviceName: string): Promise<void>;
    private checkDependencies;
    private calculateInitializationOrder;
    private calculateShutdownOrder;
    private startHealthChecks;
    private performHealthChecks;
    private updateServiceStatus;
    getStats(): {
        totalServices: number;
        activeServices: number;
        inactiveServices: number;
        errorServices: number;
        byDomain: Record<string, number>;
        byType: Record<string, number>;
    };
}
export declare const serviceRegistry: ServiceRegistry;
export {};
//# sourceMappingURL=service-registry.d.ts.map