/**
 * ToolTrain Code Search Agent - Migration Stub
 * This agent has been migrated to Rust AI Core
 */

export class ToolTrainCodeSearchAgent {
  async search(query: string, context?: any) {
    return {
      query,
      results: [],
      migrated: true,
      redirect: 'http://localhost:8083/ai-core/search/'
    };
  }
  
  async indexRepository(repoPath: string) {
    return {
      indexed: false,
      migrated: true,
      redirect: 'http://localhost:8083/ai-core/search/'
    };
  }
}

export default ToolTrainCodeSearchAgent;
