#!/usr/bin/env tsx
/**
 * Comprehensive Functional Test Suite for HRM-Integrated Agent Systems
 * Tests all 6 layers of the agent architecture with HRM decision routing
 */

import { hrmAgentBridge } from './src/services/hrm-agent-bridge';
import { DynamicAgentFactory } from './src/services/dynamic-agent-factory';
import { rustAgentRegistry } from './src/services/rust-agent-registry-client';
import { goAgentOrchestrator } from './src/services/go-agent-orchestrator-client';
import { dspyAgentClient } from './src/services/dspy-agent-client';

interface TestResult {
  testName: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  duration: number;
  details: string;
  error?: unknown;
}

class HRMIntegrationTester {
  private results: TestResult[] = [];
  private dynamicFactory: DynamicAgentFactory;

  constructor() {
    this.dynamicFactory = new DynamicAgentFactory();
    process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.log('🧪 HRM Integration Functional Testing Suite');
    console.log('=' .repeat(60));
  }

  /**
   * Run comprehensive functional tests
   */
  async runAllTests(): Promise<void> {
    console.log('🚀 Starting comprehensive functional tests...\n');
    
    // 1. Test service connectivity
    await this.testServiceConnectivity();
    
    // 2. Test HRM Decision Engine
    await this.testHRMDecisionEngine();
    
    // 3. Test Rust Agent Registry operations
    await this.testRustAgentRegistry();
    
    // 4. Test Go Agent Orchestrator
    await this.testGoAgentOrchestrator();
    
    // 5. Test DSPy Cognitive Pipeline
    await this.testDSPyCognitivePipeline();
    
    // 6. Test Dynamic Agent Factory with HRM
    await this.testDynamicAgentFactoryWithHRM();
    
    // 7. Test multi-system coordination
    await this.testMultiSystemCoordination();
    
    // 8. Test fallback strategies
    await this.testFallbackStrategies();
    
    // 9. Test performance and monitoring
    await this.testPerformanceMonitoring();
    
    // 10. Test real-world scenarios
    await this.testRealWorldScenarios();

    this.generateTestReport();
  }

  /**
   * Test 1: Service Connectivity
   */
  private async testServiceConnectivity(): Promise<void> {
    console.log('1️⃣ Testing Service Connectivity');
    console.log('-'.repeat(40));

    // Test HRM Agent Bridge connectivity
    await this.runTest('HRM Agent Bridge Connectivity', async () => {
      const systemStatus = await hrmAgentBridge.getSystemStatus();
      console.log(`   HRM Status: ${systemStatus.hrmStatus}`);
      console.log(`   Overall Health: ${systemStatus.overallHealth}`);
      
      return `HRM: ${systemStatus.hrmStatus}, Health: ${systemStatus.overallHealth}`;
    });

    // Test Rust Agent Registry
    await this.runTest('Rust Agent Registry Connectivity', async () => {
      const isHealthy = await rustAgentRegistry.isHealthy();
      const status = rustAgentRegistry.getConnectionStatus();
      console.log(`   Connected: ${status.connected}, Base URL: ${status.baseUrl}`);
      
      return `Connected: ${status.connected}, Healthy: ${isHealthy}`;
    });

    // Test Go Agent Orchestrator
    await this.runTest('Go Agent Orchestrator Connectivity', async () => {
      const isHealthy = await goAgentOrchestrator.isHealthy();
      const status = goAgentOrchestrator.getConnectionStatus();
      console.log(`   Connected: ${status.connected}, Base URL: ${status.baseUrl}`);
      
      return `Connected: ${status.connected}, Healthy: ${isHealthy}`;
    });

    // Test DSPy Cognitive Pipeline
    await this.runTest('DSPy Cognitive Pipeline Connectivity', async () => {
      const isHealthy = await dspyAgentClient.isHealthy();
      const status = dspyAgentClient.getConnectionStatus();
      console.log(`   Connected: ${status.connected}, Base URL: ${status.baseUrl}`);
      
      return `Connected: ${status.connected}, Healthy: ${isHealthy}`;
    });

    console.log();
  }

