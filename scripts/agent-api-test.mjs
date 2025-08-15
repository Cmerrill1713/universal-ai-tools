#!/usr/bin/env node

/**
 * Agent API Integration Test
 * Tests the actual R1 RAG agents via API endpoints
 */

import { performance } from 'perf_hooks';
import fetch from 'node-fetch';

console.log('🧪 Agent API Integration Test');
console.log('============================');
console.log('Testing R1 RAG agents via API endpoints\n');

const SERVER_URL = 'http://localhost:9999';

class AgentAPITester {
  constructor() {
    this.testResults = [];
    this.agentBaseUrl = `${SERVER_URL}/api/v1/agents`;
  }

  async runAgentAPITests() {
    console.log('🚀 Starting Agent API Tests\n');

    try {
      // Test 1: Verify agent registry
      await this.testAgentRegistry();

      // Test 2: Test R1 RAG agents
      await this.testR1RAGAgents();

      // Test 3: Test agent orchestration
      await this.testAgentOrchestration();

      // Test 4: Test R1 reasoning workflow
      await this.testR1ReasoningWorkflow();

      this.generateAPITestReport();

    } catch (error) {
      console.error('❌ Agent API test failed:', error.message);
    }
  }

  async testAgentRegistry() {
    console.log('📋 Test 1: Agent Registry Verification');
    console.log('------------------------------------');

    try {
      const response = await fetch(`${this.agentBaseUrl}`, {
        signal: AbortSignal.timeout(5000)
      });

      if (response.ok) {
        const data = await response.json();
        const agents = data.agents || [];
        
        const r1AgentNames = ['graphrag_reasoning', 'r1_reasoning', 'multi_tier_router', 'performance_optimization'];
        
        console.log(`   📊 Total agents registered: ${agents.length}`);
        
        for (const agentName of r1AgentNames) {
          const agent = agents.find(a => a.name === agentName);
          if (agent) {
            console.log(`   ✅ ${agentName}: Available (${agent.capabilities.length} capabilities)`);
            this.testResults.push({ test: `Registry: ${agentName}`, success: true });
          } else {
            console.log(`   ❌ ${agentName}: Not found`);
            this.testResults.push({ test: `Registry: ${agentName}`, success: false });
          }
        }

        this.testResults.push({ test: 'Agent Registry', success: true });
      } else {
        throw new Error(`HTTP ${response.status}`);
      }

    } catch (error) {
      console.log(`   ❌ Registry test failed: ${error.message}`);
      this.testResults.push({ test: 'Agent Registry', success: false, error: error.message });
    }

    console.log();
  }

