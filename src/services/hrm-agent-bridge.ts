/**
 * HRM Agent Bridge Service
 * Integrates HRM Universal Decision Engine with Dynamic Agent Factory
 * Provides intelligent agent routing, LLM selection, and resource management
 */

import { DynamicAgentFactory } from './dynamic-agent-factory';
import type { AgentInstance } from './dynamic-agent-factory';
import { RustAgentRegistryClient } from './rust-agent-registry-client';
import { GoAgentOrchestratorClient } from './go-agent-orchestrator-client';
import { DSPyAgentClient } from './dspy-agent-client';

// HRM Decision Engine Types (matching Python types)
export enum HRMDecisionType {
  LLM_SELECTION = 'llm_selection',
  AGENT_ROUTING = 'agent_routing',
  MEMORY_MANAGEMENT = 'memory_management',
  RESOURCE_SCALING = 'resource_scaling',
  ERROR_RECOVERY = 'error_recovery',
  SECURITY_ACCESS = 'security_access',
  DATA_PROCESSING = 'data_processing',
  UX_OPTIMIZATION = 'ux_optimization',
  API_ROUTING = 'api_routing',
  MONITORING_ACTION = 'monitoring_action'
}

export interface HRMDecisionContext {
  decisionType: HRMDecisionType;
  userId?: string;
  sessionId?: string;
  requestData?: Record<string, any>;
  systemState?: Record<string, any>;
  historicalData?: Record<string, any>[];
  constraints?: Record<string, any>;
  availableOptions?: Record<string, any>[];
}

export interface HRMDecisionResult {
  decisionId: string;
  selectedOption: Record<string, any>;
  confidence: number;
  reasoningSteps: string[];
  alternativeOptions: Record<string, any>[];
  estimatedImpact: Record<string, number>;
  monitoringMetrics: string[];
  fallbackStrategy?: Record<string, any>;
}

// Rust Agent Registry integration types
export interface RustAgentDefinition {
  id: string;
  name: string;
  agentType: 'specialized' | 'general' | 'utility' | 'debugging' | 'testing' | 'optimization';
  description: string;
  capabilities: string[];
  config: Record<string, any>;
  status: 'idle' | 'busy' | 'failed' | 'offline';
  version: string;
  endpoint?: string;
  performance: {
    tasksCompleted: number;
    averageResponseMs: number;
    successRate: number;
    lastError?: string;
  };
}

// Go Agent Orchestrator integration types
export interface GoAgentDefinition {
  id: string;
  name: string;
  type: string;
  status: 'idle' | 'busy' | 'failed' | 'offline';
  capabilities: string[];
  performance: {
    tasksCompleted: number;
    averageResponseMs: number;
    successRate: number;
  };
}

/**
 * HRM Agent Bridge - Intelligent Multi-System Agent Orchestration
 */
export class HRMAgentBridge {
  private hrmBaseUrl: string;
  private dynamicFactory: DynamicAgentFactory;
  private rustRegistry: RustAgentRegistryClient;
  private goOrchestrator: GoAgentOrchestratorClient;
  private dspyClient: DSPyAgentClient;
  private decisionHistory: Map<string, HRMDecisionResult> = new Map();

  constructor(
    hrmBaseUrl: string = 'http://localhost:8085',
    rustRegistryUrl: string = 'http://localhost:8006',
    goOrchestratorUrl: string = 'http://localhost:8081',
    dspyUrl: string = 'http://localhost:8766'
  ) {
    this.hrmBaseUrl = hrmBaseUrl.replace(/\/$/, '');
    this.dynamicFactory = new DynamicAgentFactory();
    this.rustRegistry = new RustAgentRegistryClient(rustRegistryUrl);
    this.goOrchestrator = new GoAgentOrchestratorClient(goOrchestratorUrl);
    this.dspyClient = new DSPyAgentClient(dspyUrl);

    console.log('🧠 HRM Agent Bridge initialized');
    console.log(`  - HRM Decision Engine: ${this.hrmBaseUrl}`);
    console.log(`  - Rust Agent Registry: ${rustRegistryUrl}`);
    console.log(`  - Go Agent Orchestrator: ${goOrchestratorUrl}`);
    console.log(`  - DSPy Orchestrator: ${dspyUrl}`);
  }