  /**
   * Test 2: HRM Decision Engine
   */
  private async testHRMDecisionEngine(): Promise<void> {
    console.log('2️⃣ Testing HRM Decision Engine');
    console.log('-'.repeat(40));

    // Test LLM selection
    await this.runTest('HRM LLM Selection', async () => {
      const result = await hrmAgentBridge.selectBestLLM(
        "Create a complex Swift UI component with animations",
        "software_engineering",
        { complexity: 'high', language: 'swift' }
      );
      
      console.log(`   Selected LLM: ${result.modelId}`);
      console.log(`   Confidence: ${result.decisionResult.confidence}`);
      
      return `LLM: ${result.modelId}, Confidence: ${result.decisionResult.confidence}`;
    });

    // Test agent selection
    await this.runTest('HRM Agent Selection', async () => {
      const result = await hrmAgentBridge.selectBestAgent(
        "Debug API endpoints that are returning 500 errors",
        "api_debugging",
        { priority: 'high', errorType: 'server_error' }
      );
      
      console.log(`   Selected Agent: ${result.agent?.name || 'None'}`);
      console.log(`   Source System: ${result.sourceSystem}`);
      console.log(`   Confidence: ${result.confidence}`);
      
      return `Agent: ${result.agent?.name}, System: ${result.sourceSystem}, Confidence: ${result.confidence}`;
    });

    // Test memory management decision
    await this.runTest('HRM Memory Management', async () => {
      const result = await hrmAgentBridge.optimizeMemoryUsage({
        currentUsage: 85,
        threshold: 90,
        availableActions: ['garbage_collect', 'cache_clear', 'agent_restart']
      });
      
      console.log(`   Recommended Action: ${result.recommendedAction}`);
      console.log(`   Priority: ${result.priority}`);
      
      return `Action: ${result.recommendedAction}, Priority: ${result.priority}`;
    });

    console.log();
  }

  /**
   * Test 3: Rust Agent Registry
   */
  private async testRustAgentRegistry(): Promise<void> {
    console.log('3️⃣ Testing Rust Agent Registry');
    console.log('-'.repeat(40));

    // Test list all agents
    await this.runTest('Rust Registry - List Agents', async () => {
      const agents = await rustAgentRegistry.listAllAgents();
      console.log(`   Found ${agents.length} agents in Rust registry`);
      
      return `${agents.length} agents found`;
    });

    // Test agent registration
    await this.runTest('Rust Registry - Agent Registration', async () => {
      const registrationResult = await rustAgentRegistry.registerAgent({
        name: 'test-performance-agent',
        agentType: 'performance_optimizer',
        capabilities: ['memory_analysis', 'cpu_profiling', 'bottleneck_detection'],
        endpoint: 'http://localhost:8150',
        config: { maxConcurrentTasks: 5, timeoutMs: 30000 }
      });
      
      console.log(`   Registered Agent ID: ${registrationResult.agentId}`);
      console.log(`   Status: ${registrationResult.status}`);
      
      return `ID: ${registrationResult.agentId}, Status: ${registrationResult.status}`;
    });

    // Test workflow orchestration
    await this.runTest('Rust Registry - Workflow Orchestration', async () => {
      const workflowResult = await rustAgentRegistry.orchestrateWorkflow({
        name: 'performance-optimization-workflow',
        steps: [
          {
            id: 'memory-analysis',
            agentType: 'performance_optimizer',
            input: { analysisType: 'memory', target: 'system' },
            dependencies: []
          },
          {
            id: 'optimization-recommendations',
            agentType: 'performance_optimizer',
            input: { optimizationType: 'memory', baseline: 'current' },
            dependencies: ['memory-analysis']
          }
        ],
        parallelExecution: false
      });
      
      console.log(`   Workflow ID: ${workflowResult.workflowId}`);
      console.log(`   Status: ${workflowResult.status}`);
      
      return `Workflow: ${workflowResult.workflowId}, Status: ${workflowResult.status}`;
    });

    console.log();
  }

