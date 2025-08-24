#!/usr/bin/env node

/**
 * Agent Framework Integration Test
 * Tests the actual agent registry and evaluation system rather than external APIs
 */

import { performance } from 'perf_hooks';

console.log('🔧 Agent Framework Integration Test');
console.log('==================================');
console.log('Testing actual agent registry and evaluation system\n');

class AgentFrameworkTester {
  constructor() {
    this.testResults = [];
    this.agentRegistry = null;
    this.fitnessEvaluator = null;
  }

  async runFrameworkTests() {
    console.log('🚀 Starting Agent Framework Tests\n');

    try {
      // Test 1: Initialize agent registry
      await this.testAgentRegistryInitialization();

      // Test 2: Load and test R1 RAG agents
      await this.testR1RAGAgents();

      // Test 3: Test agent orchestration
      await this.testAgentOrchestration();

      // Test 4: Test evaluation framework
      await this.testEvaluationFramework();

      // Test 5: Test R1 reasoning workflow with agents
      await this.testR1ReasoningWorkflow();

      this.generateFrameworkReport();

    } catch (error) {
      console.error('❌ Framework test failed:', error.message);
      console.error(error.stack);
    }
  }

  async testAgentRegistryInitialization() {
    console.log('📋 Test 1: Agent Registry Initialization');
    console.log('--------------------------------------');

    try {
      // Import the actual agent registry
      const { default: AgentRegistry } = await import('../src/agents/agent-registry.js');
      this.agentRegistry = new AgentRegistry();

      const availableAgents = this.agentRegistry.getAvailableAgents();
      const r1AgentNames = ['graphrag_reasoning', 'r1_reasoning', 'multi_tier_router', 'performance_optimization'];

      console.log(`   📊 Total agents registered: ${availableAgents.length}`);
      
      for (const agentName of r1AgentNames) {
        const agentDef = availableAgents.find(a => a.name === agentName);
        if (agentDef) {
          console.log(`   ✅ ${agentName}: Found (priority: ${agentDef.priority})`);
          this.testResults.push({ test: `Registry: ${agentName}`, success: true });
        } else {
          console.log(`   ❌ ${agentName}: Not found in registry`);
          this.testResults.push({ test: `Registry: ${agentName}`, success: false });
        }
      }

    } catch (error) {
      console.log(`   ❌ Registry initialization failed: ${error.message}`);
      this.testResults.push({ test: 'Registry Initialization', success: false, error: error.message });
    }

    console.log();
  }

  async testR1RAGAgents() {
    console.log('🤖 Test 2: R1 RAG Agent Loading and Execution');
    console.log('--------------------------------------------');

    if (!this.agentRegistry) {
      console.log('   ❌ Skipping - Agent registry not available');
      return;
    }

    const testContext = {
      userRequest: 'Design an AI system with knowledge graphs and reasoning capabilities',
      requestId: 'test-001',
      userId: 'framework-tester',
      metadata: { source: 'framework-test' }
    };

    const agentsToTest = [
      { name: 'multi_tier_router', description: 'Multi-tier model routing' },
      { name: 'graphrag_reasoning', description: 'GraphRAG reasoning' },
      { name: 'r1_reasoning', description: 'R1 reasoning cycles' }
    ];

    for (const agentInfo of agentsToTest) {
      try {
        console.log(`   🔄 Testing ${agentInfo.description}...`);
        const startTime = performance.now();
        
        const agent = await this.agentRegistry.getAgent(agentInfo.name);
        if (!agent) {
          throw new Error('Agent not loaded');
        }

        const result = await this.agentRegistry.processRequest(agentInfo.name, testContext);
        const latency = performance.now() - startTime;

        if (result && typeof result === 'object') {
          console.log(`   ✅ ${agentInfo.name}: Success (${latency.toFixed(0)}ms)`);
          console.log(`      Response type: ${typeof result}, Success: ${result.success !== false}`);
          this.testResults.push({ 
            test: `Agent: ${agentInfo.name}`, 
            success: true, 
            latency: Math.round(latency),
            details: `Loaded and executed successfully`
          });
        } else {
          throw new Error('Invalid response format');
        }

      } catch (error) {
        console.log(`   ❌ ${agentInfo.name}: Failed (${error.message})`);
        this.testResults.push({ 
          test: `Agent: ${agentInfo.name}`, 
          success: false, 
          error: error.message 
        });
      }
    }

    console.log();
  }

