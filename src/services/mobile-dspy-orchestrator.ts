/**
 * Mobile-Optimized DSPy Cognitive Orchestrator
 * Optimized agent chains for iOS device integration with Universal AI Tools
 * Features battery-aware processing, network optimization, and context injection
 */

import type { DSPyRequest, DSPyResponse } from './dspy-orchestrator/bridge';
import { dspyBridge as DSPyBridgeSingleton } from './dspy-orchestrator/bridge';
import { contextInjectionService } from './context-injection-service';
import { intelligentParameterService } from './intelligent-parameter-service';
import { LogContext, log } from '../utils/logger';
import { EventEmitter } from 'events';

export interface MobileDeviceContext {
  deviceId?: string;
  deviceName?: string;
  osVersion?: string;
  appVersion?: string;
  authenticationState?: 'authenticated' | 'unauthenticated' | 'locked' | 'authenticating';
  biometricCapabilities?: string[];
  proximityState?: 'near' | 'far' | 'unknown';
  connectionType?: 'wifi' | 'cellular' | 'offline';
  batteryLevel?: number;
  isLowPowerMode?: boolean;
  locationPermission?: 'granted' | 'denied' | 'not_determined';
  cameraPermission?: 'granted' | 'denied' | 'not_determined';
  watchConnected?: boolean;
  watchBatteryLevel?: number;
  biometricConfidence?: number;
  lastAuthTime?: string;
  userId?: string;
}

export interface MobileOptimizedRequest {
  taskType: 'quick_response' | 'deep_analysis' | 'creative_task' | 'ios_development' | 'swift_coding';
  userInput: string;
  deviceContext: MobileDeviceContext;
  optimizationPreferences: {
    prioritizeBattery?: boolean;
    preferCachedResults?: boolean;
    maxProcessingTime?: number;
    qualityLevel?: 'fast' | 'balanced' | 'high';
  };
  contextEnrichment?: boolean;
}

export interface MobileAgentChainConfig {
  agents: string[];
  maxAgents?: number;
  timeoutPerAgent?: number;
  batteryOptimized?: boolean;
  networkOptimized?: boolean;
  useCache?: boolean;
}

export interface MobileOrchestrationResult {
  success: boolean;
  result: any;
  metadata: {
    agentsUsed: string[];
    totalProcessingTime: number;
    batteryOptimizations: string[];
    networkOptimizations: string[];
    confidenceScore: number;
    deviceContext: MobileDeviceContext;
    cacheHit?: boolean;
  };
  error?: string;
}

export class MobileDSPyOrchestrator extends EventEmitter {
  private dspyBridge: typeof DSPyBridgeSingleton;
  private resultCache: Map<string, { result: any; expiry: number; deviceOptimized: boolean }> = new Map();
  private readonly cacheExpiryMs = 10 * 60 * 1000; // 10 minutes
  private metrics = {
    totalRequests: 0,
    batteryOptimizedRequests: 0,
    cacheHits: 0,
    averageProcessingTime: 0,
    agentChainsExecuted: 0,
    deviceContextUsed: 0,
  };

  // Mobile-optimized agent chains
  private readonly mobileAgentChains: Record<string, MobileAgentChainConfig> = {
    quick_ios_response: {
      agents: ['intent_analyzer', 'swift_specialist', 'response_generator'],
      maxAgents: 3,
      timeoutPerAgent: 5000,
      batteryOptimized: true,
      networkOptimized: true,
      useCache: true,
    },
    ios_development_chain: {
      agents: ['planner', 'ios_architect', 'swift_developer', 'ui_specialist', 'synthesizer'],
      maxAgents: 5,
      timeoutPerAgent: 10000,
      batteryOptimized: false,
      networkOptimized: true,
      useCache: true,
    },
    device_aware_analysis: {
      agents: ['context_analyzer', 'device_optimizer', 'security_validator', 'synthesizer'],
      maxAgents: 4,
      timeoutPerAgent: 8000,
      batteryOptimized: true,
      networkOptimized: false,
      useCache: true,
    },
    battery_efficient_chain: {
      agents: ['intent_analyzer', 'response_generator'],
      maxAgents: 2,
      timeoutPerAgent: 3000,
      batteryOptimized: true,
      networkOptimized: true,
      useCache: true,
    },
    comprehensive_ios_chain: {
      agents: [
        'intent_analyzer',
        'context_enricher', 
        'ios_planner',
        'swift_architect',
        'ui_designer',
        'security_auditor',
        'performance_optimizer',
        'synthesizer'
      ],
      maxAgents: 8,
      timeoutPerAgent: 15000,
      batteryOptimized: false,
      networkOptimized: false,
      useCache: true,
    },
  };