  /**
   * Test 4: Go Agent Orchestrator
   */
  private async testGoAgentOrchestrator(): Promise<void> {
    console.log('4️⃣ Testing Go Agent Orchestrator');
    console.log('-'.repeat(40));

    // Test list specialized agents
    await this.runTest('Go Orchestrator - List Specialized Agents', async () => {
      const agents = await goAgentOrchestrator.listSpecializedAgents();
      console.log(`   Found ${agents.length} specialized agents`);
      agents.slice(0, 3).forEach(agent => {
        console.log(`     - ${agent.name} (${agent.specialization})`);
      });
      
      return `${agents.length} specialized agents found`;
    });

    // Test find SwiftUI expert
    await this.runTest('Go Orchestrator - Find SwiftUI Expert', async () => {
      const swiftUIAgents = await goAgentOrchestrator.findAgentsBySpecialization('swift-ui-expert');
      console.log(`   Found ${swiftUIAgents.length} SwiftUI experts`);
      
      if (swiftUIAgents.length > 0) {
        console.log(`     Expert: ${swiftUIAgents[0].name}`);
        console.log(`     Capabilities: ${swiftUIAgents[0].capabilities.slice(0, 3).join(', ')}`);
      }
      
      return `${swiftUIAgents.length} SwiftUI experts found`;
    });

    // Test task execution with auto selection
    await this.runTest('Go Orchestrator - Auto Task Execution', async () => {
      const result = await goAgentOrchestrator.executeTaskWithAutoSelection({
        type: 'code_review',
        description: 'Review Swift code for concurrency best practices',
        priority: 'medium',
        input: { 
          code: 'async func fetchData() -> Data { /* implementation */ }',
          language: 'swift'
        },
        capabilities: ['swift', 'concurrency', 'code_review']
      });
      
      console.log(`   Execution: ${result.success ? 'SUCCESS' : 'FAILED'}`);
      console.log(`   Agent: ${result.agentName}`);
      console.log(`   Duration: ${result.executionTimeMs}ms`);
      
      return `Success: ${result.success}, Agent: ${result.agentName}, Duration: ${result.executionTimeMs}ms`;
    });

    console.log();
  }

  /**
   * Test 5: DSPy Cognitive Pipeline
   */
  private async testDSPyCognitivePipeline(): Promise<void> {
    console.log('5️⃣ Testing DSPy 10-Agent Cognitive Pipeline');
    console.log('-'.repeat(40));

    // Test cognitive reasoning
    await this.runTest('DSPy - Cognitive Reasoning', async () => {
      const result = await dspyAgentClient.executeCognitiveReasoning(
        "Design a distributed system architecture that can handle 1M+ concurrent users while maintaining sub-100ms response times",
        true, // Use HRM preprocessing
        { domain: 'system_architecture', complexity: 'high' }
      );
      
      console.log(`   Reasoning Mode: ${result.metadata.reasoning_mode}`);
      console.log(`   Validation Score: ${result.cognitive_analysis.validation_score}`);
      console.log(`   Agent Count: ${result.metadata.agent_count}`);
      
      return `Mode: ${result.metadata.reasoning_mode}, Score: ${result.cognitive_analysis.validation_score}`;
    });

    // Test adaptive orchestration
    await this.runTest('DSPy - Adaptive Orchestration', async () => {
      const result = await dspyAgentClient.executeAdaptiveOrchestration({
        request: "Optimize database queries for a high-traffic e-commerce platform",
        preferred_mode: 'cognitive',
        context: { domain: 'database_optimization', load: 'high' }
      });
      
      console.log(`   Selected Mode: ${result.mode}`);
      console.log(`   Complexity Score: ${result.complexity}`);
      
      return `Mode: ${result.mode}, Complexity: ${result.complexity}`;
    });

    // Test task coordination
    await this.runTest('DSPy - Task Coordination', async () => {
      const result = await dspyAgentClient.executeTaskCoordination({
        task: "Implement microservices migration from monolithic architecture",
        available_agents: ['architect', 'developer', 'tester', 'devops', 'security'],
        coordination_mode: 'adaptive'
      });
      
      console.log(`   Agent Assignments: ${result.agent_assignments.length}`);
      console.log(`   Consensus Confidence: ${result.confidence}`);
      
      return `Assignments: ${result.agent_assignments.length}, Confidence: ${result.confidence}`;
    });

    console.log();
  }

