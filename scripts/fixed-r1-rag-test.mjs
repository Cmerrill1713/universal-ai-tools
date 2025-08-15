#!/usr/bin/env node

/**
 * Fixed R1 RAG System Integration Test
 * Addresses timeout issues and correct API payload formats
 */

import { performance } from 'perf_hooks';
import fetch from 'node-fetch';

console.log('🔧 Fixed R1 RAG System Integration Test');
console.log('====================================');
console.log('Testing with corrected endpoints and timeouts\n');

const SERVER_URL = 'http://localhost:9999';
const LM_STUDIO_URL = 'http://localhost:5901';

class FixedR1RAGTester {
  constructor() {
    this.testResults = [];
    this.successCount = 0;
    this.totalTests = 0;
  }

  async runFixedTests() {
    console.log('🚀 Starting Fixed R1 RAG System Tests\n');

    try {
      // Test 1: System Health Check
      await this.testSystemHealth();

      // Test 2: GraphRAG with correct payload
      await this.testGraphRAGFixed();

      // Test 3: LM Studio with available models
      await this.testLMStudioFixed();

      // Test 4: Performance with realistic timeouts
      await this.testPerformanceFixed();

      // Test 5: Simple integration test
      await this.testSimpleIntegration();

      this.generateFixedReport();

    } catch (error) {
      console.error('❌ Fixed test suite failed:', error.message);
    }
  }

  async testSystemHealth() {
    console.log('🏥 Test 1: System Health Check');
    console.log('-----------------------------');

    const healthTests = [
      { name: 'Main Server', url: `${SERVER_URL}/health` },
      { name: 'LM Studio Models', url: `${LM_STUDIO_URL}/v1/models` },
      { name: 'GraphRAG Health', url: `${SERVER_URL}/api/v1/graphrag/health` }
    ];

    for (const test of healthTests) {
      const result = await this.runTest(test.name, async () => {
        const response = await fetch(test.url, { 
          signal: AbortSignal.timeout(3000) 
        });
        return response.ok;
      });
      
      console.log(`   ${result ? '✅' : '❌'} ${test.name}`);
    }

    console.log();
  }

  async testGraphRAGFixed() {
    console.log('🕸️ Test 2: GraphRAG with Correct Payload');
    console.log('---------------------------------------');

    // Test GraphRAG build with correct format
    const buildResult = await this.runTest('GraphRAG Build', async () => {
      const response = await fetch(`${SERVER_URL}/api/v1/graphrag/build`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          texts: [
            'Universal AI Tools is an advanced R1 RAG system.',
            'It implements Think-Generate-Retrieve-Rethink reasoning cycles.',
            'The system uses GraphRAG for knowledge graph construction.'
          ],
          metadata: { source: 'test', version: '1.0' }
        }),
        signal: AbortSignal.timeout(15000)
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`      Built graph with ${data.metrics?.entitiesAdded || 0} entities`);
        return true;
      }
      
