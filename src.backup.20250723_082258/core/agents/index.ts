/**
 * Agents Module - Exports for agent management and registry
 */

// Core agent components
export { AgentRegistry } from './agent-registry';
export { SelfHealingAgent } from './self-healing-agent';

// Re-export types from individual modules
export type {
  AgentCapability,
  RegisteredAgent,
  CapabilityQuery,
  AgentStats,
} from './agent-registry';

export type {
  HealingResult,
  HealingContext,
  RecoveryAction,
  DiagnosticResult,
  SystemHealth,
  HealingReport,
} from './self-healing-agent';