  /**
   * Test 6: Dynamic Agent Factory with HRM
   */
  private async testDynamicAgentFactoryWithHRM(): Promise<void> {
    console.log('6️⃣ Testing Dynamic Agent Factory with HRM Integration');
    console.log('-'.repeat(40));

    // Test HRM-optimized agent creation
    await this.runTest('Dynamic Factory - HRM Agent Creation', async () => {
      const agent = await this.dynamicFactory.createAgent(
        'react-builder',
        'HRM-TestAgent',
        { typescript: true, testing: true, complexity: 'high' }
      );
      
      console.log(`   Created Agent: ${agent.name} (${agent.id})`);
      console.log(`   Status: ${agent.status}`);
      console.log(`   HRM Decision: ${JSON.stringify(agent.config.hrmDecision || {})}`);
      
      return `Agent: ${agent.name}, Status: ${agent.status}`;
    });

    // Test task execution with HRM
    await this.runTest('Dynamic Factory - HRM Task Execution', async () => {
      const result = await this.dynamicFactory.executeTaskWithHRM(
        "Create a responsive React dashboard with real-time data visualization",
        "web_development",
        { frameworks: ['react', 'typescript'], features: ['real-time', 'responsive'] }
      );
      
      console.log(`   Success: ${result.executionMetrics.success}`);
      console.log(`   Selected Agent: ${result.executionMetrics.selectedAgent}`);
      console.log(`   Source System: ${result.executionMetrics.sourceSystem}`);
      console.log(`   Confidence: ${result.executionMetrics.confidence}`);
      
      return `Success: ${result.executionMetrics.success}, Agent: ${result.executionMetrics.selectedAgent}`;
    });

    console.log();
  }

  /**
   * Test 7: Multi-System Coordination
   */
  private async testMultiSystemCoordination(): Promise<void> {
    console.log('7️⃣ Testing Multi-System Agent Coordination');
    console.log('-'.repeat(40));

    // Test complex task requiring multiple systems
    await this.runTest('Multi-System - Complex Task Coordination', async () => {
      // This should trigger HRM to coordinate across multiple systems
      const result = await hrmAgentBridge.executeTaskWithHRM(
        "Build a complete SwiftUI app with API integration, implement comprehensive test suite, and set up CI/CD pipeline",
        "full_stack_development",
        { 
          languages: ['swift', 'typescript'], 
          platforms: ['ios', 'macos'], 
          complexity: 'complex',
          requirements: ['ui_development', 'api_integration', 'testing', 'devops']
        }
      );
      
      console.log(`   Task Execution: ${result.executionMetrics.success ? 'SUCCESS' : 'FAILED'}`);
      console.log(`   Primary Agent: ${result.executionMetrics.selectedAgent}`);
      console.log(`   Source System: ${result.executionMetrics.sourceSystem}`);
      console.log(`   Reasoning Mode: ${result.executionMetrics.reasoningMode || 'standard'}`);
      
      return `Success: ${result.executionMetrics.success}, Mode: ${result.executionMetrics.reasoningMode}`;
    });

    // Test agent search across systems
    await this.runTest('Multi-System - Cross-System Agent Search', async () => {
      const agentId = 'swift-ui-expert-001'; // Example agent ID
      const agent = await hrmAgentBridge.getAgentById(agentId);
      
      if (agent) {
        console.log(`   Found Agent: ${agent.name}`);
        console.log(`   Source System: ${agent.sourceSystem}`);
        console.log(`   Capabilities: ${agent.capabilities.slice(0, 3).join(', ')}`);
      } else {
        console.log(`   Agent ${agentId} not found in any system`);
      }
      
      return agent ? `Found: ${agent.name} in ${agent.sourceSystem}` : 'Not found';
    });

    console.log();
  }

  /**
   * Test 8: Fallback Strategies
   */
  private async testFallbackStrategies(): Promise<void> {
    console.log('8️⃣ Testing Fallback Strategies');
    console.log('-'.repeat(40));

    // Test HRM unavailable fallback
    await this.runTest('Fallback - HRM to LFM2', async () => {
      // Simulate HRM unavailability by using a task that would trigger fallback
      const result = await this.dynamicFactory.executeTaskWithHRM(
        "Simple file organization task",
        "file_management",
        { simulateHRMFailure: true }
      );
      
      console.log(`   Execution: ${result.executionMetrics.success ? 'SUCCESS' : 'FAILED'}`);
      console.log(`   Fallback Used: ${result.executionMetrics.confidence < 0.7 ? 'YES' : 'NO'}`);
      console.log(`   Final Confidence: ${result.executionMetrics.confidence}`);
      
      return `Success: ${result.executionMetrics.success}, Fallback: ${result.executionMetrics.confidence < 0.7}`;
    });

    // Test service isolation
    await this.runTest('Fallback - Service Isolation', async () => {
      const systemStatus = await hrmAgentBridge.getSystemStatus();
      
      console.log(`   Rust Registry: ${systemStatus.rustRegistry.status}`);
      console.log(`   Go Orchestrator: ${systemStatus.goOrchestrator.status}`);
      console.log(`   DSPy Pipeline: ${systemStatus.dspyPipeline.status}`);
      console.log(`   Overall Health: ${systemStatus.overallHealth}`);
      
      // System should still function even if some services are offline
      const canFunction = systemStatus.overallHealth !== 'critical';
      
      return `Health: ${systemStatus.overallHealth}, Functional: ${canFunction}`;
    });

    console.log();
  }

