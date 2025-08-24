/**
 * Enhanced Agent Executor with Unified Knowledge Integration
 * 
 * Wraps agent execution with automatic R1 RAG knowledge injection,
 * ensuring every agent has access to the full knowledge graph
 * and contextual information relevant to their tasks.
 */

import { EventEmitter } from 'events';
import { unifiedKnowledgeBridge, type KnowledgeRequest, type KnowledgeResponse } from './unified-knowledge-bridge';
import { rustAgentRegistry, type RustAgentExecutionRequest, type RustAgentExecutionResponse } from './rust-agent-registry-client';
import { log, LogContext } from '../utils/logger';

// Enhanced execution types
export interface KnowledgeEnhancedRequest extends RustAgentExecutionRequest {
  enableKnowledgeInjection?: boolean;
  knowledgeContext?: string;
  maxKnowledgeResults?: number;
  knowledgeTypes?: ('specialized' | 'general' | 'historical' | 'real-time')[];
}

export interface KnowledgeEnhancedResponse extends RustAgentExecutionResponse {
  knowledgeUsed: KnowledgeResponse;
  knowledgeEnhanced: boolean;
  knowledgeInjectionTimeMs: number;
  contextualInsights: string[];
  relatedAgentSuggestions: string[];
}

export interface AgentExecutionContext {
  originalRequest: KnowledgeEnhancedRequest;
  injectedKnowledge: KnowledgeResponse;
  agentSpecificContext: Record<string, any>;
  executionStartTime: number;
}

/**
 * Enhanced Agent Executor - R1 RAG-Powered Agent Execution
 */
export class EnhancedAgentExecutor extends EventEmitter {
  private executionContexts = new Map<string, AgentExecutionContext>();
  private knowledgeInjectionStats = {
    totalExecutions: 0,
    knowledgeEnhancedExecutions: 0,
    averageInjectionTimeMs: 0,
    knowledgeUtilizationRate: 0
  };

  constructor() {
    super();
    log.info('🚀 Enhanced Agent Executor initialized with R1 RAG integration', LogContext.SYSTEM);
  }

  /**
   * Execute agent with knowledge enhancement
   */
  async executeWithKnowledge(
    agentId: string,
    request: KnowledgeEnhancedRequest
  ): Promise<KnowledgeEnhancedResponse> {
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    try {
      log.info(`🔄 Starting knowledge-enhanced execution for agent ${agentId}`, LogContext.AI);

      // Step 1: Inject relevant knowledge if enabled
      let knowledgeResponse: KnowledgeResponse = {
        knowledge: [],
        contextualizedResults: [],
        agentSpecificInsights: [],
        confidenceScore: 0,
        sources: [],
        relatedAgents: [],
        recommendedActions: []
      };

      let knowledgeInjectionTime = 0;

      if (request.enableKnowledgeInjection !== false) {
        const knowledgeStartTime = Date.now();
        knowledgeResponse = await this.injectRelevantKnowledge(agentId, request);
        knowledgeInjectionTime = Date.now() - knowledgeStartTime;

        log.info(`📊 Knowledge injection completed in ${knowledgeInjectionTime}ms`, LogContext.AI);
      }

      // Step 2: Create execution context
      const context: AgentExecutionContext = {
        originalRequest: request,
        injectedKnowledge: knowledgeResponse,
        agentSpecificContext: {
          knowledgeAvailable: knowledgeResponse.knowledge.length > 0,
          confidenceScore: knowledgeResponse.confidenceScore,
          insights: knowledgeResponse.agentSpecificInsights
        },
        executionStartTime: startTime
      };

      this.executionContexts.set(executionId, context);

      // Step 3: Enhance the original request with knowledge
      const enhancedRequest = await this.enhanceRequestWithKnowledge(request, knowledgeResponse);

      // Step 4: Execute the agent
      const agentResponse = await rustAgentRegistry.executeAgent(agentId, enhancedRequest);

      // Step 5: Create enhanced response
      const enhancedResponse: KnowledgeEnhancedResponse = {
        ...agentResponse,
        knowledgeUsed: knowledgeResponse,
        knowledgeEnhanced: knowledgeResponse.knowledge.length > 0,
        knowledgeInjectionTimeMs: knowledgeInjectionTime,
        contextualInsights: knowledgeResponse.agentSpecificInsights,
        relatedAgentSuggestions: knowledgeResponse.relatedAgents
      };

      // Step 6: Update statistics
      this.updateExecutionStats(knowledgeInjectionTime, knowledgeResponse.knowledge.length > 0);

      // Step 7: Post-execution knowledge learning
      await this.learnFromExecution(agentId, context, enhancedResponse);

      const totalExecutionTime = Date.now() - startTime;
      log.info(
        `✅ Knowledge-enhanced execution completed in ${totalExecutionTime}ms (knowledge: ${knowledgeInjectionTime}ms)`,
        LogContext.AI
      );

      this.emit('executionCompleted', {
        agentId,
        executionId,
        totalTimeMs: totalExecutionTime,
        knowledgeEnhanced: enhancedResponse.knowledgeEnhanced
      });

      return enhancedResponse;

    } catch (error) {
      log.error(`❌ Knowledge-enhanced execution failed for agent ${agentId}`, LogContext.AI, { error });
      this.emit('executionFailed', { agentId, executionId, error });
      throw error;
    } finally {
      this.executionContexts.delete(executionId);
    }
  }

