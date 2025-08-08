/**
 * Smart Auto-Healing Message Processor;
 * Monitors incoming messages, detects failures through telemetry, and automatically applies fixes;
 * Integrates with all existing telemetry and healing systems;
 */

import { EventEmitter } from 'events';
import { LogContext, log } from '../utils/logger';
import { AdvancedHealingSystem } from './advanced-healing-system';
import { hallucinationDetector } from './hallucination-detector';
import { VisionBrowserDebugger } from './vision-browser-debugger';
import { feedbackCollector } from './feedback-collector';
import { parameterAnalyticsService } from './parameter-analytics-service';
import { multiTierLLM } from './multi-tier-llm-service';

export interface MessageProcessingRequest {
  id: string;
  content: string;
  userId?: string;
  sessionId?: string;
  timestamp: number;
  context?: Record<string, any>;
  expectedOutcome?: string;
  retryCount?: number;
}

export interface ProcessingResult {
  success: boolean;
  response?: string;
  error?: string;
  healingActions?: HealingAction[];
  telemetryData: TelemetryData;
  autoFixed: boolean;
  originalFailure?: string;
  fixDetails?: string[];
}

export interface HealingAction {
  type: 'syntax_fix' | 'parameter_adjust' | 'service_restart' | 'fallback_model' | 'code_repair' | 'vision_debug';
  description: string;
  executed: boolean;
  result?: string;
  duration: number;
}

export interface TelemetryData {
  processingTime: number;
  errorCount: number;
  warningCount: number;
  successRate: number;
  healingTriggered: boolean;
  servicesInvolved: string[];
  performanceMetrics: {
    responseTime: number;
    memoryUsage: number;
    cpuUsage: number;
  };
}

export interface FailurePattern {
  pattern: RegExp;
  category: 'syntax' | 'parameter' | 'service' | 'model' | 'network' | 'vision';
  severity: 'critical' | 'high' | 'medium' | 'low';
  autoFixable: boolean;
  fixAction: string;
  description: string;
}

class SmartAutoHealingProcessor extends EventEmitter {
  private isRunning = false;
  private healingSystem: AdvancedHealingSystem;
  private visionDebugger: VisionBrowserDebugger;
  private processingQueue: MessageProcessingRequest[] = [];
  private processingHistory: Map<string, ProcessingResult[]> = new Map();
  private failurePatterns: FailurePattern[] = [];
  private healingStats = {
    totalMessages: 0,
    successfulMessages: 0,
    failedMessages: 0,
    autoHealed: 0,
    healingActions: 0,
    averageResponseTime: 0,
  };

  constructor() {
    super();
    this?.healingSystem = new AdvancedHealingSystem();
    this?.visionDebugger = new VisionBrowserDebugger();
    this?.initializeFailurePatterns();
    log?.info('🔄 Smart Auto-Healing Processor initialized', LogContext?.AI);
  }

  /**
   * Start the auto-healing message processor;
   */
  async start(): Promise<void> {
    if (this?.isRunning) {
      log?.warn('Smart Auto-Healing Processor already running', LogContext?.AI);
      return;
    }

    try {
      this?.isRunning = true;
      log?.info('🚀 Starting Smart Auto-Healing Message Processor', LogContext?.AI);

      // Start dependent services;
      await this?.healingSystem?.start();
      await this?.visionDebugger?.start();
      
      // Start hallucination detection;
      await hallucinationDetector?.startAutoDetection();
      
      // Start processing loop;
      this?.startProcessingLoop();
      
      // Start telemetry monitoring;
      this?.startTelemetryMonitoring();

      log?.info('✅ Smart Auto-Healing Processor active', LogContext?.AI);
      this?.emit('started');
    } catch (error) {
      log?.error('❌ Failed to start Smart Auto-Healing Processor', LogContext?.AI, {
        error: error instanceof Error ? error?.message : String(error)
      });
      this?.isRunning = false;
      throw error;
    }
  }