  /**
   * Test 9: Performance and Monitoring
   */
  private async testPerformanceMonitoring(): Promise<void> {
    console.log('9️⃣ Testing Performance and Monitoring');
    console.log('-'.repeat(40));

    // Test system metrics
    await this.runTest('Performance - System Metrics', async () => {
      const systemStatus = await hrmAgentBridge.getSystemStatus();
      
      console.log(`   Total Active Agents: ${systemStatus.rustRegistry.agentCount + systemStatus.goOrchestrator.specializedAgents + systemStatus.dynamicFactory.activeAgents}`);
      console.log(`   Active Task Windows: ${systemStatus.dynamicFactory.taskWindows}`);
      console.log(`   System Health: ${systemStatus.overallHealth}`);
      
      return `Agents: ${systemStatus.rustRegistry.agentCount + systemStatus.goOrchestrator.specializedAgents}, Health: ${systemStatus.overallHealth}`;
    });

    // Test DSPy performance metrics
    await this.runTest('Performance - DSPy Metrics', async () => {
      const metrics = await dspyAgentClient.getPerformanceMetrics();
      
      console.log(`   Total Requests: ${metrics.totalRequests}`);
      console.log(`   Average Response Time: ${Math.round(metrics.averageResponseTime)}ms`);
      console.log(`   Success Rate: ${Math.round(metrics.successRate * 100)}%`);
      console.log(`   System Status: ${metrics.systemStatus}`);
      
      return `Requests: ${metrics.totalRequests}, Avg Response: ${Math.round(metrics.averageResponseTime)}ms`;
    });

    // Test response time benchmarking
    await this.runTest('Performance - Response Time Benchmark', async () => {
      const startTime = Date.now();
      
      // Execute a simple task to measure response time
      await hrmAgentBridge.selectBestLLM(
        "Simple query for response time testing",
        "general",
        {}
      );
      
      const responseTime = Date.now() - startTime;
      console.log(`   HRM Response Time: ${responseTime}ms`);
      
      const isGoodPerformance = responseTime < 1000; // Sub-second response
      
      return `Response Time: ${responseTime}ms, Performance: ${isGoodPerformance ? 'GOOD' : 'SLOW'}`;
    });

    console.log();
  }

  /**
   * Test 10: Real-World Scenarios
   */
  private async testRealWorldScenarios(): Promise<void> {
    console.log('🔟 Testing Real-World Scenarios');
    console.log('-'.repeat(40));

    // Scenario 1: Complex SwiftUI Development
    await this.runTest('Scenario - SwiftUI Development', async () => {
      const result = await hrmAgentBridge.executeTaskWithHRM(
        "Create a SwiftUI view with complex animations, API data binding, and comprehensive unit tests",
        "ios_development",
        { 
          language: 'swift',
          framework: 'swiftui',
          features: ['animations', 'api_integration', 'testing'],
          complexity: 'high'
        }
      );
      
      console.log(`   Task Success: ${result.executionMetrics.success}`);
      console.log(`   Selected System: ${result.executionMetrics.sourceSystem}`);
      console.log(`   Execution Time: ${result.executionMetrics.executionTime}ms`);
      
      return `Success: ${result.executionMetrics.success}, System: ${result.executionMetrics.sourceSystem}`;
    });

    // Scenario 2: Performance Optimization
    await this.runTest('Scenario - Performance Optimization', async () => {
      const result = await hrmAgentBridge.executeTaskWithHRM(
        "Analyze system performance bottlenecks and implement optimization strategies",
        "performance_optimization",
        { 
          target: 'full_system',
          metrics: ['memory', 'cpu', 'network', 'database'],
          optimization_level: 'aggressive'
        }
      );
      
      console.log(`   Optimization Success: ${result.executionMetrics.success}`);
      console.log(`   Agent Type: ${result.executionMetrics.selectedAgent}`);
      
      return `Success: ${result.executionMetrics.success}, Agent: ${result.executionMetrics.selectedAgent}`;
    });

    // Scenario 3: API Integration and Testing
    await this.runTest('Scenario - API Integration', async () => {
      const result = await hrmAgentBridge.executeTaskWithHRM(
        "Debug failing API endpoints, implement retry logic, and create comprehensive integration tests",
        "api_development",
        { 
          api_type: 'rest',
          issues: ['timeout', 'authentication', 'rate_limiting'],
          testing_framework: 'jest'
        }
      );
      
      console.log(`   Integration Success: ${result.executionMetrics.success}`);
      console.log(`   Debugging Agent: ${result.executionMetrics.selectedAgent}`);
      
      return `Success: ${result.executionMetrics.success}, Agent: ${result.executionMetrics.selectedAgent}`;
    });

    console.log();
  }

