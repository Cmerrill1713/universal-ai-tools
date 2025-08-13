import { EventEmitter } from 'events';
import { log, LogContext } from '@/utils/logger';
import { a2aMesh } from './a2a-communication-mesh';
import { healthMonitor } from './health-monitor-service';
export class OptimizedCollaborationEngine extends EventEmitter {
    sessions = new Map();
    games = new Map();
    incentiveStructure = {
        cooperationReward: 1.0,
        defectionPenalty: -0.5,
        contributionThreshold: 0.7,
        consensusBonus: 0.3,
    };
    constructor() {
        super();
        this.setupEventListeners();
    }
    setupEventListeners() {
        healthMonitor.on('agent_failure', this.handleAgentFailure.bind(this));
        healthMonitor.on('system_degraded', this.handleSystemDegradation.bind(this));
        a2aMesh.on('message_sent', this.handleMessageSent.bind(this));
        a2aMesh.on('collaboration_started', this.handleCollaborationStarted.bind(this));
    }
    async createCollaborationSession(task, participants, options) {
        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const game = {
            id: `game_${sessionId}`,
            participants,
            contributions: new Map(),
            totalContribution: 0,
            optimalContribution: participants.length * this.incentiveStructure.contributionThreshold,
            status: 'active',
            startTime: new Date(),
        };
        const session = {
            id: sessionId,
            task,
            participants,
            decisions: [],
            game,
            consensus: null,
            confidence: 0,
            status: 'forming',
            startTime: new Date(),
        };
        this.sessions.set(sessionId, session);
        this.games.set(game.id, game);
        await this.notifyParticipants(sessionId, 'session_created', { sessionId, task });
        log.info(`🎯 Created collaboration session: ${sessionId}`, LogContext.AGENT, {
            task,
            participants: participants.length,
        });
        this.emit('session_created', session);
        return session;
    }
    async submitDecision(sessionId, agentId, decision, confidence, reasoning) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error(`Session ${sessionId} not found`);
        }
        if (!session.participants.includes(agentId)) {
            throw new Error(`Agent ${agentId} not in session ${sessionId}`);
        }
        const sequentialDecision = {
            id: `decision_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            agentId,
            decision,
            confidence,
            timestamp: new Date(),
            reasoning,
        };
        session.decisions.push(sequentialDecision);
        const contribution = this.calculateContribution(decision, confidence, reasoning);
        session.game.contributions.set(agentId, contribution);
        session.game.totalContribution += contribution;
        log.info(`📊 Decision submitted in session ${sessionId}`, LogContext.AGENT, {
            agentId,
            confidence,
            contribution,
        });
        if (session.decisions.length === session.participants.length) {
            await this.buildConsensus(sessionId);
        }
        this.emit('decision_submitted', { sessionId, decision: sequentialDecision });
        return sequentialDecision;
    }
    async buildConsensus(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return;
        try {
            const consensus = await this.calculateWeightedConsensus(session);
            const confidence = this.calculateConsensusConfidence(session);
            session.consensus = consensus;
            session.confidence = confidence;
            session.status = 'consensus';
            await this.applyIncentives(session);
            log.info(`🤝 Consensus built for session ${sessionId}`, LogContext.AGENT, {
                confidence,
                totalContribution: session.game.totalContribution,
                optimalContribution: session.game.optimalContribution,
            });
            this.emit('consensus_built', { sessionId, consensus, confidence });
        }
        catch (error) {
            log.error(`❌ Failed to build consensus for session ${sessionId}`, LogContext.AGENT, {
                error: error instanceof Error ? error.message : String(error),
            });
            session.status = 'failed';
            this.emit('consensus_failed', { sessionId, error });
        }
    }
    async calculateWeightedConsensus(session) {
        const { decisions } = session;
        const { contributions } = session.game;
        const weightedDecisions = decisions.map((decision) => ({
            ...decision,
            weight: contributions.get(decision.agentId) || 0,
        }));
        weightedDecisions.sort((a, b) => b.weight - a.weight);
        const baseConsensus = weightedDecisions[0]?.decision;
        if (session.game.totalContribution >= session.game.optimalContribution) {
            return baseConsensus;
        }
        return await this.buildSophisticatedConsensus(weightedDecisions);
    }
    async buildSophisticatedConsensus(weightedDecisions) {
        const mostConfident = weightedDecisions.reduce((best, current) => current.confidence > best.confidence ? current : best);
        return mostConfident.decision;
    }
    calculateConsensusConfidence(session) {
        const { decisions } = session;
        const { totalContribution } = session.game;
        const { optimalContribution } = session.game;
        const avgConfidence = decisions.reduce((sum, d) => sum + d.confidence, 0) / decisions.length;
        const contributionRatio = Math.min(totalContribution / optimalContribution, 1.0);
        return avgConfidence * 0.7 + contributionRatio * 0.3;
    }
    calculateContribution(decision, confidence, reasoning) {
        let contribution = 0;
        contribution += confidence * 0.5;
        if (reasoning.length > 100) {
            contribution += 0.2;
        }
        if (confidence > 0.8) {
            contribution += 0.3;
        }
        return Math.min(contribution, 1.0);
    }
    async applyIncentives(session) {
        const { game } = session;
        const { participants } = session;
        for (const participant of participants) {
            const contribution = game.contributions.get(participant) || 0;
            const threshold = this.incentiveStructure.contributionThreshold;
            if (contribution >= threshold) {
                await this.rewardAgent(participant, this.incentiveStructure.cooperationReward);
                log.info(`🏆 Rewarded agent ${participant} for cooperation`, LogContext.AGENT, {
                    contribution,
                    reward: this.incentiveStructure.cooperationReward,
                });
            }
            else {
                await this.penalizeAgent(participant, this.incentiveStructure.defectionPenalty);
                log.warn(`⚠️ Penalized agent ${participant} for low contribution`, LogContext.AGENT, {
                    contribution,
                    penalty: this.incentiveStructure.defectionPenalty,
                });
            }
        }
        if (session.confidence > 0.8) {
            for (const participant of participants) {
                await this.rewardAgent(participant, this.incentiveStructure.consensusBonus);
            }
        }
    }
    async rewardAgent(agentId, reward) {
        try {
            const connections = a2aMesh.getAgentConnections();
            const connection = connections.find((conn) => conn.agentName === agentId);
            if (connection) {
                connection.trustLevel = Math.min(connection.trustLevel + reward, 1.0);
                connection.collaborationScore = Math.min(connection.collaborationScore + reward, 1.0);
            }
            healthMonitor.emit('agent_rewarded', { agentId, reward });
        }
        catch (error) {
            log.error(`Failed to reward agent ${agentId}`, LogContext.AGENT, { error });
        }
    }
    async penalizeAgent(agentId, penalty) {
        try {
            const connections = a2aMesh.getAgentConnections();
            const connection = connections.find((conn) => conn.agentName === agentId);
            if (connection) {
                connection.trustLevel = Math.max(connection.trustLevel + penalty, 0.0);
                connection.collaborationScore = Math.max(connection.collaborationScore + penalty, 0.0);
            }
            healthMonitor.emit('agent_penalized', { agentId, penalty });
        }
        catch (error) {
            log.error(`Failed to penalize agent ${agentId}`, LogContext.AGENT, { error });
        }
    }
    async handleAgentFailure(failure) {
        const { agentName, error } = failure;
        log.warn(`🔄 Handling agent failure: ${agentName}`, LogContext.AGENT, { error });
        const affectedSessions = Array.from(this.sessions.values()).filter((session) => session.participants.includes(agentName) && session.status === 'active');
        for (const session of affectedSessions) {
            session.participants = session.participants.filter((p) => p !== agentName);
            session.game.optimalContribution =
                session.participants.length * this.incentiveStructure.contributionThreshold;
            log.info(`🔄 Removed failed agent ${agentName} from session ${session.id}`, LogContext.AGENT);
            if (session.participants.length >= 2) {
                this.emit('agent_replaced', { sessionId: session.id, failedAgent: agentName });
            }
            else {
                session.status = 'failed';
                this.emit('session_failed', { sessionId: session.id, reason: 'insufficient_participants' });
            }
        }
    }
    async handleSystemDegradation(metrics) {
        log.warn('🔄 System degradation detected, optimizing collaboration', LogContext.SYSTEM, {
            metrics,
        });
        this.incentiveStructure.contributionThreshold = Math.max(this.incentiveStructure.contributionThreshold * 0.8, 0.5);
        for (const session of this.sessions.values()) {
            if (session.status === 'active') {
                this.emit('session_degraded', { sessionId: session.id, reason: 'system_stress' });
            }
        }
    }
    handleMessageSent(message) {
        this.emit('message_tracked', message);
    }
    handleCollaborationStarted(collaboration) {
        this.emit('collaboration_optimized', collaboration);
    }
    async notifyParticipants(sessionId, event, data) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return;
        for (const participant of session.participants) {
            try {
                await a2aMesh.sendMessage({
                    from: 'collaboration_engine',
                    to: participant,
                    type: 'notification',
                    payload: { event, sessionId, ...data },
                    priority: 'medium',
                });
            }
            catch (error) {
                log.error(`Failed to notify participant ${participant}`, LogContext.AGENT, { error });
            }
        }
    }
    getSession(sessionId) {
        return this.sessions.get(sessionId);
    }
    getActiveSessions() {
        return Array.from(this.sessions.values()).filter((s) => s.status === 'active');
    }
    getCollaborationStats() {
        const sessions = Array.from(this.sessions.values());
        const completedSessions = sessions.filter((s) => s.status === 'completed');
        const activeSessions = sessions.filter((s) => s.status === 'active');
        const successRate = completedSessions.length / Math.max(sessions.length, 1);
        const avgConfidence = sessions.reduce((sum, s) => sum + s.confidence, 0) / Math.max(sessions.length, 1);
        const avgContribution = sessions.reduce((sum, s) => sum + s.game.totalContribution, 0) / Math.max(sessions.length, 1);
        return {
            totalSessions: sessions.length,
            activeSessions: activeSessions.length,
            successRate,
            avgConfidence,
            avgContribution,
        };
    }
    async shutdown() {
        log.info('🔄 Shutting down optimized collaboration engine', LogContext.SYSTEM);
        for (const session of this.sessions.values()) {
            if (session.status === 'active') {
                session.status = 'failed';
                session.endTime = new Date();
            }
        }
        this.sessions.clear();
        this.games.clear();
        this.removeAllListeners();
    }
}
export const optimizedCollaborationEngine = new OptimizedCollaborationEngine();
export default optimizedCollaborationEngine;
//# sourceMappingURL=optimized-collaboration-engine.js.map