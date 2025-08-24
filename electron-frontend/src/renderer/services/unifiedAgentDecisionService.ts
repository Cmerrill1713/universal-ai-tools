import Logger from '../utils/logger';
/**
 * Unified Agent Decision Service
 *
 * Integrates with HRM Universal Decision Engine for intelligent agent routing and task execution.
 * This service acts as the central coordinator between the Electron frontend and the sophisticated
 * multi-layer agent architecture including:
 * - HRM MLX-based reasoning engine
 * - Rust Agent Registry for sub-millisecond performance
 * - Go Agent Orchestrator with 8 specialized agents
 * - DSPy 10-agent cognitive pipeline
 */

// HRM Decision Engine Types (matching Python backend)
export enum DecisionType {
  LLM_SELECTION = 'llm_selection',
  AGENT_ROUTING = 'agent_routing',
  MEMORY_MANAGEMENT = 'memory_management',
  RESOURCE_SCALING = 'resource_scaling',
  ERROR_RECOVERY = 'error_recovery',
  SECURITY_ACCESS = 'security_access',
  DATA_PROCESSING = 'data_processing',
  UX_OPTIMIZATION = 'ux_optimization',
  API_ROUTING = 'api_routing',
  MONITORING_ACTION = 'monitoring_action',
}

export enum DecisionPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
  IMMEDIATE = 'immediate',
}

export interface DecisionContext {
  decision_type: DecisionType;
  user_id?: string;
  session_id?: string;
  request_data?: Record<string, any>;
  system_state?: Record<string, any>;
  historical_data?: Array<Record<string, any>>;
  constraints?: Record<string, any>;
  available_options?: Array<Record<string, any>>;
}

// Enhanced HRM Decision Result with full reasoning trace
export interface HRMReasoningStep {
  decision_point: string;
  reasoning: string;
  confidence: number;
  alternatives_considered: string[];
}

export interface DecisionResult {
  decision_id: string;
  selected_option: Record<string, any>;
  confidence: number;
  reasoning_steps: string[];
  alternative_options: Array<Record<string, any>>;
  estimated_impact: Record<string, number>;
  monitoring_metrics: string[];
  fallback_strategy?: Record<string, any>;
  execution_parameters: Record<string, any>;
  estimated_resources: {
    cpu_usage: number;
    memory_mb: number;
    estimated_time_ms: number;
  };
  risk_assessment: {
    risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    potential_issues: string[];
    mitigation_strategies: string[];
  };
  timestamp: string;
}

// Agent System Types
export interface AgentCapability {
  name: string;
  version: string;
  description: string;
}

export interface AgentSystemHealth {
  rust_registry: {
    status: 'healthy' | 'degraded' | 'offline';
    response_time_ms: number;
    active_agents: number;
    total_executions: number;
  };
  go_orchestrator: {
    status: 'healthy' | 'degraded' | 'offline';
    specialized_agents: Array<{
      name: string;
      type: string;
      status: 'idle' | 'busy' | 'failed' | 'offline';
      performance: {
        tasks_completed: number;
        average_response_ms: number;
        success_rate: number;
      };
    }>;
  };
  dspy_pipeline: {
    status: 'healthy' | 'degraded' | 'offline';
    cognitive_agents: Array<{
      name: string;
      stage: string;
      processing_time_ms: number;
    }>;
  };
  hrm_engine: {
    status: 'healthy' | 'degraded' | 'offline';
    model_loaded: boolean;
    inference_time_ms: number;
    decision_accuracy: number;
  };
}

export interface TaskExecutionRequest {
  task_type:
    | 'frontend-developer'
    | 'react-expert'
    | 'typescript-pro'
    | 'code-reviewer'
    | 'test-runner'
    | 'api-debugger'
    | 'performance-optimizer'
    | 'ui-ux-designer'
    | 'one-folder'
    | 'pydantic-ai';
  complexity: 'simple' | 'moderate' | 'complex' | 'expert';
  task_description: string;
  user_context: {
    profile_id: string;
    preferences: Record<string, any>;
    experience_level: 'beginner' | 'intermediate' | 'expert';
    frontend_framework: 'react' | 'electron' | 'tailwind' | 'framer-motion';
  };
  execution_constraints: {
    max_time_ms?: number;
    max_memory_mb?: number;
    require_human_approval?: boolean;
  };
  related_files?: string[];
  parameters: Record<string, any>;
}

