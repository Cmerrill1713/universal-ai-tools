 
/**
 * @deprecated This file is deprecated. Please use enhanced_planner_agent.ts instead.
 * The enhanced version includes all functionality from this basic version plus memory integration.
 */

// Re-export from enhanced version for backward compatibility
export { EnhancedPlannerAgent as PlannerAgent } from './enhanced_planner_agent';
export default EnhancedPlannerAgent;

import { EnhancedPlannerAgent } from './enhanced_planner_agent';

console.warn(
  '⚠️ DEPRECATION WARNING: planner_agent.ts is deprecated. Please import from enhanced_planner_agent.ts instead.'
);
