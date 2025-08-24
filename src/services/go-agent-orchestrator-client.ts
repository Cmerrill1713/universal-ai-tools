/**
 * Go Agent Orchestrator Client
 * TypeScript client for the Go Agent Orchestrator service
 * Provides access to 8 specialized agents and task orchestration
 */

import { EventEmitter } from 'events';

// Go Agent Orchestrator Types (matching Go service types)
export interface GoAgentDefinition {
  id: string;
  name: string;
  type: string;
  description: string;
  specialization: string;
  capabilities: string[];
  performance: {
    tasksCompleted: number;
    averageResponseMs: number;
    successRate: number;
    lastActivity?: string;
  };
  status: 'active' | 'busy' | 'inactive' | 'failed';
  endpoint: string;
}

export interface GoAgentExecutionRequest {
  agentId: string;
  task: {
    type: string;
    description: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    input: Record<string, any>;
    context?: Record<string, any>;
    metadata?: Record<string, any>;
  };
  timeoutSeconds?: number;
  retryAttempts?: number;
}

export interface GoAgentExecutionResponse {
  success: boolean;
  result: Record<string, any>;
  executionTimeMs: number;
  agentId: string;
  agentName: string;
  metadata: Record<string, any>;
  errors?: string[];
}

export interface GoOrchestratorStats {
  totalAgents: number;
  activeAgents: number;
  busyAgents: number;
  totalExecutions: number;
  averageResponseTime: number;
  successRate: number;
  queuedTasks: number;
}

export interface GoTaskOrchestrationRequest {
  workflowName: string;
  tasks: Array<{
    id: string;
    agentType?: string;
    agentId?: string;
    task: {
      type: string;
      description: string;
      priority: 'low' | 'medium' | 'high' | 'critical';
      input: Record<string, any>;
      context?: Record<string, any>;
    };
    dependencies?: string[];
    retryPolicy?: {
      maxAttempts: number;
      backoffMs: number;
    };
  }>;
  parallelExecution?: boolean;
  failureHandling?: 'abort' | 'continue' | 'retry';
}

export interface GoTaskOrchestrationResponse {
  success: boolean;
  workflowId: string;
  results: Record<string, GoAgentExecutionResponse>;
  executionTimeMs: number;
  failedTasks?: string[];
  completedTasks: string[];
}

/**
 * Go Agent Orchestrator Client - Specialized Agent Management
 */
export class GoAgentOrchestratorClient extends EventEmitter {
  private baseUrl: string;
  private healthCheckInterval?: NodeJS.Timeout;
  private isConnected: boolean = false;
  private connectionRetries: number = 0;
  private maxRetries: number = 5;

  // Cached agent definitions for performance
  private cachedAgents: Map<string, GoAgentDefinition> = new Map();
  private lastCacheUpdate: Date = new Date(0);
  private cacheExpiryMs: number = 30000; // 30 seconds

  constructor(baseUrl: string = 'http://localhost:8081') {
    super();
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.startHealthChecks();
    console.log(`🐹 Go Agent Orchestrator Client initialized: ${this.baseUrl}`);
  }

  /**
   * Get all available specialized agents
   */
  async listSpecializedAgents(): Promise<GoAgentDefinition[]> {
    try {
      // Check cache first
      if (this.isCacheValid()) {
        return Array.from(this.cachedAgents.values());
      }

      const response = await fetch(`${this.baseUrl}/agents`);

      if (!response.ok) {
        throw new Error(`Failed to list agents: ${response.status} ${response.statusText}`);
      }

      const agents: GoAgentDefinition[] = await response.json();
      
      // Update cache
      this.cachedAgents.clear();
      agents.forEach(agent => this.cachedAgents.set(agent.id, agent));
      this.lastCacheUpdate = new Date();

      console.log(`✅ Retrieved ${agents.length} specialized agents from Go orchestrator`);
      return agents;
    } catch (error) {
      console.error('❌ Failed to list agents from Go orchestrator:', error);
      return Array.from(this.cachedAgents.values()); // Return cached if available
    }
  }

  /**
   * Get specific agent by ID
   */
  async getAgent(agentId: string): Promise<GoAgentDefinition | null> {
    try {
      // Check cache first
      if (this.cachedAgents.has(agentId) && this.isCacheValid()) {
        return this.cachedAgents.get(agentId)!;
      }

      const response = await fetch(`${this.baseUrl}/agents/${agentId}`);

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`Failed to get agent: ${response.status} ${response.statusText}`);
      }

      const agent: GoAgentDefinition = await response.json();
      