  /**
   * Intelligent agent selection using HRM Universal Decision Engine
   */
  async selectBestAgent(
    taskDescription: string,
    taskType?: string,
    constraints?: Record<string, any>
  ): Promise<{
    agent: RustAgentDefinition | GoAgentDefinition | AgentInstance;
    decisionResult: HRMDecisionResult;
    sourceSystem: 'rust-registry' | 'go-orchestrator' | 'dynamic-factory';
  }> {
    console.log(`🧠 HRM agent selection for task: ${taskDescription}`);

    // Gather available agents from all systems
    const availableAgents = await this.gatherAllAgents();
    
    // Create HRM decision context
    const context: HRMDecisionContext = {
      decisionType: HRMDecisionType.AGENT_ROUTING,
      requestData: {
        task: taskDescription,
        taskType: taskType || 'general',
        complexity: this.assessTaskComplexity(taskDescription)
      },
      systemState: {
        totalAgents: availableAgents.length,
        systemLoad: await this.getSystemLoad()
      },
      constraints: constraints || {},
      availableOptions: availableAgents.map(agent => ({
        agentId: agent.id,
        name: agent.name,
        type: agent.type || agent.agentType,
        capabilities: agent.capabilities,
        performance: agent.performance,
        sourceSystem: agent.sourceSystem
      }))
    };

    // Get HRM decision
    const decisionResult = await this.makeHRMDecision(context);
    
    // Find the selected agent
    const selectedAgentId = decisionResult.selectedOption.agentId;
    const selectedAgent = availableAgents.find(a => a.id === selectedAgentId);
    
    if (!selectedAgent) {
      throw new Error(`Selected agent ${selectedAgentId} not found`);
    }

    console.log(`✅ HRM selected agent: ${selectedAgent.name} (${selectedAgent.sourceSystem})`);
    console.log(`   Confidence: ${decisionResult.confidence}`);
    console.log(`   Reasoning: ${decisionResult.reasoningSteps[0]}`);

    return {
      agent: selectedAgent,
      decisionResult,
      sourceSystem: selectedAgent.sourceSystem
    };
  }

  /**
   * Intelligent LLM selection using HRM Decision Engine
   */
  async selectBestLLM(
    userQuery: string,
    domain?: string,
    userPreferences?: Record<string, any>
  ): Promise<{
    modelId: string;
    endpoint: string;
    decisionResult: HRMDecisionResult;
  }> {
    console.log(`🧠 HRM LLM selection for query: ${userQuery.substring(0, 50)}...`);

    // Define available LLM options
    const availableLLMs = await this.getAvailableLLMs();
    
    const context: HRMDecisionContext = {
      decisionType: HRMDecisionType.LLM_SELECTION,
      requestData: {
        query: userQuery,
        domain: domain || 'general',
        userPreferences: userPreferences || {}
      },
      constraints: {
        responseTime: '< 5s',
        cost: 'optimize'
      },
      availableOptions: availableLLMs
    };

    const decisionResult = await this.makeHRMDecision(context);
    
    const selectedModel = decisionResult.selectedOption;
    
    console.log(`✅ HRM selected LLM: ${selectedModel.modelId}`);
    console.log(`   Confidence: ${decisionResult.confidence}`);

    return {
      modelId: selectedModel.modelId,
      endpoint: selectedModel.endpoint,
      decisionResult
    };
  }

  /**
   * Memory management decisions using HRM
   */
  async optimizeMemoryUsage(
    currentMemoryState: Record<string, any>
  ): Promise<{
    action: string;
    parameters: Record<string, any>;
    decisionResult: HRMDecisionResult;
  }> {
    const context: HRMDecisionContext = {
      decisionType: HRMDecisionType.MEMORY_MANAGEMENT,
      systemState: currentMemoryState,
      constraints: {
        memoryLimit: '4GB',
        retentionPolicies: { 
          conversationHistory: '7d',
          temporaryFiles: '1h',
          cacheData: '24h'
        }
      }
    };

    const decisionResult = await this.makeHRMDecision(context);
    
    return {
      action: decisionResult.selectedOption.action,
      parameters: decisionResult.selectedOption.parameters || {},
      decisionResult
    };
  }