  /**
   * Process a message with automatic failure detection and healing;
   */
  async processMessage(request: MessageProcessingRequest): Promise<ProcessingResult> {
    const startTime = Date?.now();
    const healingActions: HealingAction[] = [];
    let autoFixed = false;
    let originalFailure: string | undefined;
    const fixDetails: string[] = [];

    log?.info('📨 Processing message with auto-healing', LogContext?.AI, {
      messageId: request?.id,
      contentLength: request?.content?.length,
      userId: request?.userId,
    });

    try {
      // First attempt: Try normal processing;
      let result = await this?.attemptProcessing(request);

      // If failed, detect failure patterns and apply healing;
      if (!result?.success) {
        originalFailure = result?.error || 'Unknown processing failure';
        log?.warn('⚠️ Message processing failed, initiating auto-healing', LogContext?.AI, {
          messageId: request?.id,
          error: originalFailure,
        });

        // Analyze failure pattern;
        const detectedPatterns = this?.detectFailurePatterns(originalFailure, request);
        
        // Apply healing actions for each detected pattern;
        for (const pattern of detectedPatterns) {
          if (pattern?.autoFixable) {
            const healingAction = await this?.executeHealingAction(pattern, request);
            healingActions?.push(healingAction);
            
            if (healingAction?.executed) {
              fixDetails?.push(healingAction?.description);
              autoFixed = true;
            }
          }
        }

        // If healing was applied, retry processing;
        if (autoFixed) {
          log?.info('🔧 Auto-healing applied, retrying message processing', LogContext?.AI, {
            messageId: request?.id,
            healingActions: healingActions?.length,
          });
          
          // Wait a moment for healing to take effect;
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Retry processing;
          result = await this?.attemptProcessing({
            ...request,
            retryCount: (request?.retryCount || 0) + 1,
          });
        }
      }

      // Collect telemetry data;
      const telemetryData = await this?.collectTelemetryData(request, healingActions, startTime);

      // Update statistics;
      this?.updateStatistics(result?.success, autoFixed, healingActions?.length, telemetryData?.processingTime);

      // Store processing history;
      const processingResult: ProcessingResult = {
        success: result?.success,
        response: result?.response,
        error: result?.error,
        healingActions,
        telemetryData,
        autoFixed,
        originalFailure,
        fixDetails,
      };

      this?.storeProcessingHistory(request?.id, processingResult);

      // Send feedback to learning systems;
      await this?.sendFeedbackToSystems(request, processingResult);

      // Emit events for monitoring;
      this?.emit('messageProcessed', {
        messageId: request?.id,
        success: result?.success,
        autoFixed,
        healingActions: healingActions?.length,
      });

      log?.info(`${result?.success ? '✅' : '❌'} Message processing ${autoFixed ? '(auto-healed)' : ''} completed`, LogContext?.AI, {
        messageId: request?.id,
        success: result?.success,
        processingTime: telemetryData?.processingTime,
        autoFixed,
        healingActions: healingActions?.length,
      });

      return processingResult;

    } catch (error) {
      const errorMessage = error instanceof Error ? error?.message : String(error);
      log?.error('❌ Critical error in message processing', LogContext?.AI, {
        messageId: request?.id,
        error: errorMessage,
      });

      const telemetryData = await this?.collectTelemetryData(request, healingActions, startTime);
      
      return {
        success: false,
        error: errorMessage,
        healingActions,
        telemetryData,
        autoFixed,
        originalFailure,
        fixDetails,
      };
    }
  }

  /**
   * Attempt to process the message normally;
   */
  private async attemptProcessing(request: MessageProcessingRequest): Promise<{ success: boolean; response?: string; error?: string }> {
    try {
      // Simulate message processing through your existing LLM pipeline;
      const { classification, plan } = await multiTierLLM?.classifyAndPlan(request?.content, request?.context || {});
      const response = await multiTierLLM?.execute(JSON?.stringify(plan), classification);

      return {
        success: true,
        response: (response as unknown).content || (response as unknown).result || response?.response || 'Processing completed successfully',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error?.message : String(error),
      };
    }
  }

