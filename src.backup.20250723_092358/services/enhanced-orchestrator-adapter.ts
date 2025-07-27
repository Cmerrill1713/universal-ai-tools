/**
 * Enhanced Orchestrator Adapter
 *
 * This adapter provides backward compatibility by mapping the old
 * EnhancedOrchestrator interface to the new DSPy service.
 */

import { EventEmitter } from 'events';
import type { DSPyOrchestrationRequest } from './dspy-service';
import { dspyService } from './dspy-service';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { BATCH_SIZE_10, HTTP_200, HTTP_400, HTTP_401, HTTP_404, HTTP_500, MAX_ITEMS_100, PERCENT_10, PERCENT_100, PERCENT_20, PERCENT_30, PERCENT_50, PERCENT_80, PERCENT_90, TIME_10000MS, TIME_1000MS, TIME_2000MS, TIME_5000MS, TIME_500MS, ZERO_POINT_EIGHT, ZERO_POINT_FIVE, ZERO_POINT_NINE } from "../utils/common-constants";

export interface EnhancedOrchestratorConfig {
  supabaseUrl: string;
  supabaseKey: string;
  redisUrl?: string;
  enableMLX?: boolean;
  enableAdaptiveTools?: boolean;
  enableCaching?: boolean;
  enableContinuousLearning?: boolean;
  enableCognitiveOrchestration?: boolean;
  targetLatencyMs?: number;
  consensusThreshold?: number;
  riskTolerance?: 'low' | 'medium' | 'high';
  maxConcurrentAgents?: number;
  enableFaultTolerance?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  circuitBreakerThreshold?: number;
  degradationStrategy?: 'graceful' | 'minimal' | 'fallback';
}

export interface EnhancedRequest {
  requestId: string;
  userRequest: string;
  userId: string;
  conversationId?: string;
  sessionId?: string;
  context?: any;
  preferredModel?: string;
  orchestrationMode?: 'standard' | 'cognitive' | 'adaptive';
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
  orchestrationMode: string;
  participatingAgents: string[];
  consensusReached?: boolean;
  mlxOptimized?: boolean;
  cacheHit?: boolean;
  nextActions?: string[];
  metadata?: {
    orchestration?: any;
    performance?: any;
    learning?: any;
  };
}

/**
 * Adapter class that mimics the EnhancedOrchestrator interface
 * but uses DSPy service internally
 */
export class EnhancedOrchestratorAdapter extends EventEmitter {
  private config: EnhancedOrchestratorConfig;
  private isInitialized = false;

  constructor(config: EnhancedOrchestratorConfig) {
    super();
    this.config = config;
    logger.info('Enhanced Orchestrator Adapter created - using DSPy service backend');
  }

  /**
   * Initialize the adapter
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    logger.info('🚀 Initializing Enhanced Orchestrator Adapter...');

    try {
      // Wait for DSPy service to be ready
      const maxAttempts = 10;
      let attempts = 0;

      while (attempts < maxAttempts) {
        const status = dspyService.getStatus();
        if (status.initialized && status.connected) {
          break;
        }
        attempts++;
        await new Promise((resolve) => setTimeout(TIME_1000MS));
      }

      const finalStatus = dspyService.getStatus();
      if (!finalStatus.initialized || !finalStatus.connected) {
        throw new Error('DSPy service failed to initialize');
      }

      this.isInitialized = true;
      logger.info('✅ Enhanced Orchestrator Adapter initialized successfully');
      this.emit('orchestrator_ready');
    } catch (error) {
      logger.error('❌ Failed to initialize Enhanced Orchestrator Adapter:', error);
      throw error;
    }
  }

  /**
   * Process requestusing DSPy service
   */
  async processRequest(request EnhancedRequest): Promise<EnhancedResponse> {
    const startTime = Date.now();

    if (!this.isInitialized) {
      throw new Error('Orchestrator not initialized. Call initialize() first.');
    }

    logger.info(`🎯 Processing requestvia adapter: ${requestrequestId}`);
    this.emit('request_started', request;

    try {
      // Map orchestration mode
      let dspyMode: 'simple' | 'standard' | 'cognitive' | 'adaptive' = 'standard';
      if (requestorchestrationMode === 'cognitive') {
        dspyMode = 'cognitive';
      } else if (requestorchestrationMode === 'adaptive') {
        dspyMode = 'adaptive';
      }

      // Create DSPy request
      const dspyRequest: DSPyOrchestrationRequest = {
        requestId: requestrequestId,
        userRequest: requestuserRequest,
        userId: requestuserId,
        orchestrationMode: dspyMode,
        context: {
          ...requestcontext,
          conversationId: requestconversationId,
          sessionId: requestsessionId,
          preferredModel: requestpreferredModel,
        },
        timestamp: requesttimestamp,
      };

      // Execute through DSPy service
      const dspyResponse = await dspyService.orchestrate(dspyRequest);

      // Map response back to EnhancedResponse format
      const response: EnhancedResponse = {
        requestId: dspyResponse.requestId,
        success: dspyResponse.success,
        data: dspyResponse.result,
        confidence: dspyResponse.confidence || 0.8,
        reasoning: dspyResponse.reasoning || 'Processed via DSPy orchestration',
        latencyMs: dspyResponse.executionTime,
        agentId: 'dspy-orchestrator',
        orchestrationMode: dspyResponse.mode,
        participatingAgents: dspyResponse.participatingAgents || [],
        consensusReached: true,
        mlxOptimized: requestpreferredModel !== undefined,
        cacheHit: false,
        errorMessage: dspyResponse._error
        metadata: {
          orchestration: {
            dspyMode: dspyResponse.mode,
            complexity: dspyResponse.complexity,
          },
          performance: {
            executionTime: dspyResponse.executionTime,
          },
        },
      };

      this.emit('request_completed', response);
      return response;
    } catch (error) {
      const latency = Date.now() - startTime;
      logger.error(❌ Request ${requestrequestId} failed:`, error);

      const errorResponse: EnhancedResponse = {
        requestId: requestrequestId,
        success: false,
        data: null,
        confidence: 0,
        reasoning: 'Request failed',
        latencyMs: latency,
        agentId: 'dspy-orchestrator',
        orchestrationMode: 'fallback',
        participatingAgents: [],
        errorMessage: error instanceof Error ? error.message : String(_error,
      };

      this.emit('request_failed', {
        requestId: requestrequestId,
        _error errorResponse.errorMessage,
        latency,
      });

      return errorResponse;
    }
  }

  /**
   * Get orchestrator status
   */
  getStatus(): any {
    const dspyStatus = dspyService.getStatus();

    return {
      isInitialized: this.isInitialized,
      config: this.config,
      dspyServiceStatus: dspyStatus,
      isHealthy: dspyStatus.initialized && dspyStatus.connected,
    };
  }

  /**
   * Shutdown the adapter
   */
  async shutdown(): Promise<void> {
    logger.info('🎯 Enhanced Orchestrator Adapter shutting down...');
    this.removeAllListeners();
    this.isInitialized = false;
    this.emit('orchestrator_shutdown');
  }
}

/**
 * Factory function to create an adapter instance
 */
export function createEnhancedOrchestratorAdapter(
  config: EnhancedOrchestratorConfig
): EnhancedOrchestratorAdapter {
  return new EnhancedOrchestratorAdapter(config);
}

export default EnhancedOrchestratorAdapter;
