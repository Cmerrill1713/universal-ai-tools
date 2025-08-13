import { EventEmitter } from 'events';
import type AgentRegistry from '@/agents/agent-registry';
export interface HealthMetrics {
    systemHealth: number;
    agentHealth: number;
    meshHealth: number;
    memoryUsage: number;
    cpuUsage: number;
    errorRate: number;
    responseTime: number;
    timestamp: Date;
}
export interface HealthIssue {
    id: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    component: string;
    description: string;
    autoFixable: boolean;
    timestamp: Date;
}
export declare class HealthMonitorService extends EventEmitter {
    private agentRegistry;
    private healthHistory;
    private activeIssues;
    private monitoringInterval;
    private healingInterval;
    private isMonitoring;
    constructor();
    setAgentRegistry(agentRegistry: AgentRegistry): void;
    private startMonitoring;
    private performHealthCheck;
    private calculateSystemHealth;
    private calculateErrorRate;
    private measureResponseTime;
    private detectIssues;
    private performSelfHealing;
    private healIssue;
    private healMemoryUsage;
    private healAgentHealth;
    private healMeshConnectivity;
    getCurrentHealth(): HealthMetrics | null;
    getHealthHistory(limit?: number): HealthMetrics[];
    getActiveIssues(): HealthIssue[];
    forceHealthCheck(): Promise<HealthMetrics>;
    forceSelfHealing(): Promise<void>;
    getHealthSummary(): {
        overallHealth: number;
        issueCount: number;
        criticalIssues: number;
        uptimeHours: number;
    };
    shutdown(): Promise<void>;
}
export declare const healthMonitor: HealthMonitorService;
export default healthMonitor;
//# sourceMappingURL=health-monitor-service.d.ts.map