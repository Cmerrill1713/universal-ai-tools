import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { DSPyService } from '../../../src/services/dspy-service';
import { DSPyBridge } from '../../../src/services/dspy-orchestrator/bridge';
import { UniversalAgentRegistry } from '../../../src/agents/universal_agent_registry';
import { EnhancedMemorySystem } from '../../../src/memory/enhanced_memory_system';
import { logger } from '../../../src/utils/logger';
import { v4 as uuidv4 } from 'uuid';
import WebSocket from 'ws';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';

// Integration test that tests the real DSPy integration
describe('DSPy Orchestration Integration', () => {
  let dspyService: DSPyService;
  let agentRegistry: UniversalAgentRegistry;
  let memorySystem: EnhancedMemorySystem;
  let pythonProcess: ChildProcess | null = null;
  let wsServer: WebSocket.Server | null = null;

  beforeAll(async () => {
    // Set up test environment
    process.env.NODE_ENV = 'test';
    process.env.DSPY_TEST_MODE = 'true';
    
    // Initialize services
    logger.info('🧪 Starting DSPy integration tests...');
    
    // Start mock Python service for testing
    await startMockPythonService();
    
    // Initialize real services
    dspyService = new DSPyService();
    agentRegistry = UniversalAgentRegistry.getInstance();
    memorySystem = EnhancedMemorySystem.getInstance();
    
    // Wait for services to initialize
    await new Promise(resolve => setTimeout(resolve, 3000));
  });

  afterAll(async () => {
    // Clean up
    await dspyService.shutdown();
    if (pythonProcess) {
      pythonProcess.kill();
    }
    if (wsServer) {
      wsServer.close();
    }
  });

  beforeEach(() => {
    // Clear any state between tests
    jest.clearAllMocks();
  });

  async function startMockPythonService(): Promise<void> {
    // Create a mock WebSocket server that simulates DSPy responses
    wsServer = new WebSocket.Server({ port: 8765 });
    
    wsServer.on('connection', (ws) => {
      logger.info('Mock DSPy service connected');
      
      ws.on('message', (data: string) => {
        const request = JSON.parse(data);
        logger.info(`Mock DSPy received: ${request.method}`);
        
        // Simulate different responses based on method
        let response: any;
        
        switch (request.method) {
          case 'orchestrate':
            response = {
              requestId: request.requestId,
              success: true,
              data: {
                orchestration_mode: request.params.context?.mode || 'standard',
                consensus: `Orchestrated response for: ${request.params.userRequest}`,
                complexity: 3,
                confidence: 0.85,
                coordination_plan: 'Selected optimal agents for task',
                selected_agents: 'planner,code_assistant'
              }
            };
            break;
            
          case 'coordinate_agents':
            response = {
              requestId: request.requestId,
              success: true,
              data: {
                selected_agents: request.params.agents.slice(0, 2),
                coordination_plan: 'Agents coordinated successfully',
                agent_assignments: request.params.agents.slice(0, 2).map((agent: string) => ({
                  agent,
                  task: `Subtask for ${agent}`
                }))
              }
            };
            break;
            
          case 'manage_knowledge':
            response = {
              requestId: request.requestId,
              success: true,
              data: handleKnowledgeOperation(request.params)
            };
            break;
            
          default:
            response = {
              requestId: request.requestId,
              success: false,
              error: `Unknown method: ${request.method}`
            };
        }
        
        ws.send(JSON.stringify(response));
      });
    });
  }

  function handleKnowledgeOperation(params: any): any {
    switch (params.operation) {
      case 'search':
        return {
          results: [
            { content: 'Result 1', score: 0.9 },
            { content: 'Result 2', score: 0.8 }
          ],
          total: 2
        };
      case 'extract':
        return {
          entities: ['entity1', 'entity2'],
          concepts: ['concept1'],
          relationships: []
        };
      case 'evolve':
        return {
          evolved_knowledge: params.data.existing_knowledge + ' ' + params.data.new_information,
          changes: ['Added new information'],
          confidence: 0.9
        };
      default:
        return { error: 'Unknown operation' };
    }
  }

  describe('Basic Orchestration', () => {
    it('should orchestrate a simple request', async () => {
      const request = {
        requestId: uuidv4(),
        userRequest: 'Help me write a hello world program',
        userId: 'test-user',
        timestamp: new Date()
      };

      const response = await dspyService.orchestrate(request);

      expect(response.success).toBe(true);
      expect(response.result).toContain('Orchestrated response for');
      expect(response.mode).toBe('standard');
      expect(response.participatingAgents).toContain('planner');
      expect(response.participatingAgents).toContain('code_assistant');
    });

    it('should handle different orchestration modes', async () => {
      const modes = ['simple', 'standard', 'cognitive', 'adaptive'] as const;
      
      for (const mode of modes) {
        const request = {
          requestId: uuidv4(),
          userRequest: `Test ${mode} orchestration`,
          userId: 'test-user',
          orchestrationMode: mode,
          timestamp: new Date()
        };

        const response = await dspyService.orchestrate(request);
        
        expect(response.success).toBe(true);
        expect(response.mode).toBe(mode);
      }
    });
  });

  describe('Agent Coordination', () => {
    it('should coordinate multiple agents', async () => {
      const availableAgents = [
        'planner_agent',
        'code_assistant_agent',
        'file_manager_agent',
        'web_scraper_agent'
      ];

      const result = await dspyService.coordinateAgents(
        'Build a web scraping tool',
        availableAgents,
        { requirements: ['Python', 'BeautifulSoup'] }
      );

      expect(result.success).toBe(true);
      expect(result.selectedAgents).toHaveLength(2);
      expect(result.coordinationPlan).toBeTruthy();
      expect(result.assignments).toHaveLength(2);
      
      result.assignments.forEach((assignment: any) => {
        expect(assignment).toHaveProperty('agent');
        expect(assignment).toHaveProperty('task');
      });
    });

    it('should handle empty agent list', async () => {
      const result = await dspyService.coordinateAgents(
        'Some task',
        [],
        {}
      );

      expect(result.success).toBe(true);
      expect(result.selectedAgents).toHaveLength(0);
    });
  });

  describe('Knowledge Management Integration', () => {
    it('should search knowledge successfully', async () => {
      const result = await dspyService.searchKnowledge(
        'TypeScript best practices',
        { limit: 5, threshold: 0.7 }
      );

      expect(result.success).toBe(true);
      expect(result.operation).toBe('search');
      expect(result.result.results).toHaveLength(2);
      expect(result.result.results[0].score).toBeGreaterThan(0.5);
    });

    it('should extract knowledge from content', async () => {
      const content = `
        TypeScript is a statically typed superset of JavaScript.
        It adds optional static typing and class-based object-oriented programming.
      `;

      const result = await dspyService.extractKnowledge(content, {
        domain: 'programming',
        language: 'en'
      });

      expect(result.success).toBe(true);
      expect(result.result.entities).toContain('entity1');
      expect(result.result.concepts).toContain('concept1');
    });

    it('should evolve knowledge with new information', async () => {
      const existing = 'Python is a programming language';
      const newInfo = 'Python 3.12 adds improved error messages';

      const result = await dspyService.evolveKnowledge(existing, newInfo);

      expect(result.success).toBe(true);
      expect(result.result.evolved_knowledge).toContain(existing);
      expect(result.result.evolved_knowledge).toContain(newInfo);
      expect(result.result.confidence).toBeGreaterThan(0.5);
    });
  });

  describe('Complex Workflows', () => {
    it('should handle a complex multi-step workflow', async () => {
      // Step 1: Initial orchestration
      const orchestrationRequest = {
        requestId: uuidv4(),
        userRequest: 'Create a data analysis pipeline for CSV files',
        userId: 'test-user',
        orchestrationMode: 'cognitive' as const,
        context: {
          fileType: 'CSV',
          analysisType: 'statistical'
        },
        timestamp: new Date()
      };

      const orchestrationResponse = await dspyService.orchestrate(orchestrationRequest);
      expect(orchestrationResponse.success).toBe(true);

      // Step 2: Coordinate agents based on the plan
      const agents = ['planner_agent', 'code_assistant_agent', 'file_manager_agent'];
      const coordinationResult = await dspyService.coordinateAgents(
        'Implement CSV analysis pipeline',
        agents,
        { plan: orchestrationResponse.reasoning }
      );

      expect(coordinationResult.success).toBe(true);
      expect(coordinationResult.selectedAgents).toHaveLength(2);

      // Step 3: Search for relevant knowledge
      const knowledgeResult = await dspyService.searchKnowledge(
        'CSV parsing Python pandas',
        { limit: 10 }
      );

      expect(knowledgeResult.success).toBe(true);
      expect(knowledgeResult.result.results.length).toBeGreaterThan(0);
    });

    it('should handle concurrent orchestration requests', async () => {
      const requests = Array.from({ length: 5 }, (_, i) => ({
        requestId: uuidv4(),
        userRequest: `Concurrent request ${i}`,
        userId: `user-${i}`,
        timestamp: new Date()
      }));

      const responses = await Promise.all(
        requests.map(req => dspyService.orchestrate(req))
      );

      expect(responses).toHaveLength(5);
      responses.forEach((response, i) => {
        expect(response.success).toBe(true);
        expect(response.result).toContain(`Concurrent request ${i}`);
      });
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle service disconnection gracefully', async () => {
      // Temporarily close the WebSocket server
      if (wsServer) {
        wsServer.close();
      }

      const request = {
        requestId: uuidv4(),
        userRequest: 'Test during disconnection',
        userId: 'test-user',
        timestamp: new Date()
      };

      const response = await dspyService.orchestrate(request);
      
      expect(response.success).toBe(false);
      expect(response.mode).toBe('fallback');
      expect(response.error).toBeTruthy();

      // Restart the server
      await startMockPythonService();
      await new Promise(resolve => setTimeout(resolve, 2000));
    });

    it('should handle malformed requests', async () => {
      const request = {
        requestId: uuidv4(),
        userRequest: '', // Empty request
        userId: 'test-user',
        timestamp: new Date()
      };

      const response = await dspyService.orchestrate(request);
      
      // Should still process but with appropriate handling
      expect(response).toBeTruthy();
      expect(response.requestId).toBe(request.requestId);
    });
  });

  describe('Performance Characteristics', () => {
    it('should complete requests within reasonable time', async () => {
      const request = {
        requestId: uuidv4(),
        userRequest: 'Simple performance test',
        userId: 'test-user',
        timestamp: new Date()
      };

      const startTime = Date.now();
      const response = await dspyService.orchestrate(request);
      const endTime = Date.now();

      expect(response.success).toBe(true);
      expect(response.executionTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(endTime - startTime).toBeLessThan(5000);
    });

    it('should handle request queuing', async () => {
      // Send multiple requests rapidly
      const requests = Array.from({ length: 10 }, (_, i) => ({
        requestId: uuidv4(),
        userRequest: `Queue test ${i}`,
        userId: 'test-user',
        timestamp: new Date()
      }));

      const startTime = Date.now();
      const responses = await Promise.all(
        requests.map(req => dspyService.orchestrate(req))
      );
      const totalTime = Date.now() - startTime;

      expect(responses).toHaveLength(10);
      responses.forEach(response => {
        expect(response.success).toBe(true);
      });

      // Should process all requests efficiently
      expect(totalTime).toBeLessThan(10000); // Less than 10 seconds for 10 requests
    });
  });

  describe('Status and Monitoring', () => {
    it('should provide accurate status information', () => {
      const status = dspyService.getStatus();

      expect(status).toHaveProperty('initialized');
      expect(status).toHaveProperty('connected');
      expect(status).toHaveProperty('queueSize');
      
      expect(typeof status.initialized).toBe('boolean');
      expect(typeof status.connected).toBe('boolean');
      expect(typeof status.queueSize).toBe('number');
    });

    it('should track queue size during operations', async () => {
      const initialStatus = dspyService.getStatus();
      const initialQueueSize = initialStatus.queueSize;

      // Start multiple async operations
      const promises = Array.from({ length: 3 }, (_, i) => 
        dspyService.orchestrate({
          requestId: uuidv4(),
          userRequest: `Queue tracking ${i}`,
          userId: 'test-user',
          timestamp: new Date()
        })
      );

      // Check status while operations are in progress
      // Note: This might not always catch the queue in action due to timing
      const midStatus = dspyService.getStatus();
      
      // Wait for all to complete
      await Promise.all(promises);

      const finalStatus = dspyService.getStatus();
      expect(finalStatus.queueSize).toBe(initialQueueSize);
    });
  });
});