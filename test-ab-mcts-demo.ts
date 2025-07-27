#!/usr/bin/env ts-node

/**
 * AB-MCTS Demo Script
 * Tests the revolutionary AI orchestration system
 */

import { abMCTSService } from './src/services/ab-mcts-service';
import { abMCTSOrchestrator } from './src/services/ab-mcts-orchestrator';
import { feedbackCollector } from './src/services/feedback-collector';
import { bayesianModelRegistry } from './src/utils/bayesian-model';
import { ThompsonSelector, adaptiveExplorer } from './src/utils/thompson-sampling';
import { AgentContext, ABMCTSFeedback } from './src/types/ab-mcts';
import { log, LogContext } from './src/utils/logger';
  private agents = [
    { name: 'planner-agent', type: 'cognitive', capabilities: ['planning', 'reasoning'] },
    { name: 'code-agent', type: 'cognitive', capabilities: ['coding', 'debugging'] },
    { name: 'research-agent', type: 'cognitive', capabilities: ['research', 'analysis'] },
    { name: 'creative-agent', type: 'cognitive', capabilities: ['creative', 'writing'] }
  ];

  getAgents() {
    return this.agents.map(a => ({
      getName: () => a.name,
      getCapabilities: () => a.capabilities,
      getProbabilisticScore: (context: AgentContext) => Math.random() * 0.8 + 0.2,
      executeWithFeedback: async (context: AgentContext) => {
        // Simulate agent execution
        const executionTime = Math.random() * 2000 + 500;
        await new Promise(resolve => setTimeout(resolve, executionTime));
        
        const success = Math.random() > 0.3;
        const confidence = success ? Math.random() * 0.4 + 0.6 : Math.random() * 0.3;
        
        return {
          response: {
            success,
            data: { result: `${a.name} completed task` },
            confidence,
            message: `Executed by ${a.name}`,
            reasoning: `Used ${a.capabilities.join(', ')} capabilities`,
            metadata: {
              agent: a.name,
              executionTime,
              tokens: { total_tokens: Math.floor(Math.random() * 500 + 100) }
            }
          },
          feedback: {
            nodeId: context.metadata?.nodeId || 'test-node',
            reward: {
              value: success ? confidence : confidence * 0.5,
              components: {
                quality: confidence,
                speed: 1 - (executionTime / 3000),
                cost: 0.7,
                user_satisfaction: confidence
              },
              metadata: {
                executionTime,
                tokensUsed: Math.floor(Math.random() * 500 + 100),
                memoryUsed: 0,
                errors: success ? 0 : 1
              }
            },
            errorOccurred: !success,
            timestamp: Date.now(),
            context: {
              taskType: 'demo',
              sessionId: context.requestId
            }
          }
        };
      },
      getPerformanceMetrics: () => ({
        successRate: Math.random() * 0.4 + 0.5,
        confidenceInterval: [0.4, 0.8] as [number, number],
        executionCount: Math.floor(Math.random() * 100),
        averageReward: Math.random() * 0.3 + 0.5,
        recentTrend: 'stable' as const,
        spawnCount: 0
      })
    }));
  }

  getInstance() { return this; }
}

// Test functions
async function testThompsonSampling() {
  console.log('\n🎲 Testing Thompson Sampling...\n');
  
  const selector = new ThompsonSelector();
  const arms = ['fast-model', 'accurate-model', 'balanced-model'];
  
  selector.initializeArms(arms, 1, 1);
  
  // Simulate 20 rounds
  for (let i = 0; i < 20; i++) {
    const selected = selector.selectArm();
    const success = Math.random() > (selected === 'accurate-model' ? 0.3 : 0.6);
    
    selector.updateArm(selected, success);
    
    if (i % 5 === 4) {
      console.log(`Round ${i + 1}: Selected ${selected}, Success: ${success}`);
      console.log('Current rankings:', selector.getRankedArms());
    }
  }
}

async function testBayesianModel() {
  console.log('\n📊 Testing Bayesian Performance Model...\n');
  
  const agents = ['planner-agent', 'code-agent'];
  const taskType = 'test-task';
  
  // Simulate observations
  for (let i = 0; i < 10; i++) {
    const agent = agents[Math.floor(Math.random() * agents.length)];
    const success = Math.random() > 0.4;
    
    bayesianModelRegistry.updateModel(
      agent,
      taskType,
      {
        value: success ? 0.8 : 0.3,
        components: { quality: 0.7, speed: 0.8, cost: 0.6 },
        metadata: { executionTime: 1000, tokensUsed: 200, memoryUsed: 0, errors: 0 }
      },
      1000,
      {}
    );
  }
  
  // Get best agent
  const best = bayesianModelRegistry.getBestAgent(taskType, agents);
  console.log('Best agent:', best);
  
  // Get rankings
  const rankings = bayesianModelRegistry.getRankings(taskType);
  console.log('Rankings:', rankings);
}

