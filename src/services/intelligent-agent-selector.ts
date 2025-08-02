/**
 * Intelligent Agent Selector Service
 * Uses LFM2 for ultra-fast task classification and intelligent routing
 * Routes tasks between LFM2, Ollama, specialized agents, and external APIs
 */

import { AgentRegistry } from '../agents/agent-registry';
import { athenaAgent } from '../agents/athena-agent';
import type { AgentContext, AgentResponse, ServiceRouteIntegrationData } from '../types';
import type { MobileDeviceContext } from './mobile-dspy-orchestrator';
import { TaskType, intelligentParameterService } from './intelligent-parameter-service';
import { lfm2Bridge } from './lfm2-bridge';
import { ollamaService } from './ollama-service';
import { llmRouter } from './llm-router-service';
import { LogContext, log } from '../utils/logger';
import { EventEmitter } from 'events';

export interface AgentSelectionRequest {
  userInput: string;
  conversationHistory?: ChatMessage[];
  deviceContext?: MobileDeviceContext;
  userPreferences?: UserPreferences;
  urgency?: 'low' | 'medium' | 'high';
  expectedResponseType?: 'quick' | 'detailed' | 'creative';
}

export interface ChatMessage {
  text: string;
  isFromUser: boolean;
  agentName?: string;
  timestamp: Date;
  confidence?: number;
  metadata?: any;
}

export interface UserPreferences {
  preferredResponseLength: 'short' | 'medium' | 'long';
  expertiseLevel: 'beginner' | 'intermediate' | 'expert';
  processingSpeed: 'fast' | 'balanced' | 'thorough';
  domains: string[];
}

export interface AgentRecommendation {
  primaryAgent: string;
  confidence: number;
  reasoning: string;
  fallbackAgents: string[];
  estimatedResponseTime: number;
  batteryImpact: 'low' | 'medium' | 'high';
  networkImpact: 'low' | 'medium' | 'high';
  processingComplexity: 'simple' | 'moderate' | 'complex';
  optimizedForDevice: boolean;
}

export interface TaskClassification {
  domain: string[];
  complexity: 'simple' | 'moderate' | 'complex';
  taskType: 'question' | 'request' | 'creative' | 'analysis' | 'coding' | 'planning';
  expertise_required: string[];
  estimated_tokens: number;
  requires_memory: boolean;
  requires_tools: boolean;
}

export class IntelligentAgentSelector extends EventEmitter {
  private agentRegistry: AgentRegistry;
  private selectionHistory: Map<string, AgentRecommendation[]> = new Map();
  private performanceMetrics: Map<string, {
    successRate: number;
    avgResponseTime: number;
    userSatisfaction: number;
    batteryEfficiency: number;
  }> = new Map();
  
  private taskPatterns = {
    coding: [
      /\b(code|program|function|class|method|debug|fix|implement|script)\b/i,
      /\b(javascript|typescript|python|swift|ios|android|react|node)\b/i,
      /\b(error|bug|syntax|compile|runtime|exception)\b/i
    ],
    analysis: [
      /\b(analyze|analysis|examine|investigate|research|study|evaluate)\b/i,
      /\b(data|statistics|trends|patterns|insights|metrics)\b/i,
      /\b(compare|contrast|pros|cons|advantages|disadvantages)\b/i
    ],
    planning: [
      /\b(plan|planning|schedule|organize|strategy|roadmap|timeline)\b/i,
      /\b(project|task|goal|objective|milestone|deadline)\b/i,
      /\b(prioritize|sequence|steps|phases|approach)\b/i
    ],
    creative: [
      /\b(create|generate|design|write|compose|build|make)\b/i,
      /\b(story|content|article|blog|marketing|creative)\b/i,
      /\b(brainstorm|ideas|innovative|original|unique)\b/i
    ],
    information: [
      /\b(what|who|when|where|why|how|explain|tell|describe)\b/i,
      /\b(definition|meaning|details|information|facts)\b/i,
      /\b(search|find|lookup|retrieve|get)\b/i
    ],
    personal: [
      /\b(help|assist|support|guide|recommend|suggest)\b/i,
      /\b(personal|my|I|me|myself|advice|opinion)\b/i,
      /\b(daily|routine|habit|lifestyle|productivity)\b/i
    ]
  };

  constructor(agentRegistry?: AgentRegistry) {
    super();
    this.agentRegistry = agentRegistry || new AgentRegistry();
    this.initializePerformanceMetrics();
  }

