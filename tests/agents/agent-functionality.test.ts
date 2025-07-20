/**
 * Agent Functionality Tests
 * Tests all agent functionality including cognitive agents, orchestration, and coordination
 */

import { jest } from '@jest/globals';
import { BaseAgent } from '../../src/agents/base_agent';
import { EnhancedOrchestratorAgent } from '../../src/agents/enhanced_orchestrator';
import { UniversalAgentRegistry } from '../../src/agents/universal_agent_registry';
import { DevilsAdvocateAgent } from '../../src/agents/cognitive/devils_advocate_agent';
import { EnhancedPlannerAgent } from '../../src/agents/cognitive/enhanced_planner_agent';
import { ReflectorAgent } from '../../src/agents/cognitive/reflector_agent';
import { SynthesizerAgent } from '../../src/agents/cognitive/synthesizer_agent';
import { UserIntentAgent } from '../../src/agents/cognitive/user_intent_agent';

// Mock dependencies
jest.mock('../../src/services/supabase_service');
jest.mock('../../src/services/dspy-service');
jest.mock('../../src/core/coordination/agent-coordinator');

describe('Agent Functionality Tests', () => {
  describe('BaseAgent', () => {
    let baseAgent: BaseAgent;

    beforeEach(() => {
      baseAgent = new BaseAgent({
        id: 'test-agent',
        name: 'Test Agent',
        description: 'A test agent',
        capabilities: ['test']
      });
    });

    test('should initialize with correct properties', () => {
      expect(baseAgent.id).toBe('test-agent');
      expect(baseAgent.name).toBe('Test Agent');
      expect(baseAgent.description).toBe('A test agent');
      expect(baseAgent.capabilities).toContain('test');
    });

    test('should execute basic tasks', async () => {
      const task = {
        id: 'task-1',
        type: 'test',
        data: { message: 'Hello, Agent!' }
      };

      const result = await baseAgent.execute(task);

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('taskId', 'task-1');
    });

    test('should handle task errors gracefully', async () => {
      const invalidTask = {
        id: 'invalid-task',
        type: 'unsupported',
        data: null
      };

      const result = await baseAgent.execute(invalidTask);

      expect(result).toHaveProperty('success', false);
      expect(result).toHaveProperty('error');
    });

    test('should update agent status', () => {
      expect(baseAgent.status).toBe('idle');
      
      baseAgent.setStatus('busy');
      expect(baseAgent.status).toBe('busy');
      
      baseAgent.setStatus('idle');
      expect(baseAgent.status).toBe('idle');
    });

    test('should track execution metrics', async () => {
      const task = {
        id: 'metrics-task',
        type: 'test',
        data: {}
      };

      await baseAgent.execute(task);

      expect(baseAgent.metrics.totalExecutions).toBe(1);
      expect(baseAgent.metrics.successfulExecutions).toBe(1);
      expect(baseAgent.metrics.averageExecutionTime).toBeGreaterThan(0);
    });
  });

  describe('Enhanced Orchestrator Agent', () => {
    let orchestrator: EnhancedOrchestratorAgent;

    beforeEach(() => {
      orchestrator = new EnhancedOrchestratorAgent({
        id: 'orchestrator',
        name: 'Enhanced Orchestrator',
        description: 'Orchestrates multiple agents'
      });
    });

    test('should coordinate multiple agents', async () => {
      const agents = [
        new BaseAgent({ id: 'agent-1', name: 'Agent 1' }),
        new BaseAgent({ id: 'agent-2', name: 'Agent 2' })
      ];

      orchestrator.registerAgents(agents);

      const complexTask = {
        id: 'complex-task',
        type: 'orchestration',
        data: {
          subtasks: [
            { agentId: 'agent-1', task: 'process-data' },
            { agentId: 'agent-2', task: 'analyze-results' }
          ]
        }
      };

      const result = await orchestrator.execute(complexTask);

      expect(result.success).toBe(true);
      expect(result.subtaskResults).toHaveLength(2);
    });

    test('should handle agent failures in orchestration', async () => {
      const faultyAgent = new BaseAgent({ id: 'faulty', name: 'Faulty Agent' });
      faultyAgent.execute = jest.fn().mockRejectedValue(new Error('Agent failure'));

      orchestrator.registerAgents([faultyAgent]);

      const task = {
        id: 'failing-task',
        type: 'orchestration',
        data: {
          subtasks: [{ agentId: 'faulty', task: 'fail' }]
        }
      };

      const result = await orchestrator.execute(task);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
    });

    test('should optimize task distribution', async () => {
      const agents = Array.from({ length: 5 }, (_, i) => 
        new BaseAgent({ id: `agent-${i}`, name: `Agent ${i}` })
      );

      orchestrator.registerAgents(agents);

      const parallelTasks = Array.from({ length: 10 }, (_, i) => ({
        agentId: `agent-${i % 5}`,
        task: `parallel-task-${i}`
      }));

      const task = {
        id: 'parallel-execution',
        type: 'orchestration',
        data: { subtasks: parallelTasks }
      };

      const startTime = Date.now();
      const result = await orchestrator.execute(task);
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });

  describe('Cognitive Agents', () => {
    describe('Devils Advocate Agent', () => {
      let devilsAdvocate: DevilsAdvocateAgent;

      beforeEach(() => {
        devilsAdvocate = new DevilsAdvocateAgent({
          id: 'devils-advocate',
          name: 'Devils Advocate'
        });
      });

      test('should challenge proposed solutions', async () => {
        const proposal = {
          id: 'proposal-task',
          type: 'challenge',
          data: {
            proposal: 'We should use a simple solution',
            context: 'Software architecture decision'
          }
        };

        const result = await devilsAdvocate.execute(proposal);

        expect(result.success).toBe(true);
        expect(result.challenges).toBeDefined();
        expect(result.challenges.length).toBeGreaterThan(0);
      });

      test('should identify potential risks', async () => {
        const riskAnalysis = {
          id: 'risk-analysis',
          type: 'risk-assessment',
          data: {
            plan: 'Deploy to production without testing',
            domain: 'software deployment'
          }
        };

        const result = await devilsAdvocate.execute(riskAnalysis);

        expect(result.success).toBe(true);
        expect(result.risks).toBeDefined();
        expect(result.risks.length).toBeGreaterThan(0);
      });
    });

    describe('Enhanced Planner Agent', () => {
      let planner: EnhancedPlannerAgent;

      beforeEach(() => {
        planner = new EnhancedPlannerAgent({
          id: 'planner',
          name: 'Enhanced Planner'
        });
      });

      test('should create detailed execution plans', async () => {
        const planningTask = {
          id: 'planning-task',
          type: 'create-plan',
          data: {
            objective: 'Build a web application',
            constraints: ['2 week timeline', 'budget: $10k'],
            requirements: ['responsive design', 'user authentication']
          }
        };

        const result = await planner.execute(planningTask);

        expect(result.success).toBe(true);
        expect(result.plan).toBeDefined();
        expect(result.plan.phases).toBeDefined();
        expect(result.plan.timeline).toBeDefined();
        expect(result.plan.resources).toBeDefined();
      });

      test('should adapt plans based on feedback', async () => {
        const adaptationTask = {
          id: 'adaptation-task',
          type: 'adapt-plan',
          data: {
            originalPlan: { phases: ['design', 'develop', 'test'] },
            feedback: 'Timeline too aggressive',
            constraints: ['extend timeline by 1 week']
          }
        };

        const result = await planner.execute(adaptationTask);

        expect(result.success).toBe(true);
        expect(result.adaptedPlan).toBeDefined();
        expect(result.changes).toBeDefined();
      });
    });

    describe('Reflector Agent', () => {
      let reflector: ReflectorAgent;

      beforeEach(() => {
        reflector = new ReflectorAgent({
          id: 'reflector',
          name: 'Reflector Agent'
        });
      });

      test('should analyze past performance', async () => {
        const reflectionTask = {
          id: 'reflection-task',
          type: 'analyze-performance',
          data: {
            executionHistory: [
              { task: 'task-1', success: true, duration: 100 },
              { task: 'task-2', success: false, duration: 50 },
              { task: 'task-3', success: true, duration: 200 }
            ]
          }
        };

        const result = await reflector.execute(reflectionTask);

        expect(result.success).toBe(true);
        expect(result.analysis).toBeDefined();
        expect(result.insights).toBeDefined();
        expect(result.recommendations).toBeDefined();
      });

      test('should identify improvement opportunities', async () => {
        const improvementTask = {
          id: 'improvement-task',
          type: 'identify-improvements',
          data: {
            systemMetrics: {
              averageResponseTime: 500,
              errorRate: 0.05,
              throughput: 100
            }
          }
        };

        const result = await reflector.execute(improvementTask);

        expect(result.success).toBe(true);
        expect(result.improvements).toBeDefined();
        expect(result.prioritizedActions).toBeDefined();
      });
    });

    describe('Synthesizer Agent', () => {
      let synthesizer: SynthesizerAgent;

      beforeEach(() => {
        synthesizer = new SynthesizerAgent({
          id: 'synthesizer',
          name: 'Synthesizer Agent'
        });
      });

      test('should combine multiple inputs into coherent output', async () => {
        const synthesisTask = {
          id: 'synthesis-task',
          type: 'synthesize',
          data: {
            inputs: [
              { source: 'agent-1', data: 'Analysis result A' },
              { source: 'agent-2', data: 'Analysis result B' },
              { source: 'agent-3', data: 'Analysis result C' }
            ],
            outputFormat: 'comprehensive-report'
          }
        };

        const result = await synthesizer.execute(synthesisTask);

        expect(result.success).toBe(true);
        expect(result.synthesis).toBeDefined();
        expect(result.confidenceScore).toBeGreaterThan(0);
      });

      test('should resolve conflicts between inputs', async () => {
        const conflictTask = {
          id: 'conflict-resolution',
          type: 'resolve-conflicts',
          data: {
            conflictingInputs: [
              { source: 'agent-1', recommendation: 'use-option-a' },
              { source: 'agent-2', recommendation: 'use-option-b' }
            ]
          }
        };

        const result = await synthesizer.execute(conflictTask);

        expect(result.success).toBe(true);
        expect(result.resolution).toBeDefined();
        expect(result.reasoning).toBeDefined();
      });
    });

    describe('User Intent Agent', () => {
      let userIntentAgent: UserIntentAgent;

      beforeEach(() => {
        userIntentAgent = new UserIntentAgent({
          id: 'user-intent',
          name: 'User Intent Agent'
        });
      });

      test('should understand user intent from natural language', async () => {
        const intentTask = {
          id: 'intent-analysis',
          type: 'analyze-intent',
          data: {
            userInput: 'I want to create a new project with React and TypeScript',
            context: 'project-creation'
          }
        };

        const result = await userIntentAgent.execute(intentTask);

        expect(result.success).toBe(true);
        expect(result.intent).toBeDefined();
        expect(result.intent.action).toBe('create-project');
        expect(result.intent.entities).toContain('React');
        expect(result.intent.entities).toContain('TypeScript');
      });

      test('should handle ambiguous user input', async () => {
        const ambiguousTask = {
          id: 'ambiguous-intent',
          type: 'analyze-intent',
          data: {
            userInput: 'Fix it',
            context: 'general'
          }
        };

        const result = await userIntentAgent.execute(ambiguousTask);

        expect(result.success).toBe(true);
        expect(result.clarificationNeeded).toBe(true);
        expect(result.suggestedQuestions).toBeDefined();
      });
    });
  });

  describe('Universal Agent Registry', () => {
    let registry: UniversalAgentRegistry;

    beforeEach(() => {
      registry = new UniversalAgentRegistry();
    });

    test('should register and retrieve agents', () => {
      const agent = new BaseAgent({ id: 'test-agent', name: 'Test Agent' });
      
      registry.registerAgent(agent);
      
      const retrievedAgent = registry.getAgent('test-agent');
      expect(retrievedAgent).toBe(agent);
    });

    test('should list all registered agents', () => {
      const agents = [
        new BaseAgent({ id: 'agent-1', name: 'Agent 1' }),
        new BaseAgent({ id: 'agent-2', name: 'Agent 2' }),
        new BaseAgent({ id: 'agent-3', name: 'Agent 3' })
      ];

      agents.forEach(agent => registry.registerAgent(agent));

      const allAgents = registry.getAllAgents();
      expect(allAgents).toHaveLength(3);
    });

    test('should find agents by capability', () => {
      const agents = [
        new BaseAgent({ id: 'agent-1', capabilities: ['data-processing'] }),
        new BaseAgent({ id: 'agent-2', capabilities: ['analysis', 'data-processing'] }),
        new BaseAgent({ id: 'agent-3', capabilities: ['visualization'] })
      ];

      agents.forEach(agent => registry.registerAgent(agent));

      const dataProcessingAgents = registry.findAgentsByCapability('data-processing');
      expect(dataProcessingAgents).toHaveLength(2);
    });

    test('should unregister agents', () => {
      const agent = new BaseAgent({ id: 'temp-agent', name: 'Temporary Agent' });
      
      registry.registerAgent(agent);
      expect(registry.getAgent('temp-agent')).toBe(agent);
      
      registry.unregisterAgent('temp-agent');
      expect(registry.getAgent('temp-agent')).toBeUndefined();
    });

    test('should prevent duplicate agent registration', () => {
      const agent1 = new BaseAgent({ id: 'duplicate', name: 'Agent 1' });
      const agent2 = new BaseAgent({ id: 'duplicate', name: 'Agent 2' });
      
      registry.registerAgent(agent1);
      
      expect(() => {
        registry.registerAgent(agent2);
      }).toThrow('Agent with ID "duplicate" already registered');
    });
  });

  describe('Agent Communication', () => {
    test('should enable inter-agent communication', async () => {
      const agent1 = new BaseAgent({ id: 'sender', name: 'Sender Agent' });
      const agent2 = new BaseAgent({ id: 'receiver', name: 'Receiver Agent' });
      
      const registry = new UniversalAgentRegistry();
      registry.registerAgent(agent1);
      registry.registerAgent(agent2);
      
      const message = {
        from: 'sender',
        to: 'receiver',
        type: 'data-share',
        payload: { data: 'shared information' }
      };
      
      const result = await registry.sendMessage(message);
      
      expect(result.success).toBe(true);
      expect(result.delivered).toBe(true);
    });

    test('should handle message routing failures', async () => {
      const registry = new UniversalAgentRegistry();
      
      const message = {
        from: 'sender',
        to: 'nonexistent',
        type: 'test',
        payload: {}
      };
      
      const result = await registry.sendMessage(message);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Agent not found');
    });
  });

  describe('Agent Load Balancing', () => {
    test('should distribute tasks across available agents', async () => {
      const agents = Array.from({ length: 3 }, (_, i) => 
        new BaseAgent({ id: `worker-${i}`, name: `Worker ${i}`, capabilities: ['processing'] })
      );
      
      const registry = new UniversalAgentRegistry();
      agents.forEach(agent => registry.registerAgent(agent));
      
      const tasks = Array.from({ length: 9 }, (_, i) => ({
        id: `task-${i}`,
        type: 'processing',
        data: { workload: i + 1 }
      }));
      
      const results = await Promise.all(
        tasks.map(task => registry.distributeTask(task))
      );
      
      expect(results.every(result => result.success)).toBe(true);
      
      // Check that tasks were distributed evenly
      const agentLoads = agents.map(agent => agent.metrics.totalExecutions);
      const maxLoad = Math.max(...agentLoads);
      const minLoad = Math.min(...agentLoads);
      expect(maxLoad - minLoad).toBeLessThanOrEqual(1);
    });
  });
});
