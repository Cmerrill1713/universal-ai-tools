export { knowledgeGraphRouter as default } from '../migration/compatibility-stubs';

// Add missing realtime service setup function
export function setRealtimeService(service: any): void {
  console.log('Knowledge graph realtime service migrated to Rust GraphRAG at port 8085');
}
