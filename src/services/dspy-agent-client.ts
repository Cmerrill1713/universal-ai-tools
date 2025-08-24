/**
 * DSPy Agent Client
 * TypeScript client for the DSPy Orchestrator Python service
 * Provides access to 10-agent cognitive reasoning pipeline
 */

import { EventEmitter } from 'events';

// DSPy Orchestrator Types (matching Python types)
export interface DSPyCognitiveAnalysis {
  intent: string;
  assumptions: string;
  constraints: string;
  challenges: string;
  risks: string;
  ethical_concerns: string;
  plan: string;
  resources: string;
  synthesis: string;
  execution: string;
  learnings: string;
  validation_score: number;
  final_report: string;
  key_insights: string;
}

export interface DSPyHRMPreprocessing {
  hrm_preprocessed: string;
  hrm_confidence: number;
  hrm_template: string;
}

export interface DSPyCognitiveReasoningResponse {
  cognitive_analysis: DSPyCognitiveAnalysis;
  hrm_preprocessing?: DSPyHRMPreprocessing;
  metadata: {
    timestamp: string;
    reasoning_mode: 'cognitive' | 'cognitive_hrm_enhanced';
    agent_count: number;
    hrm_enabled: boolean;
  };
}

export interface DSPyTaskCoordinationRequest {
  task: string;
  available_agents: string[];
  coordination_mode?: 'parallel' | 'sequential' | 'adaptive';
}

export interface DSPyTaskCoordinationResponse {
  task_analysis: {
    subtasks: string;
    dependencies: string;
    priority: string;
  };
  agent_assignments: Array<{
    subtask: string;
    agent: string;
    confidence: number;
  }>;
  coordination_plan: string;
  consensus: string;
  confidence: number;
}

export interface DSPyKnowledgeSearchRequest {
  query: string;
  context?: Record<string, any>;
  search_mode?: 'standard' | 'optimized' | 'semantic';
}

export interface DSPyKnowledgeSearchResponse {
  query: string;
  optimized_query: string;
  strategy: string;
  results: Array<{
    content: string;
    source: string;
    relevance: number;
  }>;
}

export interface DSPyKnowledgeExtractionResponse {
  facts: string;
  relationships: string;
  insights: string;
  validity_score: number;
  concerns: string;
}

export interface DSPyAdaptiveOrchestratorRequest {
  request: string;
  preferred_mode?: 'simple' | 'standard' | 'cognitive';
  context?: Record<string, any>;
}

export interface DSPyAdaptiveOrchestratorResponse {
  mode: 'simple' | 'standard' | 'cognitive';
  response?: string; // For simple mode
  plan?: string; // For standard mode
  execution?: string; // For standard mode
  result?: string; // For standard mode
  cognitive_analysis?: DSPyCognitiveAnalysis; // For cognitive mode
  complexity: number;
}

/**
 * DSPy Agent Client - 10-Agent Cognitive Reasoning System
 */
export class DSPyAgentClient extends EventEmitter {
  private baseUrl: string;
  private healthCheckInterval?: NodeJS.Timeout;
  private isConnected: boolean = false;
  private connectionRetries: number = 0;
  private maxRetries: number = 5;

  // Performance tracking
  private requestCount: number = 0;
  private totalResponseTime: number = 0;
  private lastHealthCheck: Date = new Date();

  constructor(baseUrl: string = 'http://localhost:8766') {
    super();
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.startHealthChecks();
    console.log(`🧠 DSPy Agent Client initialized: ${this.baseUrl}`);
  }