  /**
   * Intelligent agent selection using LFM2 as primary router
   */
  public async selectAgent(request: AgentSelectionRequest): Promise<AgentRecommendation> {
    const startTime = Date.now();
    
    try {
      log.info('🎯 Starting LFM2-based intelligent routing', LogContext.AI, {
        userInput: request.userInput.substring(0, 100),
        hasDeviceContext: !!request.deviceContext,
        hasHistory: !!(request.conversationHistory?.length),
      });

      // Step 1: Use LFM2 for ultra-fast task classification (100-500ms) with timeout
      const routingDecisionPromise = lfm2Bridge.routingDecision(request.userInput, {
        conversationHistory: request.conversationHistory,
        deviceContext: request.deviceContext,
        userPreferences: request.userPreferences
      });
      
      // Add 2-second timeout for LFM2 routing (should be much faster)
      const routingDecision = await Promise.race([
        routingDecisionPromise,
        new Promise<any>((_, reject) => {
          setTimeout(() => reject(new Error('LFM2 routing timeout after 2s')), 2000);
        })
      ]).catch(error => {
        log.warn('⚠️ LFM2 routing failed, using fallback logic', LogContext.AI, {
          error: error.message
        });
        // Fast fallback routing decision - test LM Studio speed
        return {
          targetService: 'lm-studio',
          confidence: 0.3,
          reasoning: 'Fallback to LM Studio (testing speed)',
          estimatedTokens: 100
        };
      });
      
      log.info('🚀 LFM2 routing decision', LogContext.AI, {
        targetService: routingDecision.targetService,
        confidence: routingDecision.confidence,
        estimatedTokens: routingDecision.estimatedTokens,
        reasoning: routingDecision.reasoning
      });

      // Step 2: Analyze device constraints for optimization
      const deviceConstraints = this.analyzeDeviceConstraints(request.deviceContext);
      
      // Step 3: Apply device-specific optimizations
      const optimizedService = this.optimizeForDevice(routingDecision.targetService, deviceConstraints);
      
      // Step 4: Generate fallback options based on LFM2 decision
      const fallbackServices = this.generateServiceFallbacks(optimizedService, routingDecision);
      
      const finalRecommendation: AgentRecommendation = {
        primaryAgent: this.mapServiceToAgent(optimizedService),
        confidence: routingDecision.confidence,
        reasoning: routingDecision.reasoning,
        fallbackAgents: fallbackServices.map(service => this.mapServiceToAgent(service)),
        estimatedResponseTime: this.estimateServiceResponseTime(optimizedService, routingDecision.estimatedTokens),
        batteryImpact: this.assessServiceBatteryImpact(optimizedService, deviceConstraints),
        networkImpact: this.assessServiceNetworkImpact(optimizedService),
        processingComplexity: this.determineServiceComplexity(optimizedService, routingDecision.estimatedTokens),
        optimizedForDevice: true
      };

      // Store for learning
      this.storeSelectionHistory(request.userInput, finalRecommendation);
      
      const selectionTime = Date.now() - startTime;
      log.info('✅ LFM2-based routing completed', LogContext.AI, {
        selectedService: optimizedService,
        selectedAgent: finalRecommendation.primaryAgent,
        confidence: finalRecommendation.confidence,
        selectionTime: `${selectionTime}ms`,
        batteryImpact: finalRecommendation.batteryImpact,
      });

      return finalRecommendation;
      
    } catch (error) {
      log.error('❌ LFM2 routing failed', LogContext.AI, {
        error: error instanceof Error ? error.message : String(error),
      });
      
      // Fallback to Ollama with personal assistant
      return this.createFallbackRecommendation(request);
    }
  }

