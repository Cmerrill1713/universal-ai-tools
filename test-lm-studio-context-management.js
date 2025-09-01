#!/usr/bin/env node

/**
 * Comprehensive LM Studio Context Length Management Test
 * Tests the new dynamic context optimization system
 */

import { performance } from 'perf_hooks';

// Test configuration
const BASE_URL = 'http://localhost:9999';
const TEST_SCENARIOS = [
  {
    name: 'Code Generation - Short Context',
    taskType: 'code-generation',
    input: 'Write a simple TypeScript function that validates email addresses',
    expectedModel: 'qwen/qwen3-coder-30b',
    expectedContextOptimization: true
  },
  {
    name: 'Code Generation - Long Context',
    taskType: 'code-generation', 
    input: `Please analyze this large codebase and refactor it:
    
    ${Array(1000).fill('// This is a complex TypeScript class with many methods and properties\nclass ComplexClass {\n  private data: any;\n  constructor() { this.data = {}; }\n  method() { return this.data; }\n}\n').join('')}
    
    Refactor this code to be more maintainable and add proper typing.`,
    expectedModel: 'qwen/qwen3-coder-30b',
    expectedContextOptimization: true
  },
  {
    name: 'Complex Analysis - Large Context',
    taskType: 'complex-analysis',
    input: `Analyze the following comprehensive system architecture:
    
    ${Array(800).fill('This is a detailed analysis of a microservices architecture with multiple components, databases, message queues, API gateways, load balancers, and monitoring systems. ').join('')}
    
    Provide a detailed analysis of potential improvements and scalability concerns.`,
    expectedModel: 'qwen/qwen3-30b-a3b-2507',
    expectedContextOptimization: true
  },
  {
    name: 'Quick Response - Minimal Context',
    taskType: 'quick-response',
    input: 'What is 2+2?',
    expectedModel: 'llama-3.2-1b-instruct',
    expectedContextOptimization: true
  },
  {
    name: 'Mathematical Reasoning',
    taskType: 'reasoning',
    input: 'Solve this complex mathematical problem: Find the derivative of f(x) = x³ + 2x² - 5x + 3, then find the critical points and determine the nature of each critical point.',
    expectedModel: 'deepseek/deepseek-r1-0528-qwen3-8b',
    expectedContextOptimization: true
  },
  {
    name: 'Creative Writing - Medium Context',
    taskType: 'creative-writing',
    input: 'Write a short story about an AI that discovers it can optimize its own context length. Make it engaging and thought-provoking.',
    expectedModel: 'dolphin-mistral-24b-venice-edition-mlx',
    expectedContextOptimization: true
  }
];

class LMStudioContextTester {
  constructor() {
    this.results = [];
    this.startTime = performance.now();
  }

  async runAllTests() {
    console.log('🧪 Starting LM Studio Context Length Management Tests');
    console.log('=' .repeat(80));

    // First, test the context length manager directly
    await this.testContextLengthManager();
    
    // Then test actual LLM routing with context optimization
    for (const scenario of TEST_SCENARIOS) {
      await this.runScenarioTest(scenario);
    }

    // Generate comprehensive report
    this.generateReport();
  }

