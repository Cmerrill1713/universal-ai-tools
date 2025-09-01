#!/usr/bin/env tsx

/**
 * Comprehensive TypeScript Analysis API Test Suite
 * Tests all endpoints and analyzes results with Claude agent
 */

import axios from 'axios';
import { performance } from 'perf_hooks';

const API_BASE = 'http://localhost:9999/api/v1';

// Test code samples
const simpleCode = `
function add(a: number, b: number): number {
  return a + b;
}
`;

const complexCode = `
interface User {
  id: string;
  name: string;
  email: string;
  roles: Role[];
}

enum Role {
  Admin = 'ADMIN',
  User = 'USER'
}

class UserService {
  private users: Map<string, User> = new Map();
  
  async getUser(id: string): Promise<User | null> {
    return this.users.get(id) || null;
  }
  
  async createUser(userData: Omit<User, 'id'>): Promise<User> {
    const user: User = {
      ...userData,
      id: crypto.randomUUID()
    };
    this.users.set(user.id, user);
    return user;
  }
}
`;

const errorCode = `
// Code with intentional errors
interface Product {
  id: number;
  name: string;
  price: string; // Should be number
}

function calculateTotal(products: Product[]): number {
  return products.reduce((sum, p) => sum + p.price, 0); // Type error
}

const invalidSyntax = {
  missing: 'closing brace'
// Missing closing brace
`;

interface TestResult {
  endpoint: string;
  success: boolean;
  executionTime: number;
  response?: any;
  error?: string;
}

async function testHealthEndpoint(): Promise<TestResult> {
  const start = performance.now();
  try {
    const response = await axios.get(`${API_BASE}/typescript/health`);
    return {
      endpoint: 'GET /typescript/health',
      success: true,
      executionTime: performance.now() - start,
      response: response.data
    };
  } catch (error: any) {
    return {
      endpoint: 'GET /typescript/health',
      success: false,
      executionTime: performance.now() - start,
      error: error.response?.data?.error || error.message
    };
  }
}

async function testContextAnalysis(): Promise<TestResult> {
  const start = performance.now();
  try {
    const response = await axios.post(`${API_BASE}/typescript/analyze-context`, {
      code: complexCode,
      filename: 'user-service.ts',
      options: {
        depth: 'deep'
      }
    });
    return {
      endpoint: 'POST /typescript/analyze-context',
      success: true,
      executionTime: performance.now() - start,
      response: response.data
    };
  } catch (error: any) {
    return {
      endpoint: 'POST /typescript/analyze-context',
      success: false,
      executionTime: performance.now() - start,
      error: error.response?.data?.error || error.message
    };
  }
}

async function testSyntaxValidation(): Promise<TestResult> {
  const start = performance.now();
  try {
    const response = await axios.post(`${API_BASE}/typescript/validate-syntax`, {
      code: errorCode,
      filename: 'product-service.ts',
      options: {
        includeFixSuggestions: true
      }
    });
    return {
      endpoint: 'POST /typescript/validate-syntax',
      success: true,
      executionTime: performance.now() - start,
      response: response.data
    };
  } catch (error: any) {
    return {
      endpoint: 'POST /typescript/validate-syntax',
      success: false,
      executionTime: performance.now() - start,
      error: error.response?.data?.error || error.message
    };
  }
}

async function testParallelAnalysis(): Promise<TestResult> {
  const start = performance.now();
  try {
    const response = await axios.post(`${API_BASE}/typescript/parallel-analysis`, {
      code: complexCode,
      filename: 'user-service.ts',
      options: {
        includeFixSuggestions: true,
        depth: 'deep'
      }
    });
    return {
      endpoint: 'POST /typescript/parallel-analysis',
      success: true,
      executionTime: performance.now() - start,
      response: response.data
    };
  } catch (error: any) {
    return {
      endpoint: 'POST /typescript/parallel-analysis',
      success: false,
      executionTime: performance.now() - start,
      error: error.response?.data?.error || error.message
    };
  }
}

async function testBatchAnalysis(): Promise<TestResult> {
  const start = performance.now();
  try {
    const response = await axios.post(`${API_BASE}/typescript/batch-analyze`, {
      files: [
        { filename: 'simple.ts', code: simpleCode },
        { filename: 'complex.ts', code: complexCode },
        { filename: 'errors.ts', code: errorCode }
      ],
      analysisType: 'both'
    });
    return {
      endpoint: 'POST /typescript/batch-analyze',
      success: true,
      executionTime: performance.now() - start,
      response: response.data
    };
  } catch (error: any) {
    return {
      endpoint: 'POST /typescript/batch-analyze',
      success: false,
      executionTime: performance.now() - start,
      error: error.response?.data?.error || error.message
    };
  }
}

