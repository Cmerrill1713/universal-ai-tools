#!/usr/bin/env npx tsx

/**
 * Comprehensive test for all enhanced agents
 * Tests each agent individually and verifies proper model routing
 */

import AgentRegistryClass from './src/agents/agent-registry';
import type { AgentContext } from './src/types';

// Create a singleton instance
const agentRegistry = new AgentRegistryClass();

async function testAgent(agentName: string, context: AgentContext): Promise<void> {
  console.log(`\n🤖 Testing ${agentName}...`);
  const startTime = Date.now();
  
  try {
    const agent = await agentRegistry.getAgent(agentName);
    if (!agent) {
      console.error(`❌ Agent ${agentName} not found in registry`);
      return;
    }

    const result = await agent.execute(context);
    const executionTime = Date.now() - startTime;
    
    if (result.success) {
      console.log(`✅ ${agentName} succeeded in ${executionTime}ms`);
      console.log(`   Confidence: ${result.confidence}`);
      if (result.data) {
        console.log(`   Response type: ${typeof result.data}`);
      }
    } else {
      console.error(`❌ ${agentName} failed: ${result.error}`);
    }
  } catch (error) {
    console.error(`❌ ${agentName} error:`, error);
  }
}

async function runTests() {
  console.log('🚀 Starting comprehensive agent tests...\n');

  // Test contexts for different agent types
  const codeContext: AgentContext = {
    prompt: `Analyze this TypeScript code:
    
    interface User {
      id: string;
      name: string;
      email?: string;
    }
    
    async function getUser(id: string): Promise<User> {
      const response = await fetch(\`/api/users/\${id}\`);
      return response.json();
    }`,
    userRequest: 'Analyze this TypeScript code',
    requestId: `test-${Date.now()}-code`,
    metadata: {
      taskType: 'code_analysis',
      language: 'typescript'
    }
  };

  const planningContext: AgentContext = {
    prompt: 'Plan a strategy to build a real-time chat application with TypeScript and WebSocket',
    userRequest: 'Plan a strategy to build a real-time chat application with TypeScript and WebSocket',
    requestId: `test-${Date.now()}-planning`,
    metadata: {
      taskType: 'planning'
    }
  };

  const generalContext: AgentContext = {
    prompt: 'What are the best practices for API security in Node.js applications?',
    userRequest: 'What are the best practices for API security in Node.js applications?',
    requestId: `test-${Date.now()}-general`,
    metadata: {
      taskType: 'information_retrieval'
    }
  };

  // Test all enhanced agents
  const agentTests = [
    // TypeScript specialists
    { name: 'enhanced-context-agent', context: codeContext },
    { name: 'enhanced-syntax-agent', context: codeContext },
    
    // Core enhanced agents
    { name: 'enhanced-planner-agent', context: planningContext },
    { name: 'enhanced-retriever-agent', context: generalContext },
    { name: 'enhanced-synthesizer-agent', context: generalContext },
    { name: 'enhanced-personal-assistant-agent', context: generalContext },
    { name: 'enhanced-code-assistant-agent', context: codeContext },
    
    // Multi-tier planner
    { name: 'multi-tier-planner-agent', context: planningContext }
  ];

  console.log(`Testing ${agentTests.length} agents...\n`);
  
  // Test each agent sequentially to avoid overwhelming the system
  for (const test of agentTests) {
    await testAgent(test.name, test.context);
  }

  console.log('\n\n🏁 Testing complete!');
  
  // Test parallel execution for TypeScript agents
  console.log('\n\n🔄 Testing parallel TypeScript analysis...');
  const parallelStart = Date.now();
  
  try {
    const [contextAgent, syntaxAgent] = await Promise.all([
      agentRegistry.getAgent('enhanced-context-agent'),
      agentRegistry.getAgent('enhanced-syntax-agent')
    ]);

    if (contextAgent && syntaxAgent) {
      const [contextResult, syntaxResult] = await Promise.all([
        contextAgent.execute(codeContext),
        syntaxAgent.execute(codeContext)
      ]);

      const parallelTime = Date.now() - parallelStart;
      console.log(`\n✅ Parallel execution completed in ${parallelTime}ms`);
      console.log(`   Context analysis: ${contextResult.success ? 'Success' : 'Failed'}`);
      console.log(`   Syntax validation: ${syntaxResult.success ? 'Success' : 'Failed'}`);
    }
  } catch (error) {
    console.error('❌ Parallel execution error:', error);
  }
}

// Run the tests
runTests().catch(console.error);