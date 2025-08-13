import { EventEmitter } from 'events';
import { type AgentDefinition } from '@/types';
import type { BaseAgent } from './base-agent';
import type { EnhancedBaseAgent } from './enhanced-base-agent';
export interface AgentLoadingLock {
    [agentName: string]: Promise<BaseAgent | null>;
}
export declare class AgentRegistry extends EventEmitter {
    private agentDefinitions;
    private loadedAgents;
    private agentUsage;
    private loadingLocks;
    private supabase;
    constructor();
    private registerBuiltInAgents;
    private registerAgent;
    private createEnhancedAgent;
    getAgent(agentName: string): Promise<BaseAgent | EnhancedBaseAgent | null>;
    private loadAgent;
    getAvailableAgents(): AgentDefinition[];
    getLoadedAgents(): string[];
    getCoreAgents(): string[];
    processRequest(agentName: string, context: unknown): Promise<unknown>;
    processParallelRequests(agentRequests: Array<{
        agentName: string;
        context: unknown;
    }>): Promise<Array<{
        agentName: string;
        result: unknown;
        error?: string;
    }>>;
    private createTaskRecord;
    private updateTaskRecord;
    orchestrateAgents(primaryAgent: string, supportingAgents: string[], context: unknown): Promise<{
        primary: unknown;
        supporting: Array<{
            agentName: string;
            result: unknown;
            error?: string;
        }>;
        synthesis?: unknown;
        optimization?: unknown;
    }>;
    requestCollaboration(task: string, requiredCapabilities: string[], teamSize?: number, initiator?: string): Promise<string>;
    shareKnowledge(fromAgent: string, knowledgeType: string, data: unknown, relevantCapabilities: string[], confidence?: number): Promise<void>;
    findOptimalAgent(requiredCapabilities: string[]): string | null;
    getMeshStatus(): unknown;
    unloadIdleAgents(maxIdleMinutes?: number): Promise<void>;
    shutdown(): Promise<void>;
}
export default AgentRegistry;
//# sourceMappingURL=agent-registry.d.ts.map