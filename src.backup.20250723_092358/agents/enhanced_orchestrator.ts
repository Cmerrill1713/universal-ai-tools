/* eslint-disable no-undef */
/**
 * Enhanced Universal AI Tools Orchestrator - DSPy Integration
 *
 * MIGRATED TO DSPy 3 - This file now delegates to DSPy for:
 * - Intelligent orchestration with Chain-of-Thought reasoning
 * - Dynamic agent selection and coordination
 * - AI-powered knowledge management
 * - MIPROv2 automatic prompt optimization
 * - Continuous learning and self-improvement
 */

import { EventEmitter } from 'events';
import { UniversalAgentRegistry } from './universal_agent_registry';
import {
  type DSPyOrchestrationRequest,
  type DSPyOrchestrationResponse,
  dspyService,
} from '../services/dspy-service';
import { dspyOptimizer } from '../services/dspy-performance-optimizer';
import { AdaptiveToolManager } from '../enhanced/adaptive_tool_integration';
import { MLXManager } from '../enhanced/mlx_integration';
import type { AgentContext, AgentResponse } from './base_agent';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';

// Configuration interfaces
export interface EnhancedOrchestratorConfig {
  // Basic configuration
  supabaseUrl: string;
  supabaseKey: string;
  redisUrl?: string;

  // Feature toggles
  enableMLX?: boolean;
  enableAdaptiveTools?: boolean;
  enableCaching?: boolean;
  enableContinuousLearning?: boolean;
  enableCognitiveOrchestration?: boolean;

  // Performance settings
  targetLatencyMs?: number;
  consensusThreshold?: number;
  riskTolerance?: 'low' | 'medium' | 'high';
  maxConcurrentAgents?: number;

  // Fault tolerance
  enableFaultTolerance?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  circuitBreakerThreshold?: number;
  degradationStrategy?: 'graceful' | 'minimal' | 'fallback';
}

// Request and response interfaces
export interface EnhancedRequest {
  requestId: string;
  userRequest: string;
  userId: string;
  conversationId?: string;
  sessionId?: string;
  context?: any;
  preferredModel?: string;
  orchestrationMode?: 'standard' | 'cognitive' | 'adaptive' | 'widget-creation';
  widgetRequirements?: {
    description: string;
    functionality?: string[];
    constraints?: string[];
  };
  timestamp: Date;
}

export interface EnhancedResponse {
  requestId: string;
  success: boolean;
  data: any;
  confidence: number;
  message?: string;
  reasoning: string;
  latencyMs: number;
  agentId: string;
  errorMessage?: string;

  // Enhanced fields
  orchestrationMode: string;
  participatingAgents: string[];
  consensusReached?: boolean;
  mlxOptimized?: boolean;
  cacheHit?: boolean;
  nextActions?: string[];

  // Metadata
  metadata?: {
    orchestration?: any;
    performance?: any;
    learning?: any;
  };
}

// Agent signal and consensus interfaces
interface AgentSignal {
  agentName: string;
  signalType: '_analysis | 'recommendation' | 'warning' | '_error);
  confidence: number;
  data: any;
  timestamp: Date;
  priority: 'low' | 'medium' | 'high' | 'critical';
  weight?: number;
}

interface ConsensusResult {
  decision: any;
  confidence: number;
  participatingAgents: string[];
  reasoning: string;
  consensusReached: boolean;
  dissenting: string[];
  approachUsed: 'consensus' | 'cognitive' | 'adaptive';
}

// Performance and health monitoring
interface OrchestrationMetrics {
  totalRequests: number;
  successfulRequests: number;
  averageLatency: number;
  averageConfidence: number;
  agentParticipationRates: Map<string, number>;
  consensusAchievementRate: number;
  errorRate: number;
  cacheHitRate: number;
  mlxUsageRate: number;
}

interface FaultToleranceConfig {
  maxRetries: number;
  retryDelay: number;
  circuitBreakerThreshold: number;
  degradationStrategy: 'graceful' | 'minimal' | 'fallback';
}

export class EnhancedOrchestrator extends EventEmitter {
  private config: EnhancedOrchestratorConfig;
  private registry: UniversalAgentRegistry;
  private adaptiveTools: AdaptiveToolManager;
  private mlxManager: MLXManager;
  private supabase: SupabaseClient;
  private redis?: any;

  // Agent management
  private agentWeights: Map<string, number> = new Map();
  private agentHealthStatus: Map<string, 'healthy' | 'degraded' | 'failed'> = new Map();
  private circuitBreakers: Map<
    string,
    { failureCount: number; lastFailure: Date; isOpen: boolean }
  > = new Map();

  // Performance tracking
  private metrics: OrchestrationMetrics;
  private requestHistory: Map<string, EnhancedResponse> = new Map();
  private performanceHistory: any[] = [];

  // System state
  private isInitialized = false;
  private shutdownEvent = false;
  private logger: any = console;

  constructor(config: EnhancedOrchestratorConfig) {
    super();

    this.config = {
      enableMLX: true,
      enableAdaptiveTools: true,
      enableCaching: true,
      enableContinuousLearning: true,
      enableCognitiveOrchestration: true,
      targetLatencyMs: 100,
      consensusThreshold: 0.6,
      riskTolerance: 'medium',
      maxConcurrentAgents: 10,
      enableFaultTolerance: true,
      maxRetries: 3,
      retryDelay: 1000,
      circuitBreakerThreshold: 5,
      degradationStrategy: 'graceful',
      ...config,
    };

    // Initialize Supabase
    this.supabase = createClient(config.supabaseUrl, config.supabaseKey);

    // Initialize components
    this.registry = new UniversalAgentRegistry(this.supabase);
    this.adaptiveTools = new AdaptiveToolManager(this.supabase);
    this.mlxManager = new MLXManager(this.supabase);

    // Initialize metrics
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      averageLatency: 0,
      averageConfidence: 0,
      agentParticipationRates: new Map(),
      consensusAchievementRate: 0,
      errorRate: 0,
      cacheHitRate: 0,
      mlxUsageRate: 0,
    };

