export { agentOrchestrationRouter as default } from '../migration/compatibility-stubs';

// Add missing WebSocket orchestration setup function
export function setupWebSocketOrchestration(io: any): void {
  console.log('WebSocket orchestration migrated to Go WebSocket service at port 8090');
}
