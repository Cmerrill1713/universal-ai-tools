import { EventEmitter } from 'events';
interface MCPHealthStatus {
    isRunning: boolean;
    lastPing?: number;
    processId?: number;
    uptime?: number;
    messageCount: number;
    errorCount: number;
}
export declare class MCPIntegrationService extends EventEmitter {
    private supabaseMCPProcess;
    private supabase;
    private isConnected;
    private messageQueue;
    private healthStatus;
    private startTime;
    private readonly maxRetries;
    private retryCount;
    private hasSupabaseConfig;
    constructor();
    private setupEventHandlers;
    start(): Promise<boolean>;
    private setupProcessHandlers;
    private waitForReady;
    sendMessage(method: string, params?: unknown): Promise<unknown>;
    private fallbackOperation;
    private fallbackSaveContext;
    private fallbackSearchContext;
    private fallbackGetRecentContext;
    private fallbackSaveCodePattern;
    private fallbackGetCodePatterns;
    private fallbackProposeMigration;
    private ensureTablesExist;
    getHealthStatus(): MCPHealthStatus;
    ping(): Promise<boolean>;
    restart(): Promise<boolean>;
    shutdown(): Promise<void>;
    isRunning(): boolean;
    getStatus(): {
        status: string;
        connected: boolean;
        health: MCPHealthStatus;
        uptime?: number;
    };
}
export declare const mcpIntegrationService: MCPIntegrationService;
export {};
//# sourceMappingURL=mcp-integration-service.d.ts.map