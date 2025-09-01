#!/usr/bin/env npx tsx

/**
 * Simple test for TypeScript analysis agents
 */

import AgentRegistryClass from './src/agents/agent-registry';
import type { AgentContext } from './src/types';

// Wait for services to initialize
async function waitForInitialization() {
  console.log('⏳ Waiting for services to initialize...');
  await new Promise(resolve => setTimeout(resolve, 2000));
}

// Create registry instance
const agentRegistry = new AgentRegistryClass();

const testCode = `
interface User {
  id: string;
  name: string;
  email?: string;
}

async function getUser(id: string): Promise<User> {
  const response = await fetch(\`/api/users/\${id}\`);
  return response.json();
}
`;

async function testAgent(agentName: string) {
  console.log(`\nTesting ${agentName}...`);
  
  const context: AgentContext = {
    prompt: `Analyze this TypeScript code:\n${testCode}`,
    userRequest: 'Analyze this TypeScript code',
    requestId: `test-${Date.now()}-${agentName}`,
    metadata: {
      taskType: 'code_analysis',
      language: 'typescript',
      filename: 'test.ts',
      codeLength: testCode.length
    }
  };

  try {
    const agent = await agentRegistry.getAgent(agentName);
    if (!agent) {
      console.error(`❌ Agent ${agentName} not found`);
      return;
    }

    const startTime = Date.now();
    const result = await agent.execute(context);
    const executionTime = Date.now() - startTime;

    if (result.success) {
      console.log(`✅ ${agentName} succeeded in ${executionTime}ms`);
      console.log(`   Confidence: ${result.confidence}`);
      
      // Try to parse and display key information
      if (result.data && typeof result.data === 'string') {
        try {
          const parsed = JSON.parse(result.data);
          if (agentName === 'enhanced-context-agent' && parsed.context_analysis) {
            console.log(`   Found ${parsed.context_analysis.typescript_context?.imports?.length || 0} imports`);
            console.log(`   Found ${parsed.context_analysis.typescript_context?.interfaces?.length || 0} interfaces`);
            console.log(`   Found ${parsed.context_analysis.typescript_context?.functions?.length || 0} functions`);
          } else if (agentName === 'enhanced-syntax-agent' && parsed.syntax_analysis) {
            console.log(`   Syntax valid: ${parsed.syntax_analysis.typescript_syntax?.isValid}`);
            console.log(`   Errors: ${parsed.syntax_analysis.typescript_syntax?.errors?.length || 0}`);
            console.log(`   Warnings: ${parsed.syntax_analysis.typescript_syntax?.warnings?.length || 0}`);
          }
        } catch (e) {
          // Not JSON or parsing failed
        }
      }
    } else {
      console.error(`❌ ${agentName} failed: ${result.error}`);
    }
  } catch (error) {
    console.error(`❌ ${agentName} error:`, error);
  }
}

async function runParallelTest() {
  console.log('\n🔄 Running parallel TypeScript analysis...');
  const startTime = Date.now();
  
  try {
    const [contextAgent, syntaxAgent] = await Promise.all([
      agentRegistry.getAgent('enhanced-context-agent'),
      agentRegistry.getAgent('enhanced-syntax-agent')
    ]);

    if (!contextAgent || !syntaxAgent) {
      console.error('❌ Could not load agents');
      return;
    }

    const context: AgentContext = {
      prompt: `Analyze this TypeScript code:\n${testCode}`,
      userRequest: 'Analyze this TypeScript code',
      requestId: `test-${Date.now()}-parallel`,
      metadata: {
        taskType: 'code_analysis',
        language: 'typescript',
        filename: 'test.ts',
        codeLength: testCode.length
      }
    };

    const [contextResult, syntaxResult] = await Promise.all([
      contextAgent.execute(context),
      syntaxAgent.execute(context)
    ]);

    const executionTime = Date.now() - startTime;
    
    console.log(`\n✅ Parallel execution completed in ${executionTime}ms`);
    console.log(`   Context analysis: ${contextResult.success ? 'Success' : 'Failed'}`);
    console.log(`   Syntax validation: ${syntaxResult.success ? 'Success' : 'Failed'}`);
    
    if (contextResult.success && syntaxResult.success) {
      console.log('\n🎉 Both TypeScript agents working correctly!');
    }
  } catch (error) {
    console.error('❌ Parallel test error:', error);
  }
}

async function main() {
  console.log('🚀 Testing TypeScript Analysis Agents\n');
  console.log('=' .repeat(50));
  
  // Wait for services to initialize
  await waitForInitialization();
  
  // Test individual agents
  await testAgent('enhanced-context-agent');
  await testAgent('enhanced-syntax-agent');
  
  // Test parallel execution
  console.log('\n' + '=' .repeat(50));
  await runParallelTest();
  
  console.log('\n' + '=' .repeat(50));
  console.log('\n✨ Test complete!\n');
  
  // Exit after a short delay to allow logs to flush
  setTimeout(() => process.exit(0), 100);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});