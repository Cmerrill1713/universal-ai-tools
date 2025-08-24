// Migration compatibility for agent registry
import { AgentRegistry as AgentRegistryClass } from '../migration/compatibility-stubs';

// Export as both class and instance for backward compatibility
export const AgentRegistry = AgentRegistryClass;

// Create singleton instance
const registryInstance = new AgentRegistryClass();

// Export singleton for services that expect an instance
export const agentRegistry = registryInstance;

export default AgentRegistry;