  constructor() {
    super();
    // Use the singleton instance
    this.dspyBridge = DSPyBridgeSingleton;
  }

  /**
   * Main orchestration method - optimized for mobile devices
   */
  public async orchestrate(request: MobileOptimizedRequest): Promise<MobileOrchestrationResult> {
    const startTime = Date.now();
    this.metrics.totalRequests++;

    try {
      log.info('📱 Starting mobile-optimized DSPy orchestration', LogContext.AI, {
        taskType: request.taskType,
        deviceId: request.deviceContext.deviceId,
        batteryLevel: request.deviceContext.batteryLevel,
        isLowPowerMode: request.deviceContext.isLowPowerMode,
        connectionType: request.deviceContext.connectionType,
      });

      // Check cache first if requested
      const cacheKey = this.generateCacheKey(request);
      if (request.optimizationPreferences.preferCachedResults) {
        const cached = this.getCachedResult(cacheKey);
        if (cached) {
          this.metrics.cacheHits++;
          log.info('🔄 Returning cached mobile orchestration result', LogContext.AI);
          return {
            success: true,
            result: cached.result,
            metadata: {
              agentsUsed: ['cache'],
              totalProcessingTime: Date.now() - startTime,
              batteryOptimizations: ['cached_result'],
              networkOptimizations: ['cached_result'],
              confidenceScore: 0.9,
              deviceContext: request.deviceContext,
              cacheHit: true,
            },
          };
        }
      }

      // Select optimal agent chain based on device context and task type
      const chainConfig = this.selectOptimalChain(request);
      log.info('🔗 Selected mobile agent chain', LogContext.AI, {
        chain: chainConfig.agents.join(' → '),
        batteryOptimized: chainConfig.batteryOptimized,
        networkOptimized: chainConfig.networkOptimized,
      });

      // Apply device-specific optimizations
      const optimizedConfig = await this.applyDeviceOptimizations(chainConfig, request.deviceContext);

      // Enrich context if requested
      let enrichedInput = request.userInput;
      if (request.contextEnrichment && request.deviceContext.userId) {
        this.metrics.deviceContextUsed++;
        const contextResult = await contextInjectionService.enrichWithContext(
          request.userInput,
          {
            userId: request.deviceContext.userId,
            deviceContext: request.deviceContext,
          }
        );
        enrichedInput = contextResult.enrichedPrompt;
      }

      // Get intelligent parameters for mobile optimization
      const optimalParams = await intelligentParameterService.getTaskParameters(
        request.taskType,
        {
          deviceType: 'iOS',
          batteryLevel: request.deviceContext.batteryLevel,
          connectionType: request.deviceContext.connectionType,
          isLowPowerMode: request.deviceContext.isLowPowerMode,
        }
      );

      // Execute the mobile-optimized agent chain
      const result = await this.executeMobileChain(
        optimizedConfig,
        enrichedInput,
        request.deviceContext,
        optimalParams
      );

      // Cache the result
      if (optimizedConfig.useCache) {
        this.cacheResult(cacheKey, result, true);
      }

      const processingTime = Date.now() - startTime;
      this.updateMetrics(processingTime, request.deviceContext.isLowPowerMode || false);

      const orchestrationResult: MobileOrchestrationResult = {
        success: true,
        result: result.data,
        metadata: {
          agentsUsed: result.agentsUsed,
          totalProcessingTime: processingTime,
          batteryOptimizations: result.batteryOptimizations,
          networkOptimizations: result.networkOptimizations,
          confidenceScore: result.confidence,
          deviceContext: request.deviceContext,
        },
      };

      log.info('✅ Mobile DSPy orchestration completed', LogContext.AI, {
        processingTime,
        agentsUsed: result.agentsUsed.length,
        batteryOptimized: optimizedConfig.batteryOptimized,
        confidence: result.confidence,
      });

      return orchestrationResult;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      log.error('❌ Mobile DSPy orchestration failed', LogContext.AI, {
        error: error instanceof Error ? error.message : String(error),
        processingTime,
        taskType: request.taskType,
      });

      return {
        success: false,
        result: null,
        error: error instanceof Error ? error.message : String(error),
        metadata: {
          agentsUsed: [],
          totalProcessingTime: processingTime,
          batteryOptimizations: [],
          networkOptimizations: [],
          confidenceScore: 0,
          deviceContext: request.deviceContext,
        },
      };
    }
  }