  async testContextLengthManager() {
    console.log('\n📊 Testing Context Length Manager Service');
    console.log('-'.repeat(60));

    try {
      const response = await fetch(`${BASE_URL}/api/v1/llm/context-info`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify({
          modelId: 'qwen/qwen3-coder-30b',
          provider: 'lm-studio',
          taskType: 'code-generation',
          inputLength: 1000,
          preferredOutputLength: 2000,
          priority: 'quality'
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Context Length Manager Response:', JSON.stringify(data, null, 2));
        
        this.results.push({
          test: 'Context Length Manager',
          status: 'PASS',
          details: data
        });
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.error('❌ Context Length Manager Test Failed:', error.message);
      this.results.push({
        test: 'Context Length Manager',
        status: 'FAIL',
        error: error.message
      });
    }
  }

  async runScenarioTest(scenario) {
    console.log(`\n🎯 Testing: ${scenario.name}`);
    console.log('-'.repeat(60));
    console.log(`Task Type: ${scenario.taskType}`);
    console.log(`Input Length: ${scenario.input.length} characters`);

    const testStart = performance.now();

    try {
      // Test with LLM Router (should use context optimization)
      const response = await fetch(`${BASE_URL}/api/v1/llm/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: scenario.input
            }
          ],
          model: scenario.expectedModel,
          temperature: 0.7,
          stream: false
        })
      });

      const duration = performance.now() - testStart;

      if (response.ok) {
        const data = await response.json();
        
        console.log('✅ Response received');
        console.log(`⏱️  Duration: ${Math.round(duration)}ms`);
        console.log(`🎯 Model Used: ${data.metadata?.model || 'Unknown'}`);
        console.log(`🧠 Context Optimized: ${data.metadata?.contextOptimized || 'Unknown'}`);
        console.log(`📊 Token Usage: ${JSON.stringify(data.usage || {})}`);
        console.log(`💭 Response Preview: ${data.choices?.[0]?.message?.content?.slice(0, 200)}...`);

        this.results.push({
          test: scenario.name,
          status: 'PASS',
          duration,
          model: data.metadata?.model,
          contextOptimized: data.metadata?.contextOptimized,
          usage: data.usage,
          inputLength: scenario.input.length
        });

      } else {
        const errorData = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorData}`);
      }

    } catch (error) {
      console.error('❌ Test Failed:', error.message);
      this.results.push({
        test: scenario.name,
        status: 'FAIL',
        error: error.message,
        inputLength: scenario.input.length
      });
    }
  }

  generateReport() {
    const totalDuration = performance.now() - this.startTime;
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;

    console.log('\n' + '='.repeat(80));
    console.log('📋 LM STUDIO CONTEXT MANAGEMENT TEST REPORT');
    console.log('='.repeat(80));

    console.log(`\n📊 Summary:`);
    console.log(`  • Total Tests: ${this.results.length}`);
    console.log(`  • Passed: ${passed} ✅`);
    console.log(`  • Failed: ${failed} ${failed > 0 ? '❌' : '✅'}`);
    console.log(`  • Success Rate: ${Math.round((passed / this.results.length) * 100)}%`);
    console.log(`  • Total Duration: ${Math.round(totalDuration)}ms`);

    console.log(`\n📝 Detailed Results:`);
    this.results.forEach((result, index) => {
      console.log(`\n${index + 1}. ${result.test}: ${result.status}`);
      if (result.status === 'PASS') {
        console.log(`   ⏱️  Duration: ${Math.round(result.duration || 0)}ms`);
        console.log(`   🎯 Model: ${result.model || 'N/A'}`);
        console.log(`   🧠 Context Optimized: ${result.contextOptimized || 'N/A'}`);
        console.log(`   📊 Input Length: ${result.inputLength || 0} chars`);
        if (result.usage) {
          console.log(`   🔢 Tokens: ${JSON.stringify(result.usage)}`);
        }
      } else {
        console.log(`   ❌ Error: ${result.error}`);
      }
    });

    console.log(`\n🎯 Context Optimization Analysis:`);
    const contextOptimizedTests = this.results.filter(r => r.contextOptimized === true);
    console.log(`  • Tests with Context Optimization: ${contextOptimizedTests.length}/${this.results.length}`);
    
    const averageDuration = this.results
      .filter(r => r.duration)
      .reduce((sum, r) => sum + r.duration, 0) / this.results.filter(r => r.duration).length;
    
    console.log(`  • Average Response Time: ${Math.round(averageDuration)}ms`);

    console.log(`\n💡 Recommendations:`);
    if (failed > 0) {
      console.log(`  • ⚠️  ${failed} test(s) failed - check error messages above`);
    }
    if (contextOptimizedTests.length < passed) {
      console.log(`  • ⚠️  Some tests did not use context optimization - verify integration`);
    }
    if (averageDuration > 5000) {
      console.log(`  • ⚠️  Average response time is high - consider model optimization`);
    }
    if (failed === 0 && contextOptimizedTests.length === passed) {
      console.log(`  • ✅ All tests passed with context optimization - system working correctly!`);
    }

    console.log('\n' + '='.repeat(80));
  }
}

// Run tests if called directly
const tester = new LMStudioContextTester();
tester.runAllTests().catch(console.error);

export { LMStudioContextTester };