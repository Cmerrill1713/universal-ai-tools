import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

export interface AgentStatus {
  agentId: string;
  agentName: string;
  status: 'idle' | 'thinking' | 'working' | 'completed' | 'error';
  currentTask?: string;
  progress?: number;
  timestamp: Date;
  metadata?: {
    confidence?: number;
    participatingIn?: string;
    result?: any;
  };
}

export interface AgentCollaborationUpdate {
  type: 'agent_status' | 'collaboration_start' | 'collaboration_end' | 'agent_message';
  requestId: string;
  data: AgentStatus | any;
  timestamp: Date;
}

export class AgentCollaborationWebSocket extends EventEmitter {
  private wss: WebSocket.Server | null = null;
  private clients: Set<WebSocket> = new Set();
  private agentStatuses: Map<string, AgentStatus> = new Map();
  
  constructor() {
    super();
    this.initializeAgentStatuses();
  }
  
  private initializeAgentStatuses(): void {
    // Initialize with default agent statuses
    const defaultAgents = [
      { agentId: 'orchestrator', agentName: 'Orchestrator', status: 'idle' as const },
      { agentId: 'planner', agentName: 'Planner Agent', status: 'idle' as const },
      { agentId: 'retriever', agentName: 'Retriever Agent', status: 'idle' as const },
      { agentId: 'synthesizer', agentName: 'Synthesizer Agent', status: 'idle' as const },
      { agentId: 'memory', agentName: 'Memory Agent', status: 'idle' as const },
      { agentId: 'coder', agentName: 'Code Assistant', status: 'idle' as const },
      { agentId: 'ui_designer', agentName: 'UI Designer', status: 'idle' as const },
    ];
    
    defaultAgents.forEach(agent => {
      this.agentStatuses.set(agent.agentId, {
        ...agent,
        currentTask: 'Ready',
        timestamp: new Date(),
      });
    });
  }
  
  initialize(server: any): void {
    this.wss = new WebSocket.Server({
      server,
      path: '/ws/agent-collaboration'
    });
    
    this.wss.on('connection', (ws: WebSocket) => {
      logger.info('New WebSocket client connected for agent collaboration');
      this.clients.add(ws);
      
      // Send initial agent statuses
      this.sendInitialStatuses(ws);
      
      ws.on('message', (message: string) => {
        try {
          const data = JSON.parse(message);
          this.handleClientMessage(ws, data);
        } catch (error) {
          logger.error('Failed to parse WebSocket message:', error);
        }
      });
      
      ws.on('close', () => {
        this.clients.delete(ws);
        logger.info('WebSocket client disconnected');
      });
      
      ws.on('error', (error) => {
        logger.error('WebSocket error:', error);
        this.clients.delete(ws);
      });
    });
    
    logger.info('Agent Collaboration WebSocket initialized');
  }
  
  private sendInitialStatuses(ws: WebSocket): void {
    const statuses = Array.from(this.agentStatuses.values());
    ws.send(JSON.stringify({
      type: 'initial_statuses',
      data: statuses,
      timestamp: new Date(),
    }));
  }
  
  private handleClientMessage(ws: WebSocket, message: any): void {
    // Handle client requests if needed
    if (message.type === 'get_status') {
      this.sendInitialStatuses(ws);
    }
  }
  
  // Public methods for updating agent status
  updateAgentStatus(update: AgentStatus): void {
    this.agentStatuses.set(update.agentId, update);
    this.broadcast({
      type: 'agent_status',
      requestId: update.metadata?.participatingIn || 'system',
      data: update,
      timestamp: new Date(),
    });
  }
  
  startCollaboration(requestId: string, participatingAgents: string[]): void {
    // Update participating agents to 'thinking' status
    participatingAgents.forEach(agentId => {
      const current = this.agentStatuses.get(agentId);
      if (current) {
        this.updateAgentStatus({
          ...current,
          status: 'thinking',
          currentTask: 'Analyzing request',
          metadata: { participatingIn: requestId },
        });
      }
    });
    
    this.broadcast({
      type: 'collaboration_start',
      requestId,
      data: { participatingAgents },
      timestamp: new Date(),
    });
  }
  
  updateAgentProgress(agentId: string, task: string, progress?: number): void {
    const current = this.agentStatuses.get(agentId);
    if (current) {
      this.updateAgentStatus({
        ...current,
        status: 'working',
        currentTask: task,
        progress,
        timestamp: new Date(),
      });
    }
  }
  
  completeAgentTask(agentId: string, result?: any): void {
    const current = this.agentStatuses.get(agentId);
    if (current) {
      this.updateAgentStatus({
        ...current,
        status: 'completed',
        currentTask: 'Task completed',
        progress: 100,
        metadata: { ...current.metadata, result },
        timestamp: new Date(),
      });
      
      // Reset to idle after a delay
      setTimeout(() => {
        const agent = this.agentStatuses.get(agentId);
        if (agent && agent.status === 'completed') {
          this.updateAgentStatus({
            ...agent,
            status: 'idle',
            currentTask: 'Ready',
            progress: undefined,
            metadata: {},
          });
        }
      }, 3000);
    }
  }
  
  endCollaboration(requestId: string, result: any): void {
    // Reset all participating agents
    this.agentStatuses.forEach((status, agentId) => {
      if (status.metadata?.participatingIn === requestId) {
        this.completeAgentTask(agentId, result);
      }
    });
    
    this.broadcast({
      type: 'collaboration_end',
      requestId,
      data: { result },
      timestamp: new Date(),
    });
  }
  
  private broadcast(update: AgentCollaborationUpdate): void {
    const message = JSON.stringify(update);
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }
  
  shutdown(): void {
    this.clients.forEach(client => client.close());
    this.clients.clear();
    if (this.wss) {
      this.wss.close();
    }
  }
}

// Export singleton instance
export const agentCollaborationWS = new AgentCollaborationWebSocket();