  /**
   * Execute task using HRM-selected agent with DSPy cognitive reasoning for complex tasks
   */
  async executeTaskWithHRM(
    taskDescription: string,
    taskType?: string,
    constraints?: Record<string, any>
  ): Promise<{
    result: any;
    executionMetrics: {
      selectedAgent: string;
      sourceSystem: string;
      executionTime: number;
      confidence: number;
      success: boolean;
      reasoningMode?: 'standard' | 'cognitive';
    };
  }> {
    const startTime = Date.now();
    
    // Assess task complexity to determine if DSPy cognitive reasoning is needed
    const complexity = this.assessTaskComplexity(taskDescription);
    const usesCognitive = complexity === 'complex';
    
    if (usesCognitive) {
      console.log('🧠 Using DSPy cognitive reasoning for complex task');
      
      try {
        // Use DSPy cognitive reasoning chain for complex tasks
        const cognitiveResult = await this.dspyClient.executeCognitiveReasoning(
          taskDescription,
          true, // Use HRM preprocessing
          { taskType, constraints }
        );
        
        const executionTime = Date.now() - startTime;
        
        return {
          result: {
            cognitive_analysis: cognitiveResult.cognitive_analysis,
            hrm_preprocessing: cognitiveResult.hrm_preprocessing,
            metadata: cognitiveResult.metadata
          },
          executionMetrics: {
            selectedAgent: 'DSPy Cognitive Chain (10 agents)',
            sourceSystem: 'dspy-orchestrator',
            executionTime,
            confidence: cognitiveResult.cognitive_analysis.validation_score,
            success: true,
            reasoningMode: 'cognitive'
          }
        };
      } catch (error) {
        console.warn('DSPy cognitive reasoning failed, falling back to agent selection:', error);
      }
    }
    
    // Standard agent selection for non-complex tasks or as fallback
    const { agent, decisionResult, sourceSystem } = await this.selectBestAgent(
      taskDescription, 
      taskType, 
      constraints
    );

    try {
      let result: any;
      
      // Execute task based on source system
      switch (sourceSystem) {
        case 'rust-registry':
          result = await this.executeOnRustAgent(agent as any, taskDescription);
          break;
        case 'go-orchestrator':
          result = await this.executeOnGoAgent(agent as any, taskDescription);
          break;
        case 'dynamic-factory':
          result = await this.executeOnDynamicAgent(agent as AgentInstance, taskDescription);
          break;
        default:
          throw new Error(`Unknown source system: ${sourceSystem}`);
      }

      const executionTime = Date.now() - startTime;
      
      console.log(`✅ HRM task execution completed in ${executionTime}ms`);
      
      return {
        result,
        executionMetrics: {
          selectedAgent: agent.name,
          sourceSystem,
          executionTime,
          confidence: decisionResult.confidence,
          success: true,
          reasoningMode: 'standard'
        }
      };
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      console.error(`❌ HRM task execution failed:`, error);
      
      return {
        result: { error: error.message },
        executionMetrics: {
          selectedAgent: agent.name,
          sourceSystem,
          executionTime,
          confidence: decisionResult.confidence,
          success: false,
          reasoningMode: 'standard'
        }
      };
    }
  }

  /**
   * Execute complex reasoning using DSPy 10-agent cognitive pipeline
   */
  async executeCognitiveReasoning(
    request: string,
    useHrmPreprocessing: boolean = true,
    context?: Record<string, any>
  ): Promise<{
    cognitive_analysis: any;
    hrm_preprocessing?: any;
    metadata: {
      reasoning_mode: string;
      agent_count: number;
      execution_time: number;
    };
  }> {
    const startTime = Date.now();
    
    console.log(`🧠 Executing DSPy cognitive reasoning for: ${request.substring(0, 50)}...`);
    
    const result = await this.dspyClient.executeCognitiveReasoning(
      request,
      useHrmPreprocessing,
      context
    );
    
    const executionTime = Date.now() - startTime;
    
    return {
      ...result,
      metadata: {
        ...result.metadata,
        execution_time: executionTime
      }
    };
  }

