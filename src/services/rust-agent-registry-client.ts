/**
 * Rust Agent Registry Client
 * TypeScript client for the high-performance Rust Agent Registry service
 * Provides seamless integration between TypeScript services and Rust agent management
 */

import { EventEmitter } from 'events';

// Agent Registry Types (matching Rust service types)
export interface RustAgentCapability {
  name: string;
  description: string;
  complexity: 'simple' | 'moderate' | 'complex';
  inputs: string[];
  outputs: string[];
}

export interface RustAgentConfig {
  maxConcurrentTasks: number;
  timeout: number;
  retryAttempts: number;
  resourceLimits: {
    memory: number;
    cpu: number;
  };
  environment: Record<string, string>;
}

export interface RustAgentDefinition {
  id: string;
  name: string;
  agentType: 'specialized' | 'general' | 'utility' | 'debugging' | 'testing' | 'optimization';
  description: string;
  capabilities: RustAgentCapability[];
  config: RustAgentConfig;
  version: string;
  endpoint?: string;
  status: 'active' | 'inactive' | 'failed';
  createdAt: string;
  lastActivity?: string;
  performance: {
    tasksCompleted: number;
    averageResponseMs: number;
    successRate: number;
    lastError?: string;
  };
}

export interface RustAgentExecutionRequest {
  input: Record<string, any>;
  context?: Record<string, any>;
  timeoutSeconds?: number;
}

export interface RustAgentExecutionResponse {
  success: boolean;
  output: Record<string, any>;
  executionTimeMs: number;
  agentId: string;
  agentName: string;
  metadata: Record<string, any>;
}

export interface RustAgentQuery {
  agentType?: 'specialized' | 'general' | 'utility' | 'debugging' | 'testing' | 'optimization';
  status?: 'active' | 'inactive' | 'failed';
  capability?: string;
  limit?: number;
  offset?: number;
}

export interface RustRegistryStats {
  totalAgents: number;
  activeAgents: number;
  totalExecutions: number;
  averageResponseTime: number;
  successRate: number;
  memoryUsage: number;
}

/**
 * Rust Agent Registry Client - High-Performance Agent Management
 */
export class RustAgentRegistryClient extends EventEmitter {
  private baseUrl: string;
  private healthCheckInterval?: NodeJS.Timeout;
  private isConnected: boolean = false;
  private connectionRetries: number = 0;
  private maxRetries: number = 5;

  constructor(baseUrl: string = 'http://localhost:8006') {
    super();
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.startHealthChecks();
    console.log(`🦀 Rust Agent Registry Client initialized: ${this.baseUrl}`);
  }

