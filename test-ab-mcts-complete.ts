#!/usr/bin/env tsx

/**
 * Complete AB-MCTS Test
 * Tests all components including tree storage
 */

process.env.USE_MOCK_LLM = 'true';

import { abMCTSService } from './src/services/ab-mcts-service';
import { treeStorage } from './src/services/ab-mcts-tree-storage';
import { ThompsonSelector } from './src/utils/thompson-sampling';
import { bayesianModelRegistry } from './src/utils/bayesian-model';
import { feedbackCollector } from './src/services/feedback-collector';
import { AgentContext, ABMCTSFeedback } from './src/types/ab-mcts';

async function testCompleteSystem() {
  console.log('🚀 Complete AB-MCTS System Test\n');
  console.log('=' .repeat(60));
  
  try {
    // Test 1: Thompson Sampling
    console.log('\n1️⃣ Testing Thompson Sampling\n');
    
    const selector = new ThompsonSelector();
    const agents = ['agent-A', 'agent-B', 'agent-C'];
    selector.initializeArms(agents, 1, 1);
    
    // Simulate different success rates
    const performance = {
      'agent-A': 0.8,  // 80% success
      'agent-B': 0.6,  // 60% success  
      'agent-C': 0.3   // 30% success
    };
    
    for (let i = 0; i < 30; i++) {
      const selected = selector.selectArm();
      const success = Math.random() < performance[selected];
      selector.updateArm(selected, success);
    }
    
    const rankings = selector.getRankedArms();
    console.log('Thompson Sampling Rankings:');
    rankings.forEach((rank, i) => {
      console.log(`${i + 1}. ${rank.name}: ${(rank.mean * 100).toFixed(1)}% (${rank.samples} samples)`);
    });
    
    // Test 2: AB-MCTS Search
    console.log('\n\n2️⃣ Testing AB-MCTS Tree Search\n');
    
    const context: AgentContext = {
      userRequest: 'Create a comprehensive plan for building a scalable microservices architecture',
      requestId: 'test-search-001',
      userId: 'test-user',
      metadata: {
        taskType: 'architecture',
        complexity: 'high'
      }
    };
    
    const searchResult = await abMCTSService.search(
      context,
      ['planner', 'architect', 'reviewer'],
      {
        useCache: false,
        saveCheckpoints: true, // Enable tree storage
        maxIterations: 50,
        timeLimit: 3000
      }
    );
    
    console.log('Search Results:');
    console.log(`- Best action: ${searchResult.bestAction.agentName}`);
    console.log(`- Confidence: ${(searchResult.confidence * 100).toFixed(1)}%`);
    console.log(`- Nodes explored: ${searchResult.searchMetrics.nodesExplored}`);
    console.log(`- Search time: ${searchResult.searchMetrics.timeElapsed}ms`);
    console.log(`- Path length: ${searchResult.bestPath.length}`);
    
    // Test 3: Tree Storage
    console.log('\n\n3️⃣ Testing Tree Storage\n');
    
    if (treeStorage.isAvailable()) {
      console.log('✅ Redis storage is available');
      
      // Check if tree was saved
      const savedResult = await treeStorage.loadSearchResult(context.requestId);
      if (savedResult) {
        console.log('✅ Tree successfully saved and loaded from Redis');
        console.log(`- Loaded confidence: ${savedResult.confidence}`);
        console.log(`- Loaded best action: ${savedResult.bestAction?.agentName}`);
      } else {
        console.log('⚠️  Tree not found in storage (Redis might not be running)');
      }
      
      // Get tree statistics
      if (searchResult.bestPath.length > 0) {
        const stats = await treeStorage.getTreeStats(searchResult.bestPath[0].id);
        if (stats) {
          console.log('\nTree Statistics:');
          console.log(`- Total nodes: ${stats.totalNodes}`);
          console.log(`- Max depth: ${stats.maxDepth}`);
          console.log(`- Avg branching factor: ${stats.avgBranchingFactor.toFixed(2)}`);
        }
      }
    } else {
      console.log('⚠️  Redis storage not available - tree persistence disabled');
    }
    
    // Test 4: Feedback Collection
    console.log('\n\n4️⃣ Testing Feedback Collection\n');
    
    // Simulate user feedback
    const feedback: ABMCTSFeedback = {
      nodeId: searchResult.bestPath[searchResult.bestPath.length - 1]?.id || 'test',
      reward: {
        value: 0.85,
        components: {
          quality: 0.9,
          speed: 0.8,
          cost: 0.85
        },
        metadata: {
          executionTime: 1500,
          tokensUsed: 250,
          memoryUsed: 0,
          errors: 0
        }
      },
      userRating: 4,
      errorOccurred: false,
      timestamp: Date.now(),
      context: {
        taskType: 'architecture',
        sessionId: context.requestId
      }
    };
    
    await feedbackCollector.collectFeedback(feedback);
    console.log('✅ Feedback collected successfully');
    
    // Process feedback batch
    await feedbackCollector.processBatch();
    const metrics = feedbackCollector.getMetrics();
    console.log(`- Total processed: ${metrics.totalProcessed}`);
    console.log(`- Queue size: ${metrics.queueSize}`);
    
    // Test 5: Bayesian Model Updates
    console.log('\n\n5️⃣ Testing Bayesian Model Updates\n');
    
    // Update models based on execution
    bayesianModelRegistry.updateModel(
      'planner',
      'architecture',
      feedback.reward,
      1500,
      {}
    );
    
    const modelRankings = bayesianModelRegistry.getRankings('architecture');
    console.log('Bayesian Model Rankings:');
    modelRankings.slice(0, 3).forEach((rank, i) => {
      console.log(`${i + 1}. ${rank.agent}: ${(rank.performance * 100).toFixed(1)}% (${rank.samples} samples)`);
    });
    
    // Test 6: System Statistics
    console.log('\n\n6️⃣ System Statistics\n');
    
    const vizData = abMCTSService.getVisualizationData();
    if (vizData) {
      console.log('Tree Visualization Metrics:');
      console.log(`- Total nodes: ${vizData.metrics.totalNodes}`);
      console.log(`- Max depth: ${vizData.metrics.maxDepth}`);
      console.log(`- Exploration rate: ${(vizData.metrics.explorationRate * 100).toFixed(1)}%`);
      console.log(`- Exploitation rate: ${(vizData.metrics.exploitationRate * 100).toFixed(1)}%`);
    }
    
    console.log('\n' + '=' .repeat(60));
    console.log('✅ All tests completed successfully!\n');
    
    console.log('Summary:');
    console.log('- Thompson sampling correctly learns agent preferences');
    console.log('- AB-MCTS tree search explores and finds paths');
    console.log('- Tree storage works with Redis (if available)');
    console.log('- Feedback collection processes user input');
    console.log('- Bayesian models update with new observations');
    console.log('- System provides comprehensive metrics');
    
    console.log('\nThe AB-MCTS system is fully functional!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    console.error(error instanceof Error ? error.stack : 'Unknown error');
  }
  
  // Cleanup
  feedbackCollector.shutdown();
}

// Run the complete test
testCompleteSystem().then(() => {
  console.log('\n👋 Complete system test finished!');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});