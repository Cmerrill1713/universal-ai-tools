export { localLlmRouter as default } from '../migration/compatibility-stubs';

// Add missing shutdown function
export function shutdownLocalLLMRouter(): void {
  console.log('Local LLM router migrated to Rust LLM Router at port 8082');
}
