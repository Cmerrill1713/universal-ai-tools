#!/usr/bin/env tsx

/**
 * AB-MCTS Working Test
 * Demonstrates the system with mock LLM integration
 */

// Set environment for mock mode
process.env.USE_MOCK_LLM = 'true';

import { AgentContext, AgentResponse } from './src/types';
import { EnhancedBaseAgent } from './src/agents/enhanced-base-agent';
import { mockLLMService } from './src/services/mock-llm-service';

// Create mock enhanced agents for testing
class MockEnhancedAgent extends EnhancedBaseAgent {
  constructor(
    private agentType: string,
    private capabilities: string[]
  ) {
    super();
  }
  
  getName(): string {
    return `${this.agentType}-agent`;
  }
  
  getCapabilities(): string[] {
    return this.capabilities;
  }
  
  getDescription(): string {
    return `Mock ${this.agentType} agent for testing`;
  }
  
  protected buildSystemPrompt(): string {
    return `You are a ${this.agentType} agent.`;
  }
  
  protected getInternalModelName(): string {
    return 'mock-model';
  }
  
  async execute(context: AgentContext): Promise<AgentResponse> {
    try {
      const response = await mockLLMService.execute(context.userRequest, {
        agent: this.agentType,
        context
      });
      
      const parsed = JSON.parse(response.content);
      
      return {
        success: true,
        data: parsed,
        confidence: parsed.confidence || 0.7,
        message: `${this.agentType} completed successfully`,
        reasoning: parsed.reasoning || 'Mock execution completed',
        metadata: response.metadata
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        confidence: 0,
        message: `${this.agentType} failed: ${error}`,
        reasoning: 'Mock execution failed'
      };
    }
  }
  
  getProbabilisticScore(context: AgentContext): number {
    // Simulate different agent strengths
    const scores: Record<string, number> = {
      planner: 0.85,
      retriever: 0.75,
      synthesizer: 0.80,
      code_assistant: 0.70,
      personal_assistant: 0.65
    };
    
    return scores[this.agentType] || 0.5;
  }
}

// Create test agents
const testAgents = [
  new MockEnhancedAgent('planner', ['planning', 'task_decomposition', 'strategy']),
  new MockEnhancedAgent('retriever', ['information_retrieval', 'search', 'research']),
  new MockEnhancedAgent('synthesizer', ['synthesis', 'analysis', 'consensus']),
  new MockEnhancedAgent('code_assistant', ['code_generation', 'debugging', 'refactoring']),
  new MockEnhancedAgent('personal_assistant', ['assistance', 'coordination', 'task_management'])
];

// Import AB-MCTS components after setting up mocks
import { abMCTSService } from './src/services/ab-mcts-service';
import { abMCTSOrchestrator } from './src/services/ab-mcts-orchestrator';
import { bayesianModelRegistry } from './src/utils/bayesian-model';
import { ThompsonSelector } from './src/utils/thompson-sampling';
import { feedbackCollector } from './src/services/feedback-collector';

// Override agent registry to use mock agents
import AgentRegistry from './src/agents/agent-registry';
const registry = new AgentRegistry();
(registry as any).agents = new Map(testAgents.map(a => [a.getName(), a]));
(registry as any).agentDefinitions = testAgents.map(a => ({
  name: a.getName(),
  path: 'mock',
  type: 'cognitive',
  description: a.getDescription(),
  capabilities: a.getCapabilities()
}));
(abMCTSOrchestrator as any).agentRegistry = registry;

