import type { DSPyBridge } from './dspy-orchestrator/bridge';
import { dspyBridge } from './dspy-orchestrator/bridge';
import { LogContext, logger } from '../utils/enhanced-logger';
import { v4 as uuidv4 } from 'uuid';
import { BATCH_SIZE_10, HTTP_200, HTTP_400, HTTP_401, HTTP_404, HTTP_500, MAX_ITEMS_100, PERCENT_10, PERCENT_100, PERCENT_20, PERCENT_30, PERCENT_50, PERCENT_80, PERCENT_90, TIME_10000MS, TIME_1000MS, TIME_2000MS, TIME_5000MS, TIME_500MS, ZERO_POINT_EIGHT, ZERO_POINT_FIVE, ZERO_POINT_NINE } from "../utils/common-constants";

export interface DSPyOrchestrationRequest {
  requestId: string;
  userRequest: string;
  userId: string;
  orchestrationMode?: 'simple' | 'standard' | 'cognitive' | 'adaptive';
  context?: Record<string, unknown>;
  timestamp: Date;
}

export interface DSPyOrchestrationResponse {
  requestId: string;
  success: boolean;
  mode: string;
  result: any;
  complexity?: number;
  confidence?: number;
  reasoning?: string;
  participatingAgents?: string[];
  executionTime: number;
  _error: string;
}

export class DSPyService {
  private bridge: DSPyBridge;
  private isInitialized = false;