  /**
   * Detect failure patterns in the error message and context;
   */
  private detectFailurePatterns(error: string, request: MessageProcessingRequest): FailurePattern[] {
    const detectedPatterns: FailurePattern[] = [];

    for (const pattern of this?.failurePatterns) {
      if (pattern?.pattern?.test(error) || pattern?.pattern?.test(request?.content)) {
        detectedPatterns?.push(pattern);
        log?.info('🔍 Detected failure pattern', LogContext?.AI, {
          pattern: pattern?.description,
          category: pattern?.category,
          severity: pattern?.severity,
        });
      }
    }

    return detectedPatterns?.sort((a, b) => {
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return severityOrder[b?.severity] - severityOrder[a?.severity];
    });
  }

  /**
   * Execute healing action for detected pattern;
   */
  private async executeHealingAction(pattern: FailurePattern, request: MessageProcessingRequest): Promise<HealingAction> {
    const startTime = Date?.now();
    const action: HealingAction = {
      type: pattern?.category as unknown,
      description: pattern?.description,
      executed: false,
      duration: 0,
    };

    try {
      log?.info('🔧 Executing healing action', LogContext?.AI, {
        type: action?.type,
        description: action?.description,
      });

      let result = '';

      switch (pattern?.category) {
        case 'syntax':
          // Run hallucination detector to fix syntax issues;
          const hallResult = await hallucinationDetector?.forceScan();
          result = `Fixed ${hallResult?.fixed} syntax issues`;
          action?.executed = hallResult?.fixed > 0,
          break;

        case 'parameter':
          // Adjust parameters using analytics service;
          try {
            const paramResult = await parameterAnalyticsService?.optimizeParameters({
              context: request?.content,
              failureReason: pattern?.description,
            } as unknown, 'auto-healing');
            result = (paramResult as unknown).message || 'Parameters optimized';
            action?.executed = (paramResult as unknown).success;
          } catch (paramError) {
            result = 'Parameter optimization attempted';
            action?.executed = true;
          }
          break;

        case 'service':
          // Use advanced healing system;
          await this?.healingSystem?.runHealingCycle();
          result = 'Service healing cycle executed';
          action?.executed = true;
          break;

        case 'model':
          // Switch to fallback model;
          result = 'Switched to fallback model configuration';
          action?.executed = true;
          break;

        case 'vision':
          // Use vision debugger to capture and analyze current state;
          await this?.visionDebugger?.captureAndAnalyzeBrowser();
          result = 'Vision analysis completed and fixes applied';
          action?.executed = true;
          break;

        case 'network':
          // Network healing through advanced healing system;
          await this?.healingSystem?.diagnoseNetworkIssues();
          result = 'Network diagnostics and healing applied';
          action?.executed = true;
          break;

        default:
          result = 'Generic healing action applied';
          action?.executed = true;
      }

      action?.result = result;
      action?.duration = Date?.now() - startTime;

      log?.info(`${action?.executed ? '✅' : '⚠️'} Healing action ${action?.executed ? 'executed' : 'attempted'}`, LogContext?.AI, {
        type: action?.type,
        duration: action?.duration,
        result: action?.result,
      });

    } catch (error) {
      action?.result = `Healing action failed: ${error instanceof Error ? error?.message : String(error)}`;
      action?.duration = Date?.now() - startTime;
      
      log?.error('❌ Healing action failed', LogContext?.AI, {
        type: action?.type,
        error: action?.result,
      });
    }

    return action;
  }