async function testABMCTSSearch() {
  console.log('\n🌳 Testing AB-MCTS Tree Search...\n');
  
  const context: AgentContext = {
    userRequest: 'Create a REST API for user management',
    requestId: 'test-123',
    userId: 'demo-user',
    metadata: {
      taskType: 'development',
      complexity: 'medium'
    }
  };
  
  const availableAgents = ['planner-agent', 'code-agent', 'research-agent'];
  
  const searchResult = await abMCTSService.search(
    context,
    availableAgents,
    {
      useCache: false,
      enableParallelism: true,
      collectFeedback: true,
      visualize: true
    }
  );
  
  console.log('Search completed:');
  console.log('- Best action:', searchResult.bestAction);
  console.log('- Confidence:', searchResult.confidence);
  console.log('- Path length:', searchResult.bestPath.length);
  console.log('- Nodes explored:', searchResult.searchMetrics.nodesExplored);
  console.log('- Recommendations:', searchResult.recommendations);
}

async function testOrchestrator() {
  console.log('\n🎯 Testing AB-MCTS Orchestrator...\n');
  
  // Create mock agents
  const mockRegistry = new MockAgentRegistry();
  const mockAgents = mockRegistry.getAgents();
  
  // Set mock agents in orchestrator
  (abMCTSOrchestrator as any).setMockAgents(mockAgents);
  
  const context: AgentContext = {
    userRequest: 'Analyze this codebase and suggest improvements',
    requestId: 'orch-test-456',
    userId: 'demo-user',
    metadata: {
      taskType: 'analysis',
      requiredCapabilities: ['research', 'analysis']
    }
  };
  
  try {
    const result = await abMCTSOrchestrator.orchestrate(context, {
      useCache: false,
      collectFeedback: true,
      visualize: true
    });
    
    console.log('Orchestration result:');
    console.log('- Success:', result.response.success);
    console.log('- Confidence:', result.response.confidence);
    console.log('- Best agent:', result.searchResult.bestAction.agentName);
    console.log('- Execution path:', result.executionPath);
    console.log('- Total time:', result.totalTime, 'ms');
    console.log('- Resources used:', result.resourcesUsed);
    
    // Test user feedback
    if (result.response.success) {
      await abMCTSOrchestrator.processUserFeedback('orch-test-456', 4, 'Good result!');
      console.log('\n✅ User feedback processed');
    }
    
  } catch (error) {
    console.error('Orchestration failed:', error);
  }
}

async function testFeedbackCollector() {
  console.log('\n📈 Testing Feedback Collector...\n');
  
  // Collect some feedback
  for (let i = 0; i < 5; i++) {
    const feedback: ABMCTSFeedback = {
      nodeId: `node-${i}`,
      reward: {
        value: Math.random(),
        components: {
          quality: Math.random(),
          speed: Math.random(),
          cost: Math.random()
        },
        metadata: {
          executionTime: Math.random() * 2000,
          tokensUsed: Math.floor(Math.random() * 500),
          memoryUsed: 0,
          errors: Math.random() > 0.8 ? 1 : 0
        }
      },
      errorOccurred: Math.random() > 0.8,
      timestamp: Date.now(),
      context: {
        taskType: 'test',
        sessionId: 'test-session'
      }
    };
    
    await feedbackCollector.collectFeedback(feedback);
  }
  
  // Get metrics
  const metrics = feedbackCollector.getMetrics();
  console.log('Feedback metrics:');
  console.log('- Queue size:', metrics.queueSize);
  console.log('- Total processed:', metrics.totalProcessed);
  console.log('- Aggregations:', metrics.aggregations.length);
  
  // Generate report
  const report = feedbackCollector.generateReport();
  console.log('\nFeedback report:');
  console.log('- Total feedbacks:', report.summary.totalFeedbacks);
  console.log('- Average quality:', report.summary.averageQuality.toFixed(2));
  console.log('- Recommendations:', report.recommendations);
}

async function testVisualization() {
  console.log('\n🎨 Testing Tree Visualization...\n');
  
  // Create a simple tree
  const context: AgentContext = {
    userRequest: 'Visualize tree structure',
    requestId: 'viz-test',
    userId: 'demo'
  };
  
  await abMCTSService.search(
    context,
    ['agent1', 'agent2', 'agent3'],
    { useCache: false }
  );
  
  const vizData = abMCTSService.getVisualizationData();
  if (vizData) {
    console.log('Visualization data:');
    console.log('- Total nodes:', vizData.metrics.totalNodes);
    console.log('- Max depth:', vizData.metrics.maxDepth);
    console.log('- Branching factor:', vizData.metrics.avgBranchingFactor.toFixed(2));
    console.log('- Sample nodes:', vizData.nodes.slice(0, 3));
  }
}

// Main test runner
async function runAllTests() {
  console.log('🚀 AB-MCTS System Test Suite\n');
  console.log('=' .repeat(50));
  
  try {
    await testThompsonSampling();
    await testBayesianModel();
    await testABMCTSSearch();
    await testOrchestrator();
    await testFeedbackCollector();
    await testVisualization();
    
    console.log('\n' + '=' .repeat(50));
    console.log('✅ All tests completed successfully!');
    
    // Get final statistics
    const stats = abMCTSOrchestrator.getStatistics();
    console.log('\nFinal statistics:');
    console.log('- Active searches:', stats.activeSearches);
    console.log('- Success rate:', (stats.successRate * 100).toFixed(1) + '%');
    console.log('- Circuit breaker:', stats.circuitBreakerState);
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
  }
  
  // Cleanup
  feedbackCollector.shutdown();
}

// Run tests
runAllTests().then(() => {
  console.log('\n👋 Demo complete!');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});