      const error = await response.text();
      console.log(`      Error: ${error}`);
      return false;
    });

    console.log(`   ${buildResult ? '✅' : '❌'} GraphRAG Build`);

    // Test GraphRAG query
    const queryResult = await this.runTest('GraphRAG Query', async () => {
      const response = await fetch(`${SERVER_URL}/api/v1/graphrag/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'What is Universal AI Tools?',
          maxResults: 3
        }),
        signal: AbortSignal.timeout(10000)
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`      Found ${data.results?.length || 0} results`);
        return true;
      }
      
      return false;
    });

    console.log(`   ${queryResult ? '✅' : '❌'} GraphRAG Query\n`);
  }

  async testLMStudioFixed() {
    console.log('🤖 Test 3: LM Studio with Available Models');
    console.log('----------------------------------------');

    // Test with known available model
    const models = [
      'qwen2.5-coder-14b-instruct-mlx',
      'google/gemma-3-4b',
      'llama-3.2-1b-instruct'
    ];

    for (const model of models) {
      const result = await this.runTest(`LM Studio: ${model}`, async () => {
        const response = await fetch(`${LM_STUDIO_URL}/v1/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: 'What is AI?' }],
            max_tokens: 50,
            temperature: 0.3
          }),
          signal: AbortSignal.timeout(15000)
        });

        if (response.ok) {
          const data = await response.json();
          const responseText = data.choices[0]?.message?.content || '';
          console.log(`      Response: ${responseText.substring(0, 50)}...`);
          return responseText.length > 10;
        }
        
        console.log(`      Error: HTTP ${response.status}`);
        return false;
      });

      console.log(`   ${result ? '✅' : '❌'} ${model}`);
    }

    console.log();
  }

  async testPerformanceFixed() {
    console.log('⚡ Test 4: Performance with Realistic Timeouts');
    console.log('--------------------------------------------');

    const performanceTests = [
      {
        name: 'Simple Query',
        query: 'What is AI?',
        maxTokens: 100,
        timeout: 10000,
        target: 5000
      },
      {
        name: 'Medium Query',
        query: 'Explain machine learning concepts',
        maxTokens: 200,
        timeout: 15000,
        target: 8000
      }
    ];

    for (const test of performanceTests) {
      const latencies = [];
      
      for (let i = 0; i < 2; i++) {
        const startTime = performance.now();
        const success = await this.runTest(`${test.name} (${i + 1}/2)`, async () => {
          const response = await fetch(`${LM_STUDIO_URL}/v1/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'qwen2.5-coder-14b-instruct-mlx',
              messages: [{ role: 'user', content: test.query }],
              max_tokens: test.maxTokens,
              temperature: 0.3
            }),
            signal: AbortSignal.timeout(test.timeout)
          });

          return response.ok;
        });

        const latency = performance.now() - startTime;
        if (success) latencies.push(latency);
        
        console.log(`     ${success ? '✅' : '❌'} Iteration ${i + 1}: ${latency.toFixed(0)}ms`);
      }

      const avgLatency = latencies.length > 0 ? 
        latencies.reduce((sum, l) => sum + l, 0) / latencies.length : 0;
      
      const performanceOk = avgLatency > 0 && avgLatency < test.target;
      console.log(`   ${performanceOk ? '✅' : '❌'} ${test.name}: Avg ${avgLatency.toFixed(0)}ms (target: ${test.target}ms)\n`);
    }
  }

  async testSimpleIntegration() {
    console.log('🔄 Test 5: Simple Integration Test');
    console.log('--------------------------------');

    const integrationResult = await this.runTest('End-to-End Workflow', async () => {
      console.log('     🔧 Step 1: Check GraphRAG health...');
      const graphHealth = await fetch(`${SERVER_URL}/api/v1/graphrag/health`, { 
        signal: AbortSignal.timeout(5000) 
      });
      
      if (!graphHealth.ok) return false;

      console.log('     🤖 Step 2: Test model inference...');
      const inference = await fetch(`${LM_STUDIO_URL}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'qwen2.5-coder-14b-instruct-mlx',
          messages: [{ role: 'user', content: 'Explain R1 reasoning briefly' }],
          max_tokens: 150,
          temperature: 0.3
        }),
        signal: AbortSignal.timeout(12000)
      });

      if (!inference.ok) return false;

      const data = await inference.json();
      const response = data.choices[0]?.message?.content || '';
      
      console.log(`     💡 Response: ${response.substring(0, 100)}...`);
      
      return response.length > 20;
    });

    console.log(`   ${integrationResult ? '✅' : '❌'} End-to-End Workflow\n`);
  }

  async runTest(testName, testFunction) {
    this.totalTests++;
    
    try {
      const success = await testFunction();
      if (success) this.successCount++;
      this.testResults.push({ testName, success, error: null });
      return success;
    } catch (error) {
      this.testResults.push({ testName, success: false, error: error.message });
      return false;
    }
  }

  generateFixedReport() {
    console.log('📋 Fixed Test Results Report');
    console.log('============================\n');

    console.log('🎯 Summary:');
    console.log(`   Total Tests: ${this.totalTests}`);
    console.log(`   Passed Tests: ${this.successCount}`);
    console.log(`   Success Rate: ${((this.successCount / this.totalTests) * 100).toFixed(1)}%\n`);

    console.log('📊 Detailed Results:');
    this.testResults.forEach(result => {
      const status = result.success ? '✅' : '❌';
      const error = result.error ? ` (${result.error})` : '';
      console.log(`   ${status} ${result.testName}${error}`);
    });

    console.log('\n💡 Key Findings:');
    if (this.successCount === this.totalTests) {
      console.log('   🎉 All tests passed! R1 RAG system is operational');
    } else if (this.successCount >= this.totalTests * 0.7) {
      console.log('   ✅ Most tests passed - system is largely functional');
    } else {
      console.log('   ⚠️ Multiple test failures - system needs debugging');
    }

    console.log('\n🏁 Fixed R1 RAG Test Complete!');
    console.log(`✨ Achieved ${this.successCount}/${this.totalTests} objectives`);
  }
}

// Run the fixed test suite
const tester = new FixedR1RAGTester();
tester.runFixedTests().catch(console.error);