  /**
   * Inject relevant knowledge for the agent's task
   */
  private async injectRelevantKnowledge(
    agentId: string,
    request: KnowledgeEnhancedRequest
  ): Promise<KnowledgeResponse> {
    try {
      // Build knowledge request from agent execution request
      const knowledgeRequest: KnowledgeRequest = {
        agentId,
        query: this.extractQueryFromRequest(request),
        contextType: request.knowledgeTypes?.[0] || 'general',
        maxResults: request.maxKnowledgeResults || 10,
        includeRelated: true
      };

      // Get knowledge from the unified bridge
      const knowledge = await unifiedKnowledgeBridge.getKnowledgeForAgent(knowledgeRequest);

      log.info(
        `📚 Retrieved ${knowledge.knowledge.length} knowledge paths for agent (confidence: ${knowledge.confidenceScore.toFixed(2)})`,
        LogContext.AI
      );

      return knowledge;
    } catch (error) {
      log.error(`❌ Failed to inject knowledge for agent ${agentId}`, LogContext.AI, { error });
      
      // Return empty knowledge response on failure
      return {
        knowledge: [],
        contextualizedResults: [],
        agentSpecificInsights: [],
        confidenceScore: 0,
        sources: [],
        relatedAgents: [],
        recommendedActions: []
      };
    }
  }

  /**
   * Extract meaningful query from agent execution request
   */
  private extractQueryFromRequest(request: KnowledgeEnhancedRequest): string {
    // Try to extract query from various input fields
    const input = request.input;
    
    // Common query fields
    const queryFields = ['query', 'question', 'task', 'prompt', 'instruction', 'goal'];
    
    for (const field of queryFields) {
      if (input[field] && typeof input[field] === 'string') {
        return input[field];
      }
    }

    // Try to extract from context
    if (request.context?.query) {
      return request.context.query;
    }

    // Use knowledge context if provided
    if (request.knowledgeContext) {
      return request.knowledgeContext;
    }

    // Fall back to stringified input
    const inputString = JSON.stringify(input);
    if (inputString.length > 10 && inputString.length < 200) {
      return inputString;
    }

    // Default query
    return 'general agent assistance';
  }

  /**
   * Enhance agent request with injected knowledge
   */
  private async enhanceRequestWithKnowledge(
    originalRequest: KnowledgeEnhancedRequest,
    knowledge: KnowledgeResponse
  ): Promise<RustAgentExecutionRequest> {
    const enhancedInput = { ...originalRequest.input };

    // Add knowledge to the request if available
    if (knowledge.knowledge.length > 0) {
      // Add contextual knowledge
      enhancedInput.knowledgeContext = {
        relevantPaths: knowledge.knowledge.map(k => ({
          summary: k.reasoning.join(' → '),
          entities: k.nodes.map(n => ({ name: n.name, type: n.type })),
          score: k.score
        })),
        insights: knowledge.agentSpecificInsights,
        sources: knowledge.sources,
        confidence: knowledge.confidenceScore,
        relatedAgents: knowledge.relatedAgents
      };

      // Add high-confidence facts directly to context
      const highConfidenceFacts = knowledge.contextualizedResults
        .filter(result => result.confidence > 0.8)
        .map(result => result.summary);

      if (highConfidenceFacts.length > 0) {
        enhancedInput.knowledgeFacts = highConfidenceFacts;
      }

      // Add recommended actions as guidance
      if (knowledge.recommendedActions.length > 0) {
        enhancedInput.recommendedActions = knowledge.recommendedActions;
      }
    }

    return {
      input: enhancedInput,
      context: {
        ...originalRequest.context,
        knowledgeEnhanced: knowledge.knowledge.length > 0,
        knowledgeConfidence: knowledge.confidenceScore
      },
      timeoutSeconds: originalRequest.timeoutSeconds
    };
  }

  /**
   * Learn from execution results to improve future knowledge injection
   */
  private async learnFromExecution(
    agentId: string,
    context: AgentExecutionContext,
    response: KnowledgeEnhancedResponse
  ): Promise<void> {
    try {
      // Only learn from successful executions
      if (!response.success) return;

      // Extract learning signals
      const learningData = {
        agentId,
        knowledgeUsed: context.injectedKnowledge.knowledge.length,
        executionSuccess: response.success,
        executionTime: response.executionTimeMs,
        knowledgeConfidence: context.injectedKnowledge.confidenceScore,
        timestamp: new Date().toISOString()
      };

      // Store learning data for future improvement
      // This could be expanded to use machine learning for optimization
      
      log.debug(`📈 Learning data recorded for agent ${agentId}`, LogContext.AI, { learningData });

    } catch (error) {
      log.error(`❌ Failed to learn from execution for agent ${agentId}`, LogContext.AI, { error });
    }
  }

