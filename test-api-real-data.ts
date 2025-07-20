#!/usr/bin/env node
/**
 * Test All APIs with Real Data
 * Verifies that all endpoints work with actual functionality, not mocks
 */

import axios from 'axios';
import { WebSocketAgentClient } from './src/client/websocket-agent-client';

const BASE_URL = 'http://localhost:9999';
const API_KEY = 'test-key-12345';

interface TestResult {
  endpoint: string;
  method: string;
  success: boolean;
  realData: boolean;
  message: string;
  data?: any;
  error?: any;
}

class APITester {
  private results: TestResult[] = [];
  private wsClient: WebSocketAgentClient | null = null;

  async runAllTests() {
    console.log('🧪 Testing All APIs with Real Data');
    console.log('=' .repeat(60));

    // Test health endpoints
    await this.testHealthEndpoints();

    // Test memory endpoints
    await this.testMemoryEndpoints();

    // Test orchestration endpoints
    await this.testOrchestrationEndpoints();

    // Test WebSocket functionality
    await this.testWebSocketConnection();

    // Test agent coordination
    await this.testAgentCoordination();

    // Test tools endpoint
    await this.testToolsEndpoint();

    // Print summary
    this.printSummary();
  }

  async testHealthEndpoints() {
    console.log('\n📋 Testing Health Endpoints...');
    
    // Basic health
    await this.testEndpoint('GET', '/health', null, false);
    
    // API health
    await this.testEndpoint('GET', '/api/health', null, false);
    
    // Status endpoint
    await this.testEndpoint('GET', '/api/v1/status', null, true);
  }

  async testMemoryEndpoints() {
    console.log('\n🧠 Testing Memory Endpoints...');
    
    // Create a memory
    const memoryData = {
      content: `Test memory created at ${new Date().toISOString()}`,
      metadata: { test: true, source: 'api-test' },
      tags: ['test', 'real-data']
    };
    
    const createResult = await this.testEndpoint('POST', '/api/v1/memory', memoryData, true);
    
    // List memories
    await this.testEndpoint('GET', '/api/v1/memory', null, true);
    
    // Search memories (if implemented)
    await this.testEndpoint('GET', '/api/v1/memory?search=test', null, true);
  }

  async testOrchestrationEndpoints() {
    console.log('\n🤖 Testing Orchestration Endpoints...');
    
    // Basic orchestration
    const orchestrationData = {
      userRequest: 'Analyze the sentiment of customer reviews and generate a summary report',
      orchestrationMode: 'advanced',
      context: {
        task_type: 'analysis',
        prefer_quality: true,
        real_test: true
      }
    };
    
    await this.testEndpoint('POST', '/api/v1/orchestrate', orchestrationData, true);
    
    // Agent coordination
    const coordinationData = {
      task: 'Build a recommendation system for an e-commerce platform',
      agents: ['architect', 'data_scientist', 'developer', 'tester'],
      context: {
        project_type: 'machine_learning',
        real_test: true
      }
    };
    
    await this.testEndpoint('POST', '/api/v1/coordinate', coordinationData, true);
  }

  async testWebSocketConnection() {
    console.log('\n🔌 Testing WebSocket Connection...');
    
    try {
      this.wsClient = new WebSocketAgentClient('ws://localhost:9999');
      
      // Set up event listeners
      this.wsClient.on('connected', () => {
        console.log('✅ WebSocket connected successfully');
      });
      
      this.wsClient.on('message', (message) => {
        console.log('📨 WebSocket message received:', message.type);
      });
      
      await this.wsClient.connect();
      
      // Test orchestration via WebSocket
      const response = await this.wsClient.orchestrate({
        userRequest: 'Create a Python script to analyze CSV data',
        mode: 'advanced',
        context: { real_test: true }
      });
      
      this.results.push({
        endpoint: 'WebSocket',
        method: 'orchestrate',
        success: true,
        realData: this.isRealData(response),
        message: 'WebSocket orchestration successful',
        data: response
      });
      
    } catch (error) {
      this.results.push({
        endpoint: 'WebSocket',
        method: 'connect',
        success: false,
        realData: false,
        message: 'WebSocket connection failed',
        error: error instanceof Error ? error.message : error
      });
    }
  }

  async testAgentCoordination() {
    console.log('\n🤝 Testing Agent Coordination...');
    
    if (!this.wsClient || !this.wsClient.isConnectedStatus()) {
      console.log('⚠️  WebSocket not connected, skipping coordination tests');
      return;
    }
    
    try {
      // Test model info
      const modelInfo = await this.wsClient.getModelInfo();
      console.log('📊 Current model:', modelInfo.name || 'Unknown');
      
      // Test agent coordination
      const coordination = await this.wsClient.coordinateAgents({
        task: 'Optimize database queries for better performance',
        agents: ['database_expert', 'performance_engineer'],
        context: { urgency: 'high' }
      });
      
      this.results.push({
        endpoint: 'WebSocket',
        method: 'coordinateAgents',
        success: true,
        realData: this.isRealData(coordination),
        message: 'Agent coordination successful',
        data: coordination
      });
      
    } catch (error) {
      this.results.push({
        endpoint: 'WebSocket',
        method: 'coordinateAgents',
        success: false,
        realData: false,
        message: 'Agent coordination failed',
        error: error instanceof Error ? error.message : error
      });
    }
  }

