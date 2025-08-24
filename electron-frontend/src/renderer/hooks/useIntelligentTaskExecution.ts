import Logger from '../utils/logger';
// React import removed as not used in this TypeScript hook
import { _safeNow as safeNow, safeTaskId } from '../utils/defensiveDateHandler';
/**
 * Intelligent Task Execution Hook
 *
 * React hook that integrates with the sophisticated agent architecture including:
 * - HRM Universal Decision Engine for intelligent routing
 * - Rust Agent Registry for sub-millisecond performance tracking
 * - Go Agent Orchestrator with specialized agents
 * - DSPy 10-agent cognitive pipeline for complex reasoning
 *
 * This replaces simple task execution with hierarchical reasoning-driven orchestration.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  unifiedAgentDecisionService,
  TaskExecutionRequest,
  TaskExecutionResult,
  AgentSystemHealth,
  DecisionContext,
  DecisionType,
  DecisionResult,
  HRMReasoningStep,
} from '../services/unifiedAgentDecisionService';
import { hrmIntegrationService } from '../services/hrmIntegrationService';

export interface IntelligentTaskConfig {
  enableHRMRouting: boolean;
  enableCognitiveReasoning: boolean;
  fallbackToSimpleExecution: boolean;
  maxExecutionTimeMs: number;
  requireHumanApproval: boolean;
}

export interface TaskProgress {
  taskId: string;
  stage: string;
  currentAgent: string;
  progress: number; // 0-100
  estimatedRemainingMs: number;
  executionChain: Array<{
    agentName: string;
    status: 'pending' | 'executing' | 'completed' | 'failed';
    startTime?: number;
    endTime?: number;
    confidence?: number;
    hrmDecisionId?: string;
    reasoningTrace?: HRMReasoningStep[];
  }>;
  hrmReasoning?: string;
  hrmDecision?: DecisionResult;
  intelligentRouting?: {
    decisionId: string;
    confidence: number;
    reasoningSteps: string[];
    alternativesConsidered: number;
  };
}

export interface UseIntelligentTaskExecutionReturn {
  // Task execution
  executeTask: (request: TaskExecutionRequest) => Promise<string>;
  executeAgentChain: (agentTypes: string[], request: TaskExecutionRequest) => Promise<string>;
  executeComplexReasoning: (problem: string, context: Record<string, unknown>) => Promise<unknown>;

  // State management
  activeTasks: Map<string, TaskProgress>;
  completedTasks: TaskExecutionResult[];
  systemHealth: AgentSystemHealth | null;

  // Control
  cancelTask: (taskId: string) => Promise<boolean>;
  getTaskProgress: (taskId: string) => TaskProgress | null;

  // Performance metrics
  performanceMetrics: {
    averageExecutionTimeMs: number;
    successRate: number;
    hrmAccuracy: number;
    rustRegistryResponseMs: number;
  };

  // Status
  isInitialized: boolean;
  isConnected: boolean;
  _error: string | null;
}

const DEFAULT_CONFIG: IntelligentTaskConfig = {
  enableHRMRouting: true,
  enableCognitiveReasoning: true,
  fallbackToSimpleExecution: true,
  maxExecutionTimeMs: 300000, // 5 minutes
  requireHumanApproval: false,
};

export function useIntelligentTaskExecution(
  config: Partial<IntelligentTaskConfig> = {}
): UseIntelligentTaskExecutionReturn {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  // State management
  const [activeTasks, setActiveTasks] = useState<Map<string, TaskProgress>>(new Map());
  const [completedTasks, setCompletedTasks] = useState<TaskExecutionResult[]>([]);
  const [systemHealth, setSystemHealth] = useState<AgentSystemHealth | null>(null);
  const [performanceMetrics, setPerformanceMetrics] = useState({
    averageExecutionTimeMs: 0,
    successRate: 0,
    hrmAccuracy: 0,
    rustRegistryResponseMs: 0,
  });
  const [isInitialized, setIsInitialized] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [_error, setError] = useState<string | null>(null);

  // Refs for managing intervals and timeouts
  const healthCheckIntervalRef = useRef<NodeJS.Timeout>();
  const taskProgressIntervalRef = useRef<NodeJS.Timeout>();

  // Initialize the system and start monitoring
  useEffect(() => {
    const initialize = async () => {
      try {
        setError(null);

        // Check initial system health
        const health = await unifiedAgentDecisionService.getAgentSystemHealth();
        setSystemHealth(health);

        // Phase 2: Initialize agent health monitoring system
        await hrmIntegrationService.initializeHealthMonitoring();

        // Determine connection status based on system health
        const connected =
          health.hrm_engine.status !== 'offline' ||
          health.rust_registry.status !== 'offline' ||
          health.go_orchestrator.status !== 'offline';

        setIsConnected(connected);
        setIsInitialized(true);

        // Start enhanced health monitoring with HRM intelligence
        healthCheckIntervalRef.current = setInterval(async () => {
          try {
            const updatedHealth = await unifiedAgentDecisionService.getAgentSystemHealth();
            setSystemHealth(updatedHealth);

            // Update performance metrics with HRM-specific metrics
            setPerformanceMetrics(prev => {
              const newMetrics = {
                ...prev,
                rustRegistryResponseMs: updatedHealth.rust_registry.response_time_ms,
              };

              // Only update HRM accuracy if engine is healthy
              if (
                updatedHealth.hrm_engine.status === 'healthy' &&
                updatedHealth.hrm_engine.decision_accuracy > 0
              ) {
                newMetrics.hrmAccuracy = updatedHealth.hrm_engine.decision_accuracy;
              }

              return newMetrics;
            });

            // Update connection status based on HRM engine health
            const newConnectionStatus =
              updatedHealth.hrm_engine.status !== 'offline' ||
              updatedHealth.rust_registry.status !== 'offline' ||
              updatedHealth.go_orchestrator.status !== 'offline';

            if (newConnectionStatus !== isConnected) {
              setIsConnected(newConnectionStatus);
              Logger.debug(`🔄 Connection status changed:`, {
                connected: newConnectionStatus,
                hrm: updatedHealth.hrm_engine.status,
                rust: updatedHealth.rust_registry.status,
                go: updatedHealth.go_orchestrator.status,
              });
            }
          } catch (_error) {
            if (process.env.NODE_ENV === 'development') {
              Logger.warn('Health check failed:', _error);
            }

            // Set offline status if health check fails repeatedly
            setIsConnected(false);
          }
        }, 5000); // Every 5 seconds

        Logger.warn(`✅ HRM-Enhanced Intelligent Task Execution System initialized`);
        Logger.warn(
          `  🧠 HRM Engine: ${health.hrm_engine.status} (accuracy: ${health.hrm_engine.decision_accuracy}%)`
        );
        Logger.warn(
          `  ⚡ Rust Registry: ${health.rust_registry.status} (${health.rust_registry.response_time_ms}ms)`
        );
        Logger.warn(
          `  🚀 Go Orchestrator: ${health.go_orchestrator.status} (${health.go_orchestrator.specialized_agents.length} agents)`
        );
        Logger.warn(
          `  🤖 DSPy Pipeline: ${health.dspy_pipeline.status} (${health.dspy_pipeline.cognitive_agents.length} cognitive agents)`
        );
        Logger.warn(
          `  📊 Configuration: HRM=${finalConfig.enableHRMRouting}, Cognitive=${finalConfig.enableCognitiveReasoning}`
        );
      } catch (_error) {
        if (process.env.NODE_ENV === 'development') {
          Logger.error('Failed to initialize intelligent task system:', _error);
        }
        setError(_error instanceof Error ? _error.message : 'Initialization failed');
        setIsConnected(false);
      }
    };

    initialize();

    // Cleanup intervals on unmount
    return () => {
      const currentHealthInterval = healthCheckIntervalRef.current;
      const currentTaskInterval = taskProgressIntervalRef.current;

      if (currentHealthInterval) {
        clearInterval(currentHealthInterval);
      }
      if (currentTaskInterval) {
        clearInterval(currentTaskInterval);
      }
      // Phase 2: Shutdown health monitoring system
      hrmIntegrationService.shutdownHealthMonitoring();
    };
  }, [finalConfig.enableCognitiveReasoning, finalConfig.enableHRMRouting, isConnected]);

  // Execute a task with intelligent HRM-driven routing
  const executeTask = useCallback(
    async (request: TaskExecutionRequest): Promise<string> => {
      const taskId = safeTaskId('task');
      const startTime = safeNow();

      try {
        setError(null);

        Logger.debug(`🚀 Starting intelligent task execution:`, {
          taskId,
          type: request.task_type,
          complexity: request.complexity,
          enableHRM: finalConfig.enableHRMRouting,
        });

        // Phase 1: HRM Decision Making for Agent Routing
        let hrmDecision: DecisionResult | undefined = undefined;

        if (finalConfig.enableHRMRouting) {
          Logger.debug(
            `🧠 Phase 1 & 2: Enhanced HRM Decision Making with Rust Agent Registry coordination...`
          );

          const decisionContext: DecisionContext = {
            decision_type: DecisionType.AGENT_ROUTING,
            session_id: `task-${taskId}`,
            request_data: {
              task_type: request.task_type,
              complexity: request.complexity,
              description: request.task_description,
              user_context: request.user_context,
              related_files: request.related_files,
            },
            system_state: {
              timestamp: new Date().toISOString(),
              system_health: systemHealth,
              active_tasks: activeTasks.size,
            },
            constraints: {
              max_time_ms:
                request.execution_constraints?.max_time_ms || finalConfig.maxExecutionTimeMs,
              max_memory_mb: request.execution_constraints?.max_memory_mb || 512,
              require_human_approval:
                request.execution_constraints?.require_human_approval || false,
            },
            available_options: await unifiedAgentDecisionService.getAvailableAgents(),
          };

          try {
            // Use enhanced HRM integration service with Rust Agent Registry coordination (Phase 2)
            hrmDecision =
              await hrmIntegrationService.makeEnhancedDecisionWithRegistry(decisionContext);

            Logger.debug(`✅ Enhanced HRM Decision with Registry coordination completed:`, {
              decision_id: hrmDecision.decision_id,
              confidence: hrmDecision.confidence,
              selected_action: hrmDecision.selected_option.action,
              reasoning_steps: hrmDecision.reasoning_steps.length,
              has_fallback: !!hrmDecision.fallback_strategy,
              registry_metrics: (hrmDecision as any).registry_metrics || null,
            });
          } catch (hrmError) {
            Logger.warn(`⚠️ Enhanced HRM Decision failed, using system fallback:`, hrmError);
            hrmDecision = undefined;
          }
        }

        // Create enhanced task progress with HRM + Registry integration (Phase 2)
        const initialProgress: TaskProgress = {
          taskId,
          stage: 'hrm-registry-routing',
          currentAgent: 'hrm-registry-coordinator',
          progress: 15,
          estimatedRemainingMs: finalConfig.maxExecutionTimeMs,
          executionChain: [
            {
              agentName: 'hrm-decision-engine',
              status: hrmDecision ? 'completed' : 'failed',
              startTime,
              endTime: safeNow(),
              confidence: hrmDecision?.confidence || 0.3,
              hrmDecisionId: hrmDecision?.decision_id,
            },
          ],
          hrmDecision,
          intelligentRouting: hrmDecision
            ? {
                decisionId: hrmDecision.decision_id,
                confidence: hrmDecision.confidence,
                reasoningSteps: hrmDecision.reasoning_steps,
                alternativesConsidered: hrmDecision.alternative_options.length,
              }
            : undefined,
        };

        setActiveTasks(prev => new Map(prev).set(taskId, initialProgress));

        // Phase 2: Execute task with HRM-enhanced request
        const enhancedRequest: TaskExecutionRequest = {
          ...request,
          parameters: {
            ...request.parameters,
            hrm_decision: hrmDecision,
            hrm_confidence: hrmDecision?.confidence || 0.3,
            hrm_reasoning: hrmDecision?.reasoning_steps || ['Fallback routing'],
            hrm_selected_action: hrmDecision?.selected_option || { action: 'default' },
          },
        };

        Logger.debug(`🎯 Phase 2: Executing task with HRM-enhanced routing...`);

        // Update progress to execution phase
        setActiveTasks(prev => {
          const updated = new Map(prev);
          const current = updated.get(taskId);
          if (current) {
            updated.set(taskId, {
              ...current,
              stage: 'executing',
              currentAgent: request.task_type,
              progress: 30,
            });
          }
          return updated;
        });

        // Execute task using unified decision service with HRM intelligence
        const result = await unifiedAgentDecisionService.executeTask(enhancedRequest);

        // Update final progress
        setActiveTasks(prev => {
          const updated = new Map(prev);
          updated.delete(taskId);
          return updated;
        });

        // Store completed task with HRM intelligence
        const enhancedResult: TaskExecutionResult = {
          ...result,
          hrm_reasoning_trace: [
            ...result.hrm_reasoning_trace,
            ...(hrmDecision
              ? [
                  {
                    decision_point: 'Initial Agent Routing',
                    reasoning: hrmDecision.reasoning_steps.join('; '),
                    confidence: hrmDecision.confidence,
                    alternatives_considered: hrmDecision.alternative_options.map(
                      opt => opt.action || 'unknown'
                    ),
                  },
                ]
              : []),
          ],
        };

        setCompletedTasks(prev => [...prev, enhancedResult]);

        // Update performance metrics with HRM intelligence
        setPerformanceMetrics(prev => {
          const totalTasks = completedTasks.length + 1;
          const successfulTasks =
            completedTasks.filter(t => t.success).length + (result.success ? 1 : 0);
          const totalExecutionTime =
            completedTasks.reduce((sum, t) => sum + t.total_execution_time_ms, 0) +
            result.total_execution_time_ms;
          const hrmAccuracySum =
            completedTasks.reduce((sum, t) => {
              const hrmTrace = t.hrm_reasoning_trace?.find(
                trace => trace.decision_point === 'Initial Agent Routing'
              );
              return sum + (hrmTrace?.confidence || 0);
            }, 0) + (hrmDecision?.confidence || 0);

          return {
            ...prev,
            successRate: (successfulTasks / totalTasks) * 100,
            averageExecutionTimeMs: totalExecutionTime / totalTasks,
            hrmAccuracy: (hrmAccuracySum / totalTasks) * 100,
          };
        });

        const executionTime = safeNow() - startTime;

        // Log HRM performance metrics
        const hrmMetrics = hrmIntegrationService.getPerformanceMetrics();

        Logger.warn(`✅ HRM-enhanced task completed:`, {
          taskId,
          executionTimeMs: executionTime,
          success: result.success,
          hrmConfidence: hrmDecision?.confidence || 'N/A',
          reasoningSteps: result.hrm_reasoning_trace.length,
          selectedAgent: result.execution_chain[0]?.agent_name || 'unknown',
          hrmMetrics: {
            totalDecisions: hrmMetrics.totalDecisions,
            avgConfidence: Math.round(hrmMetrics.averageConfidence * 100) / 100,
            cacheHitRate: Math.round(hrmMetrics.cacheHitRate * 100),
            fallbackRate: Math.round(hrmMetrics.fallbackUsageRate * 100),
          },
        });

        return taskId;
      } catch (_error) {
        const executionTime = safeNow() - startTime;

        Logger.error(`❌ Task execution failed:`, {
          taskId,
          error: _error instanceof Error ? _error.message : String(_error),
          executionTimeMs: executionTime,
        });

        setError(_error instanceof Error ? _error.message : 'Task execution failed');

        // Remove from active tasks
        setActiveTasks(prev => {
          const updated = new Map(prev);
          updated.delete(taskId);
          return updated;
        });

        throw _error;
      }
    },
    [
      finalConfig.maxExecutionTimeMs,
      finalConfig.enableHRMRouting,
      completedTasks,
      systemHealth,
      activeTasks.size,
    ]
  );

  // Execute agent chain workflow
  const executeAgentChain = useCallback(
    async (agentTypes: string[], request: TaskExecutionRequest): Promise<string> => {
      const taskId = safeTaskId('chain');

      try {
        setError(null);

        // Create chain progress tracking
        const chainProgress: TaskProgress = {
          taskId,
          stage: 'chain-execution',
          currentAgent: agentTypes[0] || 'unknown',
          progress: 0,
          estimatedRemainingMs: finalConfig.maxExecutionTimeMs,
          executionChain: agentTypes.map(agentType => ({
            agentName: agentType,
            status: 'pending' as const,
          })),
        };

        setActiveTasks(prev => new Map(prev).set(taskId, chainProgress));

        // Execute chain using unified decision service
        const result = await unifiedAgentDecisionService.executeAgentChain(agentTypes, request);

        // Update completion
        setActiveTasks(prev => {
          const updated = new Map(prev);
          updated.delete(taskId);
          return updated;
        });

        setCompletedTasks(prev => [...prev, result]);

        Logger.warn(`✅ HRM-enhanced agent chain completed:`, {
          chain: agentTypes.join(' → '),
          totalTimeMs: result.total_execution_time_ms,
          success: result.success,
          chainLength: result.execution_chain.length,
        });
        Logger.warn(
          `📊 Chain performance breakdown:`,
          result.execution_chain.map(
            _e =>
              `  ${_e.agent_name}: ${_e.execution_time_ms}ms (confidence: ${_e.confidence_score})`
          )
        );

        return taskId;
      } catch (_error) {
        Logger.error('Agent chain execution failed:', _error);
        setError(_error instanceof Error ? _error.message : 'Chain execution failed');

        setActiveTasks(prev => {
          const updated = new Map(prev);
          updated.delete(taskId);
          return updated;
        });

        throw _error;
      }
    },
    [finalConfig.maxExecutionTimeMs]
  );

  // Execute complex reasoning with DSPy pipeline
  const executeComplexReasoning = useCallback(
    async (problem: string, context: Record<string, unknown>): Promise<unknown> => {
      try {
        setError(null);
        Logger.warn('🤖 Starting DSPy cognitive reasoning...');
        Logger.warn('❓ Problem:', problem);

        const result = await unifiedAgentDecisionService.executeComplexReasoning(problem, context);

        Logger.warn('🧠 Cognitive reasoning completed');
        Logger.warn('💡 Result:', result);

        return result;
      } catch (_error) {
        Logger.error('Complex reasoning failed:', _error);
        setError(_error instanceof Error ? _error.message : 'Reasoning failed');
        throw _error;
      }
    },
    []
  );

  // Cancel a running task
  const cancelTask = useCallback(async (taskId: string): Promise<boolean> => {
    try {
      // Remove from active tasks
      setActiveTasks(prev => {
        const updated = new Map(prev);
        updated.delete(taskId);
        return updated;
      });

      Logger.warn('⏹️ Task cancelled:', taskId);
      return true;
    } catch (_error) {
      Logger.error('Failed to cancel task:', _error);
      return false;
    }
  }, []);

  // Get task progress
  const getTaskProgress = useCallback(
    (taskId: string): TaskProgress | null => {
      return activeTasks.get(taskId) || null;
    },
    [activeTasks]
  );

  return {
    executeTask,
    executeAgentChain,
    executeComplexReasoning,
    activeTasks,
    completedTasks,
    systemHealth,
    cancelTask,
    getTaskProgress,
    performanceMetrics,
    isInitialized,
    isConnected,
    _error,
  };
}