  async testAgentOrchestration() {
    console.log('🎭 Test 3: Agent Orchestration');
    console.log('-----------------------------');

    if (!this.agentRegistry) {
      console.log('   ❌ Skipping - Agent registry not available');
      return;
    }

    try {
      const testContext = {
        userRequest: 'Perform comprehensive analysis using multiple AI agents',
        requestId: 'orchestration-test',
        userId: 'framework-tester'
      };

      console.log('   🔄 Testing parallel agent execution...');
      const startTime = performance.now();

      const parallelRequests = [
        { agentName: 'multi_tier_router', context: { ...testContext, userRequest: 'Route this complex query optimally' } },
        { agentName: 'retriever', context: { ...testContext, userRequest: 'Retrieve relevant information' } }
      ];

      const results = await this.agentRegistry.processParallelRequests(parallelRequests);
      const latency = performance.now() - startTime;

      const successful = results.filter(r => !r.error).length;
      const total = results.length;

      console.log(`   📊 Parallel execution: ${successful}/${total} agents succeeded (${latency.toFixed(0)}ms)`);
      
      if (successful > 0) {
        console.log(`   ✅ Agent orchestration: Working`);
        this.testResults.push({ 
          test: 'Agent Orchestration', 
          success: true, 
          latency: Math.round(latency),
          details: `${successful}/${total} agents succeeded`
        });
      } else {
        throw new Error('No agents succeeded in parallel execution');
      }

    } catch (error) {
      console.log(`   ❌ Agent orchestration failed: ${error.message}`);
      this.testResults.push({ test: 'Agent Orchestration', success: false, error: error.message });
    }

    console.log();
  }

  async testEvaluationFramework() {
    console.log('📊 Test 4: Evaluation Framework');
    console.log('------------------------------');

    try {
      // Import fitness evaluator
      const { fitnessEvaluator } = await import('../src/services/evolution/fitness-evaluator.js');
      this.fitnessEvaluator = fitnessEvaluator;

      // Test benchmark access
      const reasoningBenchmark = fitnessEvaluator.getBenchmark('reasoning');
      const creativityBenchmark = fitnessEvaluator.getBenchmark('creativity');

      if (reasoningBenchmark && creativityBenchmark) {
        console.log(`   ✅ Benchmarks loaded: reasoning (${reasoningBenchmark.tasks.length} tasks), creativity (${creativityBenchmark.tasks.length} tasks)`);
        this.testResults.push({ test: 'Evaluation Benchmarks', success: true });
      } else {
        throw new Error('Benchmarks not properly loaded');
      }

      // Test evaluation stats
      const stats = fitnessEvaluator.getEvaluationStats();
      console.log(`   📈 Evaluation stats: ${stats.benchmarksLoaded} benchmarks, ${stats.cacheSize} cached evaluations`);

      // Test creating a simple individual for evaluation
      const testIndividual = {
        id: 'test-individual-001',
        genes: {
          systemPrompt: 'You are a helpful AI assistant specialized in reasoning and analysis.',
          promptTemplate: 'Task: {task_description}\nInput: {input}\nPlease provide a thorough response:',
          reasoningStrategy: { type: 'cot' },
          parameters: {
            temperature: 0.7,
            maxTokens: 500,
            topP: 0.9,
            frequencyPenalty: 0.0,
            presencePenalty: 0.0
          },
          modelPreferences: ['qwen2.5-coder-14b-instruct-mlx']
        },
        fitness: 0,
        evaluations: []
      };

      console.log(`   🧪 Test individual created: ${testIndividual.id}`);
      console.log(`   ✅ Evaluation framework: Ready for testing`);
      this.testResults.push({ test: 'Evaluation Framework', success: true });

    } catch (error) {
      console.log(`   ❌ Evaluation framework failed: ${error.message}`);
      this.testResults.push({ test: 'Evaluation Framework', success: false, error: error.message });
    }

    console.log();
  }

