import { EventEmitter } from 'events';
interface SwarmAgent {
    id: string;
    type: string;
    role: 'queen' | 'worker' | 'coordinator';
    status: 'idle' | 'active' | 'processing' | 'error';
    capabilities: string[];
    currentTask?: string;
    performance?: {
        tasksCompleted: number;
        successRate: number;
        averageResponseTime: number;
    };
}
export declare class ClaudeFlowIntegrationService extends EventEmitter {
    private static instance;
    private claudeFlowProcess;
    private hiveMindState;
    private config;
    private supabase;
    private agentRegistry;
    private abMctsOrchestrator;
    private parameterService;
    private isInitialized;
    private constructor();
    static getInstance(): ClaudeFlowIntegrationService;
    initialize(): Promise<void>;
    private initializeClaudeFlow;
    private setupHiveMind;
    private connectMemorySystems;
    private integrateWithABMCTS;
    private setupMCPTools;
    executeSwarmTask(task: string, options?: {
        urgency?: 'low' | 'medium' | 'high';
        consensusRequired?: boolean;
        maxAgents?: number;
    }): Promise<any>;
    private selectBestAgent;
    private calculateCapabilityScore;
    private assignTaskToAgent;
    private storeInMemory;
    getHiveMindStatus(): {
        active: boolean;
        topology: string;
        agentCount: number;
        activeAgents: number;
        memorySize: number;
    };
    spawnAgent(type: string, capabilities: string[]): Promise<SwarmAgent>;
    executeConsensusDecision(question: string, options: string[]): Promise<string>;
    shutdown(): Promise<void>;
}
declare const _default: ClaudeFlowIntegrationService;
export default _default;
//# sourceMappingURL=claude-flow-integration-service.d.ts.map