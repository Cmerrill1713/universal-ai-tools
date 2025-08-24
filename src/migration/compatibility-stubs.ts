/**
 * Migration Compatibility Stubs
 * These are placeholder exports for deleted TypeScript files that have been migrated to Go/Rust
 * This allows the legacy TypeScript code to still compile during the migration period
 */

import { Router } from 'express';

// Create a stub router that returns migration notices
const createMigrationRouter = (serviceName: string, targetService: string) => {
  const router = Router();
  
  router.all('*', (req, res) => {
    res.status(503).json({
      error: 'Service Migrated',
      message: `The ${serviceName} service has been migrated to ${targetService}`,
      migration: true,
      redirect: targetService === 'Go' ? 'http://localhost:8082' : 'http://localhost:8083'
    });
  });
  
  return router;
};

// Agent Registry stub
export class AgentRegistry {
  static agents = new Map();
  
  static register(name: string, agent: any) {
    this.agents.set(name, agent);
  }
  
  static get(name: string) {
    return this.agents.get(name) || null;
  }
  
  static getAgent(name: string) {
    return this.agents.get(name) || null;
  }
  
  static getAvailableAgents() {
    return Array.from(this.agents.keys());
  }
  
  static list() {
    return Array.from(this.agents.keys());
  }
  
  static async initialize() {
    console.log('AgentRegistry: Using Go agent orchestrator at port 8082');
  }
  
  static getLoadedAgents() {
    return Array.from(this.agents.values());
  }
  
  static async processRequest(request: any) {
    return { migrated: true, redirect: 'http://localhost:8082' };
  }
  
  static async processParallelRequests(requests: any[]) {
    return { migrated: true, redirect: 'http://localhost:8082' };
  }
  
  static async orchestrateAgents(context: any) {
    return { migrated: true, redirect: 'http://localhost:8082' };
  }
  
  static async shutdown() {
    console.log('AgentRegistry: Shutdown signal received - using Go orchestrator');
  }
}

// LLM Router Service stub
export class LLMRouterService {
  async route(request: any) {
    return {
      provider: 'lm-studio',
      endpoint: 'http://localhost:5901/v1',
      model: 'qwen/qwen3-30b-a3b-2507',
      migrated: true
    };
  }
  
  async generateText(prompt: string, options?: any) {
    return {
      text: 'Service migrated to Rust LLM Router at port 8083',
      migrated: true,
      redirect: 'http://localhost:8083'
    };
  }
  
  async generateResponse(prompt: string, options?: any) {
    return {
      response: "Service migrated to Rust LLM Router at port 8083",
      migrated: true,
      redirect: "http://localhost:8083"
    };
  }

  getProviderStatus() {
    return {
      status: 'migrated',
      providers: ['lm-studio'],
      activeProvider: 'lm-studio',
      redirect: 'http://localhost:8083'
    };
  }
}

// Export instance for services that expect it
export const llmRouter = new LLMRouterService();

// Stub routers for migrated services
export const agentsRouter = createMigrationRouter('agents', 'Go');
export const orchestrationRouter = createMigrationRouter('orchestration', 'Go');
export const agentOrchestrationRouter = createMigrationRouter('agent-orchestration', 'Go');
export const fastCoordinatorRouter = createMigrationRouter('fast-coordinator', 'Go');
export const contextAnalyticsRouter = createMigrationRouter('context-analytics', 'Go');
export const environmentalAwarenessRouter = createMigrationRouter('environmental-awareness', 'Go');
export const proactiveTasksRouter = createMigrationRouter('proactive-tasks', 'Go');
export const calendarRouter = createMigrationRouter('calendar', 'Go');
export const speculativeDecodingRouter = createMigrationRouter('speculative-decoding', 'Rust');
export const autocodebenchReasonrankRouter = createMigrationRouter('autocodebench-reasonrank', 'Rust');
export const graphragRouter = createMigrationRouter('graphrag', 'Rust');
export const aiNewsRouter = createMigrationRouter('ai-news', 'Go');
export const knowledgeGraphRouter = createMigrationRouter('knowledge-graph', 'Rust');
export const codebaseOptimizerRouter = createMigrationRouter('codebase-optimizer', 'Rust');
export const voiceRouter = createMigrationRouter('voice', 'Go');
export const frontendFixerRouter = createMigrationRouter('frontend-fixer', 'Go');
export const claudeKnowledgeRouter = createMigrationRouter('claude-knowledge', 'Go');
export const productionHealthRouter = createMigrationRouter('production-health', 'Go');
export const localLlmRouter = createMigrationRouter('local-llm', 'Rust');
export const huggingfaceKnowledgeRouter = createMigrationRouter('huggingface-knowledge', 'Go');

