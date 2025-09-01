#!/usr/bin/env tsx

import AgentRegistry from './src/agents/agent-registry';

const testCode = `
interface User {
  id: string;
  name: string;
  email: string;
}

class UserService {
  private users: Map<string, User> = new Map();
  
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }
  
  async createUser(user: User): Promise<void> {
    this.users.set(user.id, user);
  }
}`;

async function runTest() {
  console.log('🚀 Direct TypeScript Agent Test\n');
  
  const registry = new AgentRegistry();
  const [contextAgent, syntaxAgent] = await Promise.all([
    registry.getAgent('enhanced-context-agent'),
    registry.getAgent('enhanced-syntax-agent')
  ]);

  if (!contextAgent || !syntaxAgent) {
    console.error('Agents not available');
    return;
  }

  console.log('✅ Agents loaded successfully\n');
  console.log('📝 Analyzing TypeScript code...\n');

  const startTime = Date.now();
  const [contextResult, syntaxResult] = await Promise.all([
    contextAgent.execute({
      prompt: `Analyze this TypeScript code:\n${testCode}`,
      userRequest: 'Analyze code structure',
      requestId: `test-${Date.now()}`,
      metadata: { taskType: 'code_analysis', language: 'typescript' }
    }),
    syntaxAgent.execute({
      prompt: `Validate this TypeScript code:\n${testCode}`,
      userRequest: 'Validate syntax',
      requestId: `test-${Date.now()}`,
      metadata: { taskType: 'syntax_validation', language: 'typescript' }
    })
  ]);

  const executionTime = Date.now() - startTime;
  
  console.log(`⏱️  Execution time: ${executionTime}ms\n`);
  console.log(`📊 Context Analysis:`);
  console.log(`   Success: ${contextResult.success}`);
  console.log(`   Confidence: ${contextResult.confidence}`);
  
  console.log(`\n🔍 Syntax Validation:`);
  console.log(`   Success: ${syntaxResult.success}`);
  console.log(`   Confidence: ${syntaxResult.confidence}`);
  
  if (contextResult.success && syntaxResult.success) {
    console.log('\n✅ Both agents completed successfully!');
    
    // Now analyze with synthesizer agent
    const synthesizerAgent = await registry.getAgent('enhanced-synthesizer-agent');
    if (synthesizerAgent) {
      console.log('\n🤖 Running synthesis analysis...');
      
      const synthesisResult = await synthesizerAgent.execute({
        prompt: `Synthesize these TypeScript analysis results:
Context Analysis: ${JSON.stringify(contextResult.data).substring(0, 500)}...
Syntax Validation: ${JSON.stringify(syntaxResult.data).substring(0, 500)}...

Provide a brief summary of the code quality and structure.`,
        userRequest: 'Synthesize analysis results',
        requestId: `synthesis-${Date.now()}`,
        metadata: { taskType: 'synthesis' }
      });
      
      if (synthesisResult.success) {
        console.log('✅ Synthesis complete!');
        console.log(`   Confidence: ${synthesisResult.confidence}`);
      }
    }
  }
  
  console.log('\n🎉 Test Complete!');
}

runTest().catch(console.error);
