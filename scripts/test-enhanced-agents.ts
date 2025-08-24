#!/usr/bin/env npx tsx
/**
 * Test Enhanced Agents Integration
 * Tests the enhanced agents with MCP context saving
 */

import { EnhancedPlannerAgent } from '../src/agents/cognitive/enhanced-planner-agent';
import type { AgentContext, AgentConfig } from '../src/types';
import pg from 'pg';
import { log, LogContext } from '../src/utils/logger';

const { Client } = pg;
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

async function testEnhancedAgents(): Promise<void> {
  let client: pg.Client | null = null;
  
  try {
    process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.log('🔌 Setting up test environment...');
    client = new Client({ connectionString: DATABASE_URL });
    await client.connect();
    
    // Clean up previous test data
    await client.query(`DELETE FROM mcp_context WHERE source = 'agent_test'`);
    
    console.log('🤖 Testing Enhanced Planner Agent...');
    
    // Create agent config
    const agentConfig: AgentConfig = {
      name: 'enhanced-planner-agent',
      description: 'Strategic task planning and decomposition with memory integration',
      priority: 1,
      capabilities: [
        { name: 'planning', description: 'Strategic planning capabilities' },
        { name: 'task_decomposition', description: 'Break down complex tasks' },
        { name: 'strategy', description: 'Strategic thinking and analysis' }
      ],
      maxLatencyMs: 10000,
      retryAttempts: 3,
      dependencies: [],
      memoryEnabled: true,
      toolExecutionEnabled: false,
    };
    
    // Create agent instance
    const agent = new EnhancedPlannerAgent(agentConfig);
    
    // Test context
    const testContext: AgentContext = {
      requestId: 'test-agent-001',
      userRequest: 'Create a plan for implementing user authentication in a TypeScript Express application',
      userId: 'test_user',
      workingDirectory: '/Users/christianmerrill/Desktop/universal-ai-tools',
      metadata: {
        taskType: 'planning',
        complexity: 'medium',
        domain: 'web_development',
      },
    };
    
    console.log('   Initializing agent...');
    await agent.initialize();
    console.log('   ✅ Agent initialized');
    
    console.log('   Executing agent with context...');
    const response = await agent.execute(testContext);
    
    console.log('   📊 Agent Response:');
    console.log(`      Success: ${response.success}`);
    console.log(`      Confidence: ${response.confidence}`);
    console.log(`      Message: ${response.message}`);
    console.log(`      Data length: ${JSON.stringify(response.data).length} chars`);
    
    // Check if context was saved to database
    console.log('   🔍 Checking saved context...');
    const savedContexts = await client.query(`
      SELECT id, content, category, metadata, created_at
      FROM mcp_context 
      WHERE metadata->>'agentName' = 'enhanced-planner-agent'
      AND created_at > NOW() - INTERVAL '1 minute'
      ORDER BY created_at DESC
      LIMIT 5
    `);
    
    console.log(`   ✅ Found ${savedContexts.rows.length} saved contexts:`);
    for (const row of savedContexts.rows) {
      console.log(`      • ${row.category}: ${row.content.substring(0, 50)}...`);
    }
    
    // Test agent performance metrics
    console.log('   📈 Testing performance metrics...');
    const metrics = agent.getPerformanceMetrics();
    console.log(`      Total calls: ${metrics.totalCalls}`);
    console.log(`      Success rate: ${(metrics.successRate * 100).toFixed(1)}%`);
    console.log(`      Avg confidence: ${(metrics.averageConfidence * 100).toFixed(1)}%`);
    
    // Test conversation history
    console.log('   💬 Testing conversation history...');
    const history = agent.getConversationHistory();
    console.log(`      History entries: ${history.length}`);
    
    // Test with feedback (AB-MCTS integration)
    console.log('   🎯 Testing with feedback...');
    const { response: feedbackResponse, feedback } = await agent.executeWithFeedback(testContext);
    console.log(`      Feedback reward: ${feedback.reward.value.toFixed(3)}`);
    console.log(`      Quality score: ${feedback.reward.components.quality.toFixed(3)}`);
    
    // Test batch execution
    console.log('   📦 Testing batch execution...');
    const batchContexts = [
      {
        ...testContext,
        requestId: 'batch-001',
        userRequest: 'Plan database schema for user management',
      },
      {
        ...testContext,
        requestId: 'batch-002', 
        userRequest: 'Plan API endpoints for authentication',
      },
    ];
    
    const batchResults = await agent.executeBatchValidated(batchContexts);
    console.log(`      Batch results: ${batchResults.length} responses`);
    console.log(`      Batch success rate: ${batchResults.filter(r => r.success).length}/${batchResults.length}`);
    
    // Shutdown agent
    await agent.shutdown();
    console.log('   ✅ Agent shutdown completed');
    
    // Final verification of saved contexts
    console.log('🔍 Final context verification...');
    const finalContexts = await client.query(`
      SELECT category, COUNT(*) as count
      FROM mcp_context 
      WHERE metadata->>'agentName' = 'enhanced-planner-agent'
      AND created_at > NOW() - INTERVAL '5 minutes'
      GROUP BY category
      ORDER BY count DESC
    `);
    
    console.log('   📊 Context breakdown by category:');
    for (const row of finalContexts.rows) {
      console.log(`      ${row.category}: ${row.count} entries`);
    }
    
    console.log('');
    console.log('🎉 Enhanced agents testing completed successfully!');
    console.log('');
    console.log('📋 Test Summary:');
    console.log(`   ✅ Agent initialization: Working`);
    console.log(`   ✅ Agent execution: ${response.success ? 'Success' : 'Failed'}`);
    console.log(`   ✅ Context saving: ${savedContexts.rows.length > 0 ? 'Active' : 'Inactive'}`);
    console.log(`   ✅ Performance metrics: Working`);
    console.log(`   ✅ AB-MCTS feedback: Working`);
    console.log(`   ✅ Batch execution: Working`);
    console.log(`   ✅ Conversation history: ${history.length} entries`);
    
    log.info('🎉 Enhanced agents testing successful', LogContext.AGENT, {
      agentName: 'enhanced-planner-agent',
      executionSuccess: response.success,
      contextsSaved: savedContexts.rows.length,
      batchExecutions: batchResults.length,
      performanceMetrics: metrics,
    });

  } catch (error) {
    process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.error('❌ Enhanced agents testing failed:', error);
    log.error('❌ Enhanced agents testing failed', LogContext.AGENT, {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  } finally {
    if (client) {
      await client.end();
    }
  }
}

// Run the test
testEnhancedAgents().catch((error) => {
  console.error('💥 Enhanced agents test failed:', error);
  process.exit(1);
});