export interface TaskExecutionResult {
  task_id: string;
  execution_chain: Array<{
    agent_name: string;
    agent_type: string;
    execution_time_ms: number;
    result: unknown;
    confidence_score: number;
    next_agent?: string;
  }>;
  final_result: unknown;
  total_execution_time_ms: number;
  resource_usage: {
    cpu_usage: number;
    memory_usage_mb: number;
    network_calls: number;
  };
  success: boolean;
  error_details?: {
    error_type: string;
    error_message: string;
    recovery_suggestions: string[];
  };
  hrm_reasoning_trace: Array<{
    decision_point: string;
    reasoning: string;
    confidence: number;
    alternatives_considered: string[];
  }>;
}

/**
 * Unified Agent Decision Service
 * Central coordination point for all agent-related decisions and execution
 */
export class UnifiedAgentDecisionService {
  private baseUrl: string;
  private sessionId: string;

  constructor(baseUrl: string = 'http://localhost:9999') {
    this.baseUrl = baseUrl;
    this.sessionId = this.generateSessionId();

    if (process.env.NODE_ENV === 'development') {
      Logger.debug(`🔗 Unified Agent Decision Service initialized`);
    }
    Logger.debug(`   Backend: ${this.baseUrl}`);
    Logger.debug(`   Session: ${this.sessionId}`);
  }

