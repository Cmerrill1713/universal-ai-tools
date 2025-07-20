import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';

export interface AgentCapability {
  id: string;
  name: string;
  description: string;
  type: 'browser' | 'research' | 'testing' | 'monitoring' | 'coordination';
  skills: string[];
  inputModes: string[];
  outputModes: string[];
  requirements: string[];
  confidence?: number;
}

export interface RegisteredAgent {
  id: string;
  name: string;
  type: string;
  status: 'idle' | 'busy' | 'error' | 'offline';
  capabilities: AgentCapability[];
  lastSeen: number;
  metadata: Record<string, any>;
  stats: AgentStats;
}

export interface AgentStats {
  tasksCompleted: number;
  tasksSuccessful: number;
  averageResponseTime: number;
  lastTaskTime: number;
  successRate: number;
}

export interface CapabilityQuery {
  requiredSkills?: string[];
  preferredType?: string;
  excludeAgents?: string[];
  minConfidence?: number;
  maxResponseTime?: number;
}

export class AgentRegistry extends EventEmitter {
  private agents: Map<string, RegisteredAgent> = new Map();
  private capabilityIndex: Map<string, Set<string>> = new Map(); // skill -> agent IDs
  private typeIndex: Map<string, Set<string>> = new Map(); // type -> agent IDs
  private statusIndex: Map<string, Set<string>> = new Map(); // status -> agent IDs

  constructor() {
    super();
    this.setupIndexes();
  }

  private setupIndexes(): void {
    // Initialize status index
    this.statusIndex.set('idle', new Set());
    this.statusIndex.set('busy', new Set());
    this.statusIndex.set('error', new Set());
    this.statusIndex.set('offline', new Set());
  }

  async registerAgent(
    agentId: string, 
    capabilities: AgentCapability[],
    metadata: Record<string, any> = {}
  ): Promise<void> {
    const agent: RegisteredAgent = {
      id: agentId,
      name: metadata.name || agentId,
      type: metadata.type || 'browser',
      status: 'idle',
      capabilities,
      lastSeen: Date.now(),
      metadata,
      stats: {
        tasksCompleted: 0,
        tasksSuccessful: 0,
        averageResponseTime: 0,
        lastTaskTime: 0,
        successRate: 0
      }
    };

    this.agents.set(agentId, agent);
    this.updateIndexes(agentId, agent);
    
    logger.info(`🤖 Agent registered: ${agentId} with ${capabilities.length} capabilities`);
    this.emit('agent_registered', { agentId, agent });
  }

  async unregisterAgent(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    this.removeFromIndexes(agentId, agent);
    this.agents.delete(agentId);
    
    logger.info(`🤖 Agent unregistered: ${agentId}`);
    this.emit('agent_unregistered', { agentId });
  }

  async updateAgentStatus(agentId: string, status: RegisteredAgent['status']): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    const oldStatus = agent.status;
    agent.status = status;
    agent.lastSeen = Date.now();

    // Update status index
    this.statusIndex.get(oldStatus)?.delete(agentId);
    this.statusIndex.get(status)?.add(agentId);

