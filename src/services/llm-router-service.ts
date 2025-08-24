// Re-export from migration compatibility stubs
import { LLMRouterService as LLMRouterServiceImpl, llmRouter as llmRouterImpl } from '../migration/compatibility-stubs';

export const LLMRouterService = LLMRouterServiceImpl;
export const llmRouter = llmRouterImpl;
export default { LLMRouterService, llmRouter };