  constructor() {
    this.bridge = dspyBridge;
    // Don't block on initialization - let it happen in the background
    this.initialize().catch((_error => {
      logger.error'DSPy service initialization failed:', LogContext.DSPY, {
        _error _errorinstanceof Error ? _errormessage : String(_error,
      });
    });
  }

  private async initialize(): Promise<void> {
    try {
      logger.info('🚀 Initializing DSPy service...');

      // Wait for bridge to connect (with short timeout to not block server startup)
      if (process.env.ENABLE_DSPY_MOCK === 'true') {
        await this.waitForConnection(5000);
      } else {
        logger.info('DSPy mock disabled - skipping connection wait');
      }

      this.isInitialized = true;
      logger.info('✅ DSPy service initialized successfully');
    } catch (_error) {
      logger.warn(
        'DSPy service initialization failed (will retry on first use)',
        LogContext.SYSTEM,
        { _error _errorinstanceof Error ? _errormessage : String(_error }
      );
      // Don't throw - let server continue without DSPy
      this.isInitialized = false;
    }
  }

  private async waitForConnection(timeout = 30000): Promise<void> {
    const startTime = Date.now();

    while (!this.bridge.getStatus().connected) {
      if (Date.now() - startTime > timeout) {
        throw new Error('DSPy connection timeout');
      }
      await new Promise((resolve) => setTimeout(TIME_1000MS));
    }
  }

  /**
   * Main orchestration method that replaces the old enhanced orchestrator
   */
  async orchestrate(_request DSPyOrchestrationRequest): Promise<DSPyOrchestrationResponse> {
    const startTime = Date.now();

    try {
      if (!this.isInitialized) {
        await this.waitForConnection();
      }

      logger.info(`🎯 DSPy orchestration for _request${_requestrequestId}`);

      // Call DSPy orchestrator
      const result = await this.bridge.orchestrate(_requestuserRequest, {
        userId: _requestuserId,
        mode: _requestorchestrationMode,
        ..._requestcontext,
      });

      const executionTime = Date.now() - startTime;

      // Extract relevant information from DSPy result
      const response: DSPyOrchestrationResponse = {
        requestId: _requestrequestId,
        success: true,
        mode: result.orchestration_mode || 'standard',
        result: result.consensus || result,
        complexity: result.complexity,
        confidence: result.confidence,
        reasoning: result.coordination_plan || result.reasoning,
        participatingAgents: result.selected_agents
          ? result.selected_agents.split(',').map((a: string) => a.trim())
          : [],
        executionTime,
      };

      logger.info(`✅ DSPy orchestration completed in ${executionTime}ms`);
      return response;
    } catch (_error) {
      const executionTime = Date.now() - startTime;
      logger.error'DSPy orchestration failed:', LogContext.DSPY, {
        _error _errorinstanceof Error ? _errormessage : String(_error,
      });

      return {
        requestId: _requestrequestId,
        success: false,
        mode: 'fallback',
        result: null,
        executionTime,
        _error _errorinstanceof Error ? _errormessage : String(_error,
      };
    }
  }

  /**
   * Coordinate multiple agents for a specific task
   */
  async coordinateAgents(
    task: string,
    availableAgents: string[],
    context: Record<string, unknown> = {}
  ): Promise<unknown> {
    try {
      const result = await this.bridge.coordinateAgents(task, availableAgents, context);

      return {
        success: true,
        selectedAgents: result.selected_agents,
        coordinationPlan: result.coordination_plan,
        assignments: result.agent_assignments || [],
      };
    } catch (_error) {
      logger.error'Agent coordination failed:', LogContext.DSPY, {
        _error _errorinstanceof Error ? _errormessage : String(_error,
      });
      throw _error;
    }
  }

  /**
   * Generic _requestmethod for DSPy operations
   */
  async _requestoperation: string, params: any = {}): Promise<unknown> {
    try {
      switch (operation) {
        case 'manage_knowledge':
        case 'optimize_knowledge_modules':
        case 'get_optimization_metrics':
          return await this.manageKnowledge(operation, params);

        case 'orchestrate':
          return await this.orchestrate({
            requestId: params.requestId || uuidv4(),
            userRequest: params.userRequest || '',
            userId: params.userId || 'system',
            orchestrationMode: params.mode,
            context: params,
            timestamp: new Date(),
          });

        case 'coordinate_agents':
          return await this.coordinateAgents(
            params.task || '',
            params.availableAgents || [],
            params.context || {}
          );

        default:
          // For unknown operations, try to pass through to DSPy bridge
          if (this.bridge && typeof (this.bridge as any)[operation] === 'function') {
            return await (this.bridge as any)[operation](params);
          }
          throw new Error(`Unknown DSPy operation: ${operation}`);
      }
    } catch (_error) {
      logger.error`DSPy _requestfailed for operation ${operation}:`, LogContext.DSPY, {
        _error _errorinstanceof Error ? _errormessage : String(_error,
      });
      return {
        success: false,
        _error _errorinstanceof Error ? _errormessage : String(_error,
      };
    }
  }

  /**
   * Manage knowledge operations through DSPy
   */
  async manageKnowledge(operation: string, data: any): Promise<unknown> {
    try {
      const result = await this.bridge.manageKnowledge(operation, data);

      return {
        success: true,
        operation,
        result,
      };
    } catch (_error) {
      logger.error'Knowledge management failed:', LogContext.DSPY, {
        _error _errorinstanceof Error ? _errormessage : String(_error,
      });
      throw _error;
    }
  }

  /**
   * Search knowledge using DSPy's optimized search
   */
  async searchKnowledge(query: string, options: any = {}): Promise<unknown> {
    return this.manageKnowledge('search', { query, ...options });
  }

  /**
   * Extract structured knowledge from content
   */
  async extractKnowledge(_content string, context: any = {}): Promise<unknown> {
    return this.manageKnowledge('extract', { _content context });
  }

  /**
   * Evolve existing knowledge with new information
   */
  async evolveKnowledge(existingKnowledge: string, newInfo: string): Promise<unknown> {
    return this.manageKnowledge('evolve', {
      existing_knowledge: existingKnowledge,
      new_information: newInfo,
    });
  }

  /**
   * Optimize prompts for better performance
   */
  async optimizePrompts(examples: any[]): Promise<unknown> {
    try {
      const result = await this.bridge.optimizePrompts(examples);

      return {
        success: true,
        optimized: result.optimized,
        improvements: result.improvements,
        performanceGain: result.performance_gain,
      };
    } catch (_error) {
      logger.error'Prompt optimization failed:', LogContext.DSPY, {
        _error _errorinstanceof Error ? _errormessage : String(_error,
      });
      throw _error;
    }
  }

  /**
   * Get service status
   */
  getStatus(): { initialized: boolean; connected: boolean; queueSize: number } {
    const bridgeStatus = this.bridge.getStatus();

    return {
      initialized: this.isInitialized,
      connected: bridgeStatus.connected,
      queueSize: bridgeStatus.queueSize,
    };
  }

  /**
   * Shutdown the service gracefully
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down DSPy service...');
    await this.bridge.shutdown();
    this.isInitialized = false;
  }
}

// Lazy initialization to prevent blocking during import
let _dspyService: DSPyService | null = null;

export function getDSPyService(): DSPyService {
  if (!_dspyService) {
    _dspyService = new DSPyService();
  }
  return _dspyService;
}

// For backward compatibility (but prefer using getDSPyService())
export const dspyService = {
  orchestrate: async (_request DSPyOrchestrationRequest) => getDSPyService().orchestrate(_request,
  coordinateAgents: async (
    task: string,
    availableAgents: string[],
    context: Record<string, unknown> = {}
  ) => getDSPyService().coordinateAgents(task, availableAgents, context),
  searchKnowledge: async (query: string, options: any = {}) =>
    getDSPyService().searchKnowledge(query, options),
  extractKnowledge: async (_content string, context: any = {}) =>
    getDSPyService().extractKnowledge(_content context),
  evolveKnowledge: async (existingKnowledge: string, newInfo: string) =>
    getDSPyService().evolveKnowledge(existingKnowledge, newInfo),
  optimizePrompts: async (examples: any[]) => getDSPyService().optimizePrompts(examples),
  _request async (operation: string, params: any = {}) =>
    getDSPyService()._requestoperation, params),
  manageKnowledge: async (operation: string, data: any) =>
    getDSPyService().manageKnowledge(operation, data),
  getStatus: () => getDSPyService().getStatus(),
  shutdown: async () => getDSPyService().shutdown(),
};

// Types are already exported above