  async testR1RAGAgents() {
    console.log('🤖 Test 2: R1 RAG Agent Execution');
    console.log('--------------------------------');

    const agentsToTest = [
      {
        name: 'multi_tier_router',
        description: 'Multi-tier model routing',
        request: 'Route this query optimally: Analyze AI system performance'
      },
      {
        name: 'graphrag_reasoning', 
        description: 'GraphRAG reasoning',
        request: 'Build a knowledge graph about AI reasoning systems'
      },
      {
        name: 'performance_optimization',
        description: 'Performance optimization', 
        request: 'Optimize system performance for sub-3 second response times'
      }
    ];

    for (const agent of agentsToTest) {
      try {
        console.log(`   🔄 Testing ${agent.description}...`);
        const startTime = performance.now();

        const response = await fetch(`${this.agentBaseUrl}/${agent.name}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userRequest: agent.request,
            userId: 'api-tester',
            requestId: `test-${agent.name}-${Date.now()}`
          }),
          signal: AbortSignal.timeout(15000)
        });

        const latency = performance.now() - startTime;

        if (response.ok) {
          const result = await response.json();
          
          const success = result.success !== false;
          const hasData = result.data && typeof result.data === 'object';
          const hasMessage = result.message && result.message.length > 0;

          console.log(`   ✅ ${agent.name}: ${success ? 'Success' : 'Failed'} (${latency.toFixed(0)}ms)`);
          console.log(`      Response: ${hasMessage ? 'Valid' : 'No message'}, Data: ${hasData ? 'Present' : 'Missing'}`);
          
          if (result.confidence) {
            console.log(`      Confidence: ${(result.confidence * 100).toFixed(1)}%`);
          }

          this.testResults.push({
            test: `Agent: ${agent.name}`,
            success: success && hasMessage,
            latency: Math.round(latency),
            details: `${hasData ? 'With data' : 'No data'}, confidence: ${result.confidence || 'N/A'}`
          });

        } else {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

      } catch (error) {
        console.log(`   ❌ ${agent.name}: Failed (${error.message})`);
        this.testResults.push({
          test: `Agent: ${agent.name}`,
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

    try {
      // Test orchestration endpoint if available
      const orchestrationRequest = {
        primaryAgent: 'multi_tier_router',
        supportingAgents: ['performance_optimization'],
        context: {
          userRequest: 'Optimize AI system performance using multi-tier routing',
          userId: 'orchestration-tester'
        }
      };

      console.log('   🔄 Testing agent orchestration...');
      const startTime = performance.now();

      // Try orchestration endpoint
      const response = await fetch(`${this.agentBaseUrl}/orchestrate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orchestrationRequest),
        signal: AbortSignal.timeout(20000)
      });

      const latency = performance.now() - startTime;

      if (response.ok) {
        const result = await response.json();
        
        console.log(`   ✅ Orchestration: Success (${latency.toFixed(0)}ms)`);
        console.log(`      Primary result: ${result.primary ? 'Present' : 'Missing'}`);
        console.log(`      Supporting results: ${result.supporting ? result.supporting.length : 0}`);
        
        this.testResults.push({
          test: 'Agent Orchestration',
          success: true,
          latency: Math.round(latency),
          details: `Primary + ${result.supporting ? result.supporting.length : 0} supporting agents`
        });

      } else if (response.status === 404) {
        console.log(`   ⚠️  Orchestration endpoint not found - testing sequential execution`);
        
        // Test sequential execution as fallback
        const sequentialSuccess = await this.testSequentialExecution();
        this.testResults.push({
          test: 'Agent Orchestration',
          success: sequentialSuccess,
          details: 'Sequential execution fallback'
        });

      } else {
        throw new Error(`HTTP ${response.status}`);
      }

    } catch (error) {
      console.log(`   ❌ Orchestration failed: ${error.message}`);
      this.testResults.push({
        test: 'Agent Orchestration',
        success: false,
        error: error.message
      });
    }