  async testToolsEndpoint() {
    console.log('\n🛠️  Testing Tools Endpoint...');
    
    await this.testEndpoint('GET', '/api/v1/tools', null, true);
  }

  async testEndpoint(method: string, path: string, data: any, requireAuth: boolean): Promise<TestResult> {
    const url = `${BASE_URL}${path}`;
    const headers = requireAuth ? { 'X-API-Key': API_KEY } : {};
    
    try {
      const response = await axios({
        method,
        url,
        data,
        headers,
        timeout: 10000
      });
      
      const isReal = this.isRealData(response.data);
      const result: TestResult = {
        endpoint: path,
        method,
        success: true,
        realData: isReal,
        message: isReal ? 'Real data response' : 'Mock/static response detected',
        data: response.data
      };
      
      this.results.push(result);
      console.log(`${method} ${path}: ${result.success ? '✅' : '❌'} ${isReal ? '(Real)' : '(Mock)'}`);
      
      return result;
      
    } catch (error: any) {
      const result: TestResult = {
        endpoint: path,
        method,
        success: false,
        realData: false,
        message: error.response?.data?.error || error.message,
        error: error.response?.status || error.code
      };
      
      this.results.push(result);
      console.log(`${method} ${path}: ❌ ${result.message}`);
      
      return result;
    }
  }

  isRealData(data: any): boolean {
    // Check if response contains indicators of real functionality
    if (!data) return false;
    
    // Look for mock/test indicators
    const jsonStr = JSON.stringify(data);
    const mockIndicators = ['mock', 'test-', 'example', 'placeholder', 'TODO'];
    const hasMockIndicators = mockIndicators.some(indicator => 
      jsonStr.toLowerCase().includes(indicator.toLowerCase())
    );
    
    // Look for real data indicators
    const realIndicators = [
      data.timestamp && new Date(data.timestamp).getTime() > Date.now() - 60000, // Recent timestamp
      data.requestId && data.requestId.includes(Date.now().toString().substring(0, 10)), // Current requestId
      data.data && typeof data.data === 'object' && Object.keys(data.data).length > 2, // Complex data
      data.executionTime && typeof data.executionTime === 'number', // Real execution time
      data.model_used && data.model_used.provider, // Real model info
      data.participatingAgents && Array.isArray(data.participatingAgents) // Real agent list
    ];
    
    const hasRealIndicators = realIndicators.filter(Boolean).length >= 2;
    
    return hasRealIndicators && !hasMockIndicators;
  }

  printSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));
    
    const total = this.results.length;
    const successful = this.results.filter(r => r.success).length;
    const realData = this.results.filter(r => r.realData).length;
    const failed = this.results.filter(r => !r.success);
    
    console.log(`Total Tests: ${total}`);
    console.log(`Successful: ${successful} (${Math.round(successful/total*100)}%)`);
    console.log(`Real Data: ${realData} (${Math.round(realData/total*100)}%)`);
    console.log(`Failed: ${failed.length}`);
    
    if (failed.length > 0) {
      console.log('\n❌ Failed Tests:');
      failed.forEach(f => {
        console.log(`  - ${f.method} ${f.endpoint}: ${f.message}`);
      });
    }
    
    // Check specific functionality
    console.log('\n🔍 Functionality Check:');
    const checks = {
      'Memory System': this.results.some(r => r.endpoint.includes('memory') && r.realData),
      'Orchestration': this.results.some(r => r.endpoint.includes('orchestrate') && r.realData),
      'Agent Coordination': this.results.some(r => r.endpoint.includes('coordinate') && r.realData),
      'WebSocket': this.results.some(r => r.endpoint === 'WebSocket' && r.success),
      'DSPy Integration': this.results.some(r => r.data?.model_used?.provider)
    };
    
    Object.entries(checks).forEach(([feature, working]) => {
      console.log(`  ${feature}: ${working ? '✅ Working' : '❌ Not Working'}`);
    });
    
    // Overall assessment
    const workingFeatures = Object.values(checks).filter(Boolean).length;
    const readiness = Math.round((workingFeatures / Object.keys(checks).length) * 100);
    
    console.log(`\n🎯 Real Functionality: ${readiness}%`);
    
    if (readiness >= 80) {
      console.log('✅ APIs are working with real data!');
    } else if (readiness >= 50) {
      console.log('⚠️  Some APIs still using mock data');
    } else {
      console.log('❌ Most APIs are not using real functionality');
    }
    
    // Cleanup
    if (this.wsClient) {
      this.wsClient.disconnect();
    }
  }
}

// Run tests
async function main() {
  const tester = new APITester();
  
  try {
    // Check if server is running
    await axios.get(`${BASE_URL}/health`);
    console.log('✅ Server is running');
  } catch (error) {
    console.error('❌ Server is not running. Start it with:');
    console.error('   NODE_ENV=development npx tsx src/server-startup-fix.ts');
    process.exit(1);
  }
  
  await tester.runAllTests();
}

main().catch(console.error);