  /**
   * Main execution method using LFM2 routing
   */
  public async executeWithOptimalAgent(
    userRequest: string,
    context: AgentContext,
    deviceContext?: MobileDeviceContext
  ): Promise<AgentResponse & { serviceUsed: string; routingDecision: any }> {
    const startTime = Date.now();

    try {
      // Step 1: Use LFM2 for routing decision with timeout
      const routingDecisionPromise = lfm2Bridge.routingDecision(userRequest, {
        conversationHistory: context.conversationHistory,
        deviceContext,
        userId: context.userId
      });
      
      // Add 2-second timeout for LFM2 routing with LM Studio fallback
      const routingDecision = await Promise.race([
        routingDecisionPromise,
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('LFM2 routing timeout')), 2000);
        })
      ]).catch(error => {
        log.warn('⚠️ LFM2 routing failed in executeWithOptimalAgent', LogContext.AI, {
          error: error.message
        });
        // Test LM Studio as fallback
        return {
          targetService: 'lm-studio',
          confidence: 0.3,
          reasoning: 'Fallback to LM Studio (testing speed)',
          estimatedTokens: 100
        };
      });

      const decision = routingDecision as ServiceRouteIntegrationData;
      log.info('🎯 LFM2 routing decision made', LogContext.AI, {
        targetService: decision.targetService,
        confidence: decision.confidence,
        estimatedTokens: decision.estimatedTokens
      });

      // Step 2: Execute with selected service
      const result = await this.executeWithService(
        decision.targetService,
        userRequest,
        context
      );

      // Step 3: Update performance metrics
      this.updateServiceMetrics(decision.targetService, Date.now() - startTime, result.success);

      return {
        ...result,
        serviceUsed: decision.targetService,
        routingDecision: decision
      };

    } catch (error) {
      log.error('❌ LFM2 execution failed', LogContext.AI, {
        error: error instanceof Error ? error.message : String(error)
      });

      // Fallback to Ollama
      const fallbackResult = await this.executeWithService('ollama', userRequest, context);
      return {
        ...fallbackResult,
        serviceUsed: 'ollama (fallback)',
        routingDecision: {
          targetService: 'ollama',
          confidence: 0.3,
          reasoning: 'Fallback due to routing error',
          estimatedTokens: 100
        }
      };
    }
  }

  /**
   * Execute with selected service
   */
  private async executeWithService(
    targetService: string,
    userRequest: string,
    context: AgentContext
  ): Promise<AgentResponse> {
    const startTime = Date.now();

    try {
      switch (targetService) {
        case 'lfm2':
          return await this.executeWithLFM2(userRequest, context);
        
        case 'ollama':
          return await this.executeWithOllama(userRequest, context);
        
        case 'lm-studio':
          return await this.executeWithLMStudio(userRequest, context);
        
        case 'openai':
        case 'anthropic':
          return await this.executeWithExternalAPI(targetService, userRequest, context);
        
        default:
          // Try to find matching agent
          if (this.agentRegistry) {
            const availableAgents = this.agentRegistry.getAvailableAgents();
            const matchingAgent = availableAgents.find(agent => agent.name === targetService);
            
            if (matchingAgent) {
              const result = await this.agentRegistry.processRequest(targetService, context);
              return result as AgentResponse;
            }
          }
          
          // Fallback to Ollama
          return await this.executeWithOllama(userRequest, context);
      }
    } catch (error) {
      log.error(`❌ Service ${targetService} execution failed`, LogContext.AI, {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Execute with LFM2 (ultra-fast responses)
   */
  private async executeWithLFM2(userRequest: string, context: AgentContext): Promise<AgentResponse> {
    // Determine task type based on the request
    const taskType = this.classifyTaskType(userRequest);
    
    // Get optimized parameters for the task
    const taskContext = intelligentParameterService.createTaskContext(
      userRequest,
      taskType
    );
    const parameters = intelligentParameterService.getTaskParameters(taskContext);
    
    const response = await lfm2Bridge.quickResponse(userRequest, 
      taskType === TaskType.CLASSIFICATION ? 'classification' : 'simple_qa'
    );
    
    return {
      success: true,
      confidence: response.confidence || 0.8,
      message: response.content,
      reasoning: 'LFM2 fast response',
      data: { response: { message: response.content } },
      metadata: {
        agentName: 'LFM2-1.2B',
        duration_ms: response.executionTime,
        model: response.model,
        provider: 'local',
        parameters: {
          temperature: parameters.temperature,
          maxTokens: parameters.maxTokens,
          topP: parameters.topP
        },
        taskType: taskType.toString(),
        complexity: taskContext.complexity
      }
    };
  }

  /**
   * Execute with Ollama
   */
  private async executeWithOllama(userRequest: string, context: AgentContext): Promise<AgentResponse> {
    // Determine task type and get optimized parameters
    const taskType = this.classifyTaskType(userRequest);
    const taskContext = intelligentParameterService.createTaskContext(
      userRequest,
      taskType
    );
    const parameters = intelligentParameterService.getTaskParameters(taskContext);
    
    const messages = [
      ...(context.conversationHistory || []).slice(-5), // Last 5 messages for context
      { role: 'user' as const, content: userRequest }
    ];

    const response = await ollamaService.generateResponse(messages, 'llama3.2:3b', {
      temperature: parameters.temperature,
      max_tokens: parameters.maxTokens || 1000
    });

    return {
      success: true,
      confidence: 0.85,
      message: response.message.content,
      reasoning: 'Ollama Llama 3.2 response',
      data: { response: { message: response.message.content } },
      metadata: {
        agentName: 'Llama-3.2-3B',
        duration_ms: (response.total_duration || 1000000000) / 1000000,
        model: 'llama3.2:3b',
        provider: 'ollama',
        parameters: {
          temperature: parameters.temperature,
          maxTokens: parameters.maxTokens,
          topP: parameters.topP
        },
        taskType: taskType.toString(),
        complexity: taskContext.complexity
      }
    };
  }

  /**
   * Execute with LM Studio
   */
  private async executeWithLMStudio(userRequest: string, context: AgentContext): Promise<AgentResponse> {
    const response = await llmRouter.generateResponse('lm-studio', [
      { role: 'user', content: userRequest }
    ], {
      temperature: 0.7,
      maxTokens: 1500
    });

    return {
      success: true,
      confidence: 0.85,
      message: response.content,
      reasoning: 'LM Studio response',
      data: { response: { message: response.content } },
      metadata: {
        agentName: 'LM-Studio',
        duration_ms: 2000, // Estimate
        model: 'lm-studio',
        provider: 'lm-studio'
      }
    };
  }

  /**
   * Execute with external APIs (OpenAI, Anthropic)
   */
  private async executeWithExternalAPI(service: string, userRequest: string, context: AgentContext): Promise<AgentResponse> {
    const response = await llmRouter.generateResponse(service, [
      { role: 'user', content: userRequest }
    ], {
      temperature: 0.7,
      maxTokens: 1500
    });

    return {
      success: true,
      confidence: 0.9,
      message: response.content,
      reasoning: `${service} API response`,
      data: { response: { message: response.content } },
      metadata: {
        agentName: service,
        duration_ms: 3000, // Estimate
        model: service === 'openai' ? 'gpt-4' : 'claude-3.5-sonnet',
        provider: service
      }
    };
  }

  /**
   * Classify the user's task using NLP and pattern matching
   */
  private async classifyTask(
    userInput: string,
    history?: ChatMessage[]
  ): Promise<TaskClassification> {
    const input = userInput.toLowerCase();
    const domains: string[] = [];
    const expertise_required: string[] = [];
    
    // Pattern matching for task domains
    for (const [domain, patterns] of Object.entries(this.taskPatterns)) {
      if (patterns.some(pattern => pattern.test(input))) {
        domains.push(domain);
      }
    }
    
    // Context from conversation history
    if (history && history.length > 0) {
      const recentContext = history.slice(-3).map(msg => msg.text.toLowerCase()).join(' ');
      
      // Check for domain continuity
      for (const [domain, patterns] of Object.entries(this.taskPatterns)) {
        if (patterns.some(pattern => pattern.test(recentContext))) {
          if (!domains.includes(domain)) {
            domains.push(`contextual_${domain}`);
          }
        }
      }
    }
    
    // Determine complexity
    const complexity = this.assessComplexity(userInput, domains);
    
    // Determine task type
    const taskType = this.determineTaskType(domains, input) as 'question' | 'request' | 'creative' | 'analysis' | 'coding' | 'planning';
    
    // Estimate token requirements
    const estimated_tokens = this.estimateTokenRequirements(userInput, complexity);
    
    return {
      domain: domains.length > 0 ? domains : ['general'],
      complexity,
      taskType,
      expertise_required: this.mapDomainsToExpertise(domains),
      estimated_tokens,
      requires_memory: this.requiresMemory(userInput, history),
      requires_tools: this.requiresTools(userInput, domains),
    };
  }

  /**
   * Use Athena agent to make intelligent selection decisions
   */
  private async getAthenaRecommendation(
    request: AgentSelectionRequest,
    classification: TaskClassification,
    deviceConstraints: any
  ): Promise<{
    primaryAgent: string;
    confidence: number;
    reasoning: string;
    processingComplexity: 'simple' | 'moderate' | 'complex';
  }> {
    const athenaContext: AgentContext = {
      requestId: `selection_${Date.now()}`,
      userRequest: `Select the best agent for this task: "${request.userInput}"
      
      Task Classification:
      - Domain: ${classification.domain.join(', ')}
      - Complexity: ${classification.complexity}
      - Type: ${classification.taskType}
      - Expertise needed: ${classification.expertise_required.join(', ')}
      
      Device Context:
      - Battery Level: ${request.deviceContext?.batteryLevel || 'unknown'}%
      - Connection: ${request.deviceContext?.connectionType || 'unknown'}
      - Low Power Mode: ${request.deviceContext?.isLowPowerMode || false}
      
      Available Agents: ${this.agentRegistry.getAvailableAgents().map(a => `${a.name} (${a.description})`).join(', ')}
      
      Respond with JSON: {
        "agent": "agent_name",
        "confidence": 0.0-1.0,
        "reasoning": "why this agent is best",
        "processing_complexity": "simple|moderate|complex"
      }`,
      contextData: {
        classification,
        deviceConstraints,
        availableAgents: this.agentRegistry.getAvailableAgents(),
      },
      sessionId: request.deviceContext?.userId || 'anonymous',
      timestamp: new Date(),
      messageHistory: request.conversationHistory || [],
    };

    try {
      const athenaResponse = await athenaAgent.execute(athenaContext);
      
      if (athenaResponse.success && athenaResponse.message) {
        // Try to parse JSON response from Athena
        const jsonMatch = athenaResponse.message.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            return {
              primaryAgent: parsed.agent || 'personal_assistant',
              confidence: Math.min(1.0, Math.max(0.0, parsed.confidence || 0.8)),
              reasoning: parsed.reasoning || 'Athena recommendation',
              processingComplexity: parsed.processing_complexity || 'moderate',
            };
          } catch (parseError) {
            log.warn('Failed to parse Athena JSON response', LogContext.AI);
          }
        }
        
        // Fallback: extract agent name from text response
        const availableAgents = this.agentRegistry.getAvailableAgents();
        for (const agent of availableAgents) {
          if (athenaResponse.message.toLowerCase().includes(agent.name)) {
            return {
              primaryAgent: agent.name,
              confidence: athenaResponse.confidence,
              reasoning: `Athena selected based on: ${athenaResponse.reasoning || 'context analysis'}`,
              processingComplexity: classification.complexity,
            };
          }
        }
      }
    } catch (error) {
      log.warn('Athena selection failed, using fallback logic', LogContext.AI, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    
    // Fallback to rule-based selection
    return this.getRuleBasedRecommendation(classification, deviceConstraints);
  }

  /**
   * Rule-based fallback agent selection
   */
  private getRuleBasedRecommendation(
    classification: TaskClassification,
    deviceConstraints: any
  ): {
    primaryAgent: string;
    confidence: number;
    reasoning: string;
    processingComplexity: 'simple' | 'moderate' | 'complex';
  } {
    // Battery-constrained selection
    if (deviceConstraints.batteryLevel < 20 || deviceConstraints.isLowPowerMode) {
      return {
        primaryAgent: 'personal_assistant',
        confidence: 0.9,
        reasoning: 'Selected lightweight agent due to low battery',
        processingComplexity: 'simple',
      };
    }
    
    // Domain-based selection
    if (classification.domain.includes('coding')) {
      return {
        primaryAgent: 'code_assistant',
        confidence: 0.95,
        reasoning: 'Code-related task detected',
        processingComplexity: 'moderate',
      };
    }
    
    if (classification.domain.includes('planning')) {
      return {
        primaryAgent: 'planner',
        confidence: 0.9,
        reasoning: 'Planning task detected',
        processingComplexity: 'moderate',
      };
    }
    
    if (classification.domain.includes('analysis') || classification.complexity === 'complex') {
      return {
        primaryAgent: 'synthesizer',
        confidence: 0.85,
        reasoning: 'Complex analysis required',
        processingComplexity: 'complex',
      };
    }
    
    if (classification.domain.includes('information')) {
      return {
        primaryAgent: 'retriever',
        confidence: 0.9,
        reasoning: 'Information retrieval task',
        processingComplexity: 'simple',
      };
    }
    
    // Default to personal assistant
    return {
      primaryAgent: 'personal_assistant',
      confidence: 0.8,
      reasoning: 'General assistance task',
      processingComplexity: 'moderate',
    };
  }

  /**
   * Apply performance-based optimizations
   */
  private applyPerformanceOptimizations(
    recommendation: any,
    deviceConstraints: any,
    userPreferences?: UserPreferences
  ): any {
    const agentMetrics = this.performanceMetrics.get(recommendation.primaryAgent);
    
    // Adjust confidence based on historical performance
    if (agentMetrics) {
      recommendation.confidence *= agentMetrics.successRate;
    }
    
    // Battery impact assessment
    recommendation.batteryImpact = this.assessBatteryImpact(
      recommendation.primaryAgent,
      recommendation.processingComplexity,
      deviceConstraints
    );
    
    // Network impact assessment
    recommendation.networkImpact = this.assessNetworkImpact(
      recommendation.primaryAgent,
      deviceConstraints
    );
    
    // Override for extreme battery constraints
    if (deviceConstraints.batteryLevel < 10) {
      recommendation.primaryAgent = 'personal_assistant';
      recommendation.batteryImpact = 'low';
      recommendation.reasoning += ' (Overridden for critical battery level)';
    }
    
    return recommendation;
  }

  /**
   * Helper methods
   */
  private assessComplexity(input: string, domains: string[]): 'simple' | 'moderate' | 'complex' {
    const complexityIndicators = [
      'analyze', 'create', 'build', 'design', 'optimize', 'develop',
      'multiple', 'complex', 'advanced', 'sophisticated', 'comprehensive'
    ];
    
    const hasComplexityIndicator = complexityIndicators.some(indicator =>
      input.toLowerCase().includes(indicator)
    );
    
    if (input.length > 200 || domains.length > 2 || hasComplexityIndicator) {
      return 'complex';
    }
    
    if (input.length > 50 || domains.length > 1) {
      return 'moderate';
    }
    
    return 'simple';
  }

  private determineTaskType(domains: string[], input: string): string {
    if (domains.includes('coding')) return 'coding';
    if (domains.includes('analysis')) return 'analysis';
    if (domains.includes('planning')) return 'planning';
    if (domains.includes('creative')) return 'creative';
    
    if (input.includes('?')) return 'question';
    
    return 'request' as const;
  }

  private mapDomainsToExpertise(domains: string[]): string[] {
    const expertiseMap: Record<string, string[]> = {
      coding: ['programming', 'software_development', 'debugging'],
      analysis: ['data_analysis', 'research', 'insights'],
      planning: ['project_management', 'strategy', 'organization'],
      creative: ['content_creation', 'design', 'writing'],
      information: ['research', 'knowledge_retrieval'],
      personal: ['assistance', 'productivity', 'organization'],
    };
    
    const expertise: string[] = [];
    for (const domain of domains) {
      const domainExpertise = expertiseMap[domain] || ['general_assistance'];
      expertise.push(...domainExpertise);
    }
    
    return [...new Set(expertise)]; // Remove duplicates
  }

  private estimateTokenRequirements(input: string, complexity: string): number {
    const baseTokens = Math.ceil(input.length / 4); // Rough token estimation
    
    const multipliers = {
      simple: 2,
      moderate: 4,
      complex: 8,
    };
    
    return baseTokens * multipliers[complexity as keyof typeof multipliers];
  }

  private requiresMemory(input: string, history?: ChatMessage[]): boolean {
    const memoryIndicators = ['remember', 'earlier', 'before', 'previous', 'last time'];
    const hasMemoryIndicator = memoryIndicators.some(indicator =>
      input.toLowerCase().includes(indicator)
    );
    
    return hasMemoryIndicator || Boolean(history && history.length > 0);
  }

  private requiresTools(input: string, domains: string[]): boolean {
    const toolIndicators = ['search', 'lookup', 'find', 'calculate', 'execute', 'run'];
    const hasToolIndicator = toolIndicators.some(indicator =>
      input.toLowerCase().includes(indicator)
    );
    
    return hasToolIndicator || domains.includes('coding');
  }

  private analyzeDeviceConstraints(deviceContext?: MobileDeviceContext) {
    if (!deviceContext) {
      return {
        batteryLevel: 100,
        isLowPowerMode: false,
        connectionType: 'wifi',
        processingCapability: 'high',
      };
    }
    
    return {
      batteryLevel: deviceContext.batteryLevel || 100,
      isLowPowerMode: deviceContext.isLowPowerMode || false,
      connectionType: deviceContext.connectionType || 'wifi',
      processingCapability: this.assessProcessingCapability(deviceContext),
    };
  }

  private assessProcessingCapability(deviceContext: MobileDeviceContext): 'low' | 'medium' | 'high' {
    // This is about SERVER processing capability based on device constraints
    if (deviceContext.isLowPowerMode || (deviceContext.batteryLevel && deviceContext.batteryLevel < 20)) {
      return 'low'; // Server should use minimal processing
    }
    
    if (deviceContext.connectionType === 'cellular') {
      return 'medium'; // Server should optimize for network
    }
    
    return 'high'; // Server can use full processing power
  }

  private assessBatteryImpact(
    agentName: string,
    complexity: string,
    deviceConstraints: any
  ): 'low' | 'medium' | 'high' {
    // Battery impact is about network/response size, not device processing
    const impactMap = {
      personal_assistant: 'low',
      retriever: 'low',
      planner: 'medium',
      code_assistant: 'medium',
      synthesizer: 'high',
      athena: 'medium',
    };
    
    let impact = impactMap[agentName as keyof typeof impactMap] || 'medium';
    
    // Adjust based on complexity
    if (complexity === 'complex' && impact !== 'high') {
      impact = impact === 'low' ? 'medium' : 'high';
    }
    
    return impact as 'low' | 'medium' | 'high';
  }

  private assessNetworkImpact(agentName: string, deviceConstraints: any): 'low' | 'medium' | 'high' {
    // Network impact based on typical response sizes
    const networkMap = {
      personal_assistant: 'low',
      retriever: 'medium', // Might fetch external data
      planner: 'medium',
      code_assistant: 'high', // Code responses can be large
      synthesizer: 'high', // Complex analysis responses
      athena: 'medium',
    };
    
    return (networkMap[agentName as keyof typeof networkMap] || 'medium') as 'low' | 'medium' | 'high';
  }

  private estimateResponseTime(
    agentName: string,
    classification: TaskClassification,
    deviceConstraints: any
  ): number {
    const baseTimings = {
      personal_assistant: 2000,
      retriever: 3000,
      planner: 5000,
      code_assistant: 8000,
      synthesizer: 10000,
      athena: 6000,
    };
    
    let baseTime = baseTimings[agentName as keyof typeof baseTimings] || 5000;
    
    // Adjust for complexity
    const complexityMultipliers = {
      simple: 0.5,
      moderate: 1.0,
      complex: 2.0,
    };
    
    baseTime *= complexityMultipliers[classification.complexity];
    
    // Adjust for device constraints (server optimizes processing)
    if (deviceConstraints.batteryLevel < 20) {
      baseTime *= 0.7; // Faster, simpler processing
    }
    
    return Math.round(baseTime);
  }

  private generateFallbackAgents(primaryAgent: string, classification: TaskClassification): string[] {
    const fallbacks: string[] = [];
    
    // Always include personal assistant as ultimate fallback
    if (primaryAgent !== 'personal_assistant') {
      fallbacks.push('personal_assistant');
    }
    
    // Add domain-specific fallbacks
    if (classification.domain.includes('coding') && primaryAgent !== 'code_assistant') {
      fallbacks.unshift('code_assistant');
    }
    
    if (classification.domain.includes('analysis') && primaryAgent !== 'synthesizer') {
      fallbacks.unshift('synthesizer');
    }
    
    if (classification.domain.includes('planning') && primaryAgent !== 'planner') {
      fallbacks.unshift('planner');
    }
    
    // Limit to top 2 fallbacks
    return fallbacks.slice(0, 2);
  }

  private createFallbackRecommendation(request: AgentSelectionRequest): AgentRecommendation {
    return {
      primaryAgent: 'personal_assistant',
      confidence: 0.6,
      reasoning: 'Fallback selection due to selection service error',
      fallbackAgents: ['retriever'],
      estimatedResponseTime: 5000,
      batteryImpact: 'low',
      networkImpact: 'low',
      processingComplexity: 'simple',
      optimizedForDevice: false,
    };
  }

  private storeSelectionHistory(userInput: string, recommendation: AgentRecommendation): void {
    const key = userInput.substring(0, 50);
    const history = this.selectionHistory.get(key) || [];
    history.push(recommendation);
    this.selectionHistory.set(key, history.slice(-5)); // Keep last 5
  }

  private initializePerformanceMetrics(): void {
    const agents = ['personal_assistant', 'retriever', 'planner', 'code_assistant', 'synthesizer', 'athena'];
    
    for (const agent of agents) {
      this.performanceMetrics.set(agent, {
        successRate: 0.9, // Start with optimistic assumption
        avgResponseTime: 5000,
        userSatisfaction: 0.8,
        batteryEfficiency: 0.8,
      });
    }
  }

  /**
   * LFM2-specific helper methods
   */
  private optimizeForDevice(targetService: string, deviceConstraints: any): string {
    // Override service selection based on device constraints
    if (deviceConstraints.batteryLevel < 20 || deviceConstraints.isLowPowerMode) {
      // Use fastest service for low battery
      return 'lfm2';
    }
    
    if (deviceConstraints.connectionType === 'cellular' && (targetService === 'openai' || targetService === 'anthropic')) {
      // Use local models for cellular connections
      return 'ollama';
    }
    
    return targetService;
  }

  private generateServiceFallbacks(primaryService: string, routingDecision: any): string[] {
    const fallbacks: string[] = [];
    
    switch (primaryService) {
      case 'lfm2':
        fallbacks.push('ollama');
        break;
      case 'ollama': 
        fallbacks.push('lfm2', 'lm-studio');
        break;
      case 'lm-studio':
        fallbacks.push('ollama', 'lfm2');
        break;
      case 'openai':
      case 'anthropic':
        fallbacks.push('ollama', 'lm-studio', 'lfm2');
        break;
      default:
        fallbacks.push('ollama', 'lfm2');
    }
    
    return fallbacks.slice(0, 2); // Limit to 2 fallbacks
  }

  private mapServiceToAgent(service: string): string {
    const serviceToAgentMap: Record<string, string> = {
      'lfm2': 'lfm2_router',
      'ollama': 'personal_assistant', 
      'lm-studio': 'code_assistant',
      'openai': 'synthesizer',
      'anthropic': 'retriever'
    };
    
    return serviceToAgentMap[service] || 'personal_assistant';
  }

  private estimateServiceResponseTime(service: string, estimatedTokens: number): number {
    const baseTimings: Record<string, number> = {
      'lfm2': 200,      // Ultra-fast
      'ollama': 2000,   // Local model
      'lm-studio': 2500, // Local model 
      'openai': 3000,   // API call
      'anthropic': 3500 // API call
    };
    
    let baseTime = baseTimings[service] || 2000;
    
    // Adjust for token count
    const tokenMultiplier = Math.max(1, estimatedTokens / 100);
    baseTime *= tokenMultiplier;
    
    return Math.round(baseTime);
  }

  private assessServiceBatteryImpact(service: string, deviceConstraints: any): 'low' | 'medium' | 'high' {
    const impactMap: Record<string, 'low' | 'medium' | 'high'> = {
      'lfm2': 'low',      // Minimal processing
      'ollama': 'medium', // Local processing
      'lm-studio': 'medium', // Local processing
      'openai': 'low',    // Offloaded processing
      'anthropic': 'low'  // Offloaded processing  
    };
    
    let impact = impactMap[service] || 'medium';
    
    // Adjust for device constraints
    if (deviceConstraints.batteryLevel < 30) {
      if (impact === 'medium') impact = 'high';
      if (impact === 'low' && (service === 'ollama' || service === 'lm-studio')) {
        impact = 'medium'; // Local models still use some battery
      }
    }
    
    return impact;
  }

  private assessServiceNetworkImpact(service: string): 'low' | 'medium' | 'high' {
    const networkMap: Record<string, 'low' | 'medium' | 'high'> = {
      'lfm2': 'low',      // No network
      'ollama': 'low',    // No network  
      'lm-studio': 'low', // No network
      'openai': 'high',   // API calls
      'anthropic': 'high' // API calls
    };
    
    return networkMap[service] || 'medium';
  }

  private determineServiceComplexity(service: string, estimatedTokens: number): 'simple' | 'moderate' | 'complex' {
    if (estimatedTokens < 100) return 'simple';
    if (estimatedTokens < 500) return 'moderate';
    return 'complex';
  }

  private updateServiceMetrics(service: string, responseTime: number, success: boolean): void {
    // Create service-specific metrics tracking
    const key = `service_${service}`;
    const metrics = this.performanceMetrics.get(key) || {
      successRate: 0.9,
      avgResponseTime: responseTime,
      userSatisfaction: 0.8,
      batteryEfficiency: 0.8
    };
    
    const alpha = 0.1;
    metrics.successRate = success 
      ? metrics.successRate + alpha * (1 - metrics.successRate)
      : metrics.successRate - alpha * metrics.successRate;
    
    metrics.avgResponseTime = alpha * responseTime + (1 - alpha) * metrics.avgResponseTime;
    
    this.performanceMetrics.set(key, metrics);
    
    log.debug('📊 Updated service metrics', LogContext.AI, {
      service,
      successRate: metrics.successRate,
      avgResponseTime: metrics.avgResponseTime
    });
  }

  /**
   * Update performance metrics based on actual usage
   */
  public updatePerformanceMetrics(
    agentName: string,
    success: boolean,
    responseTime: number,
    userSatisfaction?: number,
    batteryEfficiency?: number
  ): void {
    const metrics = this.performanceMetrics.get(agentName);
    if (!metrics) return;
    
    // Exponential moving average updates
    const alpha = 0.1;
    
    metrics.successRate = success
      ? metrics.successRate + alpha * (1 - metrics.successRate)
      : metrics.successRate - alpha * metrics.successRate;
    
    metrics.avgResponseTime = alpha * responseTime + (1 - alpha) * metrics.avgResponseTime;
    
    if (userSatisfaction !== undefined) {
      metrics.userSatisfaction = alpha * userSatisfaction + (1 - alpha) * metrics.userSatisfaction;
    }
    
    if (batteryEfficiency !== undefined) {
      metrics.batteryEfficiency = alpha * batteryEfficiency + (1 - alpha) * metrics.batteryEfficiency;
    }
    
    this.performanceMetrics.set(agentName, metrics);
  }

  /**
   * Get current performance metrics
   */
  public getPerformanceMetrics() {
    return Object.fromEntries(this.performanceMetrics);
  }

  /**
   * Reset learning data (useful for testing)
   */
  public reset(): void {
    this.selectionHistory.clear();
    this.initializePerformanceMetrics();
  }

  /**
   * Classify the task type based on the user request
   */
  private classifyTaskType(userRequest: string): TaskType {
    const request = userRequest.toLowerCase();
    
    // Check for specific patterns first - order matters!
    
    // Creative writing patterns (check before other writing)
    if (request.includes('poem') || request.includes('story') || request.includes('haiku') || 
        request.includes('creative')) {
      return TaskType.CREATIVE_WRITING;
    }
    
    // Code-related patterns
    if ((request.includes('write') || request.includes('create')) && 
        (request.includes('function') || request.includes('code') || request.includes('script') || 
         request.includes('typescript') || request.includes('javascript'))) {
      return TaskType.CODE_GENERATION;
    }
    
    if (request.includes('fix') || request.includes('debug') || request.includes('error')) {
      return TaskType.CODE_DEBUGGING;
    }
    
    if (request.includes('review') && request.includes('code')) {
      return TaskType.CODE_REVIEW;
    }
    
    // Analysis and reasoning patterns
    if (request.includes('summarize') || request.includes('summary') || 
        request.includes('key features') || request.includes('bullet points')) {
      return TaskType.SUMMARIZATION;
    }
    
    if (request.includes('translate') || request.includes('translation')) {
      return TaskType.TRANSLATION;
    }
    
    if (request.includes('analyze') || request.includes('analysis')) {
      return TaskType.DATA_ANALYSIS;
    }
    
    if (request.includes('research') || request.includes('find information')) {
      return TaskType.RESEARCH;
    }
    
    // Classification patterns (check before general questions)
    if ((request.includes('positive') || request.includes('negative')) && 
        (request.includes('review') || request.includes('sentiment'))) {
      return TaskType.CLASSIFICATION;
    }
    
    if (request.includes('classify') || request.includes('category') || 
        request.includes('categorize')) {
      return TaskType.CLASSIFICATION;
    }
    
    // Reasoning patterns
    if (request.includes('explain') || request.includes('why') || request.includes('how') ||
        request.includes('pros and cons') || request.includes('advantages')) {
      return TaskType.REASONING;
    }
    
    // Math and calculations (factual)
    if (request.includes('calculate') || request.includes('%') || 
        request.match(/\d+\s*[\+\-\*\/]\s*\d+/)) {
      return TaskType.FACTUAL_QA;
    }
    
    // Factual questions
    if (request.includes('what') || request.includes('who') || request.includes('when') || 
        request.includes('where') || request.includes('capital') || request.includes('?')) {
      return TaskType.FACTUAL_QA;
    }
    
    // Default to casual chat
    return TaskType.CASUAL_CHAT;
  }
}

// Create singleton instance
export const intelligentAgentSelector = new IntelligentAgentSelector();
export default intelligentAgentSelector;