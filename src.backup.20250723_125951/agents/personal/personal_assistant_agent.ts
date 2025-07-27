/**
 * @deprecated This file is deprecated. Please use enhanced_personal_assistant_agent.ts instead.
 * The enhanced version includes all functionality from this basic version plus vector memory integration.
 */

// Re-export from enhanced version for backward compatibility
export { default as PersonalAssistantAgent } from './enhanced_personal_assistant_agent';
export default EnhancedPersonalAssistantAgent;

import EnhancedPersonalAssistantAgent from './enhanced_personal_assistant_agent';

console.warn(
  '⚠️ DEPRECATION WARNING: personal_assistant_agent.ts is deprecated. Please import from enhanced_personal_assistant_agent.ts instead.'
);
