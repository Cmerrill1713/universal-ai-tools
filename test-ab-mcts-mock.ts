#!/usr/bin/env tsx

/**
 * AB-MCTS Mock Test
 * Tests the AB-MCTS system with mock LLM responses for demonstration
 */

import { AgentContext, AgentResponse } from './src/types';
import { abMCTSService } from './src/services/ab-mcts-service';
import { abMCTSOrchestrator } from './src/services/ab-mcts-orchestrator';
import { bayesianModelRegistry } from './src/utils/bayesian-model';
import { ThompsonSelector } from './src/utils/thompson-sampling';

// Mock LLM service for testing without API keys
class MockLLMService {
  private responses = new Map<string, any>();
  
  constructor() {
    // Pre-configure responses for different agent types
    this.responses.set('planner', {
      plan: {
        title: 'REST API Development Plan',
        overview: 'Comprehensive plan for building a user management REST API',
        phases: [
          {
            name: 'Design Phase',
            duration: '2 days',
            tasks: [
              {
                id: 'task_1',
                title: 'Define API endpoints',
                description: 'Design RESTful endpoints for user CRUD operations',
                dependencies: [],
                resources: ['API designer', 'REST guidelines'],
                priority: 'high',
                estimatedHours: 4
              }
            ]
          }
        ],
        risks: [
          {
            description: 'Authentication complexity',
            probability: 'medium',
            impact: 'high',
            mitigation: 'Use proven JWT library'
          }
        ],
        success_criteria: ['All endpoints documented', 'Tests passing', 'Security review complete']
      },
      reasoning: 'Created comprehensive plan based on REST best practices',
      confidence: 0.85,
      next_steps: ['Set up project structure', 'Define data models']
    });
    
    this.responses.set('retriever', {
      findings: [
        'REST API best practices: Use HTTP verbs correctly',
        'User management requires authentication and authorization',
        'Consider rate limiting and input validation'
      ],
      sources: ['RFC 7231', 'OWASP guidelines'],
      confidence: 0.9
    });
    
    this.responses.set('synthesizer', {
      synthesis: 'Based on the plan and research, the API should implement JWT authentication, follow RESTful conventions, and include comprehensive error handling.',
      key_points: ['Security first', 'RESTful design', 'Comprehensive testing'],
      confidence: 0.88
    });
  }
  
  async execute(agent: string, context: AgentContext): Promise<any> {
    // Simulate execution time
    await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 200));
    
    // Simulate occasional failures
    if (Math.random() < 0.1) {
      throw new Error(`Mock failure for ${agent}`);
    }
    
    return this.responses.get(agent.split('-')[0]) || {
      result: `${agent} completed task`,
      confidence: 0.7
    };
  }
}

// Monkey-patch the multi-tier LLM service
const mockLLM = new MockLLMService();
import('./src/services/multi-tier-llm-service').then(module => {
  module.multiTierLLM.execute = async (prompt: string, context: any) => {
    const agent = context.agent || 'general';
    const response = await mockLLM.execute(agent, { userRequest: prompt, requestId: 'mock', userId: 'test' });
    return {
      response,
      metadata: {
        modelUsed: 'mock-llm',
        tokensUsed: Math.floor(Math.random() * 500 + 100),
        executionTime: Date.now()
      }
    };
  };
});