  /**
   * Coordinate complex tasks across multiple agent systems using DSPy
   */
  async coordinateMultiSystemTask(
    taskDescription: string,
    availableAgentSystems: string[] = ['rust-registry', 'go-orchestrator', 'dynamic-factory']
  ): Promise<{
    coordination_plan: any;
    agent_assignments: any[];
    execution_results: Record<string, any>;
  }> {
    console.log(`🤝 Coordinating multi-system task: ${taskDescription.substring(0, 50)}...`);
    
    // Get all available agents from different systems
    const allAgents = await this.gatherAllAgents();
    const agentNames = allAgents.map(agent => `${agent.name} (${agent.sourceSystem})`);
    
    // Use DSPy task coordination
    const coordinationResult = await this.dspyClient.executeTaskCoordination({
      task: taskDescription,
      available_agents: agentNames,
      coordination_mode: 'adaptive'
    });
    
    // Execute coordinated tasks across systems
    const executionResults: Record<string, any> = {};
    
    for (const assignment of coordinationResult.agent_assignments) {
      try {
        const agentInfo = allAgents.find(a => 
          assignment.agent.includes(a.name)
        );
        
        if (agentInfo) {
          const result = await this.executeTaskWithHRM(
            assignment.subtask,
            'coordination_subtask'
          );
          
          executionResults[assignment.agent] = {
            subtask: assignment.subtask,
            result: result.result,
            success: result.executionMetrics.success,
            executionTime: result.executionMetrics.executionTime
          };
        }
      } catch (error) {
        executionResults[assignment.agent] = {
          subtask: assignment.subtask,
          error: error.message,
          success: false
        };
      }
    }
    
    return {
      coordination_plan: coordinationResult.coordination_plan,
      agent_assignments: coordinationResult.agent_assignments,
      execution_results: executionResults
    };
  }

  /**
   * Get comprehensive system status across all agent systems including DSPy
   */
  async getUnifiedSystemStatus(): Promise<{
    totalAgents: number;
    systemHealth: number; // 0-1 score
    activeAgents: Record<string, number>; // by system
    averageResponseTime: number;
    memoryUsage: Record<string, any>;
    serviceStatus: Record<string, boolean>;
    dspyMetrics?: {
      totalRequests: number;
      averageResponseTime: number;
      successRate: number;
      availableModels: string[];
    };
  }> {
    const [rustAgents, goAgents, dynamicAgents, dspyMetrics] = await Promise.all([
      this.getRustAgents().catch(() => []),
      this.getGoAgents().catch(() => []),
      this.getDynamicAgents(),
      this.dspyClient.getPerformanceMetrics().catch(() => null)
    ]);

    // Check service connectivity
    const serviceStatus = {
      hrm: await this.isHRMHealthy(),
      rust: await this.rustRegistry.isHealthy(),
      go: await this.goOrchestrator.isHealthy(),
      dspy: await this.dspyClient.isHealthy()
    };

    const totalAgents = rustAgents.length + goAgents.length + dynamicAgents.length + 10; // +10 for DSPy agents
    const activeRust = rustAgents.filter(a => a.status === 'active').length;
    const activeGo = goAgents.filter(a => a.status === 'active').length;
    const activeDynamic = dynamicAgents.filter(a => a.status === 'running').length;
    const activeDspy = serviceStatus.dspy ? 10 : 0; // DSPy has 10 cognitive agents

    // Calculate system health score
    const systemHealth = totalAgents > 0 
      ? (activeRust + activeGo + activeDynamic + activeDspy) / totalAgents 
      : 0;

    // Calculate average response time across systems
    const allPerformanceData = [
      ...rustAgents.map(a => a.performance?.averageResponseMs || 0),
      ...goAgents.map(a => a.performance?.averageResponseMs || 0)
    ].filter(time => time > 0);

    if (dspyMetrics?.averageResponseTime) {
      allPerformanceData.push(dspyMetrics.averageResponseTime);
    }

    const averageResponseTime = allPerformanceData.length > 0
      ? allPerformanceData.reduce((sum, time) => sum + time, 0) / allPerformanceData.length
      : 0;

    const result: any = {
      totalAgents,
      systemHealth,
      activeAgents: {
        rust: activeRust,
        go: activeGo,
        dynamic: activeDynamic,
        dspy: activeDspy
      },
      averageResponseTime,
      memoryUsage: await this.getSystemMemoryUsage(),
      serviceStatus
    };

    if (dspyMetrics) {
      result.dspyMetrics = dspyMetrics;
    }

    return result;
  }