  /**
   * Select the optimal agent chain based on device context and task type
   */
  private selectOptimalChain(request: MobileOptimizedRequest): MobileAgentChainConfig {
    const { taskType, deviceContext, optimizationPreferences } = request;

    // Battery-first optimization
    if (deviceContext.isLowPowerMode || (deviceContext.batteryLevel && deviceContext.batteryLevel < 20)) {
      log.info('🔋 Using battery-efficient chain due to low power', LogContext.AI);
      return this.mobileAgentChains.battery_efficient_chain || this.mobileAgentChains.quick_ios_response;
    }

    // Network-first optimization for cellular connections
    if (deviceContext.connectionType === 'cellular' && optimizationPreferences.prioritizeBattery) {
      return this.mobileAgentChains.quick_ios_response || this.getDefaultChain();
    }

    // Task-specific chain selection
    switch (taskType) {
      case 'quick_response':
        return this.mobileAgentChains.quick_ios_response || this.getDefaultChain();
      
      case 'ios_development':
      case 'swift_coding':
        return deviceContext.batteryLevel && deviceContext.batteryLevel > 50
          ? (this.mobileAgentChains.ios_development_chain || this.getDefaultChain())
          : (this.mobileAgentChains.quick_ios_response || this.getDefaultChain());
      
      case 'deep_analysis':
        return deviceContext.connectionType === 'wifi' && deviceContext.batteryLevel && deviceContext.batteryLevel > 30
          ? (this.mobileAgentChains.comprehensive_ios_chain || this.getDefaultChain())
          : (this.mobileAgentChains.device_aware_analysis || this.getDefaultChain());
      
      case 'creative_task':
        return this.mobileAgentChains.ios_development_chain || this.getDefaultChain();
      
      default:
        return this.mobileAgentChains.device_aware_analysis || this.getDefaultChain();
    }
  }

  /**
   * Apply device-specific optimizations to the agent chain configuration
   */
  private async applyDeviceOptimizations(
    config: MobileAgentChainConfig,
    deviceContext: MobileDeviceContext
  ): Promise<MobileAgentChainConfig> {
    const optimized = { ...config };

    // Battery optimizations
    if (deviceContext.isLowPowerMode || (deviceContext.batteryLevel && deviceContext.batteryLevel < 30)) {
      optimized.maxAgents = Math.min(optimized.maxAgents || 5, 3);
      optimized.timeoutPerAgent = Math.min(optimized.timeoutPerAgent || 10000, 5000);
      optimized.batteryOptimized = true;
    }

    // Network optimizations
    if (deviceContext.connectionType === 'cellular') {
      optimized.timeoutPerAgent = Math.min(optimized.timeoutPerAgent || 10000, 8000);
      optimized.networkOptimized = true;
      optimized.useCache = true;
    }

    // Offline mode handling
    if (deviceContext.connectionType === 'offline') {
      optimized.agents = ['local_processor']; // Fallback to local-only processing
      optimized.maxAgents = 1;
      optimized.useCache = true;
    }

    return optimized;
  }