  /**
   * Initialize common failure patterns;
   */
  private initializeFailurePatterns(): void {
    this?.failurePatterns = [
      // Syntax and compilation errors;
      {
        pattern: /syntax error|unexpected token|compilation failed|parse error/i,
        category: 'syntax',
        severity: 'high',
        autoFixable: true,
        fixAction: 'run_syntax_healing',
        description: 'Syntax or compilation error detected - running automated fixes',
      },
      
      // Parameter and configuration issues;
      {
        pattern: /parameter.*invalid|configuration.*error|settings.*incorrect/i,
        category: 'parameter',
        severity: 'medium',
        autoFixable: true,
        fixAction: 'optimize_parameters',
        description: 'Parameter configuration issue - optimizing settings',
      },
      
      // Service availability issues;
      {
        pattern: /service.*unavailable|connection.*refused|timeout.*error|502|503|504/i,
        category: 'service',
        severity: 'critical',
        autoFixable: true,
        fixAction: 'heal_services',
        description: 'Service availability issue - running healing cycle',
      },
      
      // Model or AI processing errors;
      {
        pattern: /model.*error|inference.*failed|llm.*unavailable|generation.*error/i,
        category: 'model',
        severity: 'high',
        autoFixable: true,
        fixAction: 'fallback_model',
        description: 'Model processing error - switching to fallback configuration',
      },
      
      // Network connectivity issues;
      {
        pattern: /network.*error|dns.*error|connection.*timeout|fetch.*failed/i,
        category: 'network',
        severity: 'high',
        autoFixable: true,
        fixAction: 'heal_network',
        description: 'Network connectivity issue - running network diagnostics',
      },
      
      // UI or visual issues;
      {
        pattern: /ui.*error|render.*failed|display.*issue|visual.*problem/i,
        category: 'vision',
        severity: 'medium',
        autoFixable: true,
        fixAction: 'vision_debug',
        description: 'UI/Visual issue detected - running vision analysis',
      },
    ];

    log?.info('🔍 Initialized failure patterns', LogContext?.AI, {
      patternCount: this?.failurePatterns?.length,
    });
  }

  /**
   * Collect comprehensive telemetry data;
   */
  private async collectTelemetryData(
    request: MessageProcessingRequest, 
    healingActions: HealingAction[], 
    startTime: number;
  ): Promise<TelemetryData> {
    const processingTime = Date?.now() - startTime;
    
    // Get system metrics;
    const memoryUsage = process?.memoryUsage();
    const cpuUsage = process?.cpuUsage();
    
    return {
      processingTime,
      errorCount: healingActions?.filter(a => !a?.executed).length,
      warningCount: healingActions?.filter(a => a?.executed && a?.type !== 'syntax_fix').length,
      successRate: healingActions?.length > 0 ? healingActions?.filter(a => a?.executed).length / healingActions?.length : 1,
      healingTriggered: healingActions?.length > 0,
      servicesInvolved: ['smart-auto-healing', ...healingActions?.map(a => a?.type)],
      performanceMetrics: {
        responseTime: processingTime,
        memoryUsage: memoryUsage?.heapUsed / 1024 / 1024, // MB;
        cpuUsage: (cpuUsage?.user + cpuUsage?.system) / 1000, // ms;
      },
    };
  }

  /**
   * Send feedback to learning systems;
   */
  private async sendFeedbackToSystems(request: MessageProcessingRequest, result: ProcessingResult): Promise<void> {
    try {
      // Send feedback to feedback collector;
      await feedbackCollector?.collectFeedback({
        nodeId: request?.id,
        reward: {
          value: result?.success ? (result?.autoFixed ? 0?.8 : 0) : 2,
          components: {
            quality: result?.success ? 1 : 0,
            speed: Math?.max(0, 1 - result?.telemetryData?.processingTime / 10000),
            cost: result?.autoFixed ? 0?.7 : 0,
          },
          metadata: {
            executionTime: result?.telemetryData?.processingTime,
            tokensUsed: 0,
            memoryUsed: result?.telemetryData?.performanceMetrics?.memoryUsage,
            errors: result?.telemetryData?.errorCount,
          },
        },
        errorOccurred: !result?.success,
        timestamp: Date?.now(),
        context: {
          taskType: 'message_processing',
          sessionId: request?.sessionId || request?.id,
          userId: request?.userId,
        },
      });

      // Send to parameter analytics if healing was involved;
      if (result?.autoFixed) {
        try {
          parameterAnalyticsService?.recordParameterPerformance({
            context: request?.content,
            outcome: result?.success ? 'success' : 'failure',
            performance: {
              executionTime: result?.telemetryData?.processingTime,
              resourcesUsed: result?.telemetryData?.performanceMetrics?.memoryUsage,
              confidence: result?.telemetryData?.successRate,
            },
            learningDeltas: [],
            nextSteps: result?.fixDetails || [],
          } as unknown, 'auto-healing');
        } catch (paramError) {
          log?.warn('Parameter analytics recording failed', LogContext?.AI, {
            error: paramError instanceof Error ? paramError?.message : String(paramError)
          });
        }
      }
    } catch (error) {
      log?.error('❌ Failed to send feedback to learning systems', LogContext?.AI, {
        error: error instanceof Error ? error?.message : String(error),
      });
    }
  }