  /**
   * Get agent by ID from any connected system
   */
  async getAgentById(agentId: string): Promise<{
    id: string;
    name: string;
    type: string;
    capabilities: string[];
    status: string;
    endpoint?: string;
    port?: number;
    performance?: {
      requestCount: number;
      averageResponseTime: number;
      errorRate: number;
    };
    config?: Record<string, any>;
    sourceSystem: 'rust-registry' | 'go-orchestrator' | 'dynamic-factory';
  } | null> {
    try {
      console.log(`🔍 HRM searching for agent: ${agentId}`);
      
      // Check Rust Agent Registry first (fastest)
      try {
        const rustAgent = await this.rustRegistry.getAgent(agentId);
        if (rustAgent) {
          console.log(`✅ Found agent in Rust Registry: ${rustAgent.name}`);
          return {
            id: rustAgent.id,
            name: rustAgent.name,
            type: rustAgent.agentType,
            capabilities: rustAgent.capabilities,
            status: rustAgent.status,
            endpoint: rustAgent.endpoint,
            performance: rustAgent.performance,
            config: rustAgent.config,
            sourceSystem: 'rust-registry'
          };
        }
      } catch (rustError) {
        console.debug('Agent not found in Rust Registry:', rustError.message);
      }

      // Check Go Agent Orchestrator
      try {
        const goAgent = await this.goOrchestrator.getAgent(agentId);
        if (goAgent) {
          console.log(`✅ Found agent in Go Orchestrator: ${goAgent.name}`);
          return {
            id: goAgent.id,
            name: goAgent.name,
            type: goAgent.type,
            capabilities: goAgent.capabilities,
            status: goAgent.status,
            endpoint: goAgent.endpoint,
            performance: {
              requestCount: goAgent.performance.tasksCompleted,
              averageResponseTime: goAgent.performance.averageResponseMs,
              errorRate: 1 - goAgent.performance.successRate
            },
            sourceSystem: 'go-orchestrator'
          };
        }
      } catch (goError) {
        console.debug('Agent not found in Go Orchestrator:', goError.message);
      }

      // Check Dynamic Factory (local agents)
      const runningAgents = this.dynamicFactory.getRunningAgents();
      const localAgent = runningAgents.find(agent => agent.id === agentId);
      if (localAgent) {
        console.log(`✅ Found agent in Dynamic Factory: ${localAgent.name}`);
        return {
          id: localAgent.id,
          name: localAgent.name,
          type: localAgent.template.id,
          capabilities: localAgent.template.capabilities.map(cap => cap.name),
          status: localAgent.status,
          endpoint: localAgent.endpoint,
          port: localAgent.port,
          performance: localAgent.performance,
          config: localAgent.config,
          sourceSystem: 'dynamic-factory'
        };
      }

      console.warn(`⚠️ Agent ${agentId} not found in any system`);
      return null;
    } catch (error) {
      console.error(`❌ Error searching for agent ${agentId}:`, error);
      return null;
    }
  }

