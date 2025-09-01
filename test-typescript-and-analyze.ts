#!/usr/bin/env tsx

/**
 * Test TypeScript Analysis API and analyze response with Claude agent
 */

import axios from 'axios';

const API_BASE = 'http://localhost:9999/api/v1';

// Sample TypeScript code for testing
const complexTypeScriptCode = `
// Advanced TypeScript example with various features
interface User {
  id: string;
  name: string;
  email: string;
  roles: Role[];
  metadata?: Record<string, any>;
}

enum Role {
  Admin = 'ADMIN',
  User = 'USER',
  Guest = 'GUEST'
}

type AsyncResult<T> = Promise<{ data: T; error?: Error }>;

class UserService {
  private users: Map<string, User> = new Map();
  private cache: WeakMap<User, Date> = new WeakMap();
  
  constructor(private readonly config: { maxUsers: number }) {}
  
  async getUser(id: string): AsyncResult<User | null> {
    try {
      const user = this.users.get(id);
      if (user) {
        this.cache.set(user, new Date());
      }
      return { data: user || null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  }
  
  async createUser(userData: Omit<User, 'id'>): AsyncResult<User> {
    if (this.users.size >= this.config.maxUsers) {
      throw new Error('User limit reached');
    }
    
    const user: User = {
      ...userData,
      id: crypto.randomUUID()
    };
    
    this.users.set(user.id, user);
    return { data: user };
  }
  
  getUsersByRole(role: Role): User[] {
    return Array.from(this.users.values())
      .filter(user => user.roles.includes(role));
  }
}

// Generic utility function
function processArray<T>(items: T[], processor: (item: T) => void): void {
  items.forEach(processor);
}

// Decorator example
function log(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const original = descriptor.value;
  descriptor.value = async function(...args: any[]) {
    console.log(\`Calling \${propertyKey} with args:\`, args);
    const result = await original.apply(this, args);
    console.log(\`Result:\`, result);
    return result;
  };
}

export { UserService, Role, type User, type AsyncResult };
`;

