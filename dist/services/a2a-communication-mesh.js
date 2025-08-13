import { EventEmitter } from 'events';
import { THREE, TWO } from '@/utils/constants';
import { log, LogContext } from '@/utils/logger';
import { alphaEvolve } from './alpha-evolve-service';
import { multiTierLLM } from './multi-tier-llm-service';
export class A2ACommunicationMesh extends EventEmitter {
    agents = new Map();
    messageQueue = new Map();
    activeCollaborations = new Map();
    messageHistory = [];
    knowledgeGraph = new Map();
    routingTable = new Map();
    constructor() {
        super();
        this.initializeMesh();
    }
    initializeMesh() {
        log.info('🕸️ Initializing A2A communication mesh', LogContext.AI);
        setInterval(() => this.maintainMesh(), 30000);
        setInterval(() => this.processMessageQueues(), 1000);
        setInterval(() => this.monitorCollaborations(), 5000);
        log.info('✅ A2A communication mesh initialized', LogContext.AI);
    }
    registerAgent(agentName, capabilities, trustLevel = 0.8) {
        const connection = {
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
    async sendMessage(message) {
        const fullMessage = {
            ...message,
            id: this.generateMessageId(),
            timestamp: new Date(),
        };
        if (!this.validateMessage(fullMessage)) {
            throw new Error('Invalid A2A message format');
        }
        await this.routeMessage(fullMessage);
        this.messageHistory.push(fullMessage);
        if (this.messageHistory.length > 10000) {
            this.messageHistory = this.messageHistory.slice(-5000);
        }
        log.info(`📨 A2A message sent: ${fullMessage.from} → ${fullMessage.to}`, LogContext.AI, {
            type: fullMessage.type,
            priority: fullMessage.priority,
        });
        return fullMessage.id;
    }
    async requestCollaboration(request) {
        const sessionId = this.generateSessionId();
        const session = {
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
    async shareKnowledge(from, knowledge) {
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
    findOptimalAgent(requiredCapabilities) {
        let bestAgent = null;
        let bestScore = 0;
        for (const [agentName, connection] of this.agents) {
            if (connection.status !== 'online')
                continue;
            const score = this.calculateCapabilityMatch(connection.capabilities, requiredCapabilities) *
                connection.trustLevel *
                (1 + connection.collaborationScore);
            if (score > bestScore) {
                bestScore = score;
                bestAgent = agentName;
            }
        }
        return bestAgent;
    }
    findAgentTeam(requiredCapabilities, teamSize = THREE) {
        const candidates = Array.from(this.agents.entries())
            .filter(([_, connection]) => connection.status === 'online')
            .map(([agentName, connection]) => ({
            agentName,
            score: this.calculateCapabilityMatch(connection.capabilities, requiredCapabilities) *
                connection.trustLevel *
                (1 + connection.collaborationScore),
        }))
            .sort((a, b) => b.score - a.score)
            .slice(0, teamSize);
        return candidates.map((c) => c.agentName);
    }
    async intelligentRouting(message) {
        if (message.to !== 'broadcast' && message.to !== 'auto') {
            return [message.to];
        }
        const routingPrompt = `Analyze this agent message and determine optimal routing:

MESSAGE: ${JSON.stringify(message, null, TWO)}

AVAILABLE AGENTS:
${Array.from(this.agents.entries())
            .map(([name, conn]) => `- ${name}: ${conn.capabilities.join(', ')} (status: ${conn.status}, trust: ${conn.trustLevel})`)
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
        }
        catch (error) {
            log.warn('⚠️ Intelligent routing failed, using fallback', LogContext.AI);
            return this.fallbackRouting(message);
        }
    }
    fallbackRouting(message) {
        if (message.type === 'collaboration') {
            return Array.from(this.agents.keys()).slice(0, THREE);
        }
        if (message.type === 'knowledge_share') {
            return this.findRelevantAgents('general', []);
        }
        return Array.from(this.agents.entries())
            .filter(([_, conn]) => conn.status === 'online')
            .map(([name, _]) => name);
    }
    async routeMessage(message) {
        let recipients;
        if (message.to === 'broadcast' || message.to === 'auto') {
            recipients = await this.intelligentRouting(message);
        }
        else {
            recipients = [message.to];
        }
        for (const recipient of recipients) {
            const connection = this.agents.get(recipient);
            if (connection) {
                connection.messageQueue.push(message);
                connection.lastSeen = new Date();
                this.emit('message', { recipient, message });
            }
        }
    }
    processMessageQueues() {
        for (const [agentName, connection] of this.agents) {
            if (connection.messageQueue.length > 0) {
                connection.messageQueue.sort((a, b) => {
                    const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
                    return priorityOrder[b.priority] - priorityOrder[a.priority];
                });
                const messagesToProcess = connection.messageQueue.splice(0, 5);
                for (const message of messagesToProcess) {
                    this.emit('process_message', { agentName, message });
                }
            }
        }
    }
    maintainMesh() {
        const now = new Date();
        for (const [agentName, connection] of this.agents) {
            const timeSinceLastSeen = now.getTime() - connection.lastSeen.getTime();
            if (timeSinceLastSeen > 300000) {
                connection.status = 'offline';
            }
            else if (timeSinceLastSeen > 60000) {
                connection.status = 'busy';
            }
            else {
                connection.status = 'online';
            }
        }
        this.cleanupExpiredMessages();
        this.optimizeRouting();
    }
    monitorCollaborations() {
        const now = new Date();
        for (const [sessionId, session] of this.activeCollaborations) {
            const duration = now.getTime() - session.startTime.getTime();
            if (duration > 1800000) {
                session.status = 'failed';
                this.notifyCollaborationEnd(sessionId, 'timeout');
            }
            if (session.status !== 'active') {
                this.activeCollaborations.delete(sessionId);
            }
        }
    }
    updateKnowledgeGraph(agentName, capabilities) {
        this.knowledgeGraph.set(agentName, new Set(capabilities));
        for (const capability of capabilities) {
            if (!this.routingTable.has(capability)) {
                this.routingTable.set(capability, []);
            }
            const agents = this.routingTable.get(capability);
            if (!agents.includes(agentName)) {
                agents.push(agentName);
            }
        }
    }
    findRelevantAgents(knowledgeType, relevantTo) {
        const relevant = [];
        for (const [agentName, capabilities] of this.knowledgeGraph) {
            const hasRelevantCapability = Array.from(capabilities).some((cap) => relevantTo.some((relevant) => cap.toLowerCase().includes(relevant.toLowerCase())));
            if (hasRelevantCapability || relevantTo.length === 0) {
                relevant.push(agentName);
            }
        }
        return relevant;
    }
    calculateCapabilityMatch(agentCapabilities, requiredCapabilities) {
        if (requiredCapabilities.length === 0)
            return 0.5;
        const matches = requiredCapabilities.filter((required) => agentCapabilities.some((capability) => capability.toLowerCase().includes(required.toLowerCase())));
        return matches.length / requiredCapabilities.length;
    }
    validateMessage(message) {
        return !!(message.id &&
            message.from &&
            message.to &&
            message.type &&
            message.priority &&
            message.timestamp);
    }
    cleanupExpiredMessages() {
        const now = new Date();
        for (const [agentName, connection] of this.agents) {
            connection.messageQueue = connection.messageQueue.filter((message) => {
                if (message.ttl) {
                    const age = now.getTime() - message.timestamp.getTime();
                    return age < message.ttl;
                }
                return true;
            });
        }
    }
    optimizeRouting() {
        const optimizationPromise = alphaEvolve.learnFromInteraction('a2a_mesh', {
            userRequest: 'routing_optimization',
            agentResponse: JSON.stringify({
                totalMessages: this.messageHistory.length,
                activeAgents: Array.from(this.agents.values()).filter((a) => a.status === 'online').length,
                collaborations: this.activeCollaborations.size,
                meshHealth: this.getMeshStatus().meshHealth,
                lastOptimization: new Date().toISOString()
            }),
            wasSuccessful: true,
            responseTime: 100,
            tokensUsed: 50,
        });
        Promise.race([
            optimizationPromise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('Routing optimization timeout')), 5000))
        ]).catch(error => {
            this.performBasicRoutingOptimization();
        });
    }
    performBasicRoutingOptimization() {
        const now = new Date();
        for (const [agentName, connection] of this.agents) {
            if (connection.status === 'offline') {
                for (const [capability, agents] of this.routingTable) {
                    const index = agents.indexOf(agentName);
                    if (index > -1) {
                        agents.splice(index, 1);
                    }
                }
            }
            if (connection.messageQueue.length === 0 && connection.status === 'online') {
                connection.lastSeen = now;
                connection.collaborationScore = Math.min(1.0, connection.collaborationScore + 0.01);
            }
        }
    }
    async notifyCollaborationEnd(sessionId, reason) {
        const session = this.activeCollaborations.get(sessionId);
        if (!session)
            return;
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
    generateMessageId() {
        return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    generateSessionId() {
        return `collab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    getMeshStatus() {
        const onlineAgents = Array.from(this.agents.values()).filter((a) => a.status === 'online').length;
        const totalMessages = Array.from(this.messageQueue.values()).reduce((sum, queue) => sum + queue.length, 0);
        return {
            totalAgents: this.agents.size,
            onlineAgents,
            activeCollaborations: this.activeCollaborations.size,
            messagesInQueue: totalMessages,
            meshHealth: onlineAgents / Math.max(1, this.agents.size),
        };
    }
    getAgentConnections() {
        return Array.from(this.agents.values());
    }
    getCollaborationHistory() {
        return Array.from(this.activeCollaborations.values());
    }
    async shutdown() {
        log.info('🛑 Shutting down A2A communication mesh', LogContext.AI);
        await this.broadcastMessage({
            id: this.generateMessageId(),
            from: 'mesh_system',
            to: 'broadcast',
            type: 'notification',
            payload: { event: 'mesh_shutdown' },
            priority: 'urgent',
            timestamp: new Date(),
        });
        this.agents.clear();
        this.messageQueue.clear();
        this.activeCollaborations.clear();
        this.messageHistory = [];
        this.removeAllListeners();
    }
    async broadcastMessage(message) {
        const onlineAgents = Array.from(this.agents.entries())
            .filter(([_, conn]) => conn.status === 'online')
            .map(([name, _]) => name);
        for (const agentName of onlineAgents) {
            const connection = this.agents.get(agentName);
            if (connection) {
                connection.messageQueue.push(message);
            }
        }
    }
}
export const a2aMesh = new A2ACommunicationMesh();
export default a2aMesh;
//# sourceMappingURL=a2a-communication-mesh.js.map