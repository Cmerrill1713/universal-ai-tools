interface NetworkIssue {
    id: string;
    type: 'connection_refused' | 'timeout' | 'dns_error' | 'ssl_error' | 'port_blocked';
    service: string;
    endpoint: string;
    port: number;
    severity: 'high' | 'medium' | 'low';
    description: string;
    lastSeen: Date;
    count: number;
}
interface HealingStrategy {
    name: string;
    description: string;
    execute: () => Promise<boolean>;
    estimatedTime: number;
}
declare class NetworkHealingService {
    private isRunning;
    private networkIssues;
    private healingInterval;
    private monitoringInterval;
    private completedHealings;
    private coreServices;
    constructor();
    start(): Promise<void>;
    monitorNetworkHealth(): Promise<void>;
    checkServiceHealth(service: {
        name: string;
        port: number;
        endpoint: string;
    }): Promise<void>;
    private validatePort;
    private executeSecureCommand;
    checkPort(port: number): Promise<boolean>;
    checkProcessHealth(): Promise<void>;
    analyzeLogs(): Promise<void>;
    recordNetworkIssue(issue: NetworkIssue): void;
    runHealingCycle(): Promise<void>;
    healNetworkIssue(issue: NetworkIssue): Promise<void>;
    getHealingStrategies(issue: NetworkIssue): HealingStrategy[];
    private validateServiceName;
    restartService(serviceName: string): Promise<boolean>;
    checkAndStartService(serviceName: string, port: number): Promise<boolean>;
    killPortProcess(port: number): Promise<boolean>;
    resetNetworkConfiguration(): Promise<boolean>;
    increaseTimeouts(): Promise<boolean>;
    private validatePid;
    restartHighCpuProcesses(): Promise<boolean>;
    genericNetworkFix(): Promise<boolean>;
    private sleep;
    getStatus(): object;
    stop(): void;
}
export { NetworkHealingService };
//# sourceMappingURL=network-healing-service.d.ts.map