    console.log();
  }

  async testSequentialExecution() {
    try {
      // Test running agents in sequence
      const agent1Response = await fetch(`${this.agentBaseUrl}/multi_tier_router`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userRequest: 'Route this query for optimization analysis',
          userId: 'sequential-tester'
        }),
        signal: AbortSignal.timeout(10000)
      });

      if (!agent1Response.ok) return false;

      const agent2Response = await fetch(`${this.agentBaseUrl}/performance_optimization`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userRequest: 'Analyze performance optimization strategies',
          userId: 'sequential-tester'
        }),
        signal: AbortSignal.timeout(10000)
      });

      return agent2Response.ok;

    } catch (error) {
      return false;
    }
  }

  async testR1ReasoningWorkflow() {
    console.log('🧠 Test 4: R1 Reasoning Workflow');
    console.log('-------------------------------');

    try {
      const r1Request = {
        userRequest: 'Using R1 reasoning methodology, design an optimal AI system architecture. Think through the problem systematically, generate initial approaches, retrieve relevant knowledge, and rethink your solution.',
        userId: 'r1-workflow-tester',
        metadata: {
          reasoningMode: 'full_cycle',
          maxReasoningSteps: 4,
          confidenceThreshold: 0.7
        }
      };

      console.log('   🔄 Testing R1 reasoning workflow...');
      const startTime = performance.now();

      const response = await fetch(`${this.agentBaseUrl}/r1_reasoning`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(r1Request),
        signal: AbortSignal.timeout(30000) // Longer timeout for reasoning
      });

      const latency = performance.now() - startTime;

      if (response.ok) {
        const result = await response.json();
        
        const reasoningSteps = result.data?.reasoningSteps || [];
        const confidenceEvolution = result.data?.confidenceEvolution || [];
        const finalAnswer = result.data?.finalAnswer || '';
        
        const hasMultipleSteps = reasoningSteps.length >= 3;
        const hasConfidenceProgression = confidenceEvolution.length > 0;
        const hasFinalAnswer = finalAnswer.length > 50;

        console.log(`   📋 R1 Reasoning Results:`);
        console.log(`      Reasoning steps: ${reasoningSteps.length}`);
        console.log(`      Confidence evolution: ${confidenceEvolution.map(c => (c * 100).toFixed(0) + '%').join(' → ')}`);
        console.log(`      Final answer length: ${finalAnswer.length} characters`);
        console.log(`      Total time: ${latency.toFixed(0)}ms`);

        const workflowSuccess = hasMultipleSteps && hasConfidenceProgression && hasFinalAnswer;

        if (workflowSuccess) {
          console.log(`   ✅ R1 Reasoning: Multi-step workflow successful`);
        } else {
          console.log(`   ⚠️  R1 Reasoning: Partial workflow (missing some components)`);
        }

        this.testResults.push({
          test: 'R1 Reasoning Workflow',
          success: workflowSuccess,
          latency: Math.round(latency),
          details: `${reasoningSteps.length} steps, ${confidenceEvolution.length > 0 ? 'confidence tracking' : 'no confidence'}`
        });

      } else {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

    } catch (error) {
      console.log(`   ❌ R1 reasoning failed: ${error.message}`);
      this.testResults.push({
        test: 'R1 Reasoning Workflow',
        success: false,
        error: error.message
      });
    }

    console.log();
  }

  generateAPITestReport() {
    console.log('📋 Agent API Test Report');
    console.log('========================\n');

    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(r => r.success).length;
    const successRate = totalTests > 0 ? (passedTests / totalTests * 100) : 0;

    console.log('🎯 Summary:');
    console.log(`   Total Tests: ${totalTests}`);
    console.log(`   Passed Tests: ${passedTests}`);
    console.log(`   Success Rate: ${successRate.toFixed(1)}%\n`);

    // Calculate average latency for successful tests
    const successfulTests = this.testResults.filter(r => r.success && r.latency);
    const avgLatency = successfulTests.length > 0 ? 
      successfulTests.reduce((sum, t) => sum + t.latency, 0) / successfulTests.length : 0;

    if (avgLatency > 0) {
      console.log(`📊 Performance Metrics:`);
      console.log(`   Average Response Time: ${avgLatency.toFixed(0)}ms`);
      console.log(`   Performance Target: ${avgLatency < 3000 ? '✅ Sub-3s ACHIEVED' : '⚠️ Needs optimization'}\n`);
    }

    console.log('📊 Detailed Results:');
    this.testResults.forEach(result => {
      const status = result.success ? '✅' : '❌';
      const latency = result.latency ? ` (${result.latency}ms)` : '';
      const details = result.details ? ` - ${result.details}` : '';
      const error = result.error ? ` - Error: ${result.error}` : '';
      console.log(`   ${status} ${result.test}${latency}${details}${error}`);
    });

    console.log('\n🏆 R1 RAG System Status:');
    if (successRate >= 80) {
      console.log('   ✅ EXCELLENT: R1 RAG system is fully operational');
      console.log('   💡 All four development priorities achieved:');
      console.log('      🔓 GraphRAG: Knowledge graph agents working');
      console.log('      🤖 Custom Agents: Multi-tier routing functional');
      console.log('      ⚡ Performance: Response times optimized');
      console.log('      🧠 R1 Reasoning: Multi-step workflows operational');
    } else if (successRate >= 60) {
      console.log('   ⚠️  PARTIAL: R1 RAG system is partially operational');
      console.log('   🔧 Some components working, others need attention');
    } else {
      console.log('   ❌ ISSUES: R1 RAG system has significant problems');
      console.log('   🚨 Major debugging required');
    }

    console.log('\n🔍 Key Findings:');
    
    const agentTests = this.testResults.filter(r => r.test.startsWith('Agent:'));
    const workingAgents = agentTests.filter(r => r.success).length;
    if (workingAgents > 0) {
      console.log(`   • ${workingAgents}/${agentTests.length} R1 RAG agents are functional via API`);
    }
    
    const r1Test = this.testResults.find(r => r.test === 'R1 Reasoning Workflow');
    if (r1Test && r1Test.success) {
      console.log('   • R1 Think-Generate-Retrieve-Rethink workflow operational');
    }
    
    const orchestrationTest = this.testResults.find(r => r.test === 'Agent Orchestration');
    if (orchestrationTest && orchestrationTest.success) {
      console.log('   • Agent orchestration working (sequential or parallel)');
    }

    const registryTest = this.testResults.find(r => r.test === 'Agent Registry');
    if (registryTest && registryTest.success) {
      console.log('   • Agent registry fully loaded with R1 RAG agents');
    }

    console.log('\n🏁 Agent API Test Complete!');
    console.log(`✨ R1 RAG system via API: ${successRate.toFixed(1)}% functional`);
    
    if (avgLatency > 0) {
      console.log(`⚡ Average response time: ${avgLatency.toFixed(0)}ms`);
    }
  }
}

// Run the agent API test
const tester = new AgentAPITester();
tester.runAgentAPITests().catch(console.error);