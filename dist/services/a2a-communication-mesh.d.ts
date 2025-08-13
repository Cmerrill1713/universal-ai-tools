import { EventEmitter } from 'events';
export interface A2AMessage {
    id: string;
    from: string;
    to: string | 'broadcast';
    type: 'request' | 'response' | 'notification' | 'knowledge_share' | 'collaboration';
    payload: unknown;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    timestamp: Date;
    ttl?: number;
    requiresResponse?: boolean;
    conversationId?: string;
}
export interface A2AResponse {
    messageId: string;
    from: string;
    to: string;
    success: boolean;
    data?: unknown;
    error?: string;
    executionTime: number;
    timestamp: Date;
}
export interface AgentConnection {
    agentName: string;
    capabilities: string[];
    status: 'online' | 'busy' | 'offline';
    lastSeen: Date;
    messageQueue: A2AMessage[];
    collaborationScore: number;
    trustLevel: number;
}
export interface CollaborationRequest {
    initiator: string;
    participants: string[];
    task: string;
    context: unknown;
    expectedDuration: number;
    priority: 'low' | 'medium' | 'high';
}
export interface CollaborationSession {
    id: string;
    participants: string[];
    task: string;
    startTime: Date;
    status: 'active' | 'completed' | 'failed';
    sharedContext: Map<string, any>;
    messageHistory: A2AMessage[];
    results: Map<string, any>;
}
export declare class A2ACommunicationMesh extends EventEmitter {
    private agents;
    private messageQueue;
    private activeCollaborations;
    private messageHistory;
    private knowledgeGraph;
    private routingTable;
    constructor();
    private initializeMesh;
    registerAgent(agentName: string, capabilities: string[], trustLevel?: number): void;
    sendMessage(message: Omit<A2AMessage, 'id' | 'timestamp'>): Promise<string>;
    requestCollaboration(request: CollaborationRequest): Promise<string>;
    shareKnowledge(from: string, knowledge: {
        type: string;
        data: unknown;
        relevantTo: string[];
        confidence: number;
    }): Promise<void>;
    findOptimalAgent(requiredCapabilities: string[]): string | null;
    findAgentTeam(requiredCapabilities: string[], teamSize?: number): string[];
    private intelligentRouting;
    private fallbackRouting;
    private routeMessage;
    private processMessageQueues;
    private maintainMesh;
    private monitorCollaborations;
    private updateKnowledgeGraph;
    private findRelevantAgents;
    private calculateCapabilityMatch;
    private validateMessage;
    private cleanupExpiredMessages;
    private optimizeRouting;
    private performBasicRoutingOptimization;
    private notifyCollaborationEnd;
    private generateMessageId;
    private generateSessionId;
    getMeshStatus(): {
        totalAgents: number;
        onlineAgents: number;
        activeCollaborations: number;
        messagesInQueue: number;
        meshHealth: number;
    };
    getAgentConnections(): AgentConnection[];
    getCollaborationHistory(): CollaborationSession[];
    shutdown(): Promise<void>;
    private broadcastMessage;
}
export declare const a2aMesh: A2ACommunicationMesh;
export default a2aMesh;
//# sourceMappingURL=a2a-communication-mesh.d.ts.map