async function analyzeWithClaudeAgent(testResults: TestResult[]) {
  console.log('\n🤖 Analyzing all test results with Claude Agent...');
  
  try {
    const { default: AgentRegistry } = await import('./src/agents/agent-registry');
    const registry = new AgentRegistry();
    
    // Use synthesizer agent for comprehensive analysis
    const agent = await registry.getAgent('enhanced-synthesizer-agent');
    
    if (!agent) {
      console.error('❌ Synthesizer agent not available');
      return null;
    }
    
    const analysisPrompt = `
Please analyze these TypeScript API test results and provide a comprehensive assessment:

## Test Results:
${JSON.stringify(testResults, null, 2)}

## Analysis Requirements:
1. Overall API health and performance assessment
2. Identify any failures or performance bottlenecks
3. Compare execution times across endpoints
4. Assess the quality of responses (context analysis, syntax validation)
5. Provide specific recommendations for improvements
6. Rate the overall system readiness (1-10 scale)

## Expected Output Format:
{
  "overallHealth": "healthy|degraded|critical",
  "performanceGrade": "A|B|C|D|F",
  "averageResponseTime": number,
  "failureRate": number,
  "bottlenecks": [],
  "recommendations": [],
  "readinessScore": number,
  "summary": "string"
}
`;
    
    const result = await agent.execute({
      prompt: analysisPrompt,
      userRequest: 'Analyze TypeScript API test results',
      requestId: `api-analysis-${Date.now()}`,
      metadata: {
        taskType: 'api_analysis',
        testCount: testResults.length
      }
    });
    
    if (result.success) {
      console.log('✅ Claude Agent Analysis Complete!');
      console.log('Confidence:', result.confidence);
      
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

async function runComprehensiveTest() {
  console.log('🚀 Starting Comprehensive TypeScript API Test Suite');
  console.log('=' .repeat(60));
  
  // Wait for server to be ready
  console.log('⏳ Waiting for server initialization...');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const testResults: TestResult[] = [];
  
  // Run all tests
  console.log('\n📊 Running API Tests...\n');
  
  // 1. Health Check
  console.log('1️⃣ Testing Health Endpoint...');
  const healthResult = await testHealthEndpoint();
  testResults.push(healthResult);
  console.log(`   ${healthResult.success ? '✅' : '❌'} Status: ${healthResult.success ? 'SUCCESS' : 'FAILED'}`);
  console.log(`   ⏱️  Time: ${Math.round(healthResult.executionTime)}ms`);
  if (healthResult.success && healthResult.response?.data) {
    console.log(`   📊 Agents: Context=${healthResult.response.data.agents.context}, Syntax=${healthResult.response.data.agents.syntax}`);
  }
  
  // 2. Context Analysis
  console.log('\n2️⃣ Testing Context Analysis...');
  const contextResult = await testContextAnalysis();
  testResults.push(contextResult);
  console.log(`   ${contextResult.success ? '✅' : '❌'} Status: ${contextResult.success ? 'SUCCESS' : 'FAILED'}`);
  console.log(`   ⏱️  Time: ${Math.round(contextResult.executionTime)}ms`);
  if (contextResult.success && contextResult.response?.data) {
    console.log(`   📊 Confidence: ${contextResult.response.data.confidence || 'N/A'}`);
  }
  
  // 3. Syntax Validation
  console.log('\n3️⃣ Testing Syntax Validation...');
  const syntaxResult = await testSyntaxValidation();
  testResults.push(syntaxResult);
  console.log(`   ${syntaxResult.success ? '✅' : '❌'} Status: ${syntaxResult.success ? 'SUCCESS' : 'FAILED'}`);
  console.log(`   ⏱️  Time: ${Math.round(syntaxResult.executionTime)}ms`);
  if (syntaxResult.success && syntaxResult.response?.data) {
    console.log(`   📊 Confidence: ${syntaxResult.response.data.confidence || 'N/A'}`);
  }
  
  // 4. Parallel Analysis
  console.log('\n4️⃣ Testing Parallel Analysis...');
  const parallelResult = await testParallelAnalysis();
  testResults.push(parallelResult);
  console.log(`   ${parallelResult.success ? '✅' : '❌'} Status: ${parallelResult.success ? 'SUCCESS' : 'FAILED'}`);
  console.log(`   ⏱️  Time: ${Math.round(parallelResult.executionTime)}ms`);
  if (parallelResult.success && parallelResult.response?.data) {
    console.log(`   📊 Overall Success: ${parallelResult.response.data.overallSuccess}`);
    console.log(`   📊 Avg Confidence: ${parallelResult.response.data.averageConfidence || 'N/A'}`);
  }
  
  // 5. Batch Analysis
  console.log('\n5️⃣ Testing Batch Analysis...');
  const batchResult = await testBatchAnalysis();
  testResults.push(batchResult);
  console.log(`   ${batchResult.success ? '✅' : '❌'} Status: ${batchResult.success ? 'SUCCESS' : 'FAILED'}`);
  console.log(`   ⏱️  Time: ${Math.round(batchResult.executionTime)}ms`);
  if (batchResult.success && batchResult.response?.data) {
    console.log(`   📊 Files Processed: ${batchResult.response.data.filesProcessed || 0}`);
  }
  
  // Summary Statistics
  console.log('\n' + '=' .repeat(60));
  console.log('📈 Test Summary:');
  const successCount = testResults.filter(r => r.success).length;
  const totalTime = testResults.reduce((sum, r) => sum + r.executionTime, 0);
  const avgTime = totalTime / testResults.length;
  
  console.log(`   Total Tests: ${testResults.length}`);
  console.log(`   Successful: ${successCount}/${testResults.length} (${Math.round(successCount/testResults.length * 100)}%)`);
  console.log(`   Total Time: ${Math.round(totalTime)}ms`);
  console.log(`   Average Time: ${Math.round(avgTime)}ms`);
  
  // Analyze with Claude Agent
  const claudeAnalysis = await analyzeWithClaudeAgent(testResults);
  
  if (claudeAnalysis) {
    console.log('\n📝 Claude Agent Analysis Report:');
    console.log('=' .repeat(60));
    if (typeof claudeAnalysis === 'string') {
      console.log(claudeAnalysis);
    } else {
      console.log(JSON.stringify(claudeAnalysis, null, 2));
    }
  }
  
  console.log('\n' + '=' .repeat(60));
  console.log('✅ Comprehensive Test Complete!');
  
  // Exit based on success
  process.exit(successCount === testResults.length ? 0 : 1);
}

// Run the test
runComprehensiveTest().catch(console.error);