  /**
   * Update execution statistics
   */
  private updateExecutionStats(knowledgeInjectionTime: number, knowledgeEnhanced: boolean): void {
    this.knowledgeInjectionStats.totalExecutions++;
    
    if (knowledgeEnhanced) {
      this.knowledgeInjectionStats.knowledgeEnhancedExecutions++;
    }

    // Update average injection time
    const totalEnhanced = this.knowledgeInjectionStats.knowledgeEnhancedExecutions;
    if (totalEnhanced > 0) {
      this.knowledgeInjectionStats.averageInjectionTimeMs = (
        (this.knowledgeInjectionStats.averageInjectionTimeMs * (totalEnhanced - 1)) + 
        knowledgeInjectionTime
      ) / totalEnhanced;
    }

    // Update utilization rate
    this.knowledgeInjectionStats.knowledgeUtilizationRate = 
      this.knowledgeInjectionStats.knowledgeEnhancedExecutions / 
      this.knowledgeInjectionStats.totalExecutions;
  }

  /**
   * Execute multiple agents with knowledge sharing
   */
  async executeCollaborativeWorkflow(
    workflow: {
      name: string;
      agents: Array<{
        agentId: string;
        request: KnowledgeEnhancedRequest;
        dependsOn?: string[];
      }>;
      shareKnowledgeAcrossAgents?: boolean;
    }
  ): Promise<{
    success: boolean;
    results: Record<string, KnowledgeEnhancedResponse>;
    sharedKnowledge?: KnowledgeResponse;
    collaborationInsights: string[];
  }> {
    const results: Record<string, KnowledgeEnhancedResponse> = {};
    let sharedKnowledge: KnowledgeResponse | undefined;
    const collaborationInsights: string[] = [];

    try {
      log.info(`🤝 Starting collaborative workflow: ${workflow.name}`, LogContext.AI);

      // If knowledge sharing is enabled, build shared context first
      if (workflow.shareKnowledgeAcrossAgents) {
        const combinedQueries = workflow.agents
          .map(a => this.extractQueryFromRequest(a.request))
          .join(' ');

        const sharedRequest: KnowledgeRequest = {
          agentId: 'workflow_shared',
          query: combinedQueries,
          contextType: 'general',
          maxResults: 20,
          includeRelated: true
        };

        sharedKnowledge = await unifiedKnowledgeBridge.getKnowledgeForAgent(sharedRequest);
        collaborationInsights.push(`Shared knowledge pool created with ${sharedKnowledge.knowledge.length} knowledge paths`);
      }

      // Execute agents (for now, sequentially - could be parallelized based on dependencies)
      for (const agentTask of workflow.agents) {
        // Enhance request with shared knowledge if available
        if (sharedKnowledge) {
          agentTask.request.input.sharedWorkflowKnowledge = {
            relevantPaths: sharedKnowledge.knowledge.slice(0, 5), // Top 5 shared paths
            confidence: sharedKnowledge.confidenceScore
          };
        }

        const response = await this.executeWithKnowledge(agentTask.agentId, agentTask.request);
        results[agentTask.agentId] = response;

        if (response.knowledgeEnhanced) {
          collaborationInsights.push(
            `Agent ${agentTask.agentId} utilized ${response.knowledgeUsed.knowledge.length} knowledge paths`
          );
        }
      }

      const successfulExecutions = Object.values(results).filter(r => r.success).length;
      collaborationInsights.push(
        `Workflow completed: ${successfulExecutions}/${workflow.agents.length} agents succeeded`
      );

      log.info(`✅ Collaborative workflow "${workflow.name}" completed`, LogContext.AI);

      return {
        success: successfulExecutions === workflow.agents.length,
        results,
        sharedKnowledge,
        collaborationInsights
      };

    } catch (error) {
      log.error(`❌ Collaborative workflow "${workflow.name}" failed`, LogContext.AI, { error });
      throw error;
    }
  }

  /**
   * Get execution statistics
   */
  getExecutionStats() {
    return { ...this.knowledgeInjectionStats };
  }

  /**
   * Get current execution contexts (for monitoring)
   */
  getActiveExecutions(): AgentExecutionContext[] {
    return Array.from(this.executionContexts.values());
  }

  /**
   * Force refresh knowledge for an agent before next execution
   */
  async refreshAgentKnowledge(agentId: string): Promise<void> {
    await unifiedKnowledgeBridge.refreshAgentKnowledge(agentId);
    log.info(`🔄 Knowledge refreshed for agent ${agentId}`, LogContext.AI);
  }

  /**
   * Shutdown the executor
   */
  shutdown(): void {
    this.removeAllListeners();
    this.executionContexts.clear();
    log.info('🛑 Enhanced Agent Executor shutdown', LogContext.SYSTEM);
  }
}

// Export singleton instance
export const enhancedAgentExecutor = new EnhancedAgentExecutor();
export default enhancedAgentExecutor;