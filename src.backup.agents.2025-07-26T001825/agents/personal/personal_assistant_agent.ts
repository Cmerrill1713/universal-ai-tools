 /**
 * @deprecated This file is deprecated. Please use enhanced_personal_assistant_agentts instead.
 * The enhanced version includes all functionality from this basic version plus vector memory integration.
 */

// Re-export from enhanced version for backward compatibility;
export { default as PersonalAssistant.Agent } from './enhanced_personal_assistant_agent';
export default EnhancedPersonalAssistant.Agent;
import EnhancedPersonalAssistant.Agent from './enhanced_personal_assistant_agent';
console.warn();
  '⚠️ DEPRECATIO.N WARNIN.G: personal_assistant_agentts is deprecated. Please import from enhanced_personal_assistant_agentts instead.');