async function runMockTest() {
  console.log('🚀 AB-MCTS Mock Test Suite\n');
  console.log('=' .repeat(50));
  console.log('\nRunning with mock LLM responses for demonstration...\n');
  
  try {
    // Test 1: Thompson Sampling
    console.log('🎲 Testing Thompson Sampling...\n');
    const selector = new ThompsonSelector();
    const agents = ['planner-agent', 'retriever-agent', 'synthesizer-agent'];
    selector.initializeArms(agents, 1, 1);
    
    // Simulate learning
    for (let i = 0; i < 20; i++) {
      const selected = selector.selectArm();
      // Planner has 80% success, others 60%
      const success = Math.random() < (selected.includes('planner') ? 0.8 : 0.6);
      selector.updateArm(selected, success);
      
      if (i === 19) {
        console.log('After 20 rounds of learning:');
        console.log('Agent rankings:', selector.getRankedArms());
      }
    }
    
    // Test 2: AB-MCTS Search
    console.log('\n🌳 Testing AB-MCTS Tree Search...\n');
    
    const context: AgentContext = {
      userRequest: 'Create a REST API for user management with authentication',
      requestId: 'mock-test-1',
      userId: 'demo-user',
      metadata: {
        taskType: 'development',
        complexity: 'medium',
        mockMode: true
      }
    };
    
    const searchResult = await abMCTSService.search(
      context,
      ['planner-agent', 'retriever-agent', 'synthesizer-agent'],
      {
        useCache: false,
        enableParallelism: true,
        collectFeedback: true
      }
    );
    
    console.log('Search completed:');
    console.log('- Best action:', searchResult.bestAction.agentName);
    console.log('- Confidence:', searchResult.confidence.toFixed(3));
    console.log('- Nodes explored:', searchResult.searchMetrics.nodesExplored);
    console.log('- Search time:', searchResult.searchMetrics.timeElapsed, 'ms');
    
    // Test 3: Orchestration
    console.log('\n🎯 Testing AB-MCTS Orchestration...\n');
    
    // Configure orchestrator for mock mode
    (abMCTSOrchestrator as any).config.fallbackToTraditional = true;
    
    const orchResult = await abMCTSOrchestrator.orchestrate(context, {
      useCache: false,
      collectFeedback: true
    });
    
    console.log('Orchestration result:');
    console.log('- Success:', orchResult.response.success);
    console.log('- Confidence:', orchResult.response.confidence?.toFixed(3));
    console.log('- Execution path:', orchResult.executionPath.join(' → '));
    console.log('- Total time:', orchResult.totalTime, 'ms');
    
    // Test 4: Bayesian Model Updates
    console.log('\n📊 Testing Bayesian Performance Tracking...\n');
    
    // Simulate performance observations
    for (let i = 0; i < 10; i++) {
      const agent = agents[i % agents.length];
      const success = Math.random() < (agent.includes('planner') ? 0.85 : 0.7);
      
      bayesianModelRegistry.updateModel(
        agent,
        'development',
        {
          value: success ? 0.9 : 0.3,
          components: {
            quality: success ? 0.9 : 0.4,
            speed: 0.7,
            cost: 0.6
          },
          metadata: {
            executionTime: Math.random() * 1000 + 500,
            tokensUsed: Math.floor(Math.random() * 300 + 100),
            memoryUsed: 0,
            errors: success ? 0 : 1
          }
        },
        Math.random() * 1000 + 500,
        {}
      );
    }
    
    const bestAgent = bayesianModelRegistry.getBestAgent('development', agents);
    const rankings = bayesianModelRegistry.getRankings('development');
    
    console.log('Best agent for development tasks:', bestAgent);
    console.log('Performance rankings:');
    rankings.slice(0, 3).forEach((r, i) => {
      console.log(`${i + 1}. ${r.agent}: ${r.performance.toFixed(3)} (${r.samples} samples)`);
    });
    
    // Test 5: Statistics
    console.log('\n📈 System Statistics...\n');
    const stats = abMCTSOrchestrator.getStatistics();
    console.log('- Active searches:', stats.activeSearches);
    console.log('- Cached results:', stats.cachedResults);
    console.log('- Success rate:', (stats.successRate * 100).toFixed(1) + '%');
    console.log('- Circuit breaker:', stats.circuitBreakerState);
    
    console.log('\n' + '=' .repeat(50));
    console.log('✅ Mock test completed successfully!');
    console.log('\nThe AB-MCTS system is working correctly in mock mode.');
    console.log('To use with real LLMs, configure API keys as shown in AB_MCTS_SETUP_GUIDE.md');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
  }
}

// Run the mock test
runMockTest().then(() => {
  console.log('\n👋 Mock test complete!');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});