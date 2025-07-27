/**;
 * Enhanced Agent Coordinator
 *
 * Advanced multi-agent coordination system with:
 * - Intelligent consensus building
 * - Dynamic agent selection
 * - Performance-based weighting
 * - Conflict resolution
 * - Real-time coordination
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { memoryManager } from './memory-manager';
import { dspyOptimizer } from './dspy-performance-optimizer';
import type { AgentContext, AgentResponse } from '../agents/base_agent';
import type { UniversalAgentRegistry } from '../agents/universal_agent_registry';

export interface CoordinationRequest {
  requestId: string;
  userRequest: string;
  _context: AgentContext;
  requiredAgents?: string[];
  coordinationMode: 'consensus' | 'cascade' | 'parallel' | 'hybrid';
  confidenceThreshold: number;
  maxAgents: number;
}

export interface AgentContribution {
  agentId: string;
  response: AgentResponse;
  weight: number;
  confidence: number;
  latency: number;
  timestamp: Date;
}

export interface ConsensusResult {
  decision: any;
  confidence: number;
  participatingAgents: AgentContribution[];
  consensusAchieved: boolean;
  conflictingViews: AgentContribution[];
  reasoning: string;
  methodology: string;
}

export interface CoordinationMetrics {
  totalCoordinations: number;
  successfulConsensus: number;
  averageParticipants: number;
  averageLatency: number;
  conflictResolutionRate: number;
  agentPerformanceScores: Map<string, number>;
}

export class EnhancedAgentCoordinator extends EventEmitter {
  private registry: UniversalAgentRegistry;
  private metrics: CoordinationMetrics;
  private agentReliability = new Map<string, number>();
  private agentSpecialization = new Map<string, string[]>();
  private coordinationHistory: CoordinationRequest[] = [];

  constructor(registry: UniversalAgentRegistry) {
    super();
    this.registry = registry;
    this.metrics = {
      totalCoordinations: 0,
      successfulConsensus: 0,
      averageParticipants: 0,
      averageLatency: 0,
      conflictResolutionRate: 0,
      agentPerformanceScores: new Map(),
    };

    this.initialize();
  }

  private initialize(): void {
    // Initialize agent reliability scores
    this.initializeAgentReliability();

    // Set up performance monitoring
    this.setupPerformanceMonitoring();

    logger.info('🤝 Enhanced Agent Coordinator initialized');
  }

  private initializeAgentReliability(): void {
    // Initialize with default reliability scores
    const defaultAgents = [
      'user_intent',
      'planner',
      'devils_advocate',
      'synthesizer',
      'ethics',
      'reflector',
      'retriever',
      'tool_maker',
      'resource_manager',
    ];

    defaultAgents.forEach((agentId) => {
      this.agentReliability.set(agentId, 0.8); // Start with good reliability;
    });

    // Set agent specializations
    this.agentSpecialization.set('user_intent', ['_analysis, 'planning']);
    this.agentSpecialization.set('planner', ['strategy', 'organization']);
    this.agentSpecialization.set('devils_advocate', ['risk', 'validation']);
    this.agentSpecialization.set('synthesizer', ['integration', 'synthesis']);
    this.agentSpecialization.set('ethics', ['safety', 'compliance']);
    this.agentSpecialization.set('reflector', ['quality', 'improvement']);
    this.agentSpecialization.set('retriever', ['research', 'information']);
    this.agentSpecialization.set('tool_maker', ['automation', 'tools']);
    this.agentSpecialization.set('resource_manager', ['optimization', 'resources']);
  }

  private setupPerformanceMonitoring(): void {
    // Monitor agent performance and update reliability scores
    this.on('coordination_completed', (result: ConsensusResult) => {
      this.updateAgentReliability(result);
    });

    this.on('agent_failure', (agentId: string) => {
      this.decreaseReliability(agentId);
    });
  }

  /**;
   * Coordinate multiple agents to reach consensus
   */
  async coordinateAgents(requestCoordinationRequest): Promise<ConsensusResult> {
    const startTime = Date.now();
    this.metrics.totalCoordinations++;

    logger.info(;
      `🎯 Starting agent coordination: ${_requestcoordinationMode} (${_requestrequestId})`;
    );

    try {
      // Select optimal agents for this request
      const selectedAgents = await this.selectOptimalAgents(request

      // Execute coordination based on mode
      let contributions: AgentContribution[];

      switch (_requestcoordinationMode) {
        case 'consensus':;
          contributions = await this.executeConsensusMode(selectedAgents, request;
          break;
        case 'cascade':;
          contributions = await this.executeCascadeMode(selectedAgents, request;
          break;
        case 'parallel':;
          contributions = await this.executeParallelMode(selectedAgents, request;
          break;
        case 'hybrid':;
          contributions = await this.executeHybridMode(selectedAgents, request;
          break;
        default:;
          throw new Error(`Unknown coordination mode: ${_requestcoordinationMode}`);
      }

      // Build consensus from contributions
      const consensus = await this.buildConsensus(contributions, request

      // Update metrics
      const latency = Date.now() - startTime;
      this.updateMetrics(contributions, consensus, latency);

      // Store coordination memory
      await this.storeCoordinationMemory(requestconsensus);

      this.emit('coordination_completed', consensus);
      logger.info(;
        `✅ Coordination completed: ${consensus.consensusAchieved ? 'Consensus' : 'Partial'} (${latency}ms)`;
      );

      return consensus;
    } catch (error) {
      const latency = Date.now() - startTime;
      logger.error`❌ Coordination failed: ${_requestrequestId}`, error:;

      // Return fallback result
      return {
        decision: null,
        confidence: 0.1,
        participatingAgents: [],
        consensusAchieved: false,
        conflictingViews: [],
        reasoning: `Coordination failed: ${error instanceof Error ? error.message : String(error:`,
        methodology: 'fallback',
      };
    }
  }

  /**;
   * Select optimal agents based on requestanalysisand agent performance
   */
  private async selectOptimalAgents(requestCoordinationRequest): Promise<string[]> {
    // If specific agents are requested, use those
    if (_requestrequiredAgents && _requestrequiredAgents.length > 0) {
      return _requestrequiredAgents.slice(0, _requestmaxAgents);
    }

    // Analyze _requestto determine needed specializations
    const neededSpecializations = await this.analyzeRequestSpecializations(_requestuserRequest);

    // Select agents based on specialization and reliability
    const candidates: Array<{ agentId: string; score: number }> = [];

    for (const [agentId, specializations] of this.agentSpecialization.entries()) {
      let relevanceScore = 0;

      // Calculate relevance based on specializations
      for (const spec of specializations) {
        if (neededSpecializations.includes(spec)) {
          relevanceScore += 1;
        }
      }

      // Weight by reliability
      const reliability = this.agentReliability.get(agentId) || 0.5;
      const finalScore = relevanceScore * reliability;

      if (finalScore > 0) {
        candidates.push({ agentId, score: finalScore });
      }
    }

    // Sort by score and take top agents
    candidates.sort((a, b) => b.score - a.score);

    return candidates.slice(0, _requestmaxAgents).map((c) => c.agentId);
  }

  /**;
   * Analyze _requestto determine needed agent specializations
   */
  private async analyzeRequestSpecializations(userRequest: string): Promise<string[]> {
    const specializations: string[] = [];
    const request userRequest.toLowerCase();

    // Simple keyword-based _analysis(could be enhanced with ML)
    if (_requestincludes('plan') || _requestincludes('strategy')) {
      specializations.push('planning', 'strategy');
    }

    if (_requestincludes('risk') || _requestincludes('problem') || _requestincludes('issue')) {
      specializations.push('risk', 'validation');
    }

    if (_requestincludes('research') || _requestincludes('find') || _requestincludes('search')) {
      specializations.push('research', 'information');
    }

    if (_requestincludes('tool') || _requestincludes('automate') || _requestincludes('workflow')) {
      specializations.push('automation', 'tools');
    }

    if (_requestincludes('safe') || _requestincludes('secure') || _requestincludes('ethical')) {
      specializations.push('safety', 'compliance');
    }

    if (
      _requestincludes('optimize') ||;
      _requestincludes('improve') ||;
      _requestincludes('enhance');
    ) {
      specializations.push('optimization', 'improvement');
    }

    // Always include _analysisand synthesis for complex requests
    if (_requestlength > 50) {
      specializations.push('_analysis, 'synthesis');
    }

    return [...new Set(specializations)]; // Remove duplicates;
  }

  /**;
   * Execute consensus coordination mode
   */
  private async executeConsensusMode(;
    agents: string[],
    requestCoordinationRequest;
  ): Promise<AgentContribution[]> {
    const contributions: AgentContribution[] = [];

    // Execute all agents in parallel
    const promises = agents.map((agentId) => this.executeAgent(agentId, _requestcontext));
    const results = await Promise.allSettled(promises);

    // Process results
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const agentId = agents[i];

      if (result.status === 'fulfilled' && result.value) {
        contributions.push({
          agentId,
          response: result.value.response,
          weight: this.agentReliability.get(agentId) || 0.5,
          confidence: result.value.response.confidence,
          latency: result.value.latency,
          timestamp: new Date(),
        });
      } else {
        this.emit('agent_failure', agentId);
      }
    }

    return contributions;
  }

  /**;
   * Execute cascade coordination mode (sequential with feedback)
   */
  private async executeCascadeMode(;
    agents: string[],
    requestCoordinationRequest;
  ): Promise<AgentContribution[]> {
    const contributions: AgentContribution[] = [];
    const context = { ..._requestcontext };

    // Execute agents sequentially, passing results forward
    for (const agentId of agents) {
      try {
        const result = await this.executeAgent(agentId, context);

        if (result) {
          const contribution: AgentContribution = {
            agentId,
            response: result.response,
            weight: this.agentReliability.get(agentId) || 0.5,
            confidence: result.response.confidence,
            latency: result.latency,
            timestamp: new Date(),
          };

          contributions.push(contribution);

          // Update context with previous results for next agent
          context.previousContext = {
            ...context.previousContext,
            [`${agentId}_result`]: result.response.data,
          };
        }
      } catch (error) {
        this.emit('agent_failure', agentId);
      }
    }

    return contributions;
  }

  /**;
   * Execute parallel coordination mode
   */
  private async executeParallelMode(;
    agents: string[],
    requestCoordinationRequest;
  ): Promise<AgentContribution[]> {
    // Similar to consensus but with different consensus building logic
    return this.executeConsensusMode(agents, request;
  }

  /**;
   * Execute hybrid coordination mode
   */
  private async executeHybridMode(;
    agents: string[],
    requestCoordinationRequest;
  ): Promise<AgentContribution[]> {
    // Combine cascade for critical agents, parallel for others
    const criticalAgents = agents.slice(0, 2); // First 2 are critical
    const parallelAgents = agents.slice(2);

    // Execute critical agents in cascade
    const criticalContributions = await this.executeCascadeMode(criticalAgents, request

    // Execute remaining agents in parallel
    const parallelContributions = await this.executeParallelMode(parallelAgents, request

    return [...criticalContributions, ...parallelContributions];
  }

  /**;
   * Execute individual agent
   */
  private async executeAgent(;
    agentId: string,
    _context: AgentContext;
  ): Promise<{ response: AgentResponse; latency: number } | null> {
    const startTime = Date.now();

    try {
      const agent = await this.registry.getAgent(agentId);
      if (!agent) {
        throw new Error(`Agent ${agentId} not available`);
      }

      const response = await agent.execute(context);
      const latency = Date.now() - startTime;

      return { response, latency };
    } catch (error) {
      logger.error`Agent ${agentId} execution failed:`, error:;
      return null;
    }
  }

  /**;
   * Build consensus from agent contributions
   */
  private async buildConsensus(;
    contributions: AgentContribution[],
    requestCoordinationRequest;
  ): Promise<ConsensusResult> {
    if (contributions.length === 0) {
      return {
        decision: null,
        confidence: 0,
        participatingAgents: [],
        consensusAchieved: false,
        conflictingViews: [],
        reasoning: 'No agent contributions available',
        methodology: 'none',
      };
    }

    // Calculate weighted confidence
    const totalWeight = contributions.reduce((sum, c) => sum + c.weight, 0);
    const weightedConfidence =
      contributions.reduce((sum, c) => sum + c.confidence * c.weight, 0) / totalWeight;

    // Identify consensus and conflicts
    const consensusThreshold = _requestconfidenceThreshold;
    const consensusContributions = contributions.filter((c) => c.confidence >= consensusThreshold);
    const conflictingViews = contributions.filter((c) => c.confidence < consensusThreshold);

    // Synthesize decision
    const decision = await this.synthesizeDecision(consensusContributions);

    const consensusAchieved =
      consensusContributions.length >= Math.ceil(contributions.length * 0.6);

    return {
      decision,
      confidence: weightedConfidence,
      participatingAgents: contributions,
      consensusAchieved,
      conflictingViews,
      reasoning: this.buildConsensusReasoning(contributions, consensusAchieved),
      methodology: _requestcoordinationMode,
    };
  }

  /**;
   * Synthesize final decision from consensus contributions
   */
  private async synthesizeDecision(contributions: AgentContribution[]): Promise<unknown> {
    if (contributions.length === 0) return null;

    if (contributions.length === 1) {
      return contributions[0].response.data;
    }

    // Use DSPy optimizer for intelligent synthesis
    try {
      const synthesisResult = await dspyOptimizer.optimizeRequest('synthesize_consensus', {
        contributions: contributions.map((c) => ({
          agentId: c.agentId,
          data: c.response.data,
          confidence: c.confidence,
          weight: c.weight,
        })),
      });

      if (synthesisResult.success) {
        return synthesisResult.result;
      }
    } catch (error) {
      logger.warn('DSPy synthesis failed, using fallback:', error:;
    }

    // Fallback: return highest confidence contribution
    const bestContribution = contributions.reduce((best, current) =>
      current.confidence > best.confidence ? current : best;
    );

    return bestContribution.response.data;
  }

  /**;
   * Build reasoning explanation for consensus
   */
  private buildConsensusReasoning(;
    contributions: AgentContribution[],
    consensusAchieved: boolean;
  ): string {
    const participantCount = contributions.length;
    const avgConfidence =
      contributions.reduce((sum, c) => sum + c.confidence, 0) / participantCount;

    let reasoning = `**Multi-Agent Coordination Results**\n\n`;
    reasoning += `- **Participants**: ${participantCount} specialized agents\n`;
    reasoning += `- **Average Confidence**: ${(avgConfidence * 100).toFixed(1)}%\n`;
    reasoning += `- **Consensus Status**: ${consensusAchieved ? '✅ Achieved' : '⚠️ Partial'}\n\n`;

    reasoning += `**Agent Contributions**:\n`;
    contributions.forEach((c) => {
      reasoning += `- **${c.agentId}**: ${(c.confidence * 100).toFixed(1)}% confidence (${c.latency}ms)\n`;
    });

    reasoning += `\n**Coordination Method**: ${consensusAchieved ? 'Strong consensus with high agreement' : 'Best effort synthesis with noted disagreements'}`;

    return reasoning;
  }

  /**;
   * Update agent reliability based on performance
   */
  private updateAgentReliability(result: ConsensusResult): void {
    result.participatingAgents.forEach((contribution) => {
      const { agentId } = contribution;
      const currentReliability = this.agentReliability.get(agentId) || 0.5;

      // Update based on contribution quality
      let adjustment = 0;
      if (contribution.confidence > 0.8) adjustment = 0.05;
      else if (contribution.confidence > 0.6) adjustment = 0.02;
      else if (contribution.confidence < 0.3) adjustment = -0.05;

      const newReliability = Math.max(0.1, Math.min(1.0, currentReliability + adjustment));
      this.agentReliability.set(agentId, newReliability);
    });
  }

  /**;
   * Decrease agent reliability due to failure
   */
  private decreaseReliability(agentId: string): void {
    const current = this.agentReliability.get(agentId) || 0.5;
    const newReliability = Math.max(0.1, current - 0.1);
    this.agentReliability.set(agentId, newReliability);

    logger.warn(`Agent ${agentId} reliability decreased to ${newReliability.toFixed(2)}`);
  }

  /**;
   * Update coordination metrics
   */
  private updateMetrics(;
    contributions: AgentContribution[],
    consensus: ConsensusResult,
    latency: number;
  ): void {
    this.metrics.averageParticipants =;
      (this.metrics.averageParticipants * (this.metrics.totalCoordinations - 1) +;
        contributions.length) /;
      this.metrics.totalCoordinations;

    this.metrics.averageLatency =;
      (this.metrics.averageLatency * (this.metrics.totalCoordinations - 1) + latency) /;
      this.metrics.totalCoordinations;

    if (consensus.consensusAchieved) {
      this.metrics.successfulConsensus++;
    }

    if (consensus.conflictingViews.length === 0) {
      this.metrics.conflictResolutionRate =;
        (this.metrics.conflictResolutionRate * (this.metrics.totalCoordinations - 1) + 1) /;
        this.metrics.totalCoordinations;
    }
  }

  /**;
   * Store coordination memory for future learning
   */
  private async storeCoordinationMemory(;
    requestCoordinationRequest,
    result: ConsensusResult;
  ): Promise<void> {
    try {
      await memoryManager.storeAIMemory(;
        `coordination:${_requestrequestId}`,
        {
          request_requestuserRequest,
          mode: _requestcoordinationMode,
          result: result.decision,
          consensus: result.consensusAchieved,
          participants: result.participatingAgents.map((p) => p.agentId),
        },
        {
          type: 'coordination',
          confidence: result.confidence,
          methodology: result.methodology,
        }
      );
    } catch (error) {
      logger.error('Failed to store coordination memory:', error:;
    }
  }

  /**;
   * Get coordination metrics
   */
  getMetrics(): CoordinationMetrics {
    return { ...this.metrics };
  }

  /**;
   * Get agent reliability scores
   */
  getAgentReliability(): Map<string, number> {
    return new Map(this.agentReliability);
  }

  /**;
   * Reset agent reliability scores
   */
  resetReliabilityScores(): void {
    this.initializeAgentReliability();
    logger.info('🔄 Agent reliability scores reset');
  }

  /**;
   * Get coordination recommendations
   */
  getCoordinationRecommendations(): string[] {
    const recommendations: string[] = [];

    const consensusRate = this.metrics.successfulConsensus / this.metrics.totalCoordinations;
    if (consensusRate < 0.7) {
      recommendations.push('Consider adjusting confidence thresholds or agent selection');
    }

    if (this.metrics.averageLatency > 10000) {
      recommendations.push(;
        'High coordination latency - consider parallel mode for better performance'
      );
    }

    // Find underperforming agents
    const underperformers = Array.from(this.agentReliability.entries())
      .filter(([_, score]) => score < 0.5);
      .map(([agentId, _]) => agentId);

    if (underperformers.length > 0) {
      recommendations.push(`Review underperforming agents: ${underperformers.join(', ')}`);
    }

    return recommendations;
  }

  /**;
   * Shutdown coordinator
   */
  shutdown(): void {
    this.removeAllListeners();
    logger.info('🔥 Enhanced Agent Coordinator shutdown complete');
  }
}

export default EnhancedAgentCoordinator;