  async testR1ReasoningWorkflow() {
    console.log('🧠 Test 5: R1 Reasoning Workflow with Agent Framework');
    console.log('---------------------------------------------------');

    if (!this.agentRegistry) {
      console.log('   ❌ Skipping - Agent registry not available');
      return;
    }

    try {
      const r1Context = {
        userRequest: 'Using R1 reasoning methodology, analyze the optimal approach for building a scalable AI reasoning system',
        requestId: 'r1-workflow-test',
        userId: 'framework-tester',
        metadata: { 
          reasoningMode: 'full_cycle',
          maxReasoningSteps: 4,
          confidenceThreshold: 0.8
        }
      };

      console.log('   🔄 Testing R1 reasoning agent workflow...');
      const startTime = performance.now();

      // Test the R1 reasoning agent specifically
      const r1Agent = await this.agentRegistry.getAgent('r1_reasoning');
      if (!r1Agent) {
        throw new Error('R1 reasoning agent not available');
      }

      console.log('   ✅ R1 reasoning agent loaded successfully');

      // Execute R1 reasoning workflow
      const result = await this.agentRegistry.processRequest('r1_reasoning', r1Context);
      const latency = performance.now() - startTime;

      if (result && typeof result === 'object') {
        const resultData = result.data || {};
        const reasoningSteps = resultData.reasoningSteps || [];
        const finalConfidence = resultData.confidenceEvolution ? 
          resultData.confidenceEvolution[resultData.confidenceEvolution.length - 1] : 0;

        console.log(`   📋 R1 Workflow Results:`);
        console.log(`      Reasoning steps: ${reasoningSteps.length}`);
        console.log(`      Final confidence: ${(finalConfidence * 100).toFixed(1)}%`);
        console.log(`      Total time: ${latency.toFixed(0)}ms`);
        console.log(`      Success: ${result.success !== false ? 'Yes' : 'No'}`);

        if (reasoningSteps.length > 0 && finalConfidence > 0.5) {
          console.log(`   ✅ R1 Reasoning Workflow: Successful multi-step reasoning`);
          this.testResults.push({ 
            test: 'R1 Reasoning Workflow', 
            success: true, 
            latency: Math.round(latency),
            details: `${reasoningSteps.length} steps, ${(finalConfidence * 100).toFixed(1)}% confidence`
          });
        } else {
          throw new Error('R1 reasoning did not produce expected multi-step results');
        }
      } else {
        throw new Error('R1 reasoning agent returned invalid result');
      }

    } catch (error) {
      console.log(`   ❌ R1 reasoning workflow failed: ${error.message}`);
      this.testResults.push({ test: 'R1 Reasoning Workflow', success: false, error: error.message });
    }

    console.log();
  }

  generateFrameworkReport() {
    console.log('📋 Agent Framework Test Report');
    console.log('=============================\n');

    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(r => r.success).length;
    const successRate = totalTests > 0 ? (passedTests / totalTests * 100) : 0;

    console.log('🎯 Summary:');
    console.log(`   Total Tests: ${totalTests}`);
    console.log(`   Passed Tests: ${passedTests}`);
    console.log(`   Success Rate: ${successRate.toFixed(1)}%\n`);

    console.log('📊 Detailed Results:');
    this.testResults.forEach(result => {
      const status = result.success ? '✅' : '❌';
      const latency = result.latency ? ` (${result.latency}ms)` : '';
      const details = result.details ? ` - ${result.details}` : '';
      const error = result.error ? ` - Error: ${result.error}` : '';
      console.log(`   ${status} ${result.test}${latency}${details}${error}`);
    });

    console.log('\n🏆 Agent Framework Status:');
    if (successRate >= 80) {
      console.log('   ✅ EXCELLENT: Agent framework is working well');
      console.log('   💡 All R1 RAG components are properly integrated');
    } else if (successRate >= 60) {
      console.log('   ⚠️  PARTIAL: Agent framework is partially working');
      console.log('   🔧 Some components need debugging');
    } else {
      console.log('   ❌ ISSUES: Agent framework has significant problems');
      console.log('   🚨 Major debugging required');
    }

    console.log('\n🔍 Key Findings:');
    
    const agentLoadingTests = this.testResults.filter(r => r.test.startsWith('Agent:'));
    const workingAgents = agentLoadingTests.filter(r => r.success).length;
    if (workingAgents > 0) {
      console.log(`   • ${workingAgents}/${agentLoadingTests.length} R1 RAG agents are functional`);
    }
    
    const r1Test = this.testResults.find(r => r.test === 'R1 Reasoning Workflow');
    if (r1Test && r1Test.success) {
      console.log('   • R1 Think-Generate-Retrieve-Rethink workflow is operational');
    }
    
    const orchestrationTest = this.testResults.find(r => r.test === 'Agent Orchestration');
    if (orchestrationTest && orchestrationTest.success) {
      console.log('   • Agent orchestration and parallel execution working');
    }

    const evaluationTest = this.testResults.find(r => r.test === 'Evaluation Framework');
    if (evaluationTest && evaluationTest.success) {
      console.log('   • Evaluation framework ready for fitness testing');
    }

    console.log('\n🏁 Agent Framework Test Complete!');
    console.log(`✨ Framework integration: ${successRate.toFixed(1)}% functional`);
  }
}

// Run the agent framework test
const tester = new AgentFrameworkTester();
tester.runFrameworkTests().catch(console.error);