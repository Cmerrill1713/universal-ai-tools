/**
 * Agent-to-Agent (A2A) Communication Mesh Service
 * Direct communication between agents for collaborative intelligence
 * Competitive advantage: Distributed agent collective consciousness
 */

import { EventEmitter } from 'events';
import { LogContext, log } from '../utils/logger';
import { multiTierLLM } from './multi-tier-llm-service';
import { alphaEvolve } from './alpha-evolve-service';
import { THREE, TWO } from '../utils/constants';

export interface A2AMessage {
  id: string;
  from: string;
  to: string | 'broadcast';
  type: 'request' | 'response' | 'notification' | 'knowledge_share' | 'collaboration';
  payload: unknown;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  timestamp: Date;
  ttl?: number; // Time to live in milliseconds
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

export class A2ACommunicationMesh extends EventEmitter {
  private agents: Map<string, AgentConnection> = new Map();
  private messageQueue: Map<string, A2AMessage[]> = new Map();
  private activeCollaborations: Map<string, CollaborationSession> = new Map();
  private messageHistory: A2AMessage[] = [];
  private knowledgeGraph: Map<string, Set<string>> = new Map();
  private routingTable: Map<string, string[]> = new Map();

  constructor() {
    super();
    this.initializeMesh();
  }

  private initializeMesh(): void {
    log.info('🕸️ Initializing A2A communication mesh', LogContext.AI);

    // Start mesh maintenance cycle
    setInterval(() => this.maintainMesh(), 30000); // Every 30 seconds

    // Start message processing
    setInterval(() => this.processMessageQueues(), 1000); // Every second

    // Start collaboration monitoring
    setInterval(() => this.monitorCollaborations(), 5000); // Every 5 seconds

    log.info('✅ A2A communication mesh initialized', LogContext.AI);
  }

  /**
   * Register an agent in the mesh
   */
  public registerAgent(agentName: string, capabilities: string[], trustLevel = 0.8): void {
    const connection: AgentConnection = {
      agentName,
      capabilities,
      status: 'online',
      lastSeen: new Date(),
      messageQueue: [],
      collaborationScore: 0.0,
      trustLevel,
    };

    this.agents.set(agentName, connection);
    this.messageQueue.set(agentName, []);
    this.updateKnowledgeGraph(agentName, capabilities);

    log.info(`🤝 Agent registered in mesh: ${agentName}`, LogContext.AI, {
      capabilities: capabilities.length,
      trustLevel,
    });

    // Notify other agents of new member
    this.broadcastMessage({
      id: this.generateMessageId(),
      from: 'mesh_system',
      to: 'broadcast',
      type: 'notification',
      payload: {
        event: 'agent_joined',
        agentName,
        capabilities,
      },
      priority: 'medium',
      timestamp: new Date(),
    });
  }

  /**
   * Send message between agents
   */
  public async sendMessage(message: Omit<A2AMessage, 'id' | 'timestamp'>): Promise<string> {
    const fullMessage: A2AMessage = {
      ...message,
      id: this.generateMessageId(),
      timestamp: new Date(),
    };

    // Validate message
    if (!this.validateMessage(fullMessage)) {
      throw new Error('Invalid A2A message format');
    }

    // Route message
    await this.routeMessage(fullMessage);

    // Store in history
    this.messageHistory.push(fullMessage);
    if (this.messageHistory.length > 10000) {
      this.messageHistory = this.messageHistory.slice(-5000); // Keep recent 5000
    }
    return undefined;
    return undefined;

    log.info(`📨 A2A message sent: ${fullMessage.from} → ${fullMessage.to}`, LogContext.AI, {
      type: fullMessage.type,
      priority: fullMessage.priority,
    });

    return fullMessage.id;
  }