    this.emit('agent_status_changed', { agentId, oldStatus, newStatus: status });
  }

  async updateAgentStats(agentId: string, stats: Partial<AgentStats>): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    Object.assign(agent.stats, stats);
    
    // Recalculate success rate
    if (agent.stats.tasksCompleted > 0) {
      agent.stats.successRate = Math.round(
        (agent.stats.tasksSuccessful / agent.stats.tasksCompleted) * 100
      );
    }

    this.emit('agent_stats_updated', { agentId, stats: agent.stats });
  }

  async findAgentsByCapabilities(query: CapabilityQuery): Promise<RegisteredAgent[]> {
    const candidates = new Set<string>();
    
    // Start with all agents if no specific skills required
    if (!query.requiredSkills || query.requiredSkills.length === 0) {
      this.agents.forEach((_, agentId) => candidates.add(agentId));
    } else {
      // Find agents that have all required skills
      const skillSets = query.requiredSkills.map(skill => 
        this.capabilityIndex.get(skill) || new Set()
      );
      
      if (skillSets.length > 0) {
        // Start with agents that have the first skill
        skillSets[0].forEach(agentId => candidates.add(agentId as string));
        
        // Filter to agents that have all required skills
        for (let i = 1; i < skillSets.length; i++) {
          const skillSet = skillSets[i];
          candidates.forEach(agentId => {
            if (!skillSet.has(agentId)) {
              candidates.delete(agentId);
            }
          });
        }
      }
    }

    // Apply additional filters
    const filteredAgents = Array.from(candidates)
      .map(agentId => this.agents.get(agentId))
      .filter(agent => {
        if (!agent) return false;
        
        // Exclude specific agents
        if (query.excludeAgents?.includes(agent.id)) return false;
        
        // Filter by preferred type
        if (query.preferredType && agent.type !== query.preferredType) return false;
        
        // Filter by minimum confidence
        if (query.minConfidence) {
          const hasMinConfidence = agent.capabilities.some(cap => 
            (cap.confidence || 0) >= query.minConfidence!
          );
          if (!hasMinConfidence) return false;
        }
        
        // Filter by maximum response time
        if (query.maxResponseTime && agent.stats.averageResponseTime > query.maxResponseTime) {
          return false;
        }
        
        // Only include available agents
        return agent.status === 'idle';
      }) as RegisteredAgent[];

    // Sort by suitability score
    return filteredAgents.sort((a, b) => {
      const scoreA = this.calculateSuitabilityScore(a, query);
      const scoreB = this.calculateSuitabilityScore(b, query);
      return scoreB - scoreA;
    });
  }

  private calculateSuitabilityScore(agent: RegisteredAgent, query: CapabilityQuery): number {
    let score = 0;
    
    // Base score from success rate
    score += agent.stats.successRate * 0.4;
    
    // Bonus for matching skills
    if (query.requiredSkills) {
      const matchingSkills = query.requiredSkills.filter(skill => 
        agent.capabilities.some(cap => cap.skills.includes(skill))
      );
      score += (matchingSkills.length / query.requiredSkills.length) * 30;
    }
    
    // Bonus for matching type
    if (query.preferredType && agent.type === query.preferredType) {
      score += 20;
    }
    
    // Penalty for slow response time
    if (agent.stats.averageResponseTime > 0) {
      score -= Math.min(agent.stats.averageResponseTime / 1000, 10);
    }
    
    // Bonus for recent activity
    const timeSinceLastTask = Date.now() - agent.stats.lastTaskTime;
    if (timeSinceLastTask < 300000) { // 5 minutes
      score += 10;
    }
    
    // Capability confidence bonus
    const avgConfidence = agent.capabilities.reduce((sum, cap) => 
      sum + (cap.confidence || 0), 0
    ) / agent.capabilities.length;
    score += avgConfidence * 0.2;
    
    return Math.max(0, Math.min(100, score));
  }

  async getAgent(agentId: string): Promise<RegisteredAgent | null> {
    return this.agents.get(agentId) || null;
  }

  async getAllAgents(): Promise<RegisteredAgent[]> {
    return Array.from(this.agents.values());
  }

  async getAgentsByStatus(status: RegisteredAgent['status']): Promise<RegisteredAgent[]> {
    const agentIds = this.statusIndex.get(status) || new Set();
    return Array.from(agentIds)
      .map(id => this.agents.get(id))
      .filter(Boolean) as RegisteredAgent[];
  }

  async getAgentsByType(type: string): Promise<RegisteredAgent[]> {
    const agentIds = this.typeIndex.get(type) || new Set();
    return Array.from(agentIds)
      .map(id => this.agents.get(id))
      .filter(Boolean) as RegisteredAgent[];
  }

  async getCapabilityDistribution(): Promise<Record<string, number>> {
    const distribution: Record<string, number> = {};
    
    this.capabilityIndex.forEach((agents, skill) => {
      distribution[skill] = agents.size;
    });
    
    return distribution;
  }

  async getRegistryStats(): Promise<{
    totalAgents: number;
    byStatus: Record<string, number>;
    byType: Record<string, number>;
    totalCapabilities: number;
    averageSuccessRate: number;
    mostActiveAgent: string | null;
  }> {
    const agents = Array.from(this.agents.values());
    const totalAgents = agents.length;
    
    const byStatus: Record<string, number> = {};
    const byType: Record<string, number> = {};
    
    agents.forEach(agent => {
      byStatus[agent.status] = (byStatus[agent.status] || 0) + 1;
      byType[agent.type] = (byType[agent.type] || 0) + 1;
    });
    
    const totalCapabilities = agents.reduce((sum, agent) => 
      sum + agent.capabilities.length, 0
    );
    
    const averageSuccessRate = agents.length > 0 
      ? agents.reduce((sum, agent) => sum + agent.stats.successRate, 0) / agents.length
      : 0;
    
    const mostActiveAgent = agents.reduce((most, agent) => {
      if (!most || agent.stats.tasksCompleted > most.stats.tasksCompleted) {
        return agent;
      }
      return most;
    }, null as RegisteredAgent | null);
    
    return {
      totalAgents,
      byStatus,
      byType,
      totalCapabilities,
      averageSuccessRate,
      mostActiveAgent: mostActiveAgent?.id || null
    };
  }

  private updateIndexes(agentId: string, agent: RegisteredAgent): void {
    // Update capability index
    agent.capabilities.forEach(cap => {
      cap.skills.forEach(skill => {
        if (!this.capabilityIndex.has(skill)) {
          this.capabilityIndex.set(skill, new Set());
        }
        this.capabilityIndex.get(skill)!.add(agentId);
      });
    });
    
    // Update type index
    if (!this.typeIndex.has(agent.type)) {
      this.typeIndex.set(agent.type, new Set());
    }
    this.typeIndex.get(agent.type)!.add(agentId);
    
    // Update status index
    this.statusIndex.get(agent.status)?.add(agentId);
  }

  private removeFromIndexes(agentId: string, agent: RegisteredAgent): void {
    // Remove from capability index
    agent.capabilities.forEach(cap => {
      cap.skills.forEach(skill => {
        this.capabilityIndex.get(skill)?.delete(agentId);
      });
    });
    
    // Remove from type index
    this.typeIndex.get(agent.type)?.delete(agentId);
    
    // Remove from status index
    this.statusIndex.get(agent.status)?.delete(agentId);
  }

  async cleanup(): Promise<void> {
    // Remove stale agents (offline for more than 5 minutes)
    const staleThreshold = Date.now() - 300000; // 5 minutes
    const staleAgents = Array.from(this.agents.values())
      .filter(agent => agent.lastSeen < staleThreshold);
    
    for (const agent of staleAgents) {
      await this.unregisterAgent(agent.id);
    }
    
    if (staleAgents.length > 0) {
      logger.info(`🧹 Cleaned up ${staleAgents.length} stale agents`);
    }
  }

  async healthCheck(): Promise<boolean> {
    const stats = await this.getRegistryStats();
    const healthyAgents = stats.byStatus.idle + stats.byStatus.busy;
    const {totalAgents} = stats;
    
    if (totalAgents === 0) return false;
    
    const healthPercentage = (healthyAgents / totalAgents) * 100;
    return healthPercentage >= 75; // At least 75% of agents should be healthy
  }
}