  /**
   * Register a new specialized agent with the Rust registry
   */
  async registerAgent(params: {
    name: string;
    agentType: 'specialized' | 'general' | 'utility' | 'debugging' | 'testing' | 'optimization';
    description: string;
    capabilities: RustAgentCapability[];
    config: Partial<RustAgentConfig>;
    version: string;
    endpoint?: string;
  }): Promise<RustAgentDefinition> {
    try {
      const response = await fetch(`${this.baseUrl}/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: params.name,
          agent_type: params.agentType,
          description: params.description,
          capabilities: params.capabilities,
          config: {
            maxConcurrentTasks: 5,
            timeout: 30000,
            retryAttempts: 3,
            resourceLimits: {
              memory: 512,
              cpu: 100
            },
            environment: {},
            ...params.config
          },
          version: params.version,
          endpoint: params.endpoint
        })
      });

      if (!response.ok) {
        throw new Error(`Registration failed: ${response.status} ${response.statusText}`);
      }

      const agent = await response.json();
      
      console.log(`✅ Registered agent with Rust registry: ${agent.name} (${agent.id})`);
      this.emit('agentRegistered', agent);
      
      return agent;
    } catch (error) {
      console.error('❌ Failed to register agent with Rust registry:', error);
      throw error;
    }
  }

  /**
   * List all agents with optional filtering
   */
  async listAgents(query?: RustAgentQuery): Promise<RustAgentDefinition[]> {
    try {
      const params = new URLSearchParams();
      
      if (query?.agentType) params.append('agent_type', query.agentType);
      if (query?.status) params.append('status', query.status);
      if (query?.capability) params.append('capability', query.capability);
      if (query?.limit) params.append('limit', query.limit.toString());
      if (query?.offset) params.append('offset', query.offset.toString());

      const url = `${this.baseUrl}/agents${params.toString() ? '?' + params.toString() : ''}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to list agents: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data || [];
    } catch (error) {
      console.error('❌ Failed to list agents from Rust registry:', error);
      return [];
    }
  }

  /**
   * Get detailed information about a specific agent
   */
  async getAgent(agentId: string): Promise<RustAgentDefinition | null> {
    try {
      const response = await fetch(`${this.baseUrl}/agents/${agentId}`);

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`Failed to get agent: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`❌ Failed to get agent ${agentId} from Rust registry:`, error);
      return null;
    }
  }

  /**
   * Execute a task on a specific agent
   */
  async executeAgent(
    agentId: string,
    request: RustAgentExecutionRequest
  ): Promise<RustAgentExecutionResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/agents/${agentId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: request.input,
          context: request.context || {},
          timeout_seconds: request.timeoutSeconds || 30
        })
      });

      if (!response.ok) {
        throw new Error(`Execution failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      console.log(`✅ Executed task on Rust agent ${agentId} in ${result.execution_time_ms}ms`);
      this.emit('agentExecuted', { agentId, result });
      
      return {
        success: result.success,
        output: result.output,
        executionTimeMs: result.execution_time_ms,
        agentId: result.agent_id,
        agentName: result.agent_name,
        metadata: result.metadata
      };
    } catch (error) {
      console.error(`❌ Failed to execute on Rust agent ${agentId}:`, error);
      throw error;
    }
  }

  /**
   * Get agent status and health information
   */
  async getAgentStatus(agentId: string): Promise<{
    status: 'active' | 'inactive' | 'failed';
    lastSeen: string;
    healthScore: number;
    executionCount: number;
    errorCount: number;
  } | null> {
    try {
      const response = await fetch(`${this.baseUrl}/agents/${agentId}/status`);

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`Failed to get agent status: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`❌ Failed to get status for Rust agent ${agentId}:`, error);
      return null;
    }
  }

  /**
   * Perform health check on a specific agent
   */
  async checkAgentHealth(agentId: string): Promise<{
    healthy: boolean;
    responseTimeMs: number;
    lastCheck: string;
    errorMessage?: string;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/agents/${agentId}/health`, {
        method: 'POST'
      });

      if (!response.ok) {
        return {
          healthy: false,
          responseTimeMs: -1,
          lastCheck: new Date().toISOString(),
          errorMessage: `HTTP ${response.status}: ${response.statusText}`
        };
      }

      return await response.json();
    } catch (error) {
      return {
        healthy: false,
        responseTimeMs: -1,
        lastCheck: new Date().toISOString(),
        errorMessage: error.message
      };
    }
  }

