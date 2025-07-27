/**
 * @deprecated This file is deprecated. Please use enhanced_planner_agentts instead.
 * The enhanced version includes all functionality from this basic version plus memory integration.
 */

// Re-export from enhanced version for backward compatibility;
export { EnhancedPlanner.Agent as Planner.Agent } from './enhanced_planner_agent';
export default EnhancedPlanner.Agent;
import { EnhancedPlanner.Agent } from './enhanced_planner_agent';
console.warn(
  '⚠️ DEPRECATIO.N WARNIN.G: planner_agentts is deprecated. Please import from enhanced_planner_agentts instead.');