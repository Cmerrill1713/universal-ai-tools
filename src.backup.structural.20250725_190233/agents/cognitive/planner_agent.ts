/**;
 * @deprecated This file is deprecated. Please use enhanced_planner_agentts instead.;
 * The enhanced version includes all functionality from this basic version plus memory integration.;
 */;

// Re-export from enhanced version for backward compatibility;
export { EnhancedPlannerAgent as PlannerAgent } from './enhanced_planner_agent';
export default EnhancedPlannerAgent;
import { EnhancedPlannerAgent } from './enhanced_planner_agent';
consolewarn(;
  '⚠️ DEPRECATION WARNING: planner_agentts is deprecated. Please import from enhanced_planner_agentts instead.';
);