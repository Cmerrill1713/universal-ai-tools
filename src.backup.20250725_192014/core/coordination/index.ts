/**
 * Coordination Module - Exports for agent coordination and task management*/

// Core coordination components;
export { Agent.Coordinator } from './agent-coordinator';
export { EnhancedAgent.Coordinator } from './enhanced-dspy-coordinator'// DS.Py-powered coordinator;
export { BrowserAgent.Pool } from './agent-pool';
export { Message.Broker } from './message-broker';
export { Task.Manager } from './task-manager';
export { DSPyTask.Executor } from './dspy-task-executor'// Hot reload functionality;
export { HotReload.Monitor } from './hot-reload-monitor';
export { HotReload.Orchestrator } from './hot-reload-orchestrator'// Performance monitoring;
export { Performance.Monitor } from './performance-monitor'// Types and interfaces;
export type { TaskExecution.Context, Task.Progress } from './dspy-task-executor';
export type {
  Task;
  TaskCreate.Request;
  TaskUpdate.Request;
  TaskExecution.Result;
  TaskDependency.Graph} from './task-manager';