  /**
   * Execute cognitive reasoning chain with 10 agents
   */
  async executeCognitiveReasoning(
    request: string,
    useHrmPreprocessing: boolean = true,
    context?: Record<string, any>
  ): Promise<DSPyCognitiveReasoningResponse> {
    try {
      const startTime = Date.now();
      
      console.log(`🧠 Executing cognitive reasoning for: ${request.substring(0, 50)}...`);

      const response = await fetch(`${this.baseUrl}/reasoning`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_type: 'cognitive_reasoning',
          input_data: {
            request,
            use_hrm_preprocessing: useHrmPreprocessing,
            context: context || {}
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Cognitive reasoning failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      const executionTime = Date.now() - startTime;

      // Update performance tracking
      this.requestCount++;
      this.totalResponseTime += executionTime;

      console.log(`✅ Cognitive reasoning completed in ${executionTime}ms`);
      console.log(`   Mode: ${result.metadata?.reasoning_mode || 'unknown'}`);
      console.log(`   Validation Score: ${result.cognitive_analysis?.validation_score || 'N/A'}`);

      this.emit('cognitiveReasoningCompleted', { request, result, executionTime });

      return result;
    } catch (error) {
      console.error('❌ Failed to execute cognitive reasoning:', error);
      throw error;
    }
  }

  /**
   * Execute adaptive orchestration with automatic mode selection
   */
  async executeAdaptiveOrchestration(
    request: DSPyAdaptiveOrchestratorRequest
  ): Promise<DSPyAdaptiveOrchestratorResponse> {
    try {
      const startTime = Date.now();
      
      console.log(`🎯 Adaptive orchestration for: ${request.request.substring(0, 50)}...`);

      const response = await fetch(`${this.baseUrl}/adaptive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_type: 'adaptive_orchestration',
          input_data: {
            request: request.request,
            preferred_mode: request.preferred_mode,
            context: request.context || {}
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Adaptive orchestration failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      const executionTime = Date.now() - startTime;

      console.log(`✅ Adaptive orchestration completed in ${executionTime}ms`);
      console.log(`   Selected Mode: ${result.mode}`);
      console.log(`   Complexity Score: ${result.complexity}`);

      this.emit('adaptiveOrchestrationCompleted', { request: request.request, result, executionTime });

      return result;
    } catch (error) {
      console.error('❌ Failed to execute adaptive orchestration:', error);
      throw error;
    }
  }

  /**
   * Execute task coordination across multiple agents
   */
  async executeTaskCoordination(
    request: DSPyTaskCoordinationRequest
  ): Promise<DSPyTaskCoordinationResponse> {
    try {
      const startTime = Date.now();
      
      console.log(`🤝 Task coordination for: ${request.task.substring(0, 50)}...`);
      console.log(`   Available agents: ${request.available_agents.length}`);

      const response = await fetch(`${this.baseUrl}/coordinate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_type: 'task_coordination',
          input_data: {
            task: request.task,
            available_agents: request.available_agents,
            coordination_mode: request.coordination_mode || 'adaptive'
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Task coordination failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      const executionTime = Date.now() - startTime;

      console.log(`✅ Task coordination completed in ${executionTime}ms`);
      console.log(`   Agent assignments: ${result.agent_assignments?.length || 0}`);
      console.log(`   Consensus confidence: ${result.confidence}`);

      this.emit('taskCoordinationCompleted', { request: request.task, result, executionTime });

      return result;
    } catch (error) {
      console.error('❌ Failed to execute task coordination:', error);
      throw error;
    }
  }

  /**
   * Execute knowledge search with optimization
   */
  async executeKnowledgeSearch(
    request: DSPyKnowledgeSearchRequest
  ): Promise<DSPyKnowledgeSearchResponse> {
    try {
      const startTime = Date.now();
      
      console.log(`🔍 Knowledge search for: ${request.query.substring(0, 50)}...`);

      const response = await fetch(`${this.baseUrl}/knowledge/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_type: 'knowledge_search',
          input_data: {
            query: request.query,
            context: request.context || {},
            search_mode: request.search_mode || 'optimized'
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Knowledge search failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      const executionTime = Date.now() - startTime;

      console.log(`✅ Knowledge search completed in ${executionTime}ms`);
      console.log(`   Results found: ${result.results?.length || 0}`);
      console.log(`   Search strategy: ${result.strategy}`);

      this.emit('knowledgeSearchCompleted', { query: request.query, result, executionTime });

      return result;
    } catch (error) {
      console.error('❌ Failed to execute knowledge search:', error);
      throw error;
    }
  }

  /**
   * Extract knowledge from content
   */
  async extractKnowledge(content: string): Promise<DSPyKnowledgeExtractionResponse> {
    try {
      const startTime = Date.now();
      
      console.log(`📖 Extracting knowledge from content (${content.length} chars)`);

      const response = await fetch(`${this.baseUrl}/knowledge/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_type: 'knowledge_extraction',
          input_data: {
            content: content
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Knowledge extraction failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      const executionTime = Date.now() - startTime;

      console.log(`✅ Knowledge extraction completed in ${executionTime}ms`);
      console.log(`   Validity score: ${result.validity_score}`);

      this.emit('knowledgeExtractionCompleted', { contentLength: content.length, result, executionTime });

      return result;
    } catch (error) {
      console.error('❌ Failed to extract knowledge:', error);
      throw error;
    }
  }

  /**
   * Get DSPy orchestrator performance metrics
   */
  async getPerformanceMetrics(): Promise<{
    totalRequests: number;
    averageResponseTime: number;
    successRate: number;
    availableModels: string[];
    systemStatus: string;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/metrics`);

      if (!response.ok) {
        throw new Error(`Failed to get metrics: ${response.status} ${response.statusText}`);
      }

      const serverMetrics = await response.json();

      // Combine server metrics with client metrics
      const averageResponseTime = this.requestCount > 0 
        ? this.totalResponseTime / this.requestCount 
        : 0;

      return {
        totalRequests: this.requestCount,
        averageResponseTime,
        successRate: serverMetrics.success_rate || 0.95,
        availableModels: serverMetrics.available_models || [],
        systemStatus: serverMetrics.status || 'unknown'
      };
    } catch (error) {
      console.error('❌ Failed to get performance metrics:', error);
      return {
        totalRequests: this.requestCount,
        averageResponseTime: this.requestCount > 0 ? this.totalResponseTime / this.requestCount : 0,
        successRate: 0,
        availableModels: [],
        systemStatus: 'error'
      };
    }
  }

  /**
   * Get available reasoning templates from HRM preprocessing
   */
  async getAvailableTemplates(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/templates`);

      if (!response.ok) {
        throw new Error(`Failed to get templates: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ Failed to get available templates:', error);
      
      // Return default templates as fallback
      return [
        'analytical',
        'problem_solving',
        'explanatory',
        'comparative',
        'creative'
      ];
    }
  }

  /**
   * Check if the DSPy orchestrator service is healthy
   */
  async isHealthy(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        timeout: 5000
      });
      
      const isHealthy = response.ok;
      this.lastHealthCheck = new Date();
      
      if (isHealthy && !this.isConnected) {
        this.isConnected = true;
        this.connectionRetries = 0;
        console.log('✅ Connected to DSPy Orchestrator');
        this.emit('connected');
      }
      
      return isHealthy;
    } catch (error) {
      if (this.isConnected) {
        this.isConnected = false;
        console.warn('⚠️ Lost connection to DSPy Orchestrator');
        this.emit('disconnected');
      }
      return false;
    }
  }

  /**
   * Start periodic health checks
   */
  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.isHealthy();
    }, 15000); // Check every 15 seconds

    // Initial health check
    this.isHealthy();
  }

  /**
   * Stop health checks and cleanup
   */
  shutdown(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
    
    this.isConnected = false;
    console.log('🛑 DSPy Agent Client shutdown');
  }

  /**
   * Get connection status and performance info
   */
  getConnectionStatus(): {
    connected: boolean;
    baseUrl: string;
    retries: number;
    maxRetries: number;
    totalRequests: number;
    averageResponseTime: number;
    lastHealthCheck: Date;
  } {
    return {
      connected: this.isConnected,
      baseUrl: this.baseUrl,
      retries: this.connectionRetries,
      maxRetries: this.maxRetries,
      totalRequests: this.requestCount,
      averageResponseTime: this.requestCount > 0 ? this.totalResponseTime / this.requestCount : 0,
      lastHealthCheck: this.lastHealthCheck
    };
  }
}

// Export singleton for easy access
export const dspyAgentClient = new DSPyAgentClient();
export default dspyAgentClient;