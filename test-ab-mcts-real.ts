#!/usr/bin/env ts-node

/**
 * AB-MCTS Real System Test
 * Tests the AB-MCTS with real enhanced agents
 */

import { abMCTSService } from './src/services/ab-mcts-service';
import { abMCTSOrchestrator } from './src/services/ab-mcts-orchestrator';
import { feedbackCollector } from './src/services/feedback-collector';
import { bayesianModelRegistry } from './src/utils/bayesian-model';
import { ThompsonSelector, adaptiveExplorer } from './src/utils/thompson-sampling';
import { AgentContext, ABMCTSFeedback } from './src/types/ab-mcts';
import AgentRegistry from './src/agents/agent-registry';
import { log, LogContext } from './src/utils/logger';

// Test functions
async function testThompsonSampling() {
  console.log('\n🎲 Testing Thompson Sampling...\n');
  
  const selector = new ThompsonSelector();
  const arms = ['planner', 'retriever', 'synthesizer'];
  
  selector.initializeArms(arms, 1, 1);
  
  // Simulate 20 rounds
  for (let i = 0; i < 20; i++) {
    const selected = selector.selectArm();
    const success = Math.random() > (selected === 'planner' ? 0.3 : 0.6);
    
    selector.updateArm(selected, success);
    
    if (i % 5 === 4) {
      console.log(`Round ${i + 1}: Selected ${selected}, Success: ${success}`);
      console.log('Current rankings:', selector.getRankedArms());
    }
  }
}

async function testBayesianModel() {
  console.log('\n📊 Testing Bayesian Performance Model...\n');
  
  const agents = ['planner', 'code_assistant'];
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
  console.log('\n🌳 Testing AB-MCTS Tree Search with Real Agents...\n');
  
  const registry = new AgentRegistry();
  const availableAgents = registry.getAvailableAgents().map(def => def.name);
  
  console.log('Available agents:', availableAgents);
  
  const context: AgentContext = {
    userRequest: 'Create a comprehensive plan for building a REST API',
    requestId: 'test-123',
    userId: 'demo-user',
    metadata: {
      taskType: 'planning',
      complexity: 'medium',
      requiredCapabilities: ['planning', 'task_decomposition']
    }
  };
  
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
  console.log('\n🎯 Testing AB-MCTS Orchestrator with Real Agents...\n');
  
  const context: AgentContext = {
    userRequest: 'Analyze this codebase and suggest improvements',
    requestId: 'orch-test-456',
    userId: 'demo-user',
    metadata: {
      taskType: 'analysis',
      requiredCapabilities: ['analysis', 'synthesis']
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
    console.log('- Response data:', JSON.stringify(result.response.data, null, 2));
    
    // Test user feedback
    if (result.response.success) {
      await abMCTSOrchestrator.processUserFeedback('orch-test-456', 4, 'Good result!');
      console.log('\n✅ User feedback processed');
    }
    
  } catch (error) {
    console.error('Orchestration failed:', error);
  }
}

async function testParallelOrchestration() {
  console.log('\n🚀 Testing Parallel AB-MCTS Orchestration...\n');
  
  const contexts: AgentContext[] = [
    {
      userRequest: 'Create a task plan for the project',
      requestId: 'parallel-1',
      userId: 'demo-user',
      metadata: { taskType: 'planning', requiredCapabilities: ['planning'] }
    },
    {
      userRequest: 'Research best practices for REST APIs',
      requestId: 'parallel-2',
      userId: 'demo-user',
      metadata: { taskType: 'research', requiredCapabilities: ['information_retrieval'] }
    },
    {
      userRequest: 'Synthesize the findings into a report',
      requestId: 'parallel-3',
      userId: 'demo-user',
      metadata: { taskType: 'synthesis', requiredCapabilities: ['synthesis'] }
    }
  ];
  
  try {
    const results = await abMCTSOrchestrator.orchestrateParallel(contexts, {
      useCache: false,
      collectFeedback: true
    });
    
    console.log(`Completed ${results.length} parallel orchestrations:`);
    results.forEach((result, index) => {
      console.log(`\n${index + 1}. ${contexts[index].userRequest}`);
      console.log(`   - Success: ${result.response.success}`);
      console.log(`   - Agent: ${result.executionPath.join(' → ')}`);
      console.log(`   - Time: ${result.totalTime}ms`);
    });
  } catch (error) {
    console.error('Parallel orchestration failed:', error);
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
  console.log('- Top performers:', report.summary.topPerformers);
  console.log('- Needs improvement:', report.summary.needsImprovement);
  console.log('- Recommendations:', report.recommendations);
}

async function testAgentRegistry() {
  console.log('\n🤖 Testing Agent Registry...\n');
  
  const registry = new AgentRegistry();
  
  // Get available agents
  const available = registry.getAvailableAgents();
  console.log(`Found ${available.length} available agents:`);
  available.forEach(agent => {
    console.log(`- ${agent.name}: ${agent.description}`);
    console.log(`  Capabilities: ${agent.capabilities.join(', ')}`);
  });
  
  // Load and test a specific agent
  const planner = await registry.getAgent('planner');
  if (planner) {
    console.log('\n✅ Successfully loaded planner agent');
    console.log('- Name:', planner.getName());
    console.log('- Capabilities:', planner.getCapabilities());
    
    // Test execution
    const testContext: AgentContext = {
      userRequest: 'Create a simple project plan',
      requestId: 'test-planner',
      userId: 'demo'
    };
    
    console.log('\nTesting planner execution...');
    const result = await planner.execute(testContext);
    console.log('- Success:', result.success);
    console.log('- Confidence:', result.confidence);
    console.log('- Message:', result.message);
  }
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
    ['planner', 'retriever', 'synthesizer'],
    { useCache: false }
  );
  
  const vizData = abMCTSService.getVisualizationData();
  if (vizData) {
    console.log('Visualization data:');
    console.log('- Total nodes:', vizData.metrics.totalNodes);
    console.log('- Max depth:', vizData.metrics.maxDepth);
    console.log('- Branching factor:', vizData.metrics.avgBranchingFactor.toFixed(2));
    console.log('- Exploration rate:', (vizData.metrics.explorationRate * 100).toFixed(1) + '%');
    console.log('- Sample nodes:', vizData.nodes.slice(0, 3).map(n => ({
      id: n.id.substring(0, 8),
      label: n.label,
      score: n.score.toFixed(3),
      visits: n.visits
    })));
  }
}

// Main test runner
async function runAllTests() {
  console.log('🚀 AB-MCTS Real System Test Suite\n');
  console.log('=' .repeat(50));
  
  try {
    // Test individual components
    await testThompsonSampling();
    await testBayesianModel();
    await testAgentRegistry();
    
    // Test AB-MCTS search
    await testABMCTSSearch();
    
    // Test orchestration
    await testOrchestrator();
    await testParallelOrchestration();
    
    // Test feedback and visualization
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
    console.log('- Cached results:', stats.cachedResults);
    
    // Get recommendations
    const recommendations = await abMCTSOrchestrator.getRecommendations();
    if (recommendations.length > 0) {
      console.log('\nRecommendations:');
      recommendations.forEach(rec => console.log('- ' + rec));
    }
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
  }
  
  // Cleanup
  const registry = new AgentRegistry();
  await registry.shutdown();
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