  /**
   * Make an intelligent decision using HRM Universal Decision Engine
   * Enhanced with proper error handling and HRM reasoning trace integration
   */
  async makeDecision(context: DecisionContext): Promise<DecisionResult> {
    const startTime = Date.now();

    try {
      Logger.debug(`🧠 HRM Decision Request:`, {
        type: context.decision_type,
        session: this.sessionId,
        hasOptions: !!context.available_options?.length,
      });

      const response = await fetch(`${this.baseUrl}/api/hrm/decision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-ID': this.sessionId,
          'X-Decision-Type': context.decision_type,
        },
        body: JSON.stringify({
          ...context,
          session_id: this.sessionId,
          timestamp: new Date().toISOString(),
        }),
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });

      const responseTime = Date.now() - startTime;

      if (!response.ok) {
        Logger.error(`HRM Decision failed: ${response.status} ${response.statusText}`);
        throw new Error(`HRM Decision failed: ${response.statusText}`);
      }

      const result: DecisionResult = await response.json();

      Logger.debug(`✅ HRM Decision completed in ${responseTime}ms:`, {
        decision_id: result.decision_id,
        confidence: result.confidence,
        reasoning_steps: result.reasoning_steps.length,
        selected_action: result.selected_option?.action || 'unknown',
      });

      return {
        ...result,
        execution_parameters: {
          ...result.execution_parameters,
          hrm_response_time_ms: responseTime,
          hrm_session_id: this.sessionId,
        },
      };
    } catch (_error) {
      const errorTime = Date.now() - startTime;

      Logger.error('HRM Decision Engine error:', {
        error: _error instanceof Error ? _error.message : String(_error),
        decision_type: context.decision_type,
        response_time_ms: errorTime,
      });

      // Fallback to rule-based decision with reasoning trace
      return this.fallbackDecision(
        context,
        _error instanceof Error ? _error.message : String(_error)
      );
    }
  }

  /**
   * Execute a task using the intelligent agent orchestration system
   */
  async executeTask(request: TaskExecutionRequest): Promise<TaskExecutionResult> {
    try {
      // First, use HRM to determine optimal execution strategy
      const decisionContext: DecisionContext = {
        decision_type: DecisionType.AGENT_ROUTING,
        session_id: this.sessionId,
        request_data: {
          task_type: request.task_type,
          complexity: request.complexity,
          description: request.task_description,
        },
        system_state: await this.getSystemState(),
        constraints: request.execution_constraints,
        available_options: await this.getAvailableAgents(),
      };

      const decision = await this.makeDecision(decisionContext);

      // Execute the task based on HRM recommendation
      const response = await fetch(`${this.baseUrl}/api/agents/execute-task`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...request,
          hrm_recommendation: decision,
          session_id: this.sessionId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Task execution failed: ${response.statusText}`);
      }

      const result: TaskExecutionResult = await response.json();
      return result;
    } catch (_error) {
      Logger.error('Task execution error:', _error);
      throw _error;
    }
  }

  /**
   * Get real-time health status of all agent systems
   */
  async getAgentSystemHealth(): Promise<AgentSystemHealth> {
    try {
      const response = await fetch(`${this.baseUrl}/api/agents/system-health`);

      if (!response.ok) {
        throw new Error(`System health check failed: ${response.statusText}`);
      }

      const health: AgentSystemHealth = await response.json();
      return health;
    } catch (_error) {
      Logger.error('Agent system health check error:', _error);
      // Return default health status
      return this.getDefaultHealthStatus();
    }
  }

  /**
   * Get available specialized agents from Go Orchestrator
   */
  async getAvailableAgents(): Promise<Array<Record<string, any>>> {
    try {
      const response = await fetch(`${this.baseUrl}/api/agents/available`);

      if (!response.ok) {
        return this.getDefaultAgents();
      }

      const agents = await response.json();
      return agents;
    } catch (_error) {
      Logger.error('Failed to get available agents:', _error);
      return this.getDefaultAgents();
    }
  }

  /**
   * Execute a chained agent workflow (e.g., react-expert → code-reviewer → test-runner)
   */
  async executeAgentChain(
    agentTypes: string[],
    initialRequest: TaskExecutionRequest
  ): Promise<TaskExecutionResult> {
    try {
      const response = await fetch(`${this.baseUrl}/api/agents/execute-chain`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agent_chain: agentTypes,
          initial_request: initialRequest,
          session_id: this.sessionId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Agent chain execution failed: ${response.statusText}`);
      }

      const result: TaskExecutionResult = await response.json();
      return result;
    } catch (_error) {
      Logger.error('Agent chain execution error:', _error);
      throw _error;
    }
  }

  /**
   * Connect to DSPy cognitive pipeline for complex reasoning tasks
   */
  async executeComplexReasoning(problem: string, context: Record<string, any>): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/dspy/cognitive-reasoning`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          problem,
          context,
          session_id: this.sessionId,
        }),
      });

      if (!response.ok) {
        throw new Error(`DSPy reasoning failed: ${response.statusText}`);
      }

      const result = await response.json();
      return result;
    } catch (_error) {
      Logger.error('DSPy cognitive reasoning error:', _error);
      throw _error;
    }
  }

  // Private helper methods
  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private async getSystemState(): Promise<Record<string, any>> {
    try {
      const health = await this.getAgentSystemHealth();
      return {
        timestamp: new Date().toISOString(),
        system_health: health,
        session_id: this.sessionId,
      };
    } catch (_error) {
      return {
        timestamp: new Date().toISOString(),
        error: 'Failed to get system state',
        session_id: this.sessionId,
      };
    }
  }

  private fallbackDecision(context: DecisionContext, errorMessage?: string): DecisionResult {
    const decisionId = `fallback-${Date.now()}`;

    // Intelligent fallback based on decision type
    const fallbackStrategy = this.getFallbackStrategy(context.decision_type);

    Logger.warn(`🔄 Using fallback decision strategy:`, {
      decision_id: decisionId,
      type: context.decision_type,
      strategy: fallbackStrategy.action,
      reason: errorMessage || 'HRM engine unavailable',
    });

    return {
      decision_id: decisionId,
      selected_option: fallbackStrategy,
      confidence: 0.3, // Lower confidence for fallback
      reasoning_steps: [
        `HRM Universal Decision Engine unavailable: ${errorMessage || 'Connection failed'}`,
        `Fallback to rule-based ${context.decision_type} logic`,
        `Using ${fallbackStrategy.action} strategy with reduced confidence`,
      ],
      alternative_options: [],
      estimated_impact: { reliability: -0.2, performance: -0.1 },
      monitoring_metrics: ['fallback_usage_rate', 'hrm_availability'],
      fallback_strategy: {
        reason: 'hrm_unavailable',
        original_context: context.decision_type,
        retry_after_ms: 30000,
      },
      execution_parameters: {
        ...context.request_data,
        fallback_mode: true,
        hrm_retry_count: 0,
      },
      estimated_resources: {
        cpu_usage: 30, // Lower resource usage for fallback
        memory_mb: 128,
        estimated_time_ms: 2000,
      },
      risk_assessment: {
        risk_level: 'MEDIUM',
        potential_issues: [
          'HRM engine offline - reduced decision quality',
          'Fallback logic may not consider all context',
          'Lower confidence in routing decisions',
        ],
        mitigation_strategies: [
          'Monitor HRM engine health and retry',
          'Use conservative routing until HRM restored',
          'Log fallback decisions for later analysis',
        ],
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get intelligent fallback strategy based on decision type
   */
  private getFallbackStrategy(decisionType: DecisionType): Record<string, any> {
    switch (decisionType) {
      case DecisionType.AGENT_ROUTING:
        return {
          action: 'route_to_general_purpose',
          agent_sequence: ['frontend-developer'],
          reasoning: 'Default to most versatile agent when HRM unavailable',
        };
      case DecisionType.LLM_SELECTION:
        return {
          action: 'select_balanced_model',
          model_id: 'claude-3.5',
          reasoning: 'Use balanced model for reliability',
        };
      case DecisionType.MEMORY_MANAGEMENT:
        return {
          action: 'conservative_retention',
          strategy: 'keep_recent',
          reasoning: 'Conservative memory management in fallback mode',
        };
      default:
        return {
          action: 'default_conservative',
          strategy: 'safe_mode',
          reasoning: 'Conservative approach for unknown decision type',
        };
    }
  }

  private getDefaultHealthStatus(): AgentSystemHealth {
    return {
      rust_registry: {
        status: 'offline',
        response_time_ms: 0,
        active_agents: 0,
        total_executions: 0,
      },
      go_orchestrator: {
        status: 'offline',
        specialized_agents: [],
      },
      dspy_pipeline: {
        status: 'offline',
        cognitive_agents: [],
      },
      hrm_engine: {
        status: 'offline',
        model_loaded: false,
        inference_time_ms: 0,
        decision_accuracy: 0,
      },
    };
  }

  private getDefaultAgents(): Array<Record<string, any>> {
    return [
      {
        name: 'frontend-developer',
        type: 'React/Frontend Development',
        status: 'offline',
        specializations: ['react', 'typescript', 'tailwind'],
      },
      {
        name: 'react-expert',
        type: 'React Component Development',
        status: 'offline',
        specializations: ['components', 'hooks', 'state-management'],
      },
      {
        name: 'typescript-pro',
        type: 'TypeScript Development',
        status: 'offline',
        specializations: ['types', 'generics', 'advanced-patterns'],
      },
      {
        name: 'ui-ux-designer',
        type: 'UI/UX Design',
        status: 'offline',
        specializations: ['design-systems', 'accessibility', 'animations'],
      },
      {
        name: 'code-reviewer',
        type: 'Code Review',
        status: 'offline',
        specializations: ['best-practices', 'security', 'performance'],
      },
      {
        name: 'test-runner',
        type: 'Test Execution',
        status: 'offline',
        specializations: ['jest', 'playwright', 'e2e-testing'],
      },
      {
        name: 'api-debugger',
        type: 'API Debugging',
        status: 'offline',
        specializations: ['rest-apis', 'graphql', 'websockets'],
      },
      {
        name: 'performance-optimizer',
        type: 'Performance Optimization',
        status: 'offline',
        specializations: ['bundling', 'lazy-loading', 'caching'],
      },
    ];
  }
}

// Export singleton instance
export const unifiedAgentDecisionService = new UnifiedAgentDecisionService();