  /**
   * Request collaboration between multiple agents
   */
  public async requestCollaboration(request: CollaborationRequest): Promise<string> {
    const sessionId = this.generateSessionId();

    // Create collaboration session
    const session: CollaborationSession = {
      id: sessionId,
      participants: [request.initiator, ...request.participants],
      task: request.task,
      startTime: new Date(),
      status: 'active',
      sharedContext: new Map(),
      messageHistory: [],
      results: new Map(),
    };

    this.activeCollaborations.set(sessionId, session);

    // Notify all participants
    for (const participant of session.participants) {
      await this.sendMessage({
        from: 'mesh_system',
        to: participant,
        type: 'collaboration',
        payload: {
          event: 'collaboration_request',
          sessionId,
          task: request.task,
          participants: session.participants,
          context: request.context,
        },
        priority: request.priority,
        requiresResponse: true,
        conversationId: sessionId,
      });
    }

    log.info(`🤝 Collaboration session started: ${sessionId}`, LogContext.AI, {
      participants: session.participants.length,
      task: request.task,
    });

    return sessionId;
  }

  /**
   * Share knowledge between agents
   */
  public async shareKnowledge(
    from: string,
    knowledge: {
      type: string;
      data: unknown;
      relevantTo: string[];
      confidence: number;
    }
  ): Promise<void> {
    // Determine which agents would benefit from this knowledge
    const recipients = this.findRelevantAgents(knowledge.type, knowledge.relevantTo);

    for (const recipient of recipients) {
      if (recipient !== from) {
        await this.sendMessage({
          from,
          to: recipient,
          type: 'knowledge_share',
          payload: {
            knowledgeType: knowledge.type,
            data: knowledge.data,
            confidence: knowledge.confidence,
            source: from,
          },
          priority: 'medium',
        });
      }
    }

    log.info(`🧠 Knowledge shared: ${from} → ${recipients.length} agents`, LogContext.AI, {
      type: knowledge.type,
      confidence: knowledge.confidence,
    });
  }

  /**
   * Get agent by optimal capability match
   */
  public findOptimalAgent(requiredCapabilities: string[]): string | null {
    let bestAgent: string | null = null;
    let bestScore = 0;

    for (const [agentName, connection] of this.agents) {
      if (connection.status !== 'online') continue;

      const score =
        this.calculateCapabilityMatch(connection.capabilities, requiredCapabilities) *
        connection.trustLevel *
        (1 + connection.collaborationScore);

      if (score > bestScore) {
        bestScore = score;
        bestAgent = agentName;
      }

      return undefined;

      return undefined;
    }

    return bestAgent;
  }