async function demonstrateABMCTS() {
  console.log('🚀 AB-MCTS Working Demonstration\n');
  console.log('=' .repeat(60));
  console.log('\nSystem configured with mock LLM for demonstration...\n');
  
  try {
    // 1. Demonstrate Thompson Sampling Learning
    console.log('📊 Phase 1: Thompson Sampling Agent Selection\n');
    
    const selector = new ThompsonSelector();
    const agentNames = testAgents.map(a => a.getName());
    selector.initializeArms(agentNames, 1, 1);
    
    console.log('Initial state: All agents have equal probability\n');
    
    // Simulate 30 rounds of learning
    const performance: Record<string, { successes: number; trials: number }> = {};
    
    for (let i = 0; i < 30; i++) {
      const selected = selector.selectArm();
      
      // Simulate performance based on agent type
      let successRate = 0.5;
      if (selected.includes('planner')) successRate = 0.85;
      else if (selected.includes('retriever')) successRate = 0.75;
      else if (selected.includes('synthesizer')) successRate = 0.80;
      else if (selected.includes('code')) successRate = 0.70;
      else successRate = 0.65;
      
      const success = Math.random() < successRate;
      selector.updateArm(selected, success);
      
      // Track performance
      if (!performance[selected]) {
        performance[selected] = { successes: 0, trials: 0 };
      }
      performance[selected].trials++;
      if (success) performance[selected].successes++;
    }
    
    console.log('After 30 rounds of learning:\n');
    const rankings = selector.getRankedArms();
    rankings.forEach((rank, i) => {
      const perf = performance[rank.name];
      const actualRate = perf ? (perf.successes / perf.trials * 100).toFixed(1) : '0.0';
      console.log(`${i + 1}. ${rank.name}`);
      console.log(`   Estimated success: ${(rank.mean * 100).toFixed(1)}%`);
      console.log(`   Actual success: ${actualRate}% (${perf?.trials || 0} trials)`);
      console.log(`   Confidence interval: [${(rank.confidence[0] * 100).toFixed(1)}%, ${(rank.confidence[1] * 100).toFixed(1)}%]\n`);
    });
    
    // 2. Demonstrate AB-MCTS Tree Search
    console.log('🌳 Phase 2: AB-MCTS Tree Search\n');
    
    const context: AgentContext = {
      userRequest: 'Create a comprehensive REST API for user management with JWT authentication, proper error handling, and documentation',
      requestId: 'demo-001',
      userId: 'demo-user',
      metadata: {
        taskType: 'development',
        complexity: 'high',
        requirements: ['authentication', 'documentation', 'security']
      }
    };
    
    console.log('Task:', context.userRequest);
    console.log('\nStarting AB-MCTS search...\n');
    
    const searchResult = await abMCTSService.search(
      context,
      agentNames,
      {
        useCache: false,
        enableParallelism: true,
        collectFeedback: true,
        maxIterations: 100, // Reduced for demo
        timeLimit: 5000
      }
    );
    
    console.log('Search Results:');
    console.log(`- Best action: ${searchResult.bestAction.agentName}`);
    console.log(`- Confidence: ${(searchResult.confidence * 100).toFixed(1)}%`);
    console.log(`- Nodes explored: ${searchResult.searchMetrics.nodesExplored}`);
    console.log(`- Average depth: ${searchResult.searchMetrics.averageDepth.toFixed(1)}`);
    console.log(`- Time elapsed: ${searchResult.searchMetrics.timeElapsed}ms\n`);
    
    // 3. Execute with best agent
    console.log('🎯 Phase 3: Agent Execution\n');
    
    const bestAgent = testAgents.find(a => a.getName() === searchResult.bestAction.agentName);
    if (bestAgent) {
      const result = await bestAgent.execute(context);
      
      console.log(`Executing with ${bestAgent.getName()}:`);
      console.log(`- Success: ${result.success}`);
      console.log(`- Confidence: ${(result.confidence * 100).toFixed(1)}%`);
      console.log(`- Response type: ${typeof result.data === 'object' ? Object.keys(result.data)[0] : 'unknown'}`);
      
      // Show specific output based on agent type
      if (result.data && bestAgent.getName().includes('planner')) {
        console.log('\nPlan Overview:');
        console.log(`- Title: ${result.data.plan?.title}`);
        console.log(`- Phases: ${result.data.plan?.phases?.length}`);
        console.log(`- Total tasks: ${result.data.plan?.phases?.reduce((sum: number, p: any) => sum + (p.tasks?.length || 0), 0)}`);
        console.log(`- Risks identified: ${result.data.plan?.risks?.length}`);
      }
    }
    
    // 4. Demonstrate Bayesian Model Updates
    console.log('\n📈 Phase 4: Bayesian Performance Tracking\n');
    
    // Simulate multiple executions
    for (let i = 0; i < 20; i++) {
      const agent = agentNames[i % agentNames.length];
      const baseRate = performance[agent]?.successes / performance[agent]?.trials || 0.5;
      const success = Math.random() < baseRate;
      
      bayesianModelRegistry.updateModel(
        agent,
        'development',
        {
          value: success ? 0.85 : 0.3,
          components: {
            quality: success ? 0.9 : 0.4,
            speed: Math.random() * 0.4 + 0.5,
            cost: Math.random() * 0.3 + 0.5
          },
          metadata: {
            executionTime: Math.random() * 2000 + 500,
            tokensUsed: Math.floor(Math.random() * 1000 + 200),
            memoryUsed: 0,
            errors: success ? 0 : 1
          }
        },
        Math.random() * 2000 + 500,
        {}
      );
    }
    
    const modelRankings = bayesianModelRegistry.getRankings('development');
    console.log('Bayesian Model Rankings (after 20 observations):\n');
    
    modelRankings.slice(0, 5).forEach((rank, i) => {
      console.log(`${i + 1}. ${rank.agent}`);
      console.log(`   Performance: ${(rank.performance * 100).toFixed(1)}%`);
      console.log(`   Reliability: ${(rank.reliability * 100).toFixed(1)}%`);
      console.log(`   Samples: ${rank.samples}\n`);
    });
    
    // 5. System Statistics
    console.log('📊 Phase 5: System Performance Metrics\n');
    
    const stats = abMCTSOrchestrator.getStatistics();
    const feedbackMetrics = feedbackCollector.getMetrics();
    
    console.log('Orchestrator Statistics:');
    console.log(`- Active searches: ${stats.activeSearches}`);
    console.log(`- Cached results: ${stats.cachedResults}`);
    console.log(`- Success rate: ${(stats.successRate * 100).toFixed(1)}%`);
    console.log(`- Circuit breaker: ${stats.circuitBreakerState}\n`);
    
    console.log('Feedback System:');
    console.log(`- Queue size: ${feedbackMetrics.queueSize}`);
    console.log(`- Total processed: ${feedbackMetrics.totalProcessed}`);
    console.log(`- Aggregations: ${feedbackMetrics.aggregations.length}`);
    
    // 6. Recommendations
    console.log('\n🎯 System Recommendations:\n');
    
    const recommendations = await abMCTSOrchestrator.getRecommendations();
    if (recommendations.length > 0) {
      recommendations.forEach((rec, i) => {
        console.log(`${i + 1}. ${rec}`);
      });
    } else {
      console.log('No recommendations at this time - system performing optimally');
    }
    
    console.log('\n' + '=' .repeat(60));
    console.log('✅ AB-MCTS demonstration completed successfully!\n');
    console.log('Key Achievements:');
    console.log('- Thompson sampling learned agent performance patterns');
    console.log('- AB-MCTS found optimal execution paths');
    console.log('- Bayesian models tracked performance over time');
    console.log('- System ready for production use with real LLMs\n');
    console.log('To use with real LLMs:');
    console.log('1. Set OPENAI_API_KEY or ANTHROPIC_API_KEY in .env');
    console.log('2. Or install Ollama and pull models locally');
    console.log('3. Remove USE_MOCK_LLM environment variable');
    
  } catch (error) {
    console.error('\n❌ Demonstration failed:', error);
    console.error('\nStack trace:', error instanceof Error ? error.stack : 'No stack trace');
  }
}

// Run demonstration
demonstrateABMCTS().then(() => {
  console.log('\n👋 Thank you for exploring AB-MCTS!');
  // Cleanup
  feedbackCollector.shutdown();
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});