// Additional migrated routers for missing services
export const monitoring = createMigrationRouter('monitoring', 'Prometheus/Grafana');
export const monitoringDashboard = createMigrationRouter('monitoring-dashboard', 'Grafana');
export const optimizationDashboard = createMigrationRouter('optimization-dashboard', 'Grafana');
export const errorMonitoring = createMigrationRouter('error-monitoring', 'Go');
export const chat = createMigrationRouter('chat', 'Go');
export const memory = createMigrationRouter('memory', 'Rust');
export const memoryOptimization = createMigrationRouter('memory-optimization', 'Rust');
export const featureDiscovery = createMigrationRouter('feature-discovery', 'Go');
export const errors = createMigrationRouter('errors', 'Go');
export const deviceAuth = createMigrationRouter('device-auth', 'Go');
export const mobileOrchestration = createMigrationRouter('mobile-orchestration', 'Go');
export const athena = createMigrationRouter('athena', 'Rust');
export const abMcts = createMigrationRouter('ab-mcts', 'Rust');
export const vision = createMigrationRouter('vision', 'Rust');
export const visionDebugSimple = createMigrationRouter('vision-debug', 'Rust');
export const huggingface = createMigrationRouter('huggingface', 'Go');
export const mlx = createMigrationRouter('mlx', 'Rust');
export const imageGeneration = createMigrationRouter('image-generation', 'Rust');
export const systemMetrics = createMigrationRouter('system-metrics', 'Prometheus');
export const performance = createMigrationRouter('performance', 'Grafana');
export const performanceAnalytics = createMigrationRouter('performance-analytics', 'Grafana');
export const mcpAgent = createMigrationRouter('mcp-agent', 'Go');

// Additional missing routers
export const assistant = createMigrationRouter('assistant', 'Go');
export const models = createMigrationRouter('models', 'Rust');
export const training = createMigrationRouter('training', 'Rust');
export const mlxFineTuning = createMigrationRouter('mlx-fine-tuning', 'Rust');
export const userPreferences = createMigrationRouter('user-preferences', 'Go');
export const flashAttention = createMigrationRouter('flash-attention', 'Rust');
export const feedback = createMigrationRouter('feedback', 'Go');
export const swiftDocs = createMigrationRouter('swift-docs', 'Go');
export const smartContext = createMigrationRouter('smart-context', 'Go');

// Export default for imports expecting default
export default {
  AgentRegistry,
  LLMRouterService,
  agentsRouter,
  orchestrationRouter,
  agentOrchestrationRouter,
  fastCoordinatorRouter,
  contextAnalyticsRouter,
  environmentalAwarenessRouter,
  proactiveTasksRouter,
  calendarRouter,
  speculativeDecodingRouter,
  autocodebenchReasonrankRouter,
  graphragRouter,
  aiNewsRouter,
  knowledgeGraphRouter,
  codebaseOptimizerRouter,
  voiceRouter,
  frontendFixerRouter,
  claudeKnowledgeRouter,
  productionHealthRouter,
  localLlmRouter,
  huggingfaceKnowledgeRouter
};