  /**
   * Get multiple agents for distributed task
   */
  public findAgentTeam(requiredCapabilities: string[], teamSize = THREE): string[] {
    const candidates = Array.from(this.agents.entries())
      .filter(([_, connection]) => connection.status === 'online')
      .map(([agentName, connection]) => ({
        agentName,
        score:
          this.calculateCapabilityMatch(connection.capabilities, requiredCapabilities) *
          connection.trustLevel *
          (1 + connection.collaborationScore),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, teamSize);

    return candidates.map((c) => c.agentName);
  }

  /**
   * Process intelligent routing using LLM
   */
  private async intelligentRouting(message: A2AMessage): Promise<string[]> {
    if (message.to !== 'broadcast' && message.to !== 'auto') {
      return [message.to];
    }

    const routingPrompt = `Analyze this agent message and determine optimal routing:

MESSAGE: ${JSON.stringify(message, null, TWO)}

AVAILABLE AGENTS:
${Array.from(this.agents.entries())
  .map(
    ([name, conn]) =>
      `- ${name}: ${conn.capabilities.join(', ')} (status: ${conn.status}, trust: ${conn.trustLevel})`
  )
  .join('\n')}

ROUTING CONTEXT:
- Message type: ${message.type}
- Priority: ${message.priority}
- Requires response: ${message.requiresResponse}

Determine which agents should receive this message based on:
1. Capability relevance
2. Agent availability 
3. Trust levels
4. Current workload
5. Message priority

Respond with JSON:
{
  "recipients": ["agent1", "agent2"],
  "reasoning": "why these agents were selected",
  "routing_strategy": "broadcast|targeted|cascade",
  "expected_response_time": "estimated time in ms"
}`;

    try {
      const result = await multiTierLLM.execute(routingPrompt, {
        domain: 'reasoning',
        complexity: 'medium',
        agentName: 'a2a_router',
      });

      const routing = JSON.parse(result.response);

      log.info('🎯 Intelligent routing completed', LogContext.AI, {
        strategy: routing.routing_strategy,
        recipients: routing.recipients.length,
      });

      return routing.recipients;
    } catch (error) {
      log.warn('⚠️ Intelligent routing failed, using fallback', LogContext.AI);
      return this.fallbackRouting(message);
    }
  }

  private fallbackRouting(message: A2AMessage): string[] {
    if (message.type === 'collaboration') {
      return Array.from(this.agents.keys()).slice(0, THREE); // Top 3 agents
    }

    if (message.type === 'knowledge_share') {
      return this.findRelevantAgents('general', []);
    }

    // Default broadcast to online agents
    return Array.from(this.agents.entries())
      .filter(([_, conn]) => conn.status === 'online')
      .map(([name, _]) => name);
  }

  private async routeMessage(message: A2AMessage): Promise<void> {
    let recipients: string[];

    if (message.to === 'broadcast' || message.to === 'auto') {
      recipients = await this.intelligentRouting(message);
    } else {
      recipients = [message.to];
    }

    // Deliver to each recipient
    for (const recipient of recipients) {
      const connection = this.agents.get(recipient);
      if (connection) {
        connection.messageQueue.push(message);
        connection.lastSeen = new Date();

        // Emit event for real-time processing
        this.emit('message', { recipient, message });
      }
    }
  }

  private processMessageQueues(): void {
    for (const [agentName, connection] of this.agents) {
      if (connection.messageQueue.length > 0) {
        // Process high priority messages first
        connection.messageQueue.sort((a, b) => {
          const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        });

        // Emit messages for processing
        const messagesToProcess = connection.messageQueue.splice(0, 5); // Process 5 at a time
        for (const message of messagesToProcess) {
          this.emit('process_message', { agentName, message });
        }
      }
    }
  }

  private maintainMesh(): void {
    const now = new Date();

    // Update agent statuses based on last seen
    for (const [agentName, connection] of this.agents) {
      const timeSinceLastSeen = now.getTime() - connection.lastSeen.getTime();

      if (timeSinceLastSeen > 300000) {
        // 5 minutes
        connection.status = 'offline';
      } else if (timeSinceLastSeen > 60000) {
        // 1 minute
        connection.status = 'busy';
      } else {
        connection.status = 'online';
      }
    }

    // Clean up expired messages
    this.cleanupExpiredMessages();

    // Update routing optimizations
    this.optimizeRouting();
  }

  private monitorCollaborations(): void {
    const now = new Date();

    for (const [sessionId, session] of this.activeCollaborations) {
      const duration = now.getTime() - session.startTime.getTime();

      // Check for timeouts or completion
      if (duration > 1800000) {
        // 30 minutes timeout
        session.status = 'failed';
        this.notifyCollaborationEnd(sessionId, 'timeout');
      }
      return undefined;
      return undefined;

      // Clean up completed sessions
      if (session.status !== 'active') {
        this.activeCollaborations.delete(sessionId);
      }
      return undefined;
      return undefined;
    }
  }

  private updateKnowledgeGraph(agentName: string, capabilities: string[]): void {
    this.knowledgeGraph.set(agentName, new Set(capabilities));

    // Update routing table based on capabilities
    for (const capability of capabilities) {
      if (!this.routingTable.has(capability)) {
        this.routingTable.set(capability, []);
      }
      const agents = this.routingTable.get(capability)!;
      if (!agents.includes(agentName)) {
        agents.push(agentName);
      }
    }
  }

  private findRelevantAgents(knowledgeType: string, relevantTo: string[]): string[] {
    const relevant: string[] = [];

    for (const [agentName, capabilities] of this.knowledgeGraph) {
      const hasRelevantCapability = Array.from(capabilities).some((cap) =>
        relevantTo.some((relevant) => cap.toLowerCase().includes(relevant.toLowerCase()))
      );

      if (hasRelevantCapability || relevantTo.length === 0) {
        relevant.push(agentName);
      }

      return undefined;

      return undefined;
    }

    return relevant;
  }

  private calculateCapabilityMatch(
    agentCapabilities: string[],
    requiredCapabilities: string[]
  ): number {
    if (requiredCapabilities.length === 0) return 0.5;

    const matches = requiredCapabilities.filter((required) =>
      agentCapabilities.some((capability) =>
        capability.toLowerCase().includes(required.toLowerCase())
      )
    );

    return matches.length / requiredCapabilities.length;
  }

  private validateMessage(message: A2AMessage): boolean {
    return !!(
      message.id &&
      message.from &&
      message.to &&
      message.type &&
      message.priority &&
      message.timestamp
    );
  }

  private cleanupExpiredMessages(): void {
    const now = new Date();

    for (const [agentName, connection] of this.agents) {
      connection.messageQueue = connection.messageQueue.filter((message) => {
        if (message.ttl) {
          const age = now.getTime() - message.timestamp.getTime();
          return age < message.ttl;
        }
        return true; // Keep messages without TTL
      });
    }
  }

  private optimizeRouting(): void {
    // Use Alpha Evolve to learn better routing patterns
    alphaEvolve.learnFromInteraction('a2a_mesh', {
      userRequest: 'routing_optimization',
      agentResponse: JSON.stringify({
        totalMessages: this.messageHistory.length,
        activeAgents: Array.from(this.agents.values()).filter((a) => a.status === 'online').length,
        collaborations: this.activeCollaborations.size,
      }),
      wasSuccessful: true,
      responseTime: 100,
      tokensUsed: 50,
    });
  }

  private async notifyCollaborationEnd(sessionId: string, reason: string): Promise<void> {
    const session = this.activeCollaborations.get(sessionId);
    if (!session) return;

    for (const participant of session.participants) {
      await this.sendMessage({
        from: 'mesh_system',
        to: participant,
        type: 'notification',
        payload: {
          event: 'collaboration_ended',
          sessionId,
          reason,
          results: Object.fromEntries(session.results),
        },
        priority: 'medium',
      });
    }
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSessionId(): string {
    return `collab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public API methods

  public getMeshStatus(): {
    totalAgents: number;
    onlineAgents: number;
    activeCollaborations: number;
    messagesInQueue: number;
    meshHealth: number;
  } {
    const onlineAgents = Array.from(this.agents.values()).filter(
      (a) => a.status === 'online'
    ).length;
    const totalMessages = Array.from(this.messageQueue.values()).reduce(
      (sum, queue) => sum + queue.length,
      0
    );

    return {
      totalAgents: this.agents.size,
      onlineAgents,
      activeCollaborations: this.activeCollaborations.size,
      messagesInQueue: totalMessages,
      meshHealth: onlineAgents / Math.max(1, this.agents.size),
    };
  }

  public getAgentConnections(): AgentConnection[] {
    return Array.from(this.agents.values());
  }

  public getCollaborationHistory(): CollaborationSession[] {
    return Array.from(this.activeCollaborations.values());
  }

  public async shutdown(): Promise<void> {
    log.info('🛑 Shutting down A2A communication mesh', LogContext.AI);

    // Notify all agents of shutdown
    await this.broadcastMessage({
      id: this.generateMessageId(),
      from: 'mesh_system',
      to: 'broadcast',
      type: 'notification',
      payload: { event: 'mesh_shutdown' },
      priority: 'urgent',
      timestamp: new Date(),
    });

    // Clear all data structures
    this.agents.clear();
    this.messageQueue.clear();
    this.activeCollaborations.clear();
    this.messageHistory = [];
    this.removeAllListeners();
  }

  private async broadcastMessage(message: A2AMessage): Promise<void> {
    const onlineAgents = Array.from(this.agents.entries())
      .filter(([_, conn]) => conn.status === 'online')
      .map(([name, _]) => name);

    for (const agentName of onlineAgents) {
      const connection = this.agents.get(agentName);
      if (connection) {
        connection.messageQueue.push(message);
      }
      return undefined;
      return undefined;
    }
  }
}

// Singleton instance
export const a2aMesh = new A2ACommunicationMesh();
export default a2aMesh;