async function testHealthEndpoint() {
  console.log('\n🏥 Testing Health Endpoint...');
  try {
    const response = await axios.get(`${API_BASE}/typescript/health`);
    console.log('✅ Health Status:', JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error: any) {
    console.error('❌ Health check failed:', error.response?.data || error.message);
    return null;
  }
}

async function testParallelAnalysis() {
  console.log('\n🔄 Testing Parallel Analysis (Context + Syntax)...');
  
  // First, we'll call without auth to see if it works
  try {
    const response = await axios.post(`${API_BASE}/typescript/parallel-analysis`, {
      code: complexTypeScriptCode,
      filename: 'user-service.ts',
      options: {
        includeFixSuggestions: true,
        depth: 'deep'
      }
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Parallel analysis completed successfully!');
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 401) {
      console.log('⚠️  Authentication required. Testing direct agent access instead...');
      return await testDirectAgentAccess();
    }
    console.error('❌ Parallel analysis failed:', error.response?.data || error.message);
    return null;
  }
}

async function testDirectAgentAccess() {
  console.log('\n🔧 Testing Direct Agent Access...');
  
  try {
    const { default: AgentRegistry } = await import('./src/agents/agent-registry');
    const registry = new AgentRegistry();
    
    // Test both agents in parallel
    const [contextAgent, syntaxAgent] = await Promise.all([
      registry.getAgent('enhanced-context-agent'),
      registry.getAgent('enhanced-syntax-agent')
    ]);
    
    if (!contextAgent || !syntaxAgent) {
      console.error('❌ Agents not available');
      return null;
    }
    
    const startTime = Date.now();
    const [contextResult, syntaxResult] = await Promise.all([
      contextAgent.execute({
        prompt: `Analyze this TypeScript code:\n${complexTypeScriptCode}`,
        userRequest: 'Analyze TypeScript code structure and patterns',
        requestId: `test-${Date.now()}`,
        metadata: {
          taskType: 'code_analysis',
          language: 'typescript',
          depth: 'deep'
        }
      }),
      syntaxAgent.execute({
        prompt: `Validate this TypeScript code:\n${complexTypeScriptCode}`,
        userRequest: 'Validate TypeScript syntax and find issues',
        requestId: `test-${Date.now()}`,
        metadata: {
          taskType: 'syntax_validation',
          language: 'typescript',
          includeFixSuggestions: true
        }
      })
    ]);
    
    const executionTime = Date.now() - startTime;
    
    return {
      success: true,
      data: {
        executionTime,
        parallel: true,
        contextAnalysis: contextResult.success ? 
          (typeof contextResult.data === 'string' ? 
            JSON.parse(contextResult.data) : contextResult.data) : 
          { error: 'Context analysis failed' },
        syntaxValidation: syntaxResult.success ? 
          (typeof syntaxResult.data === 'string' ? 
            JSON.parse(syntaxResult.data) : syntaxResult.data) : 
          { error: 'Syntax validation failed' },
        contextConfidence: contextResult.confidence,
        syntaxConfidence: syntaxResult.confidence,
        overallSuccess: contextResult.success && syntaxResult.success
      }
    };
  } catch (error) {
    console.error('❌ Direct agent access failed:', error);
    return null;
  }
}

async function analyzeWithClaudeAgent(analysisResults: any) {
  console.log('\n🤖 Analyzing results with Claude Agent...');
  
  try {
    const { default: AgentRegistry } = await import('./src/agents/agent-registry');
    const registry = new AgentRegistry();
    
    // Try to use a claude-like agent or the most capable agent
    const agentNames = ['claude-agent', 'enhanced-synthesizer-agent', 'enhanced-planner-agent'];
    let agent = null;
    
    for (const name of agentNames) {
      agent = await registry.getAgent(name);
      if (agent) {
        console.log(`📌 Using ${name} for analysis`);
        break;
      }
    }
    
    if (!agent) {
      console.log('⚠️  No suitable analysis agent found, using first available');
      const availableAgents = registry.getAvailableAgents();
      if (availableAgents.length > 0) {
        agent = await registry.getAgent(availableAgents[0]);
      }
    }
    
    if (!agent) {
      console.error('❌ No agents available for analysis');
      return null;
    }
    
    const analysisPrompt = `
Please analyze these TypeScript code analysis results and provide insights:

## Analysis Results:
${JSON.stringify(analysisResults, null, 2)}

Please provide:
1. Summary of the code structure and patterns found
2. Key findings from the syntax validation
3. Code quality assessment
4. Recommendations for improvement
5. Overall assessment of the TypeScript code

Format your response as a structured analysis report.
`;
    
    const result = await agent.execute({
      prompt: analysisPrompt,
      userRequest: 'Analyze TypeScript analysis results and provide insights',
      requestId: `claude-analysis-${Date.now()}`,
      metadata: {
        taskType: 'analysis_synthesis',
        source: 'typescript_analysis'
      }
    });
    
    if (result.success) {
      console.log('\n✅ Claude Agent Analysis Complete!');
      console.log('Confidence:', result.confidence);
      
      // Try to parse the result if it's a string
      let analysisData = result.data;
      if (typeof analysisData === 'string') {
        try {
          analysisData = JSON.parse(analysisData);
        } catch {
          // Keep as string if not JSON
        }
      }
      
      return analysisData;
    } else {
      console.error('❌ Claude agent analysis failed');
      return null;
    }
  } catch (error) {
    console.error('❌ Error using Claude agent:', error);
    return null;
  }
}

async function runCompleteTest() {
  console.log('🚀 Starting Complete TypeScript Analysis Test');
  console.log('=' .repeat(60));
  
  // Step 1: Check health
  const healthStatus = await testHealthEndpoint();
  
  // Step 2: Run parallel analysis
  const analysisResults = await testParallelAnalysis();
  
  if (analysisResults) {
    console.log('\n📊 Analysis Results Summary:');
    console.log('- Execution Time:', analysisResults.data?.executionTime || 'N/A', 'ms');
    console.log('- Context Confidence:', analysisResults.data?.contextConfidence || 'N/A');
    console.log('- Syntax Confidence:', analysisResults.data?.syntaxConfidence || 'N/A');
    console.log('- Overall Success:', analysisResults.data?.overallSuccess || false);
    
    // Step 3: Analyze with Claude agent
    const claudeAnalysis = await analyzeWithClaudeAgent(analysisResults.data);
    
    if (claudeAnalysis) {
      console.log('\n📝 Claude Agent Analysis Report:');
      console.log('=' .repeat(60));
      if (typeof claudeAnalysis === 'string') {
        console.log(claudeAnalysis);
      } else {
        console.log(JSON.stringify(claudeAnalysis, null, 2));
      }
    }
  }
  
  console.log('\n' + '=' .repeat(60));
  console.log('✅ Test Complete!');
}

// Run the test
runCompleteTest().catch(console.error);
