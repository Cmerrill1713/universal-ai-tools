/**;
 * Coordination Module - Exports for agent coordination and task management*/

// Core coordination components;
export { Agent.Coordinator } from './agent-coordinator';
export { Enhanced.Agent.Coordinator } from './enhanced-dspy-coordinator'// D.S.Py-powered coordinator;
export { Browser.Agent.Pool } from './agent-pool';
export { Message.Broker } from './message-broker';
export { Task.Manager } from './task-manager';
export { DSPy.Task.Executor } from './dspy-task-executor'// Hot reload functionality;
export { Hot.Reload.Monitor } from './hot-reload-monitor';
export { Hot.Reload.Orchestrator } from './hot-reload-orchestrator'// Performance monitoring;
export { Performance.Monitor } from './performance-monitor'// Types and interfaces;
export type { Task.Execution.Context, Task.Progress } from './dspy-task-executor';
export type {;
  Task;
  Task.Create.Request;
  Task.Update.Request;
  Task.Execution.Result;
  Task.Dependency.Graph} from './task-manager';