      // Update cache
      this.cachedAgents.set(agentId, agent);

      return agent;
    } catch (error) {
      console.error(`❌ Failed to get agent ${agentId} from Go orchestrator:`, error);
      return this.cachedAgents.get(agentId) || null;
    }
  }

  /**
   * Find agents by specialization (react-expert, frontend-developer, code-reviewer, etc.)
   */
  async findAgentsBySpecialization(specialization: string): Promise<GoAgentDefinition[]> {
    const agents = await this.listSpecializedAgents();
    return agents.filter(agent => 
      agent.specialization?.toLowerCase() === specialization.toLowerCase() ||
      agent.name.toLowerCase().includes(specialization.toLowerCase())
    );
  }

  /**
   * Get the best agent for a specific task type
   */
  async getBestAgentForTask(taskType: string, capabilities?: string[]): Promise<GoAgentDefinition | null> {
    try {
      const params = new URLSearchParams();
      params.append('task_type', taskType);
      if (capabilities) {
        capabilities.forEach(cap => params.append('capabilities', cap));
      }

      const response = await fetch(`${this.baseUrl}/agents/best-match?${params.toString()}`);

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`Failed to find best agent: ${response.status} ${response.statusText}`);
      }

      const agent: GoAgentDefinition = await response.json();
      console.log(`✅ Found best agent for task "${taskType}": ${agent.name}`);
      
      return agent;
    } catch (error) {
      console.error(`❌ Failed to find best agent for task "${taskType}":`, error);
      
      // Fallback to local matching
      const agents = await this.listSpecializedAgents();
      const matchedAgent = agents.find(agent => 
        agent.capabilities.some(cap => 
          cap.toLowerCase().includes(taskType.toLowerCase())
        ) ||
        agent.specialization?.toLowerCase().includes(taskType.toLowerCase())
      );
      
      return matchedAgent || null;
    }
  }

  /**
   * Execute a task on a specific specialized agent
   */
  async executeTask(request: GoAgentExecutionRequest): Promise<GoAgentExecutionResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/agents/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_id: request.agentId,
          task: {
            type: request.task.type,
            description: request.task.description,
            priority: request.task.priority,
            input: request.task.input,
            context: request.task.context || {},
            metadata: request.task.metadata || {}
          },
          timeout_seconds: request.timeoutSeconds || 30,
          retry_attempts: request.retryAttempts || 3
        })
      });

      if (!response.ok) {
        throw new Error(`Task execution failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      console.log(`✅ Executed task "${request.task.type}" on Go agent ${request.agentId} in ${result.execution_time_ms}ms`);
      this.emit('taskExecuted', { agentId: request.agentId, result });
      
      return {
        success: result.success,
        result: result.result,
        executionTimeMs: result.execution_time_ms,
        agentId: result.agent_id,
        agentName: result.agent_name,
        metadata: result.metadata,
        errors: result.errors
      };
    } catch (error) {
      console.error(`❌ Failed to execute task on Go agent ${request.agentId}:`, error);
      throw error;
    }
  }

  /**
   * Execute a task with automatic agent selection
   */
  async executeTaskWithAutoSelection(taskRequest: {
    type: string;
    description: string;
    priority?: 'low' | 'medium' | 'high' | 'critical';
    input: Record<string, any>;
    context?: Record<string, any>;
    capabilities?: string[];
  }): Promise<GoAgentExecutionResponse> {
    const bestAgent = await this.getBestAgentForTask(taskRequest.type, taskRequest.capabilities);
    
    if (!bestAgent) {
      throw new Error(`No suitable agent found for task type: ${taskRequest.type}`);
    }

    return this.executeTask({
      agentId: bestAgent.id,
      task: {
        type: taskRequest.type,
        description: taskRequest.description,
        priority: taskRequest.priority || 'medium',
        input: taskRequest.input,
        context: taskRequest.context
      }
    });
  }

  /**
   * Orchestrate multiple tasks across specialized agents
   */
  async orchestrateTasks(request: GoTaskOrchestrationRequest): Promise<GoTaskOrchestrationResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/orchestrate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflow_name: request.workflowName,
          tasks: request.tasks.map(task => ({
            id: task.id,
            agent_type: task.agentType,
            agent_id: task.agentId,
            task: task.task,
            dependencies: task.dependencies || [],
            retry_policy: task.retryPolicy
          })),
          parallel_execution: request.parallelExecution || false,
          failure_handling: request.failureHandling || 'abort'
        })
      });

      if (!response.ok) {
        throw new Error(`Orchestration failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      console.log(`✅ Orchestrated workflow "${request.workflowName}" with ${request.tasks.length} tasks in ${result.execution_time_ms}ms`);
      this.emit('workflowExecuted', { workflowName: request.workflowName, result });
      
      return {
        success: result.success,
        workflowId: result.workflow_id,
        results: result.results,
        executionTimeMs: result.execution_time_ms,
        failedTasks: result.failed_tasks,
        completedTasks: result.completed_tasks
      };
    } catch (error) {
      console.error(`❌ Failed to orchestrate workflow "${request.workflowName}":`, error);
      throw error;
    }
  }

  /**
   * Get agent performance metrics
   */
  async getAgentPerformance(agentId: string): Promise<{
    tasksCompleted: number;
    averageResponseMs: number;
    successRate: number;
    lastActivity: string;
    queuedTasks: number;
  } | null> {
    try {
      const response = await fetch(`${this.baseUrl}/agents/${agentId}/performance`);

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`Failed to get agent performance: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`❌ Failed to get performance for Go agent ${agentId}:`, error);
      return null;
    }
  }

  /**
   * Get overall orchestrator statistics
   */
  async getOrchestratorStats(): Promise<GoOrchestratorStats> {
    try {
      const response = await fetch(`${this.baseUrl}/stats`);

      if (!response.ok) {
        throw new Error(`Failed to get orchestrator stats: ${response.status} ${response.statusText}`);
      }

      const stats = await response.json();
      
      return {
        totalAgents: stats.total_agents || 0,
        activeAgents: stats.active_agents || 0,
        busyAgents: stats.busy_agents || 0,
        totalExecutions: stats.total_executions || 0,
        averageResponseTime: stats.average_response_time || 0,
        successRate: stats.success_rate || 0,
        queuedTasks: stats.queued_tasks || 0
      };
    } catch (error) {
      console.error('❌ Failed to get Go orchestrator stats:', error);
      return {
        totalAgents: 0,
        activeAgents: 0,
        busyAgents: 0,
        totalExecutions: 0,
        averageResponseTime: 0,
        successRate: 0,
        queuedTasks: 0
      };
    }
  }

  /**
   * Check if the Go orchestrator service is healthy
   */
  async isHealthy(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        timeout: 5000
      });
      
      const isHealthy = response.ok;
      
      if (isHealthy && !this.isConnected) {
        this.isConnected = true;
        this.connectionRetries = 0;
        console.log('✅ Connected to Go Agent Orchestrator');
        this.emit('connected');
      }
      
      return isHealthy;
    } catch (error) {
      if (this.isConnected) {
        this.isConnected = false;
        console.warn('⚠️ Lost connection to Go Agent Orchestrator');
        this.emit('disconnected');
      }
      return false;
    }
  }

  /**
   * Get available specialization types
   */
  async getSpecializations(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/specializations`);

      if (!response.ok) {
        throw new Error(`Failed to get specializations: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ Failed to get specializations from Go orchestrator:', error);
      
      // Return known specializations as fallback
      return [
        'frontend-developer',
        'react-expert',
        'typescript-pro',
        'ui-ux-designer',
        'code-reviewer', 
        'api-debugger',
        'performance-optimizer',
        'test-runner'
      ];
    }
  }

  /**
   * Check if agent cache is still valid
   */
  private isCacheValid(): boolean {
    const now = new Date();
    return (now.getTime() - this.lastCacheUpdate.getTime()) < this.cacheExpiryMs;
  }

  /**
   * Start periodic health checks and cache invalidation
   */
  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.isHealthy();
      
      // Invalidate cache periodically to ensure fresh data
      if (!this.isCacheValid()) {
        this.cachedAgents.clear();
      }
    }, 10000); // Check every 10 seconds

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
    this.cachedAgents.clear();
    console.log('🛑 Go Agent Orchestrator Client shutdown');
  }

  /**
   * Get connection status and cache info
   */
  getConnectionStatus(): {
    connected: boolean;
    baseUrl: string;
    retries: number;
    maxRetries: number;
    cachedAgents: number;
    cacheValid: boolean;
  } {
    return {
      connected: this.isConnected,
      baseUrl: this.baseUrl,
      retries: this.connectionRetries,
      maxRetries: this.maxRetries,
      cachedAgents: this.cachedAgents.size,
      cacheValid: this.isCacheValid()
    };
  }
}

// Export singleton for easy access
export const goAgentOrchestrator = new GoAgentOrchestratorClient();
export default goAgentOrchestrator;