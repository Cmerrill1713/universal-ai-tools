import { dspyBridge, DSPyBridge } from './dspy-orchestrator/bridge';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export interface DSPyOrchestrationRequest {
  requestId: string;
  userRequest: string;
  userId: string;
  orchestrationMode?: 'simple' | 'standard' | 'cognitive' | 'adaptive';
  context?: Record<string, any>;
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
  error?: string;
}

export class DSPyService {
  private bridge: DSPyBridge;
  private isInitialized: boolean = false;

  constructor() {
    this.bridge = dspyBridge;
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      logger.info('🚀 Initializing DSPy service...');
      
      // Wait for bridge to connect
      await this.waitForConnection();
      
      this.isInitialized = true;
      logger.info('✅ DSPy service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize DSPy service:', error);
      throw error;
    }
  }

  private async waitForConnection(timeout: number = 30000): Promise<void> {
    const startTime = Date.now();
    
    while (!this.bridge.getStatus().connected) {
      if (Date.now() - startTime > timeout) {
        throw new Error('DSPy connection timeout');
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  /**
   * Main orchestration method that replaces the old enhanced orchestrator
   */
  async orchestrate(request: DSPyOrchestrationRequest): Promise<DSPyOrchestrationResponse> {
    const startTime = Date.now();
    
    try {
      if (!this.isInitialized) {
        await this.waitForConnection();
      }

      logger.info(`🎯 DSPy orchestration for request ${request.requestId}`);

      // Call DSPy orchestrator
      const result = await this.bridge.orchestrate(request.userRequest, {
        userId: request.userId,
        mode: request.orchestrationMode,
        ...request.context
      });

      const executionTime = Date.now() - startTime;

      // Extract relevant information from DSPy result
      const response: DSPyOrchestrationResponse = {
        requestId: request.requestId,
        success: true,
        mode: result.orchestration_mode || 'standard',
        result: result.consensus || result,
        complexity: result.complexity,
        confidence: result.confidence,
        reasoning: result.coordination_plan || result.reasoning,
        participatingAgents: result.selected_agents ? 
          result.selected_agents.split(',').map((a: string) => a.trim()) : [],
        executionTime
      };

      logger.info(`✅ DSPy orchestration completed in ${executionTime}ms`);
      return response;

    } catch (error) {
      const executionTime = Date.now() - startTime;
      logger.error('DSPy orchestration failed:', error);
      
      return {
        requestId: request.requestId,
        success: false,
        mode: 'fallback',
        result: null,
        executionTime,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Coordinate multiple agents for a specific task
   */
  async coordinateAgents(
    task: string, 
    availableAgents: string[], 
    context: Record<string, any> = {}
  ): Promise<any> {
    try {
      const result = await this.bridge.coordinateAgents(task, availableAgents, context);
      
      return {
        success: true,
        selectedAgents: result.selected_agents,
        coordinationPlan: result.coordination_plan,
        assignments: result.agent_assignments || []
      };
    } catch (error) {
      logger.error('Agent coordination failed:', error);
      throw error;
    }
  }

  /**
   * Manage knowledge operations through DSPy
   */
  async manageKnowledge(operation: string, data: any): Promise<any> {
    try {
      const result = await this.bridge.manageKnowledge(operation, data);
      
      return {
        success: true,
        operation,
        result
      };
    } catch (error) {
      logger.error('Knowledge management failed:', error);
      throw error;
    }
  }

  /**
   * Search knowledge using DSPy's optimized search
   */
  async searchKnowledge(query: string, options: any = {}): Promise<any> {
    return this.manageKnowledge('search', { query, ...options });
  }

  /**
   * Extract structured knowledge from content
   */
  async extractKnowledge(content: string, context: any = {}): Promise<any> {
    return this.manageKnowledge('extract', { content, context });
  }

  /**
   * Evolve existing knowledge with new information
   */
  async evolveKnowledge(existingKnowledge: string, newInfo: string): Promise<any> {
    return this.manageKnowledge('evolve', { 
      existing_knowledge: existingKnowledge, 
      new_information: newInfo 
    });
  }

  /**
   * Optimize prompts for better performance
   */
  async optimizePrompts(examples: any[]): Promise<any> {
    try {
      const result = await this.bridge.optimizePrompts(examples);
      
      return {
        success: true,
        optimized: result.optimized,
        improvements: result.improvements,
        performanceGain: result.performance_gain
      };
    } catch (error) {
      logger.error('Prompt optimization failed:', error);
      throw error;
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
      queueSize: bridgeStatus.queueSize
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

// Export singleton instance
export const dspyService = new DSPyService();

// Export types
export type { DSPyOrchestrationRequest, DSPyOrchestrationResponse };