  /**
   * Search for agents by capabilities or other criteria
   */
  async searchAgents(searchQuery: string): Promise<RustAgentDefinition[]> {
    try {
      const response = await fetch(`${this.baseUrl}/agents/search?q=${encodeURIComponent(searchQuery)}`);

      if (!response.ok) {
        throw new Error(`Search failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data || [];
    } catch (error) {
      console.error('❌ Failed to search agents in Rust registry:', error);
      return [];
    }
  }

  /**
   * Get available agent types
   */
  async getAgentTypes(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/agents/types`);

      if (!response.ok) {
        throw new Error(`Failed to get agent types: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ Failed to get agent types from Rust registry:', error);
      return [];
    }
  }

  /**
   * Get available agent capabilities
   */
  async getCapabilities(): Promise<RustAgentCapability[]> {
    try {
      const response = await fetch(`${this.baseUrl}/agents/capabilities`);

      if (!response.ok) {
        throw new Error(`Failed to get capabilities: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ Failed to get capabilities from Rust registry:', error);
      return [];
    }
  }

  /**
   * Execute a complex workflow across multiple agents
   */
  async executeWorkflow(workflowDefinition: {
    name: string;
    steps: Array<{
      agentId?: string;
      agentType?: string;
      capabilities?: string[];
      input: Record<string, any>;
      dependsOn?: string[];
    }>;
    parallelExecution?: boolean;
  }): Promise<{
    success: boolean;
    results: Record<string, any>;
    executionTimeMs: number;
    failedSteps?: string[];
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/orchestration/workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(workflowDefinition)
      });

      if (!response.ok) {
        throw new Error(`Workflow execution failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      console.log(`✅ Executed workflow "${workflowDefinition.name}" in ${result.executionTimeMs}ms`);
      this.emit('workflowExecuted', { workflow: workflowDefinition.name, result });
      
      return result;
    } catch (error) {
      console.error(`❌ Failed to execute workflow "${workflowDefinition.name}":`, error);
      throw error;
    }
  }

  /**
   * Update agent configuration
   */
  async updateAgent(
    agentId: string,
    updates: {
      description?: string;
      capabilities?: RustAgentCapability[];
      config?: Partial<RustAgentConfig>;
      status?: 'active' | 'inactive';
    }
  ): Promise<RustAgentDefinition> {
    try {
      const response = await fetch(`${this.baseUrl}/agents/${agentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        throw new Error(`Update failed: ${response.status} ${response.statusText}`);
      }

      const updatedAgent = await response.json();
      
      console.log(`✅ Updated Rust agent: ${updatedAgent.name} (${agentId})`);
      this.emit('agentUpdated', updatedAgent);
      
      return updatedAgent;
    } catch (error) {
      console.error(`❌ Failed to update Rust agent ${agentId}:`, error);
      throw error;
    }
  }

  /**
   * Unregister an agent from the registry
   */
  async unregisterAgent(agentId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/agents/${agentId}`, {
        method: 'DELETE'
      });

      if (response.status === 404) {
        return false; // Agent already doesn't exist
      }

      if (!response.ok) {
        throw new Error(`Unregistration failed: ${response.status} ${response.statusText}`);
      }

      console.log(`✅ Unregistered Rust agent: ${agentId}`);
      this.emit('agentUnregistered', agentId);
      
      return true;
    } catch (error) {
      console.error(`❌ Failed to unregister Rust agent ${agentId}:`, error);
      return false;
    }
  }

  /**
   * Get comprehensive registry statistics
   */
  async getRegistryStats(): Promise<RustRegistryStats> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);

      if (!response.ok) {
        throw new Error(`Failed to get registry stats: ${response.status} ${response.statusText}`);
      }

      const healthData = await response.json();
      
      return {
        totalAgents: healthData.registered_agents || 0,
        activeAgents: healthData.active_agents || 0,
        totalExecutions: healthData.total_executions || 0,
        averageResponseTime: 0, // Would need to calculate from metrics
        successRate: 1.0, // Would need to calculate from metrics
        memoryUsage: 0 // Would need to get from metrics endpoint
      };
    } catch (error) {
      console.error('❌ Failed to get Rust registry stats:', error);
      return {
        totalAgents: 0,
        activeAgents: 0,
        totalExecutions: 0,
        averageResponseTime: 0,
        successRate: 0,
        memoryUsage: 0
      };
    }
  }

  /**
   * Get Prometheus metrics from the registry
   */
  async getMetrics(): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/metrics`);

      if (!response.ok) {
        throw new Error(`Failed to get metrics: ${response.status} ${response.statusText}`);
      }

      return await response.text();
    } catch (error) {
      console.error('❌ Failed to get Rust registry metrics:', error);
      return '';
    }
  }

  /**
   * Check if the Rust registry service is available
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
        console.log('✅ Connected to Rust Agent Registry');
        this.emit('connected');
      }
      
      return isHealthy;
    } catch (error) {
      if (this.isConnected) {
        this.isConnected = false;
        console.warn('⚠️ Lost connection to Rust Agent Registry');
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
    console.log('🛑 Rust Agent Registry Client shutdown');
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): {
    connected: boolean;
    baseUrl: string;
    retries: number;
    maxRetries: number;
  } {
    return {
      connected: this.isConnected,
      baseUrl: this.baseUrl,
      retries: this.connectionRetries,
      maxRetries: this.maxRetries
    };
  }
}

// Export singleton for easy access
export const rustAgentRegistry = new RustAgentRegistryClient();
export default rustAgentRegistry;