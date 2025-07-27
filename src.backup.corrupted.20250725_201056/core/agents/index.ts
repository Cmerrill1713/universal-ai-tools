/**;
 * Agents Module - Exports for agent management and registry*/

// Core agent components;
export { Agent.Registry } from './agent-registry';
export { Self.Healing.Agent } from './self-healing-agent'// Re-export types from individual modules;
export type {;
  Agent.Capability;
  Registered.Agent;
  Capability.Query;
  Agent.Stats} from './agent-registry';
export type {;
  Healing.Result;
  Healing.Context;
  Recovery.Action;
  Diagnostic.Result;
  System.Health;
  Healing.Report} from './self-healing-agent';