  /**
   * Run a single test with error handling and metrics
   */
  private async runTest(testName: string, testFunction: () => Promise<string>): Promise<void> {
    const startTime = Date.now();
    let result: TestResult;
    
    try {
      console.log(`   🧪 ${testName}...`);
      const details = await testFunction();
      const duration = Date.now() - startTime;
      
      result = {
        testName,
        status: 'PASS',
        duration,
        details
      };
      
      console.log(`   ✅ PASS (${duration}ms) - ${details}`);
    } catch (error) {
      const duration = Date.now() - startTime;
      
      result = {
        testName,
        status: 'FAIL',
        duration,
        details: error.message,
        error
      };
      
      console.log(`   ❌ FAIL (${duration}ms) - ${error.message}`);
    }
    
    this.results.push(result);
  }

  /**
   * Generate comprehensive test report
   */
  private generateTestReport(): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 HRM INTEGRATION FUNCTIONAL TEST REPORT');
    console.log('='.repeat(60));

    const passCount = this.results.filter(r => r.status === 'PASS').length;
    const failCount = this.results.filter(r => r.status === 'FAIL').length;
    const totalTests = this.results.length;
    const successRate = Math.round((passCount / totalTests) * 100);
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);
    const avgDuration = Math.round(totalDuration / totalTests);

    console.log(`\n📈 SUMMARY:`);
    console.log(`   Total Tests: ${totalTests}`);
    console.log(`   Passed: ${passCount} ✅`);
    console.log(`   Failed: ${failCount} ❌`);
    console.log(`   Success Rate: ${successRate}%`);
    console.log(`   Total Duration: ${totalDuration}ms`);
    console.log(`   Average Duration: ${avgDuration}ms`);
    
    console.log(`\n📊 PERFORMANCE METRICS:`);
    const fastTests = this.results.filter(r => r.duration < 500).length;
    const slowTests = this.results.filter(r => r.duration > 2000).length;
    console.log(`   Fast Tests (<500ms): ${fastTests}`);
    console.log(`   Slow Tests (>2000ms): ${slowTests}`);

    if (failCount > 0) {
      console.log(`\n❌ FAILED TESTS:`);
      this.results.filter(r => r.status === 'FAIL').forEach(result => {
        console.log(`   • ${result.testName}: ${result.details}`);
      });
    }

    console.log(`\n🎯 INTEGRATION STATUS:`);
    if (successRate >= 90) {
      console.log(`   🟢 EXCELLENT - HRM integration is working excellently`);
    } else if (successRate >= 75) {
      console.log(`   🟡 GOOD - HRM integration is mostly functional with minor issues`);
    } else if (successRate >= 50) {
      console.log(`   🟠 FAIR - HRM integration has significant issues requiring attention`);
    } else {
      console.log(`   🔴 POOR - HRM integration requires immediate fixes`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Functional testing complete!');
    console.log('='.repeat(60));
  }
}

// Run the tests if this file is executed directly
const tester = new HRMIntegrationTester();
tester.runAllTests().catch(error => {
  process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.error('❌ Test suite failed:', error);
  process.exit(1);
});

export default HRMIntegrationTester;