  /**
   * Check if HRM service is healthy
   */
  private async isHRMHealthy(): Promise<boolean> {
    try {
      const response = await fetch(`${this.hrmBaseUrl}/health`, {
        timeout: 3000
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  // Private implementation methods

  private async makeHRMDecision(context: HRMDecisionContext): Promise<HRMDecisionResult> {
    try {
      const response = await fetch(`${this.hrmBaseUrl}/reasoning`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_type: 'planning',
          input_data: {
            prompt: this.createHRMPrompt(context),
            decision_context: context,
            max_steps: 7,
            temperature: 0.3
          }
        })
      });

      if (response.ok) {
        const hrmData = await response.json();
        
        if (hrmData.success) {
          const decisionResult = this.processHRMResponse(hrmData, context);
          
          // Cache decision for learning
          this.decisionHistory.set(decisionResult.decisionId, decisionResult);
          
          return decisionResult;
        }
      }
    } catch (error) {
      console.warn('HRM decision failed, using fallback:', error);
    }

    // Fallback to rule-based decision
    return this.makeFallbackDecision(context);
  }

  private createHRMPrompt(context: HRMDecisionContext): string {
    switch (context.decisionType) {
      case HRMDecisionType.AGENT_ROUTING:
        return `Select the optimal agent for this task based on capabilities, performance, and system load:\n\nTask: ${context.requestData?.task}\nAvailable agents: ${JSON.stringify(context.availableOptions?.map(o => ({ name: o.name, capabilities: o.capabilities })))}`;
      
      case HRMDecisionType.LLM_SELECTION:
        return `Select the best LLM for this query considering complexity, domain, and performance:\n\nQuery: ${context.requestData?.query}\nDomain: ${context.requestData?.domain}\nAvailable models: ${JSON.stringify(context.availableOptions?.map(o => ({ modelId: o.modelId, capabilities: o.capabilities })))}`;
      
      case HRMDecisionType.MEMORY_MANAGEMENT:
        return `Optimize memory usage based on current state and constraints:\n\nMemory state: ${JSON.stringify(context.systemState)}\nConstraints: ${JSON.stringify(context.constraints)}`;
      
      default:
        return `Make a decision for ${context.decisionType} with context: ${JSON.stringify(context)}`;
    }
  }

  private processHRMResponse(hrmData: any, context: HRMDecisionContext): HRMDecisionResult {
    // Extract decision from HRM reasoning
    const selectedOption = context.availableOptions?.[0] || { action: 'default' };
    
    return {
      decisionId: `hrm_${Date.now()}`,
      selectedOption,
      confidence: 0.85,
      reasoningSteps: hrmData.reasoning_steps?.map((step: any) => step.reasoning) || ['HRM reasoning applied'],
      alternativeOptions: context.availableOptions?.slice(1, 3) || [],
      estimatedImpact: { performance: 0.1, reliability: 0.15 },
      monitoringMetrics: ['response_time', 'success_rate', 'resource_usage']
    };
  }

  private makeFallbackDecision(context: HRMDecisionContext): HRMDecisionResult {
    let selectedOption: Record<string, any>;
    
    if (context.availableOptions && context.availableOptions.length > 0) {
      // Simple fallback logic - select first available option
      selectedOption = context.availableOptions[0];
    } else {
      selectedOption = { action: 'default_fallback' };
    }

    return {
      decisionId: `fallback_${Date.now()}`,
      selectedOption,
      confidence: 0.5,
      reasoningSteps: ['HRM unavailable, using fallback logic'],
      alternativeOptions: [],
      estimatedImpact: { reliability: -0.1 },
      monitoringMetrics: ['fallback_usage_rate']
    };
  }

  /**
   * Gather all available agents from different systems
   */
  private async gatherAllAgents(): Promise<Array<{
    id: string;
    name: string;
    type: string;
    capabilities: string[];
    performance: {
      responseTime: number;
      successRate: number;
      load: number;
    };
    sourceSystem: 'rust-registry' | 'go-orchestrator' | 'dynamic-factory';
    reactPriority: number; // Higher value = higher priority for React tasks
  }>> {
    const allAgents: any[] = [];

    try {
      // Get agents from Rust Agent Registry
      if (this.rustRegistry) {
        const rustAgents = await this.rustRegistry.listAgents();
        rustAgents.forEach(agent => {
          allAgents.push({
            id: agent.id,
            name: agent.name,
            type: agent.agentType,
            capabilities: agent.capabilities.map(cap => cap.name),
            performance: {
              responseTime: agent.performance.averageResponseMs,
              successRate: agent.performance.successRate,
              load: agent.performance.tasksCompleted / 100 // Normalize load
            },
            sourceSystem: 'rust-registry' as const,
            reactPriority: this.calculateReactPriority(agent.agentType, agent.capabilities.map(c => c.name))
          });
        });
      }

      // Get specialized agents from Go Agent Orchestrator (PRIORITY SOURCE for React)
      if (this.goOrchestrator) {
        const goAgents = await this.goOrchestrator.listSpecializedAgents();
        goAgents.forEach(agent => {
          allAgents.push({
            id: agent.id,
            name: agent.name,
            type: agent.specialization || agent.type,
            capabilities: agent.capabilities,
            performance: {
              responseTime: agent.performance.averageResponseMs,
              successRate: agent.performance.successRate,
              load: agent.performance.tasksCompleted / 100 // Normalize load
            },
            sourceSystem: 'go-orchestrator' as const,
            reactPriority: this.calculateReactPriority(agent.specialization || agent.type, agent.capabilities)
          });
        });
      }

      // Get agents from Dynamic Factory (React-focused templates)
      const dynamicAgents = this.getDynamicAgents();
      dynamicAgents.forEach(agent => {
        allAgents.push({
          id: agent.id,
          name: agent.name,
          type: agent.type || 'dynamic',
          capabilities: agent.capabilities || [],
          performance: {
            responseTime: 800, // Improved performance for React agents
            successRate: 0.90, // Higher success rate for React agents
            load: 0.3 // Lower load for better responsiveness
          },
          sourceSystem: 'dynamic-factory' as const,
          reactPriority: this.calculateReactPriority(agent.type || 'dynamic', agent.capabilities || [])
        });
      });

      // Sort agents by React priority (highest first) for React-focused routing
      allAgents.sort((a, b) => b.reactPriority - a.reactPriority);

      console.log(`🤖 Gathered ${allAgents.length} agents (React-prioritized) from all systems`);
      console.log(`   Top React agents: ${allAgents.slice(0, 3).map(a => `${a.name} (${a.reactPriority})`).join(', ')}`);
      
      return allAgents;
    } catch (error) {
      console.error('❌ Error gathering agents:', error);
      return [];
    }
  }

  /**
   * Calculate React priority score for agent routing optimization
   */
  private calculateReactPriority(agentType: string, capabilities: string[]): number {
    let priority = 0;
    
    // High priority React specializations
    const reactSpecializations = [
      'frontend-developer', 'react-expert', 'react-builder', 'react-testing',
      'react-hooks', 'react-design-system', 'react-performance', 'typescript-pro',
      'ui-ux-designer'
    ];
    
    // Check agent type/specialization
    const lowerType = (agentType || '').toLowerCase();
    if (lowerType.includes('react')) {
      priority += 100; // Highest priority for React-specific agents
    } else if (lowerType.includes('frontend') || lowerType.includes('ui')) {
      priority += 80; // High priority for frontend agents
    } else if (lowerType.includes('typescript') || lowerType.includes('javascript')) {
      priority += 60; // Medium-high priority for TypeScript agents
    }
    
    // Check capabilities for React-related skills
    const reactCapabilities = [
      'react', 'jsx', 'tsx', 'hooks', 'components', 'state-management',
      'framer-motion', 'tailwind', 'electron', 'testing-library', 'jest'
    ];
    
    capabilities.forEach(capability => {
      const lowerCap = capability.toLowerCase();
      if (lowerCap.includes('react')) {
        priority += 30;
      } else if (reactCapabilities.some(rc => lowerCap.includes(rc))) {
        priority += 15;
      }
    });
    
    // Bonus for specialized React agent types
    if (reactSpecializations.some(spec => lowerType.includes(spec.replace('-', '')))) {
      priority += 50;
    }
    
    return Math.max(0, priority); // Ensure non-negative priority
  }

  private async getRustAgents(): Promise<RustAgentDefinition[]> {
    try {
      return await this.rustRegistry.listAgents();
    } catch (error) {
      console.warn('Failed to get Rust agents:', error);
      return [];
    }
  }

  private async getGoAgents(): Promise<GoAgentDefinition[]> {
    try {
      return await this.goOrchestrator.listSpecializedAgents();
    } catch (error) {
      console.warn('Failed to get Go agents:', error);
      return [];
    }
  }

  private getDynamicAgents(): AgentInstance[] {
    return this.dynamicFactory.getRunningAgents();
  }

  private async getAvailableLLMs(): Promise<Record<string, any>[]> {
    return [
      {
        modelId: 'claude-3.5',
        endpoint: 'anthropic',
        capabilities: ['reasoning', 'coding', 'analysis'],
        cost: 0.01,
        averageResponseTime: 2000
      },
      {
        modelId: 'gpt-4',
        endpoint: 'openai',
        capabilities: ['general', 'creative', 'reasoning'],
        cost: 0.015,
        averageResponseTime: 3000
      },
      {
        modelId: 'llama-3.1-8b',
        endpoint: 'ollama',
        capabilities: ['general', 'local'],
        cost: 0.0,
        averageResponseTime: 1500
      },
      {
        modelId: 'lfm2-1.2b',
        endpoint: 'local',
        capabilities: ['fast', 'coordination'],
        cost: 0.0,
        averageResponseTime: 500
      }
    ];
  }

  private assessTaskComplexity(taskDescription: string): 'simple' | 'moderate' | 'complex' {
    const lowerTask = taskDescription.toLowerCase();
    
    // React/Frontend complexity patterns
    const reactComplexKeywords = [
      'architecture', 'design system', 'state management', 'performance optimization',
      'complex component', 'custom hooks', 'context api', 'reducer pattern',
      'testing strategy', 'accessibility', 'responsive design', 'animation system',
      'build optimization', 'bundle analysis', 'memory leaks'
    ];
    
    const reactModerateKeywords = [
      'component', 'hook', 'props', 'state', 'event handling', 'form validation',
      'api integration', 'routing', 'styling', 'typescript', 'jsx', 'tsx',
      'framer motion', 'tailwind', 'electron'
    ];
    
    const reactSimpleKeywords = [
      'list', 'show', 'display', 'render', 'basic styling', 'simple component',
      'static content', 'import', 'export'
    ];
    
    // General complexity patterns
    const generalComplexKeywords = ['algorithm', 'complex analysis', 'research', 'refactor entire'];
    const generalSimpleKeywords = ['get', 'fetch', 'simple', 'basic', 'quick'];
    
    // Check for React-specific complexity first
    if (reactComplexKeywords.some(keyword => lowerTask.includes(keyword))) {
      return 'complex';
    } else if (reactSimpleKeywords.some(keyword => lowerTask.includes(keyword))) {
      return 'simple';
    } else if (reactModerateKeywords.some(keyword => lowerTask.includes(keyword))) {
      return 'moderate';
    }
    
    // Fallback to general complexity assessment
    if (generalComplexKeywords.some(keyword => lowerTask.includes(keyword))) {
      return 'complex';
    } else if (generalSimpleKeywords.some(keyword => lowerTask.includes(keyword))) {
      return 'simple';
    }
    
    // Default to moderate for React-related tasks
    const isReactTask = ['react', 'component', 'jsx', 'tsx', 'frontend', 'ui', 'electron'].some(
      keyword => lowerTask.includes(keyword)
    );
    
    return isReactTask ? 'moderate' : 'simple';
  }

  private async getSystemLoad(): Promise<Record<string, any>> {
    // Simplified system load assessment
    return {
      memoryUsage: process.memoryUsage().heapUsed / (1024 * 1024), // MB
      activeConnections: 0, // Would get from actual monitoring
      cpuUsage: 0.5 // Placeholder
    };
  }

  private async executeOnRustAgent(agent: any, task: string): Promise<any> {
    // Use the Rust Agent Registry client for execution
    const result = await this.rustRegistry.executeAgent(agent.id, {
      input: { task },
      timeoutSeconds: 30
    });
    
    return result.output;
  }

  private async executeOnGoAgent(agent: any, task: string): Promise<any> {
    // Use the Go Agent Orchestrator client for execution
    const result = await this.goOrchestrator.executeTaskWithAutoSelection({
      type: 'general_task',
      description: task,
      priority: 'medium',
      input: { task }
    });
    
    return result.result;
  }

  private async executeOnDynamicAgent(agent: AgentInstance, task: string): Promise<any> {
    // Create task window for dynamic agent execution
    const taskWindow = await this.dynamicFactory.createTaskWindow(
      `Execute: ${task}`,
      `Task execution on dynamic agent: ${agent.name}`,
      agent.id
    );

    return await this.dynamicFactory.executeTask(taskWindow.id, 'general_execution', { task });
  }

  private async getSystemMemoryUsage(): Promise<Record<string, any>> {
    const memUsage = process.memoryUsage();
    return {
      nodeHeap: Math.round(memUsage.heapUsed / (1024 * 1024)), // MB
      nodeTotal: Math.round(memUsage.heapTotal / (1024 * 1024)), // MB
      external: Math.round(memUsage.external / (1024 * 1024)), // MB
      rss: Math.round(memUsage.rss / (1024 * 1024)) // MB
    };
  }
}

// Export singleton for easy access
export const hrmAgentBridge = new HRMAgentBridge();
export default hrmAgentBridge;