  /**
   * Execute the mobile-optimized agent chain
   */
  private async executeMobileChain(
    config: MobileAgentChainConfig,
    input: string,
    deviceContext: MobileDeviceContext,
    parameters: any
  ): Promise<{
    data: any;
    agentsUsed: string[];
    batteryOptimizations: string[];
    networkOptimizations: string[];
    confidence: number;
  }> {
    const agentsUsed: string[] = [];
    const batteryOptimizations: string[] = [];
    const networkOptimizations: string[] = [];
    let currentInput = input;
    let confidence = 0.8;

    const maxAgents = config.maxAgents || config.agents.length;
    const agentsToRun = config.agents.slice(0, maxAgents);

    for (const agent of agentsToRun) {
      try {
        const agentRequest: DSPyRequest = {
          requestId: `mobile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          method: 'run_agent',
          params: {
            agent_name: agent,
            input: currentInput,
            device_context: deviceContext,
            parameters: {
              ...parameters,
              batteryOptimized: config.batteryOptimized,
              networkOptimized: config.networkOptimized,
              timeout: config.timeoutPerAgent,
            },
          },
          metadata: {
            mobile_optimized: true,
            battery_level: deviceContext.batteryLevel,
            connection_type: deviceContext.connectionType,
          },
        };

        const response = await this.dspyBridge.sendRequest(agentRequest);

        if (response.success && response.data) {
          agentsUsed.push(agent);
          currentInput = (response.data as any).output || currentInput;
          
          // Track optimizations applied
          if (config.batteryOptimized) {
            batteryOptimizations.push(`${agent}_battery_optimized`);
          }
          if (config.networkOptimized) {
            networkOptimizations.push(`${agent}_network_optimized`);
          }

          // Update confidence based on agent success
          confidence = Math.min(1.0, confidence + 0.05);
        }

      } catch (error) {
        log.warn(`⚠️ Mobile agent ${agent} failed, continuing chain`, LogContext.AI, {
          error: error instanceof Error ? error.message : String(error),
        });
        
        // Reduce confidence on agent failure
        confidence = Math.max(0.1, confidence - 0.1);
      }
    }

    return {
      data: {
        result: currentInput,
        chain_complete: true,
        mobile_optimized: true,
      },
      agentsUsed,
      batteryOptimizations,
      networkOptimizations,
      confidence,
    };
  }

  /**
   * Cache management for mobile optimization
   */
  private generateCacheKey(request: MobileOptimizedRequest): string {
    const keyParts = [
      request.taskType,
      request.userInput.substring(0, 100),
      request.deviceContext.deviceId || 'unknown',
      request.optimizationPreferences.qualityLevel || 'balanced',
    ];
    return Buffer.from(keyParts.join('|')).toString('base64');
  }

  private getCachedResult(cacheKey: string): { result: any; deviceOptimized: boolean } | null {
    const cached = this.resultCache.get(cacheKey);
    if (cached && Date.now() < cached.expiry) {
      return cached;
    }
    this.resultCache.delete(cacheKey);
    return null;
  }

  private cacheResult(cacheKey: string, result: any, deviceOptimized: boolean): void {
    // LRU cache management
    if (this.resultCache.size >= 100) {
      const firstKey = this.resultCache.keys().next().value;
      if (firstKey !== undefined) {
        this.resultCache.delete(firstKey);
      }
    }
    
    this.resultCache.set(cacheKey, {
      result,
      expiry: Date.now() + this.cacheExpiryMs,
      deviceOptimized,
    });
  }

  /**
   * Update metrics for mobile optimization tracking
   */
  private updateMetrics(processingTime: number, batteryOptimized: boolean): void {
    if (batteryOptimized) {
      this.metrics.batteryOptimizedRequests++;
    }

    // Exponential moving average for processing time
    const alpha = 0.1;
    this.metrics.averageProcessingTime =
      alpha * processingTime + (1 - alpha) * this.metrics.averageProcessingTime;

    this.metrics.agentChainsExecuted++;
  }

  /**
   * Get mobile orchestration metrics
   */
  public getMetrics() {
    return {
      ...this.metrics,
      cacheHitRate: this.metrics.totalRequests > 0 
        ? this.metrics.cacheHits / this.metrics.totalRequests 
        : 0,
      batteryOptimizationRate: this.metrics.totalRequests > 0
        ? this.metrics.batteryOptimizedRequests / this.metrics.totalRequests
        : 0,
      deviceContextUsageRate: this.metrics.totalRequests > 0
        ? this.metrics.deviceContextUsed / this.metrics.totalRequests
        : 0,
    };
  }

  /**
   * Clear cache and reset metrics (useful for testing)
   */
  public reset(): void {
    this.resultCache.clear();
    this.metrics = {
      totalRequests: 0,
      batteryOptimizedRequests: 0,
      cacheHits: 0,
      averageProcessingTime: 0,
      agentChainsExecuted: 0,
      deviceContextUsed: 0,
    };
  }

  /**
   * Get default fallback chain configuration
   */
  private getDefaultChain(): MobileAgentChainConfig {
    return {
      agents: ['user_intent', 'synthesis', 'execution'],
      maxAgents: 3,
      timeoutPerAgent: 10000,
      batteryOptimized: true,
      networkOptimized: false,
      useCache: true,
    };
  }

  /**
   * Shutdown the mobile orchestrator
   */
  public async shutdown(): Promise<void> {
    log.info('🛑 Shutting down mobile DSPy orchestrator', LogContext.AI);
    this.resultCache.clear();
    await this.dspyBridge.shutdown();
  }
}

// Create singleton instance
export const mobileDSPyOrchestrator = new MobileDSPyOrchestrator();
export default mobileDSPyOrchestrator;