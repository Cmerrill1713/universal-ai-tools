/**
 * Optimized Collaboration Engine
 * Implements MAC-SPGG (Multi-Agent Cooperation Sequential Public Goods Game) concepts
 * for improved agent collaboration and self-healing
 */

import { EventEmitter } from 'events';

import { log,LogContext } from '@/utils/logger';

import { a2aMesh } from './a2a-communication-mesh';
import { healthMonitor } from './health-monitor-service';

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

export class OptimizedCollaborationEngine extends EventEmitter {
  private sessions: Map<string, CollaborationSession> = new Map();
  private games: Map<string, PublicGoodsGame> = new Map();
  private incentiveStructure: IncentiveStructure = {
    cooperationReward: 1.0,
    defectionPenalty: -0.5,
    contributionThreshold: 0.7,
    consensusBonus: 0.3,
  };

  constructor() {
    super();
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Listen for health monitor events
    healthMonitor.on('agent_failure', this.handleAgentFailure.bind(this));
    healthMonitor.on('system_degraded', this.handleSystemDegradation.bind(this));

    // Listen for A2A mesh events
    a2aMesh.on('message_sent', this.handleMessageSent.bind(this));
    a2aMesh.on('collaboration_started', this.handleCollaborationStarted.bind(this));
  }

  /**
   * Create a new collaboration session with MAC-SPGG mechanics
   */
  async createCollaborationSession(
    task: string,
    participants: string[],
    options?: {
      incentiveStructure?: Partial<IncentiveStructure>;
      timeout?: number;
    }
  ): Promise<CollaborationSession> {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create public goods game
    const game: PublicGoodsGame = {
      id: `game_${sessionId}`,
      participants,
      contributions: new Map(),
      totalContribution: 0,
      optimalContribution: participants.length * this.incentiveStructure.contributionThreshold,
      status: 'active',
      startTime: new Date(),
    };

    // Create collaboration session
    const session: CollaborationSession = {
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

    // Notify participants
    await this.notifyParticipants(sessionId, 'session_created', { sessionId, task });

    log.info(`🎯 Created collaboration session: ${sessionId}`, LogContext.AGENT, {
      task,
      participants: participants.length,
    });

    this.emit('session_created', session);
    return session;
  }

  /**
   * Submit a decision in sequential order
   */
  async submitDecision(
    sessionId: string,
    agentId: string,
    decision: unknown,
    confidence: number,
    reasoning: string
  ): Promise<SequentialDecision> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    if (!session.participants.includes(agentId)) {
      throw new Error(`Agent ${agentId} not in session ${sessionId}`);
    }

    const sequentialDecision: SequentialDecision = {
      id: `decision_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      agentId,
      decision,
      confidence,
      timestamp: new Date(),
      reasoning,
    };

    session.decisions.push(sequentialDecision);

    // Update game contribution based on decision quality
    const contribution = this.calculateContribution(decision, confidence, reasoning);
    session.game.contributions.set(agentId, contribution);
    session.game.totalContribution += contribution;

    log.info(`📊 Decision submitted in session ${sessionId}`, LogContext.AGENT, {
      agentId,
      confidence,
      contribution,
    });

    // Check if all participants have decided
    if (session.decisions.length === session.participants.length) {
      await this.buildConsensus(sessionId);
    }

    this.emit('decision_submitted', { sessionId, decision: sequentialDecision });
    return sequentialDecision;
  }

  /**
   * Build consensus using game-theoretic principles
   */
  private async buildConsensus(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    try {
      // Calculate consensus using weighted voting based on contributions
      const consensus = await this.calculateWeightedConsensus(session);
      const confidence = this.calculateConsensusConfidence(session);

      session.consensus = consensus;
      session.confidence = confidence;
      session.status = 'consensus';

      // Apply incentives based on contribution levels
      await this.applyIncentives(session);

      log.info(`🤝 Consensus built for session ${sessionId}`, LogContext.AGENT, {
        confidence,
        totalContribution: session.game.totalContribution,
        optimalContribution: session.game.optimalContribution,
      });

      this.emit('consensus_built', { sessionId, consensus, confidence });
    } catch (error) {
      log.error(`❌ Failed to build consensus for session ${sessionId}`, LogContext.AGENT, {
        error: error instanceof Error ? error.message : String(error),
      });

      session.status = 'failed';
      this.emit('consensus_failed', { sessionId, error });
    }
  }

  /**
   * Calculate weighted consensus based on contributions
   */
  private async calculateWeightedConsensus(session: CollaborationSession): Promise<unknown> {
    const {decisions} = session;
    const {contributions} = session.game;

    // Weight decisions by contribution level
    const weightedDecisions = decisions.map((decision) => ({
      ...decision,
      weight: contributions.get(decision.agentId) || 0,
    }));

    // Sort by weight (highest contribution first)
    weightedDecisions.sort((a, b) => b.weight - a.weight);

    // Use the highest weighted decision as base consensus
    const baseConsensus = weightedDecisions[0]?.decision;

    // If contributions are high enough, use simple consensus
    if (session.game.totalContribution >= session.game.optimalContribution) {
      return baseConsensus;
    }

    // Otherwise, use more sophisticated consensus building
    return await this.buildSophisticatedConsensus(weightedDecisions);
  }

  /**
   * Build sophisticated consensus when contributions are low
   */
  private async buildSophisticatedConsensus(
    weightedDecisions: (SequentialDecision & { weight: number })[]
  ): Promise<unknown> {
    // Implement sophisticated consensus algorithm
    // This could involve:
    // - Multi-round voting
    // - Conflict resolution
    // - Compromise finding
    // - External validation

    // For now, return the most confident decision
    const mostConfident = weightedDecisions.reduce((best, current) =>
      current.confidence > best.confidence ? current : best
    );

    return mostConfident.decision;
  }

  /**
   * Calculate consensus confidence
   */
  private calculateConsensusConfidence(session: CollaborationSession): number {
    const {decisions} = session;
    const {totalContribution} = session.game;
    const {optimalContribution} = session.game;

    // Base confidence from average decision confidence
    const avgConfidence = decisions.reduce((sum, d) => sum + d.confidence, 0) / decisions.length;

    // Adjust based on contribution level
    const contributionRatio = Math.min(totalContribution / optimalContribution, 1.0);

    // Final confidence combines both factors
    return avgConfidence * 0.7 + contributionRatio * 0.3;
  }

  /**
   * Calculate contribution based on decision quality
   */
  private calculateContribution(decision: unknown, confidence: number, reasoning: string): number {
    let contribution = 0;

    // Base contribution from confidence
    contribution += confidence * 0.5;

    // Bonus for detailed reasoning
    if (reasoning.length > 100) {
      contribution += 0.2;
    }

    // Bonus for high confidence
    if (confidence > 0.8) {
      contribution += 0.3;
    }

    return Math.min(contribution, 1.0);
  }

  /**
   * Apply incentives based on contribution levels
   */
  private async applyIncentives(session: CollaborationSession): Promise<void> {
    const {game} = session;
    const {participants} = session;

    for (const participant of participants) {
      const contribution = game.contributions.get(participant) || 0;
      const threshold = this.incentiveStructure.contributionThreshold;

      if (contribution >= threshold) {
        // Reward cooperation
        await this.rewardAgent(participant, this.incentiveStructure.cooperationReward);
        log.info(`🏆 Rewarded agent ${participant} for cooperation`, LogContext.AGENT, {
          contribution,
          reward: this.incentiveStructure.cooperationReward,
        });
      } else {
        // Penalize defection
        await this.penalizeAgent(participant, this.incentiveStructure.defectionPenalty);
        log.warn(`⚠️ Penalized agent ${participant} for low contribution`, LogContext.AGENT, {
          contribution,
          penalty: this.incentiveStructure.defectionPenalty,
        });
      }
    }

    // Bonus for reaching consensus
    if (session.confidence > 0.8) {
      for (const participant of participants) {
        await this.rewardAgent(participant, this.incentiveStructure.consensusBonus);
      }
    }
  }

  /**
   * Reward an agent (update trust/collaboration scores)
   */
  private async rewardAgent(agentId: string, reward: number): Promise<void> {
    try {
      // Update A2A mesh trust levels
      const connections = a2aMesh.getAgentConnections();
      const connection = connections.find((conn) => conn.agentName === agentId);

      if (connection) {
        connection.trustLevel = Math.min(connection.trustLevel + reward, 1.0);
        connection.collaborationScore = Math.min(connection.collaborationScore + reward, 1.0);
      }

      // Report to health monitor
      healthMonitor.emit('agent_rewarded', { agentId, reward });
    } catch (error) {
      log.error(`Failed to reward agent ${agentId}`, LogContext.AGENT, { error });
    }
  }

  /**
   * Penalize an agent
   */
  private async penalizeAgent(agentId: string, penalty: number): Promise<void> {
    try {
      // Update A2A mesh trust levels
      const connections = a2aMesh.getAgentConnections();
      const connection = connections.find((conn) => conn.agentName === agentId);

      if (connection) {
        connection.trustLevel = Math.max(connection.trustLevel + penalty, 0.0);
        connection.collaborationScore = Math.max(connection.collaborationScore + penalty, 0.0);
      }

      // Report to health monitor
      healthMonitor.emit('agent_penalized', { agentId, penalty });
    } catch (error) {
      log.error(`Failed to penalize agent ${agentId}`, LogContext.AGENT, { error });
    }
  }

  /**
   * Handle agent failures with self-healing
   */
  private async handleAgentFailure(failure: any): Promise<void> {
    const { agentName, error } = failure;

    log.warn(`🔄 Handling agent failure: ${agentName}`, LogContext.AGENT, { error });

    // Find active sessions involving this agent
    const affectedSessions = Array.from(this.sessions.values()).filter(
      (session) => session.participants.includes(agentName) && session.status === 'active'
    );

    for (const session of affectedSessions) {
      // Remove failed agent from session
      session.participants = session.participants.filter((p) => p !== agentName);

      // Recalculate optimal contribution
      session.game.optimalContribution =
        session.participants.length * this.incentiveStructure.contributionThreshold;

      log.info(`🔄 Removed failed agent ${agentName} from session ${session.id}`, LogContext.AGENT);

      // If enough participants remain, continue
      if (session.participants.length >= 2) {
        this.emit('agent_replaced', { sessionId: session.id, failedAgent: agentName });
      } else {
        // Not enough participants, fail the session
        session.status = 'failed';
        this.emit('session_failed', { sessionId: session.id, reason: 'insufficient_participants' });
      }
    }
  }

  /**
   * Handle system degradation
   */
  private async handleSystemDegradation(metrics: any): Promise<void> {
    log.warn('🔄 System degradation detected, optimizing collaboration', LogContext.SYSTEM, {
      metrics,
    });

    // Reduce collaboration complexity during system stress
    this.incentiveStructure.contributionThreshold = Math.max(
      this.incentiveStructure.contributionThreshold * 0.8,
      0.5
    );

    // Notify active sessions
    for (const session of this.sessions.values()) {
      if (session.status === 'active') {
        this.emit('session_degraded', { sessionId: session.id, reason: 'system_stress' });
      }
    }
  }

  /**
   * Handle A2A message events
   */
  private handleMessageSent(message: any): void {
    // Track message patterns for optimization
    this.emit('message_tracked', message);
  }

  /**
   * Handle collaboration events
   */
  private handleCollaborationStarted(collaboration: any): void {
    // Optimize collaboration parameters based on historical data
    this.emit('collaboration_optimized', collaboration);
  }

  /**
   * Notify participants of session events
   */
  private async notifyParticipants(sessionId: string, event: string, data: any): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    for (const participant of session.participants) {
      try {
        await a2aMesh.sendMessage({
          // id: `notification_${Date.now()}`,
          from: 'collaboration_engine',
          to: participant,
          type: 'notification',
          payload: { event, sessionId, ...data },
          priority: 'medium',
        });
      } catch (error) {
        log.error(`Failed to notify participant ${participant}`, LogContext.AGENT, { error });
      }
    }
  }

  /**
   * Get session status
   */
  getSession(sessionId: string): CollaborationSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): CollaborationSession[] {
    return Array.from(this.sessions.values()).filter((s) => s.status === 'active');
  }

  /**
   * Get collaboration statistics
   */
  getCollaborationStats(): {
    totalSessions: number;
    activeSessions: number;
    successRate: number;
    avgConfidence: number;
    avgContribution: number;
  } {
    const sessions = Array.from(this.sessions.values());
    const completedSessions = sessions.filter((s) => s.status === 'completed');
    const activeSessions = sessions.filter((s) => s.status === 'active');

    const successRate = completedSessions.length / Math.max(sessions.length, 1);
    const avgConfidence =
      sessions.reduce((sum, s) => sum + s.confidence, 0) / Math.max(sessions.length, 1);
    const avgContribution =
      sessions.reduce((sum, s) => sum + s.game.totalContribution, 0) / Math.max(sessions.length, 1);

    return {
      totalSessions: sessions.length,
      activeSessions: activeSessions.length,
      successRate,
      avgConfidence,
      avgContribution,
    };
  }

  /**
   * Shutdown the collaboration engine
   */
  async shutdown(): Promise<void> {
    log.info('🔄 Shutting down optimized collaboration engine', LogContext.SYSTEM);

    // Complete active sessions
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

// Export singleton instance
export const optimizedCollaborationEngine = new OptimizedCollaborationEngine();
export default optimizedCollaborationEngine;
