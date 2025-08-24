/**
 * HRM Agent Integration Router
 * Phase 2: Backend API endpoints for HRM Universal Decision Engine and Rust Agent Registry
 * Provides REST API interface for the Electron frontend to connect with backend agent systems
 */

import express from 'express';
import { hrmAgentBridge } from '../services/hrm-agent-bridge.js';
import { rustAgentRegistry } from '../services/rust-agent-registry-client.js';

const router = express.Router();

/**
 * HRM Universal Decision Engine Endpoints
 */

// Make intelligent decision using HRM engine
router.post('/api/hrm/decision', async (req, res) => {
  try {
    const { decision_type, session_id, request_data, system_state, constraints, available_options } = req.body;

    console.log(`🧠 HRM Decision Request: ${decision_type}`);
    
    // Transform frontend request to HRM format
    const decisionContext = {
      decisionType: decision_type,
      sessionId: session_id,
      requestData: request_data,
      systemState: system_state,
      constraints: constraints || {},
      availableOptions: available_options || []
    };

    let decisionResult;

    // Route decision based on type
    switch (decision_type) {
      case 'agent_routing':
        const agentSelection = await hrmAgentBridge.selectBestAgent(
          request_data?.task_description || 'General task',
          request_data?.task_type,
          constraints
        );
        
        decisionResult = {
          decision_id: `agent_${Date.now()}`,
          recommended_action: `use_agent_${agentSelection.agent.id}`,
          confidence_score: agentSelection.decisionResult.confidence,
          reasoning: agentSelection.decisionResult.reasoningSteps.join('. '),
          alternative_options: agentSelection.decisionResult.alternativeOptions.slice(0, 3).map(option => ({
            action: `use_agent_${option.agentId || 'unknown'}`,
            confidence: 0.7,
            reasoning: 'Alternative agent selection'
          })),
          execution_parameters: {
            agent_id: agentSelection.agent.id,
            agent_name: agentSelection.agent.name,
            source_system: agentSelection.sourceSystem,
            capabilities: agentSelection.agent.capabilities
          },
          estimated_resources: {
            cpu_usage: 25,
            memory_mb: 128,
            estimated_time_ms: agentSelection.agent.performance?.averageResponseMs || 1000
          },
          risk_assessment: {
            risk_level: 'LOW',
            potential_issues: [],
            mitigation_strategies: ['Monitor execution time', 'Implement timeout handling']
          },
          timestamp: new Date().toISOString()
        };
        break;

      case 'llm_selection':
        const llmSelection = await hrmAgentBridge.selectBestLLM(
          request_data?.query || 'General query',
          request_data?.domain,
          request_data?.user_preferences
        );
        
        decisionResult = {
          decision_id: `llm_${Date.now()}`,
          recommended_action: `use_model_${llmSelection.modelId}`,
          confidence_score: llmSelection.decisionResult.confidence,
          reasoning: llmSelection.decisionResult.reasoningSteps.join('. '),
          alternative_options: [],
          execution_parameters: {
            model_id: llmSelection.modelId,
            endpoint: llmSelection.endpoint
          },
          estimated_resources: {
            cpu_usage: 35,
            memory_mb: 256,
            estimated_time_ms: 2000
          },
          risk_assessment: {
            risk_level: 'LOW',
            potential_issues: [],
            mitigation_strategies: []
          },
          timestamp: new Date().toISOString()
        };
        break;

      case 'memory_management':
        const memoryOptimization = await hrmAgentBridge.optimizeMemoryUsage(system_state || {});
        
        decisionResult = {
          decision_id: `memory_${Date.now()}`,
          recommended_action: memoryOptimization.action,
          confidence_score: memoryOptimization.decisionResult.confidence,
          reasoning: memoryOptimization.decisionResult.reasoningSteps.join('. '),
          alternative_options: [],
          execution_parameters: memoryOptimization.parameters,
          estimated_resources: {
            cpu_usage: 10,
            memory_mb: -50, // Memory reduction
            estimated_time_ms: 500
          },
          risk_assessment: {
            risk_level: 'LOW',
            potential_issues: ['Temporary performance impact'],
            mitigation_strategies: ['Gradual optimization', 'Monitor system stability']
          },
          timestamp: new Date().toISOString()
        };
        break;

      default:
        // Fallback decision for unknown types
        decisionResult = {
          decision_id: `fallback_${Date.now()}`,
          recommended_action: 'use_default_strategy',
          confidence_score: 0.5,
          reasoning: 'Using fallback strategy for unknown decision type',
          alternative_options: [],
          execution_parameters: {},
          estimated_resources: {
            cpu_usage: 20,
            memory_mb: 64,
            estimated_time_ms: 1000
          },
          risk_assessment: {
            risk_level: 'MEDIUM',
            potential_issues: ['Unknown decision type may not be optimal'],
            mitigation_strategies: ['Use monitoring', 'Implement fallback logic']
          },
          timestamp: new Date().toISOString()
        };
    }

    res.json(decisionResult);

  } catch (error) {
    console.error('❌ HRM Decision API Error:', error);
    res.status(500).json({
      error: 'HRM decision failed',
      message: error.message,
      fallback: {
        decision_id: `error_${Date.now()}`,
        recommended_action: 'use_safe_fallback',
        confidence_score: 0.3,
        reasoning: 'Error occurred, using safe fallback',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * Agent System Health and Status Endpoints
 */

// Get comprehensive system health across all agent systems
router.get('/api/agents/system-health', async (req, res) => {
  try {
    console.log('🏥 System Health Check Request');

    // Get unified system status from HRM bridge
    const systemStatus = await hrmAgentBridge.getUnifiedSystemStatus();

    // Transform to match frontend interface expectations
    const healthResponse = {
      rust_registry: {
        status: systemStatus.serviceStatus.rust ? 'healthy' : 'offline',
        response_time_ms: Math.round(systemStatus.averageResponseTime),
        active_agents: systemStatus.activeAgents.rust || 0,
        total_executions: 0 // Would need metrics tracking
      },
      go_orchestrator: {
        status: systemStatus.serviceStatus.go ? 'healthy' : 'offline',
        specialized_agents: [] // Would populate from actual Go service
      },
      dspy_pipeline: {
        status: systemStatus.serviceStatus.dspy ? 'healthy' : 'offline',
        cognitive_agents: systemStatus.dspyMetrics ? [
          { name: 'Problem Analysis', stage: 'analysis', processing_time_ms: 150 },
          { name: 'Solution Generation', stage: 'generation', processing_time_ms: 300 },
          { name: 'Validation', stage: 'validation', processing_time_ms: 200 }
        ] : []
      },
      hrm_engine: {
        status: systemStatus.serviceStatus.hrm ? 'healthy' : 'offline',
        model_loaded: systemStatus.serviceStatus.hrm,
        inference_time_ms: Math.round(systemStatus.dspyMetrics?.averageResponseTime || 250),
        decision_accuracy: systemStatus.dspyMetrics?.successRate || 0.85
      }
    };

    res.json(healthResponse);

  } catch (error) {
    console.error('❌ System Health API Error:', error);

    // Return default offline status
    res.status(200).json({
      rust_registry: {
        status: 'offline',
        response_time_ms: 0,
        active_agents: 0,
        total_executions: 0
      },
      go_orchestrator: {
        status: 'offline',
        specialized_agents: []
      },
      dspy_pipeline: {
        status: 'offline',
        cognitive_agents: []
      },
      hrm_engine: {
        status: 'offline',
        model_loaded: false,
        inference_time_ms: 0,
        decision_accuracy: 0
      }
    });
  }
});

// Execute task with intelligent agent routing
router.post('/api/agents/execute-task', async (req, res) => {
  try {
    const { task_type, task_description, complexity, user_context, execution_constraints, hrm_recommendation, session_id } = req.body;

    console.log(`🚀 Task Execution Request: ${task_description.substring(0, 50)}...`);

    // Execute task using HRM bridge
    const executionResult = await hrmAgentBridge.executeTaskWithHRM(
      task_description,
      task_type,
      execution_constraints
    );

    // Transform response to match frontend interface
    const response = {
      task_id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      execution_chain: [
        {
          agent_name: executionResult.executionMetrics.selectedAgent,
          agent_type: task_type || 'general',
          execution_time_ms: executionResult.executionMetrics.executionTime,
          result: executionResult.result,
          confidence_score: executionResult.executionMetrics.confidence,
          next_agent: null
        }
      ],
      final_result: executionResult.result,
      total_execution_time_ms: executionResult.executionMetrics.executionTime,
      resource_usage: {
        cpu_usage: 30,
        memory_usage_mb: 128,
        network_calls: 1
      },
      success: executionResult.executionMetrics.success,
      error_details: executionResult.executionMetrics.success ? undefined : {
        error_type: 'execution_failed',
        error_message: executionResult.result?.error || 'Task execution failed',
        recovery_suggestions: ['Retry with different agent', 'Check system resources']
      },
      hrm_reasoning_trace: [
        {
          decision_point: 'agent_selection',
          reasoning: `Selected ${executionResult.executionMetrics.selectedAgent} from ${executionResult.executionMetrics.sourceSystem}`,
          confidence: executionResult.executionMetrics.confidence,
          alternatives_considered: ['rust-registry agents', 'go-orchestrator agents', 'dynamic-factory agents']
        }
      ]
    };

    res.json(response);

  } catch (error) {
    console.error('❌ Task Execution API Error:', error);
    res.status(500).json({
      task_id: `error_${Date.now()}`,
      success: false,
      error_details: {
        error_type: 'api_error',
        error_message: error.message,
        recovery_suggestions: ['Check system connectivity', 'Verify agent availability']
      },
      final_result: { error: error.message }
    });
  }
});

// Execute agent chain workflow
router.post('/api/agents/execute-chain', async (req, res) => {
  try {
    const { agent_chain, initial_request, session_id } = req.body;

    console.log(`🔗 Agent Chain Execution: ${agent_chain.join(' → ')}`);

    // Use multi-system coordination for complex workflows
    const coordinationResult = await hrmAgentBridge.coordinateMultiSystemTask(
      initial_request.task_description,
      ['rust-registry', 'go-orchestrator', 'dynamic-factory']
    );

    // Transform coordination result to chain execution format
    const executionChain = Object.entries(coordinationResult.execution_results).map(([agentName, result], index) => ({
      agent_name: agentName,
      agent_type: agent_chain[index] || 'coordination',
      execution_time_ms: result.executionTime || 1000,
      result: result.result,
      confidence_score: result.success ? 0.85 : 0.3,
      next_agent: index < agent_chain.length - 1 ? agent_chain[index + 1] : null
    }));

    const totalExecutionTime = executionChain.reduce((sum, step) => sum + step.execution_time_ms, 0);

    const response = {
      task_id: `chain_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      execution_chain: executionChain,
      final_result: {
        coordination_plan: coordinationResult.coordination_plan,
        coordination_results: coordinationResult.execution_results,
        success: Object.values(coordinationResult.execution_results).every((r: any) => r.success)
      },
      total_execution_time_ms: totalExecutionTime,
      resource_usage: {
        cpu_usage: 50,
        memory_usage_mb: 256,
        network_calls: agent_chain.length
      },
      success: true,
      hrm_reasoning_trace: [
        {
          decision_point: 'chain_coordination',
          reasoning: 'Multi-system task coordination using DSPy orchestrator',
          confidence: 0.8,
          alternatives_considered: ['Sequential execution', 'Parallel processing', 'Single-agent fallback']
        }
      ]
    };

    res.json(response);

  } catch (error) {
    console.error('❌ Agent Chain API Error:', error);
    res.status(500).json({
      task_id: `chain_error_${Date.now()}`,
      success: false,
      error_details: {
        error_type: 'chain_execution_failed',
        error_message: error.message,
        recovery_suggestions: ['Retry individual agents', 'Check agent chain configuration']
      }
    });
  }
});

// Get available agents from all systems
router.get('/api/agents/available', async (req, res) => {
  try {
    console.log('📋 Available Agents Request');

    // Get agents from all systems via HRM bridge
    const systemStatus = await hrmAgentBridge.getUnifiedSystemStatus();

    // Create mock agent data based on system status (in production, would get real agent details)
    const agents = [
      {
        name: 'swift-ui-expert',
        type: 'SwiftUI Development',
        status: systemStatus.serviceStatus.rust ? 'healthy' : 'offline',
        capabilities: ['swiftui', 'ios', 'macos', 'ui-design'],
        performance: {
          tasks_completed: 45,
          average_response_ms: 850,
          success_rate: 0.92
        },
        source_system: 'rust-registry'
      },
      {
        name: 'code-reviewer',
        type: 'Code Review',
        status: systemStatus.serviceStatus.go ? 'healthy' : 'offline',
        capabilities: ['code-review', 'static-analysis', 'best-practices'],
        performance: {
          tasks_completed: 120,
          average_response_ms: 650,
          success_rate: 0.95
        },
        source_system: 'go-orchestrator'
      },
      {
        name: 'test-runner',
        type: 'Test Execution',
        status: systemStatus.serviceStatus.rust ? 'healthy' : 'offline',
        capabilities: ['test-execution', 'test-automation', 'ci-cd'],
        performance: {
          tasks_completed: 89,
          average_response_ms: 1200,
          success_rate: 0.88
        },
        source_system: 'rust-registry'
      },
      {
        name: 'api-debugger',
        type: 'API Debugging',
        status: systemStatus.serviceStatus.go ? 'healthy' : 'offline',
        capabilities: ['api-testing', 'network-debugging', 'endpoint-analysis'],
        performance: {
          tasks_completed: 67,
          average_response_ms: 750,
          success_rate: 0.91
        },
        source_system: 'go-orchestrator'
      },
      {
        name: 'performance-optimizer',
        type: 'Performance',
        status: systemStatus.serviceStatus.rust ? 'healthy' : 'offline',
        capabilities: ['performance-analysis', 'bottleneck-detection', 'optimization'],
        performance: {
          tasks_completed: 34,
          average_response_ms: 1500,
          success_rate: 0.87
        },
        source_system: 'rust-registry'
      },
      {
        name: 'one-folder',
        type: 'One Folder Agent',
        status: systemStatus.serviceStatus.dspy ? 'healthy' : 'offline',
        capabilities: ['folder-analysis', 'file-organization', 'project-structure'],
        performance: {
          tasks_completed: 23,
          average_response_ms: 2000,
          success_rate: 0.85
        },
        source_system: 'dynamic-factory'
      },
      {
        name: 'pydantic-ai',
        type: 'Pydantic AI',
        status: systemStatus.serviceStatus.dspy ? 'healthy' : 'offline',
        capabilities: ['data-validation', 'schema-generation', 'type-safety'],
        performance: {
          tasks_completed: 56,
          average_response_ms: 900,
          success_rate: 0.93
        },
        source_system: 'dynamic-factory'
      }
    ];

    res.json(agents);

  } catch (error) {
    console.error('❌ Available Agents API Error:', error);
    res.status(500).json({
      error: 'Failed to get available agents',
      agents: []
    });
  }
});

/**
 * DSPy Cognitive Reasoning Endpoints
 */

// Execute complex reasoning using DSPy cognitive pipeline
router.post('/api/dspy/cognitive-reasoning', async (req, res) => {
  try {
    const { problem, context, session_id } = req.body;

    console.log(`🤖 DSPy Cognitive Reasoning Request: ${problem.substring(0, 50)}...`);

    // Execute cognitive reasoning through HRM bridge
    const reasoningResult = await hrmAgentBridge.executeCognitiveReasoning(
      problem,
      true, // Use HRM preprocessing
      context
    );

    res.json({
      reasoning_id: `dspy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      cognitive_analysis: reasoningResult.cognitive_analysis,
      hrm_preprocessing: reasoningResult.hrm_preprocessing,
      execution_metadata: {
        reasoning_mode: reasoningResult.metadata.reasoning_mode,
        agent_count: reasoningResult.metadata.agent_count,
        processing_time_ms: reasoningResult.metadata.execution_time,
        confidence_score: reasoningResult.cognitive_analysis?.validation_score || 0.8
      },
      success: true,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ DSPy Cognitive Reasoning API Error:', error);
    res.status(500).json({
      reasoning_id: `dspy_error_${Date.now()}`,
      success: false,
      error: error.message,
      fallback_analysis: {
        reasoning_mode: 'fallback',
        message: 'DSPy pipeline unavailable, using fallback logic'
      }
    });
  }
});

export default router;