    // Setup orchestrator
    this.setupAgentWeights();
    this.setupHealthMonitoring();
    this.setupEventListeners();
  }

  /**
   * Initialize all enhanced features
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    console.log('🚀 Initializing Enhanced Universal AI Tools Orchestrator...');

    try {
      // Initialize base registry
      await this.registry.initialize();

      // Initialize MLX if enabled and on Apple Silicon
      if (this.config.enableMLX) {
        await this.mlxManager.initialize();
      }

      // Initialize adaptive tools
      if (this.config.enableAdaptiveTools) {
        await this.loadAdaptivePreferences();
      }

      // Initialize Redis cache
      if (this.config.enableCaching && this.config.redisUrl) {
        await this.initializeRedis(this.config.redisUrl);
      }

      // Set up continuous learning
      if (this.config.enableContinuousLearning) {
        await this.setupContinuousLearning();
      }

      // Start performance tracking
      this.startPerformanceTracking();

      this.isInitialized = true;
      console.log('✅ Enhanced orchestrator initialized successfully');
      this.emit('orchestrator_ready');
    } catch (error) {
      console._error'❌ Failed to initialize Enhanced Orchestrator:', error);
      throw error;
    }
  }

  /**
   * Main orchestration method - routes to appropriate processing mode
   */
  async processRequest(request EnhancedRequest): Promise<EnhancedResponse> {
    const startTime = Date.now();
    const { requestId } = request

    if (!this.isInitialized) {
      throw new Error('Orchestrator not initialized. Call initialize() first.');
    }

    this.metrics.totalRequests++;
    logger.info(
      `🎯 DSPy Enhanced Processing request ${requestId} (mode: ${requestorchestrationMode || 'auto'})`
    );
    this.emit('request_started', request;

    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(request;
      const cached = await this.checkCache(cacheKey);
      if (cached) {
        logger.info('🎯 Cache hit!');
        this.metrics.cacheHitRate =
          (this.metrics.cacheHitRate * this.metrics.totalRequests + 1) /
          (this.metrics.totalRequests + 1);
        return { ...cached, cacheHit: true };
      }

      // Use DSPy for intelligent orchestration
      const dspyRequest: DSPyOrchestrationRequest = {
        requestId: requestrequestId,
        userRequest: requestuserRequest,
        userId: requestuserId,
        orchestrationMode:
          requestorchestrationMode === 'widget-creation'
            ? 'cognitive'
            : requestorchestrationMode || 'adaptive',
        context: {
          ...requestcontext,
          enableMLX: this.config.enableMLX,
          enableAdaptiveTools: this.config.enableAdaptiveTools,
          riskTolerance: this.config.riskTolerance,
          maxConcurrentAgents: this.config.maxConcurrentAgents,
          // Add widget-specific context if in widget creation mode
          ...(requestorchestrationMode === 'widget-creation' && {
            task: 'widget_creation',
            widgetRequirements: requestwidgetRequirements,
            targetAgents: ['widget_creator', 'code_generator', 'test_generator'],
          }),
        },
        timestamp: requesttimestamp,
      };

      // Get DSPy orchestration response with performance optimization
      const dspyResponse: DSPyOrchestrationResponse = await dspyOptimizer.optimizeRequest(
        'orchestrate',
        dspyRequest
      );

      let response: EnhancedResponse;

      if (dspyResponse.success) {
        // DSPy successful - use its results
        response = this.convertDSPyToEnhancedResponse(dspyResponse, request startTime);
      } else {
        // Fallback to legacy mode if DSPy fails
        logger.warn('DSPy orchestration failed, falling back to legacy mode:', dspyResponse._error);
        const mode = await this.determineOrchestrationMode(request;
        response = await this.processLegacyMode(request mode);
      }

      // Post-processing for DSPy responses
      const latency = Date.now() - startTime;
      response.latencyMs = latency;
      response.orchestrationMode = dspyResponse.mode || 'dspy';

      // Cache the response
      if (this.config.enableCaching) {
        await this.cacheResponse(cacheKey, response);
      }

      // Update metrics and learning
      await this.updateMetrics(request response, latency);

      // Store in history
      this.requestHistory.set(requestId, response);

      // Continuous learning - feed back to DSPy
      if (this.config.enableContinuousLearning) {
        await this.updateLearning(request response);
        // Also optimize DSPy prompts with successful examples
        if (response.success && response.confidence && response.confidence > 0.8) {
          try {
            await dspyService.optimizePrompts([
              {
                input requestuserRequest,
                output: response.data,
                confidence: response.confidence,
              },
            ]);
          } catch (error) {
            logger.debug('DSPy prompt optimization failed:', error);
          }
        }
      }

      this.metrics.successfulRequests++;
      logger.info(
        `✅ DSPy Request ${requestId} completed in ${latency}ms with ${response.confidence} confidence`
      );
      this.emit('request_completed', response);

      return response;
    } catch (error) {
      const latency = Date.now() - startTime;
      this.logger.error(❌ Request ${requestId} failed after ${latency}ms:`, error);

      // Apply fault tolerance
      const fallbackResponse = await this.handleFailure(request _error latency);

      this.emit('request_failed', {
        requestId,
        _error error instanceof Error ? error.message : String(_error,
        latency,
      });

      return fallbackResponse;
    }
  }

  /**
   * Determine the best orchestration mode for a request
   */
  private async determineOrchestrationMode(request EnhancedRequest): Promise<string> {
    if (requestorchestrationMode) {
      return requestorchestrationMode;
    }

    // Analyze requestcomplexity
    const complexity = await this.analyzeRequestComplexity(requestuserRequest);

    // Determine mode based on complexity and features
    if (complexity.requiresMultiAgent && this.config.enableCognitiveOrchestration) {
      return 'cognitive';
    } else if (complexity.score > 0.7 && this.config.enableFaultTolerance) {
      return 'consensus';
    } else if (this.config.enableAdaptiveTools) {
      return 'adaptive';
    }

    return 'standard';
  }

  /**
   * Process requestusing cognitive orchestration (10-agent system)
   */
  private async processCognitiveRequest(request EnhancedRequest): Promise<EnhancedResponse> {
    console.log('🧠 Using cognitive orchestration...');

    const agentResults: any = {};

    // Phase 1: Intent Analysis
    agentResults.intent = await this.executeAgentPhase('user_intent', request {});

    // Phase 2: Strategic Planning
    agentResults.plan = await this.executeAgentPhase('planner', request {
      intent: agentResults.intent,
    });

    // Phase 3: Information Gathering
    agentResults.information = await this.executeAgentPhase('retriever', request {
      intent: agentResults.intent,
      plan: agentResults.plan,
    });

    // Phase 4: Critical Analysis
    agentResults.risks = await this.executeAgentPhase('devils_advocate', request {
      plan: agentResults.plan,
      information: agentResults.information,
    });

    // Phase 5: Solution Synthesis
    agentResults.solution = await this.executeAgentPhase('synthesizer', request agentResults);

    // Phase 6: Safety Validation
    agentResults.safetyValidation = await this.executeAgentPhase('ethics', request {
      solution: agentResults.solution,
    });

    // Phase 7: Tool Creation (if needed)
    if (this.needsCustomTools(agentResults.solution)) {
      agentResults.customTools = await this.executeAgentPhase('tool_maker', request {
        solution: agentResults.solution,
      });
    }

    // Phase 8: Resource Optimization
    agentResults.resourceOptimization = await this.executeAgentPhase('resource_manager', request {
      solution: agentResults.solution,
    });

    // Phase 9: Self-Reflection
    agentResults.reflection = await this.executeAgentPhase('reflector', request {
      solution: agentResults.solution,
    });

    // Phase 10: Final Coordination
    const finalResponse = this.buildCognitiveFinalResponse(agentResults);

    return {
      requestId: requestrequestId,
      success: true,
      data: finalResponse,
      confidence: this.calculateOverallConfidence(agentResults),
      reasoning: this.buildCognitiveReasoning(agentResults),
      latencyMs: 0, // Will be set by caller
      agentId: 'enhanced-orchestrator',
      orchestrationMode: 'cognitive',
      participatingAgents: Object.keys(agentResults),
      consensusReached: true,
      nextActions: this.generateNextActions(finalResponse),
    };
  }

  /**
   * Process requestusing adaptive tools
   */
  private async processAdaptiveRequest(request EnhancedRequest): Promise<EnhancedResponse> {
    console.log('🔧 Using adaptive orchestration...');

    // Analyze requestcomplexity for routing
    const complexity = await this.analyzeRequestComplexity(requestuserRequest);

    // Route to appropriate model if MLX is enabled
    let modelToUse = requestpreferredModel;
    if (this.config.enableMLX && !modelToUse) {
      modelToUse = await this.mlxManager.routeRequest({
        prompt: requestuserRequest,
      });
      console.log(`📊 MLX routed to model: ${modelToUse} (complexity: ${complexity.score})`);
    }

    // Determine required agents
    const requiredAgents = await this.determineRequiredAgents(requestuserRequest, complexity);

    let response;
    if (requiredAgents.length === 1) {
      // Single agent - use adaptive tools
      response = await this.executeWithAdaptiveTools(
        request
        requiredAgents[0],
        modelToUse || 'llama3.2:3b'
      );
    } else {
      // Multi-agent coordination
      response = await this.executeMultiAgent(request requiredAgents, modelToUse);
    }

    return {
      requestId: requestrequestId,
      success: response.success,
      data: response.data,
      confidence: response.confidence || 0.8,
      reasoning: response.reasoning || 'Executed with adaptive tools',
      latencyMs: 0, // Will be set by caller
      agentId: 'enhanced-orchestrator',
      orchestrationMode: 'adaptive',
      participatingAgents: requiredAgents,
      mlxOptimized: !!modelToUse,
    };
  }

  /**
   * Process requestusing consensus orchestration
   */
  private async processConsensusRequest(request EnhancedRequest): Promise<EnhancedResponse> {
    console.log('🤝 Using consensus orchestration...');

    // Convert to AgentContext for compatibility
    const agentContext: AgentContext = {
      requestId: requestrequestId,
      userId: requestuserId,
      sessionId: requestsessionId,
      userRequest: requestuserRequest,
      previousContext: requestcontext,
      timestamp: requesttimestamp,
    };

    // Gather signals from all participating agents
    const agentSignals = await this.gatherAgentSignals(agentContext);

    // Build consensus
    const consensus = await this.buildConsensus(agentSignals, agentContext);

    // Execute coordinated response
    const response = await this.executeCoordinatedResponse(consensus, agentContext);

    return {
      requestId: requestrequestId,
      success: response.success,
      data: response.data,
      confidence: response.confidence || 0.7,
      reasoning: response.reasoning || consensus.reasoning,
      latencyMs: 0, // Will be set by caller
      agentId: 'enhanced-orchestrator',
      orchestrationMode: 'consensus',
      participatingAgents: consensus.participatingAgents,
      consensusReached: consensus.consensusReached,
      metadata: {
        orchestration: {
          approachUsed: consensus.approachUsed,
          dissenting: consensus.dissenting,
        },
      },
    };
  }

  /**
   * Process requestusing standard orchestration
   */
  private async processStandardRequest(request EnhancedRequest): Promise<EnhancedResponse> {
    console.log('📋 Using standard orchestration...');

    // Simple agent routing
    const agentName = await this.selectPrimaryAgent(requestuserRequest);

    const response = await this.registry.processRequest(agentName, {
      requestId: requestrequestId,
      userId: requestuserId,
      userRequest: requestuserRequest,
      previousContext: requestcontext,
      timestamp: requesttimestamp,
    });

    return {
      requestId: requestrequestId,
      success: response.success,
      data: response.data,
      confidence: response.confidence || 0.6,
      reasoning: response.reasoning || 'Standard agent processing',
      latencyMs: 0, // Will be set by caller
      agentId: agentName,
      orchestrationMode: 'standard',
      participatingAgents: [agentName],
    };
  }

  /**
   * Execute a phase of cognitive orchestration
   */
  private async executeAgentPhase(
    agentName: string,
    request EnhancedRequest,
    context: any
  ): Promise<unknown> {
    try {
      const agent = await this.registry.getAgent(agentName);
      if (!agent) {
        this.logger.warn(`⚠️ Agent ${agentName} not available, using fallback`);
        return this.getFallbackResponse(agentName, context);
      }

      const agentContext: AgentContext = {
        requestId: requestrequestId,
        userId: requestuserId,
        sessionId: requestsessionId,
        userRequest: requestuserRequest,
        previousContext: context,
        timestamp: requesttimestamp,
      };

      const response = await this.executeWithTimeout(
        agent.execute(agentContext),
        this.config.targetLatencyMs! * 2
      );

      this.updateAgentHealth(agentName, 'healthy');
      return response.data;
    } catch (error) {
      this.handleAgentFailure(agentName, error);
      return this.getFallbackResponse(agentName, context);
    }
  }

  /**
   * Build final response for cognitive orchestration
   */
  private buildCognitiveFinalResponse(agentResults: any): any {
    const { intent, plan, solution, safetyValidation, reflection } = agentResults;

    return {
      primaryResponse: solution,
      userIntent: intent,
      implementationPlan: plan,
      safetyAssessment: safetyValidation,
      qualityReflection: reflection,
      orchestratorRecommendation: this.generateOrchestratorRecommendation(agentResults),
      confidence: this.calculateOverallConfidence(agentResults),
      nextSteps: plan?.steps || [],
    };
  }

  /**
   * Build comprehensive reasoning for cognitive orchestration
   */
  private buildCognitiveReasoning(agentResults: any): string {
    const { intent, plan, risks, solution, safetyValidation, reflection } = agentResults;

    return `**🧠 Comprehensive Cognitive Analysis Complete**

**🎯 Intent Recognition**: ${intent?.primaryIntent || 'Analyzed user goals and requirements'}
**📋 Strategic Planning**: Created ${plan?.steps?.length || 'detailed'} step implementation plan
**🔍 Risk Analysis**: Identified ${risks?.keyWeaknesses?.length || 'potential'} weaknesses and mitigation strategies
**🔄 Solution Synthesis**: Integrated insights from multiple cognitive perspectives
**🛡️ Safety Validation**: ${safetyValidation?.approved ? 'Approved' : 'Reviewed'} for safety and ethics compliance
**🪞 Quality Reflection**: ${reflection?.qualityScore ? `Quality score: ${reflection.qualityScore}` : 'Assessed solution quality'}

**Cognitive Process**:
1. **Deep Intent Analysis** - Understanding what you really need
2. **Strategic Decomposition** - Breaking complex goals into manageable steps
3. **Information Integration** - Gathering relevant knowledge and context
4. **Critical Evaluation** - Identifying potential issues before they occur
5. **Intelligent Synthesis** - Combining insights for optimal solutions
6. **Safety Assurance** - Ensuring ethical and secure implementations
7. **Quality Optimization** - Continuous improvement through reflection

This multi-agent cognitive approach ensures comprehensive, safe, and effective solutions tailored to your specific needs.`;
  }

  // ... [Rest of the methods from the original files, properly integrated]

  /**
   * Analyze requestcomplexity
   */
  private async analyzeRequestComplexity(request string): Promise<{
    score: number;
    type: string;
    requiresMultiAgent: boolean;
  }> {
    const indicators = {
      multiTask: /\band\b|\bthen\b|\bafter\b|\balso\b/gi,
      complex: /analyze|optimize|refactor|design|architect/gi,
      simple: /show|list|find|get|what|where/gi,
      code: /code|function|class|debug|implement/gi,
      data: /data|process|transform|aggregate/gi,
      system: /system|app|launch|monitor/gi,
    };

    let score = 0.3; // Base score
    let type = 'general';

    // Check for multi-task indicators
    const multiTaskMatches = requestmatch(indicators.multiTask);
    if (multiTaskMatches && multiTaskMatches.length > 0) {
      score += 0.2 * multiTaskMatches.length;
    }

    // Check complexity
    if (indicators.complex.test(request) {
      score += 0.3;
      type = 'complex';
    } else if (indicators.simple.test(request) {
      score -= 0.1;
      type = 'simple';
    }

    // Check domain
    if (indicators.code.test(request) {
      type = 'code';
      score += 0.1;
    } else if (indicators.data.test(request) {
      type = 'data';
    } else if (indicators.system.test(request) {
      type = 'system';
    }

    return {
      score: Math.min(Math.max(score, 0), 1),
      type,
      requiresMultiAgent: multiTaskMatches ? multiTaskMatches.length > 1 : false,
    };
  }

  /**
   * Execute with adaptive tools
   */
  private async executeWithAdaptiveTools(
    request EnhancedRequest,
    agentName: string,
    modelName: string
  ): Promise<unknown> {
    const toolMapping: Record<string, string> = {
      file_manager: 'adaptive_file_operation',
      code_assistant: 'adaptive_code__analysis,
      web_scraper: 'adaptive_web_interaction',
      personal_assistant: 'adaptive_data_processing',
    };

    const toolName = toolMapping[agentName];
    if (!toolName) {
      // Fallback to standard execution
      return this.registry.processRequest(agentName, {
        requestId: requestrequestId,
        userId: requestuserId,
        userRequest: requestuserRequest,
        previousContext: requestcontext,
        timestamp: requesttimestamp,
      });
    }

    // Execute with adaptive tool
    const result = await this.adaptiveTools.executeAdaptiveTool(
      toolName,
      { prompt: requestuserRequest },
      modelName,
      requestcontext
    );

    return {
      success: true,
      data: result,
      agentId: agentName,
      reasoning: `Executed with adaptive ${toolName}`,
      confidence: 0.9,
    };
  }

  /**
   * Gather agent signals for consensus
   */
  private async gatherAgentSignals(request AgentContext): Promise<AgentSignal[]> {
    const signals: AgentSignal[] = [];
    const agentPromises: Promise<AgentSignal | null>[] = [];

    // Determine which agents should participate
    const participatingAgents = await this.selectParticipatingAgents(request;

    for (const agentName of participatingAgents) {
      agentPromises.push(this.getAgentSignal(agentName, request);
    }

    // Wait for all agents with timeout
    const results = await Promise.allSettled(agentPromises);

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const agentName = participatingAgents[i];

      if (result.status === 'fulfilled' && result.value) {
        signals.push(result.value);
        this.updateAgentHealth(agentName, 'healthy');
      } else {
        this.handleAgentFailure(
          agentName,
          result.status === 'rejected' ? result.reason : 'No response'
        );
      }
    }

    return signals;
  }

  /**
   * Get signal from specific agent
   */
  private async getAgentSignal(
    agentName: string,
    request AgentContext
  ): Promise<AgentSignal | null> {
    const circuitBreaker = this.circuitBreakers.get(agentName);

    // Check circuit breaker status
    if (circuitBreaker?.isOpen) {
      const timeSinceLastFailure = Date.now() - circuitBreaker.lastFailure.getTime();
      if (timeSinceLastFailure < 60000) {
        // 1 minute cooldown
        this.logger.warn(`⚡ Circuit breaker open for agent ${agentName}, skipping`);
        return null;
      } else {
        // Try to close circuit breaker
        circuitBreaker.isOpen = false;
        circuitBreaker.failureCount = 0;
      }
    }

    try {
      const agent = await this.registry.getAgent(agentName);
      if (!agent) {
        throw new Error(`Agent ${agentName} not available`);
      }

      const response = await this.executeWithTimeout(
        agent.execute(request,
        this.config.targetLatencyMs! * 2
      );

      return {
        agentName,
        signalType: '_analysis,
        confidence: response.confidence || 0.5,
        data: response.data,
        timestamp: new Date(),
        priority: this.determineSignalPriority(response),
      };
    } catch (error) {
      this.handleAgentFailure(agentName, error);
      return null;
    }
  }

  /**
   * Build consensus from agent signals
   */
  private async buildConsensus(
    signals: AgentSignal[],
    request AgentContext
  ): Promise<ConsensusResult> {
    if (signals.length === 0) {
      throw new Error('No agent signals available for consensus building');
    }

    // Weight the signals by agent reliability and expertise
    const weightedSignals = signals.map((signal) => ({
      ...signal,
      weight: this.agentWeights.get(signal.agentName) || 0.5,
    }));

    // Calculate weighted confidence
    const totalWeight = weightedSignals.reduce((sum, s) => sum + s.weight, 0);
    const weightedConfidence =
      weightedSignals.reduce((sum, s) => sum + s.confidence * s.weight, 0) / totalWeight;

    // Determine if consensus is reached
    const consensusReached = weightedConfidence >= this.config.consensusThreshold!;

    // Identify dissenting agents
    const dissenting = signals
      .filter((s) => s.confidence < this.config.consensusThreshold!)
      .map((s) => s.agentName);

    // Synthesize the consensus decision
    const decision = this.synthesizeConsensusDecision(weightedSignals);

    return {
      decision,
      confidence: weightedConfidence,
      participatingAgents: signals.map((s) => s.agentName),
      reasoning: this.buildConsensusReasoning(weightedSignals, consensusReached),
      consensusReached,
      dissenting,
      approachUsed: 'consensus',
    };
  }

  /**
   * Execute coordinated response
   */
  private async executeCoordinatedResponse(
    consensus: ConsensusResult,
    request AgentContext
  ): Promise<AgentResponse> {
    return {
      success: true,
      data: consensus.decision,
      confidence: consensus.confidence,
      message: `Orchestrated response from ${consensus.participatingAgents.length} agents`,
      reasoning: consensus.reasoning,
      latencyMs: 0,
      agentId: 'enhanced-orchestrator',
      metadata: {
        orchestration: {
          participatingAgents: consensus.participatingAgents,
          consensusReached: consensus.consensusReached,
          dissenting: consensus.dissenting,
          totalLatency: Date.now() - requesttimestamp.getTime(),
        },
      },
    };
  }

  // Helper methods and setup functions
  private setupAgentWeights(): void {
    this.agentWeights.set('user_intent', 1.0);
    this.agentWeights.set('planner', 0.9);
    this.agentWeights.set('devils_advocate', 0.8);
    this.agentWeights.set('synthesizer', 0.9);
    this.agentWeights.set('ethics', 1.0);
    this.agentWeights.set('orchestrator', 0.7);
    this.agentWeights.set('reflector', 0.6);
    this.agentWeights.set('retriever', 0.7);
    this.agentWeights.set('tool_maker', 0.5);
    this.agentWeights.set('resource_manager', 0.4);
  }

  private setupHealthMonitoring(): void {
    for (const agentName of this.agentWeights.keys()) {
      this.agentHealthStatus.set(agentName, 'healthy');
      this.circuitBreakers.set(agentName, {
        failureCount: 0,
        lastFailure: new Date(0),
        isOpen: false,
      });
    }
  }

  private setupEventListeners(): void {
    this.on('request_started', (request => {
      this.logger.debug(`🚀 Enhanced orchestration started for: ${requestrequestId}`);
    });

    this.on('request_completed', (response) => {
      this.logger.debug(`✅ Enhanced orchestration completed: ${response.requestId}`);
    });

    this.on('request_failed', (response) => {
      this.logger.error(❌ Enhanced orchestration failed: ${response.requestId}`);
    });
  }

  private startPerformanceTracking(): void {
    setInterval(
      () => {
        this.updatePerformanceMetrics();
      },
      5 * 60 * 1000
    ); // Every 5 minutes
  }

  private async executeWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      promise
        .then(resolve)
        .catch(reject)
        .finally(() => clearTimeout(timer));
    });
  }

  // ... [Additional helper methods continue with proper implementations]

  /**
   * Get orchestrator status
   */
  getStatus(): any {
    return {
      isInitialized: this.isInitialized,
      config: this.config,
      metrics: this.metrics,
      agentHealth: Object.fromEntries(this.agentHealthStatus),
      circuitBreakers: Object.fromEntries(
        Array.from(this.circuitBreakers.entries()).map(([name, cb]) => [
          name,
          { isOpen: cb.isOpen, failureCount: cb.failureCount },
        ])
      ),
      registry: this.registry.getStatus(),
      requestHistorySize: this.requestHistory.size,
      isHealthy:
        this.metrics.errorRate < 0.1 &&
        this.metrics.averageLatency < this.config.targetLatencyMs! * 2,
    };
  }

  /**
   * Gracefully shutdown the orchestrator
   */
  async shutdown(): Promise<void> {
    this.shutdownEvent = true;

    // Disconnect Redis
    if (this.redis) {
      await this.redis.quit();
    }

    // Shutdown components
    await this.registry.shutdown();

    // Clear data structures
    this.requestHistory.clear();
    this.performanceHistory.length = 0;
    this.removeAllListeners();

    this.isInitialized = false;
    this.logger.info('🎯 Enhanced Orchestrator shut down gracefully');
    this.emit('orchestrator_shutdown');
  }

  // Placeholder implementations for remaining methods
  private async determineRequiredAgents(request string, complexity: any): Promise<string[]> {
    // Implementation from original enhanced orchestrator
    const agents: Set<string> = new Set();

    const agentKeywords = {
      calendar_agent: /\b(schedule|meeting|appointment|calendar|event)\b/i,
      photo_organizer: /\b(photo|picture|image|album|face)\b/i,
      file_manager: /\b(file|folder|organize|duplicate|backup)\b/i,
      code_assistant: /\b(code|function|debug|implement|refactor)\b/i,
      system_control: /\b(system|app|launch|quit|monitor)\b/i,
      web_scraper: /\b(website|scrape|monitor|fetch|extract)\b/i,
      tool_maker: /\b(create tool|build|generate|workflow)\b/i,
    };

    for (const [agent, _pattern of Object.entries(agentKeywords)) {
      if (_patterntest(request) {
        agents.add(agent);
      }
    }

    if (agents.size === 0) {
      agents.add('personal_assistant');
    }

    return Array.from(agents);
  }

  private async executeMultiAgent(
    request EnhancedRequest,
    agents: string[],
    modelName?: string
  ): Promise<unknown> {
    const coordinationRequest = {
      requestId: requestrequestId,
      userId: requestuserId,
      userRequest: requestuserRequest,
      previousContext: requestcontext,
      timestamp: requesttimestamp,
    };

    return this.registry.processRequest('personal_assistant', coordinationRequest);
  }

  private async selectPrimaryAgent(request string): Promise<string> {
    // Simple routing logic
    const requestLower = request toLowerCase();

    if (requestLower.includes('code') || requestLower.includes('debug')) {
      return 'code_assistant';
    } else if (requestLower.includes('file') || requestLower.includes('folder')) {
      return 'file_manager';
    } else if (requestLower.includes('schedule') || requestLower.includes('calendar')) {
      return 'calendar_agent';
    } else {
      return 'personal_assistant';
    }
  }

  private async selectParticipatingAgents(request AgentContext): Promise<string[]> {
    const requestLower = requestuserRequest.toLowerCase();
    const availableAgents = new Set<string>();

    // Always include core agents
    availableAgents.add('user_intent');
    availableAgents.add('planner');
    availableAgents.add('ethics');

    // Add domain-specific agents
    if (requestLower.includes('risk') || requestLower.includes('security')) {
      availableAgents.add('devils_advocate');
    }

    // Add synthesis and reflection for complex requests
    if (requestLower.length > 50 || requestLower.split(' ').length > 10) {
      availableAgents.add('synthesizer');
      availableAgents.add('reflector');
    }

    // Filter out unhealthy agents
    return Array.from(availableAgents).filter(
      (agentName) => this.agentHealthStatus.get(agentName) !== 'failed'
    );
  }

  private synthesizeConsensusDecision(weightedSignals: any[]): any {
    const recommendations = [];
    const tools = new Set<string>();
    const steps = [];

    for (const signal of weightedSignals) {
      if (signal.data?.suggested_tools) {
        signal.data.suggested_tools.forEach((tool: string) => tools.add(tool));
      }
      if (signal.data?.setup_steps) {
        steps.push(...signal.data.setup_steps);
      }
      if (signal.data?.recommendations) {
        recommendations.push(...signal.data.recommendations);
      }
    }

    return {
      suggested_tools: Array.from(tools),
      setup_steps: [...new Set(steps)],
      recommendations: [...new Set(recommendations)],
      approach: 'multi_agent_consensus',
      consensus_strength:
        weightedSignals.reduce((sum, s) => sum + s.weight, 0) / weightedSignals.length,
    };
  }

  private buildConsensusReasoning(weightedSignals: any[], consensusReached: boolean): string {
    const totalAgents = weightedSignals.length;
    const avgConfidence = weightedSignals.reduce((sum, s) => sum + s.confidence, 0) / totalAgents;

    return `**🎯 Multi-Agent Consensus Analysis**

**Participating Agents**: ${totalAgents} specialized agents contributed to this analysis
**Average Confidence**: ${(avgConfidence * 100).toFixed(1)}%
**Consensus Status**: ${consensusReached ? '✅ ACHIEVED' : '⚠️ PARTIAL'}

**Agent Contributions**:
${weightedSignals
  .map(
    (s) =>
      `• **${s.agentName}**: ${(s.confidence * 100).toFixed(1)}% confidence (weight: ${s.weight})`
  )
  .join('\n')}

This orchestrated approach ensures comprehensive _analysiswhile maintaining efficiency and reliability.`;
  }

  private determineSignalPriority(response: AgentResponse): 'low' | 'medium' | 'high' | 'critical' {
    if (!response.success) return 'critical';
    if (response.confidence < 0.3) return 'low';
    if (response.confidence < 0.7) return 'medium';
    return 'high';
  }

  private updateAgentHealth(agentName: string, status: 'healthy' | 'degraded' | 'failed'): void {
    this.agentHealthStatus.set(agentName, status);

    if (status === 'healthy') {
      const circuitBreaker = this.circuitBreakers.get(agentName);
      if (circuitBreaker) {
        circuitBreaker.failureCount = Math.max(0, circuitBreaker.failureCount - 1);
      }
    }
  }

  private handleAgentFailure(agentName: string, error any): void {
    const circuitBreaker = this.circuitBreakers.get(agentName);
    if (circuitBreaker) {
      circuitBreaker.failureCount++;
      circuitBreaker.lastFailure = new Date();

      if (circuitBreaker.failureCount >= this.config.circuitBreakerThreshold!) {
        circuitBreaker.isOpen = true;
        this.updateAgentHealth(agentName, 'failed');
        this.logger.warn(`⚡ Circuit breaker opened for agent ${agentName}`);
      } else {
        this.updateAgentHealth(agentName, 'degraded');
      }
    }

    this.emit('agent_failure', { agentName, error error.message });
  }

  private async handleFailure(
    request EnhancedRequest,
    _error any,
    latency: number
  ): Promise<EnhancedResponse> {
    this.logger.error('Enhanced orchestration failed, applying fallback strategy:', error);

    return {
      requestId: requestrequestId,
      success: false,
      data: null,
      confidence: 0.1,
      message: 'Orchestration failed, returning fallback response',
      reasoning:
        'System experienced technical difficulties. Please try again or simplify your request',
      latencyMs: latency,
      agentId: 'enhanced-orchestrator',
      orchestrationMode: 'fallback',
      participatingAgents: [],
      errorMessage: error instanceof Error ? error.message : String(_error,
    };
  }

  private generateCacheKey(request EnhancedRequest): string {
    return `ai_tools:${requestuserId}:${Buffer.from(requestuserRequest).toString('base64').substring(0, 32)}`;
  }

  private async checkCache(key: string): Promise<unknown> {
    if (!this.redis) return null;

    try {
      const cached = await this.redis.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  }

  private async cacheResponse(key: string, response: any) {
    if (!this.redis) return;

    try {
      await this.redis.setex(key, 3600, JSON.stringify(response));
    } catch (error) {
      this.logger.error('Cache write failed:', error);
    }
  }

  private async initializeRedis(redisUrl: string) {
    try {
      this.redis = new Redis(redisUrl);
      await this.redis.connect();
      console.log('✅ Redis cache connected');
    } catch (error) {
      console._error'Failed to connect to Redis:', error);
    }
  }

  private async loadAdaptivePreferences() {
    try {
      const { data } = await this.supabase.from('adaptive_tool_learning').select('*');

      if (data && data.length > 0) {
        console.log(`📚 Loaded ${data.length} adaptive preferences`);
      }
    } catch (error) {
      console._error'Failed to load adaptive preferences:', error);
    }
  }

  private async setupContinuousLearning() {
    console.log('🧠 Continuous learning enabled');
  }

  private async updateLearning(request EnhancedRequest, response: EnhancedResponse) {
    await this.supabase.from('execution_history').insert({
      user_id: requestuserId,
      request requestuserRequest,
      response: response.data,
      model_used: response.metadata?.orchestration?.model || 'unknown',
      success: response.success,
      timestamp: new Date(),
    });
  }

  private async updateMetrics(
    request EnhancedRequest,
    response: EnhancedResponse,
    latency: number
  ) {
    this.metrics.averageLatency =
      (this.metrics.averageLatency * (this.metrics.totalRequests - 1) + latency) /
      this.metrics.totalRequests;

    this.metrics.averageConfidence =
      (this.metrics.averageConfidence * (this.metrics.totalRequests - 1) + response.confidence) /
      this.metrics.totalRequests;
  }

  private updatePerformanceMetrics(): void {
    this.metrics.errorRate =
      (this.metrics.totalRequests - this.metrics.successfulRequests) / this.metrics.totalRequests;

    this.logger.debug('📊 Performance metrics updated:', this.metrics);
  }

  private needsCustomTools(solution: any): boolean {
    const solutionStr = JSON.stringify(solution).toLowerCase();
    return (
      solutionStr.includes('custom') ||
      solutionStr.includes('specific') ||
      solutionStr.includes('unique')
    );
  }

  private getFallbackResponse(agentName: string, context: any): any {
    return {
      message: `Fallback response for ${agentName}`,
      confidence: 0.3,
      fallback: true,
    };
  }

  private calculateOverallConfidence(agentResults: any): number {
    const confidenceScores: number[] = [];

    Object.values(agentResults).forEach((result: any) => {
      if (result?.confidence) {
        confidenceScores.push(result.confidence);
      }
    });

    if (confidenceScores.length === 0) return 0.7;

    return (
      confidenceScores.reduce((sum: number, score: number) => sum + score, 0) /
      confidenceScores.length
    );
  }

  private generateNextActions(finalResponse: any): string[] {
    const actions = ['Review the implementation plan'];

    if (finalResponse.implementationPlan?.steps) {
      actions.push('Execute the planned steps in sequence');
    }

    if (finalResponse.safetyAssessment?.recommendations) {
      actions.push('Address safety recommendations');
    }

    actions.push('Monitor implementation progress', 'Validate results');

    return actions;
  }

  private generateOrchestratorRecommendation(agentResults: any): string {
    const { plan, risks, safetyValidation } = agentResults;

    let recommendation = 'Proceed with the implementation following the strategic plan.';

    if (risks?.severity === 'high' || risks?.severity === 'critical') {
      recommendation = 'Address critical risks before proceeding with implementation.';
    } else if (safetyValidation?.approved === false) {
      recommendation = 'Resolve safety concerns before moving forward.';
    } else if (plan?.complexity === 'high') {
      recommendation = 'Consider breaking this into smaller phases for easier management.';
    }

    return recommendation;
  }

  /**
   * Convert DSPy orchestration response to EnhancedResponse format
   */
  private convertDSPyToEnhancedResponse(
    dspyResponse: DSPyOrchestrationResponse,
    request EnhancedRequest,
    startTime: number
  ): EnhancedResponse {
    const executionTime = Date.now() - startTime;

    return {
      requestId: requestrequestId,
      success: dspyResponse.success,
      data: dspyResponse.result,
      confidence: dspyResponse.confidence || 0.8,
      reasoning: dspyResponse.reasoning || 'DSPy intelligent orchestration',
      latencyMs: executionTime,
      agentId: 'dspy-orchestrator',
      orchestrationMode: dspyResponse.mode || 'adaptive',
      participatingAgents: dspyResponse.participatingAgents || [],
      metadata: {
        orchestration: {
          mode: dspyResponse.mode,
          confidence: dspyResponse.confidence,
          reasoning: dspyResponse.reasoning,
          executionTime: dspyResponse.executionTime,
          dspyEnabled: true,
        },
        performance: {
          latencyMs: executionTime,
          complexity: this.calculateComplexity(requestuserRequest),
          timestamp: new Date(),
        },
      },
    };
  }

  /**
   * Legacy fallback processing mode
   */
  private async processLegacyMode(
    request EnhancedRequest,
    mode: string
  ): Promise<EnhancedResponse> {
    logger.info('Using legacy orchestration mode:', mode);

    // Simplified fallback - just route to personal assistant
    const agentResponse = await this.registry.processRequest('personal_assistant', {
      requestId: requestrequestId,
      userId: requestuserId,
      userRequest: requestuserRequest,
      previousContext: requestcontext,
      timestamp: requesttimestamp,
    });

    return {
      requestId: requestrequestId,
      success: true,
      data: agentResponse,
      confidence: 0.7, // Lower confidence for fallback mode
      reasoning: 'Legacy fallback mode - DSPy unavailable',
      latencyMs: 0,
      agentId: 'personal_assistant',
      orchestrationMode: 'legacy_fallback',
      participatingAgents: ['personal_assistant'],
      metadata: {
        orchestration: {
          mode: 'legacy_fallback',
          confidence: 0.7,
          reasoning: 'DSPy service unavailable, using legacy mode',
          executionTime: 0,
          dspyEnabled: false,
        },
        performance: {
          latencyMs: Date.now() - Date.now(),
          complexity: this.calculateComplexity(requestuserRequest),
          timestamp: new Date(),
        },
      },
    };
  }

  private calculateComplexity(userRequest: string): 'low' | 'medium' | 'high' {
    const words = userRequest.split(' ').length;
    if (words < 10) return 'low';
    if (words < 30) return 'medium';
    return 'high';
  }
}

// DEPRECATED: This implementation has been replaced by DSPy service
// Use the adapter for backward compatibility
import { createEnhancedOrchestratorAdapter } from '../services/enhanced-orchestrator-adapter';

/**
 * @deprecated Use DSPy service directly or the adapter for backward compatibility
 */
export const createEnhancedOrchestrator = (config: EnhancedOrchestratorConfig) => {
  console.warn(
    '⚠️  EnhancedOrchestrator is deprecated. Using DSPy service adapter for backward compatibility.'
  );
  return createEnhancedOrchestratorAdapter(config);
};

export default EnhancedOrchestrator;
