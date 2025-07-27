/**
 * Coordination Module - Exports for agent coordination and task management
 */

// Core coordination components
export { AgentCoordinator } from './agent-coordinator';
export { EnhancedAgentCoordinator } from './enhanced-dspy-coordinator'; // DSPy-powered coordinator
export { BrowserAgentPool } from './agent-pool';
export { MessageBroker } from './message-broker';
export { TaskManager } from './task-manager';
export { DSPyTaskExecutor } from './dspy-task-executor';

// Hot reload functionality
export { HotReloadMonitor } from './hot-reload-monitor';
export { HotReloadOrchestrator } from './hot-reload-orchestrator';

// Performance monitoring
export { PerformanceMonitor } from './performance-monitor';

// Types and interfaces
export type { TaskExecutionContext, TaskProgress } from './dspy-task-executor';

export type {
  Task,
  TaskCreateRequest,
  TaskUpdateRequest,
  TaskExecutionResult,
  TaskDependencyGraph,
} from './task-manager';
