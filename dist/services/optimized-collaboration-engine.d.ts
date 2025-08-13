import { EventEmitter } from 'events';
export interface SequentialDecision {
    id: string;
    agentId: string;
    decision: unknown;
    confidence: number;
    timestamp: Date;
    reasoning: string;
}
export interface PublicGoodsGame {
    id: string;
    participants: string[];
    contributions: Map<string, number>;
    totalContribution: number;
    optimalContribution: number;
    status: 'active' | 'completed' | 'failed';
    startTime: Date;
    endTime?: Date;
}
export interface IncentiveStructure {
    cooperationReward: number;
    defectionPenalty: number;
    contributionThreshold: number;
    consensusBonus: number;
}
export interface CollaborationSession {
    id: string;
    task: string;
    participants: string[];
    decisions: SequentialDecision[];
    game: PublicGoodsGame;
    consensus: unknown;
    confidence: number;
    status: 'forming' | 'active' | 'consensus' | 'completed' | 'failed';
    startTime: Date;
    endTime?: Date;
}
export declare class OptimizedCollaborationEngine extends EventEmitter {
    private sessions;
    private games;
    private incentiveStructure;
    constructor();
    private setupEventListeners;
    createCollaborationSession(task: string, participants: string[], options?: {
        incentiveStructure?: Partial<IncentiveStructure>;
        timeout?: number;
    }): Promise<CollaborationSession>;
    submitDecision(sessionId: string, agentId: string, decision: unknown, confidence: number, reasoning: string): Promise<SequentialDecision>;
    private buildConsensus;
    private calculateWeightedConsensus;
    private buildSophisticatedConsensus;
    private calculateConsensusConfidence;
    private calculateContribution;
    private applyIncentives;
    private rewardAgent;
    private penalizeAgent;
    private handleAgentFailure;
    private handleSystemDegradation;
    private handleMessageSent;
    private handleCollaborationStarted;
    private notifyParticipants;
    getSession(sessionId: string): CollaborationSession | undefined;
    getActiveSessions(): CollaborationSession[];
    getCollaborationStats(): {
        totalSessions: number;
        activeSessions: number;
        successRate: number;
        avgConfidence: number;
        avgContribution: number;
    };
    shutdown(): Promise<void>;
}
export declare const optimizedCollaborationEngine: OptimizedCollaborationEngine;
export default optimizedCollaborationEngine;
//# sourceMappingURL=optimized-collaboration-engine.d.ts.map