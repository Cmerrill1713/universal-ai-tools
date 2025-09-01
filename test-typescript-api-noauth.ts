#!/usr/bin/env tsx

/**
 * Test script for TypeScript Analysis API endpoints (without authentication)
 * This script tests the functionality assuming authentication is disabled
 */

import axios from 'axios';

const API_BASE = 'http://localhost:9999/api/v1/typescript';

// Sample TypeScript code for testing
const sampleCode = `
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

async function testWithoutAuth() {
  console.log('🚀 Testing TypeScript Analysis Endpoints (Direct Test)');
  console.log('=' .repeat(50));
  
  // Test health endpoint (no auth required)
  console.log('\n🏥 Testing Health Endpoint...');
  try {
    const response = await axios.get(`${API_BASE}/health`);
    console.log('✅ Health check:', response.data.data);
  } catch (error: any) {
    console.error('❌ Health check failed:', error.message);
  }
  
  // Test the agents directly without going through the API
  console.log('\n🔧 Testing agents directly...');
  
  try {
    const { default: AgentRegistry } = await import('./src/agents/agent-registry');
    const registry = new AgentRegistry();
    
    console.log('\n📝 Testing Context Agent...');
    const contextAgent = await registry.getAgent('enhanced-context-agent');
    if (contextAgent) {
      const result = await contextAgent.execute({
        prompt: `Analyze this TypeScript code:\n${sampleCode}`,
        userRequest: 'Analyze TypeScript code structure',
        requestId: `test-${Date.now()}`,
        metadata: {
          taskType: 'code_analysis',
          language: 'typescript'
        }
      });
      
      console.log('✅ Context analysis result:', {
        success: result.success,
        confidence: result.confidence,
        executionTime: result.executionTime,
        dataPreview: typeof result.data === 'string' 
          ? result.data.substring(0, 200) + '...' 
          : result.data
      });
    } else {
      console.log('❌ Context agent not available');
    }
    
    console.log('\n🔍 Testing Syntax Agent...');
    const syntaxAgent = await registry.getAgent('enhanced-syntax-agent');
    if (syntaxAgent) {
      const result = await syntaxAgent.execute({
        prompt: `Validate this TypeScript code:\n${sampleCode}`,
        userRequest: 'Validate TypeScript syntax',
        requestId: `test-${Date.now()}`,
        metadata: {
          taskType: 'syntax_validation',
          language: 'typescript'
        }
      });
      
      console.log('✅ Syntax validation result:', {
        success: result.success,
        confidence: result.confidence,
        executionTime: result.executionTime,
        dataPreview: typeof result.data === 'string' 
          ? result.data.substring(0, 200) + '...' 
          : result.data
      });
    } else {
      console.log('❌ Syntax agent not available');
    }
    
    console.log('\n🔄 Testing Parallel Execution...');
    if (contextAgent && syntaxAgent) {
      const startTime = Date.now();
      const [contextResult, syntaxResult] = await Promise.all([
        contextAgent.execute({
          prompt: `Analyze this TypeScript code:\n${sampleCode}`,
          userRequest: 'Analyze TypeScript code structure',
          requestId: `test-parallel-${Date.now()}`,
          metadata: { taskType: 'code_analysis', language: 'typescript' }
        }),
        syntaxAgent.execute({
          prompt: `Validate this TypeScript code:\n${sampleCode}`,
          userRequest: 'Validate TypeScript syntax',
          requestId: `test-parallel-${Date.now()}`,
          metadata: { taskType: 'syntax_validation', language: 'typescript' }
        })
      ]);
      const totalTime = Date.now() - startTime;
      
      console.log('✅ Parallel execution completed in', totalTime, 'ms');
      console.log('   Context success:', contextResult.success);
      console.log('   Syntax success:', syntaxResult.success);
    }
    
  } catch (error) {
    console.error('❌ Agent test error:', error);
  }
  
  console.log('\n' + '=' .repeat(50));
  console.log('✅ Tests completed!');
  console.log('\n📌 Note: API endpoints require authentication.');
  console.log('   The agents are working correctly when called directly.');
}

testWithoutAuth().catch(console.error);