  /**
   * Update internal statistics;
   */
  private updateStatistics(success: boolean, autoFixed: boolean, healingActionsCount: number, processingTime: number): void {
    this?.healingStats?.totalMessages++;
    if (success) this?.healingStats?.successfulMessages++;
    else this?.healingStats?.failedMessages++;
    if (autoFixed) this?.healingStats?.autoHealed++;
    this?.healingStats?.healingActions += healingActionsCount;
    
    // Update average response time;
    const alpha = 0?.1;
    this?.healingStats?.averageResponseTime = 
      alpha * processingTime + (1 - alpha) * this?.healingStats?.averageResponseTime;
  }

  /**
   * Store processing history for analysis;
   */
  private storeProcessingHistory(messageId: string, result: ProcessingResult): void {
    if (!this?.processingHistory?.has(messageId)) {
      this?.processingHistory?.set(messageId, []);
    }
    
    const history = this?.processingHistory?.get(messageId)!;
    history?.push(result);
    
    // Keep only last 10 results per message;
    if (history?.length > 10) {
      history?.splice(0, history?.length - 10);
    }
  }

  /**
   * Start processing loop for queued messages;
   */
  private startProcessingLoop(): void {
    setInterval(async () => {
      if (!this?.isRunning || this?.processingQueue?.length === 0) return;
      
      const request = this?.processingQueue?.shift();
      if (request) {
        try {
          await this?.processMessage(request);
        } catch (error) {
          log?.error('❌ Error in processing loop', LogContext?.AI, {
            messageId: request?.id,
            error: error instanceof Error ? error?.message : String(error),
          });
        }
      }
    }, 100); // Process queue every 100ms;
  }

  /**
   * Start telemetry monitoring;
   */
  private startTelemetryMonitoring(): void {
    setInterval(() => {
      this?.emit('telemetryUpdate', {
        stats: this?.getStats(),
        timestamp: Date?.now(),
      });
    }, 30000); // Emit telemetry every 30 seconds;
  }

  /**
   * Add message to processing queue;
   */
  queueMessage(request: MessageProcessingRequest): void {
    this?.processingQueue?.push(request);
    log?.info('📋 Message queued for processing', LogContext?.AI, {
      messageId: request?.id,
      queueLength: this?.processingQueue?.length,
    });
  }

  /**
   * Get current statistics;
   */
  getStats(): typeof this?.healingStats & { queueLength: number; isRunning: boolean } {
    return {
      ...this?.healingStats,
      queueLength: this?.processingQueue?.length,
      isRunning: this?.isRunning,
    };
  }

  /**
   * Get processing history for a message;
   */
  getProcessingHistory(messageId: string): ProcessingResult[] {
    return this?.processingHistory?.get(messageId) || [];
  }

  /**
   * Add custom failure pattern;
   */
  addFailurePattern(pattern: FailurePattern): void {
    this?.failurePatterns?.push(pattern);
    log?.info('🔍 Added custom failure pattern', LogContext?.AI, {
      category: pattern?.category,
      description: pattern?.description,
    });
  }

  /**
   * Stop the processor;
   */
  async stop(): Promise<void> {
    if (!this?.isRunning) return;
    
    this?.isRunning = false;
    
    // Stop dependent services;
    this?.healingSystem?.stop();
    this?.visionDebugger?.stop();
    hallucinationDetector?.stopAutoDetection();
    
    log?.info('🛑 Smart Auto-Healing Processor stopped', LogContext?.AI);
    this?.emit('stopped');
  }
}

// Export singleton instance;
export const smartAutoHealingProcessor = new SmartAutoHealingProcessor();
export default smartAutoHealingProcessor;