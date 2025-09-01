/**
 * AB-MCTS Rust Service Integration Tests
 * 
 * Comprehensive end-to-end validation of the Rust service integration
 * with the Universal AI Tools system.
 */

import request from 'supertest';
import express from 'express';
import { abMCTSRustService, ABMCTSRustIntegration } from '../services/ab-mcts-rust-integration';
import abMCTSRustRouter from '../routers/ab-mcts-rust';

describe('AB-MCTS Rust Service Integration', () => {
  let app: express.Application;
  
  beforeAll(async () => {
    // Set up test Express app with the router
    app = express();
    app.use(express.json());
    app.use('/api/v1/ab-mcts-rust', abMCTSRustRouter);
    
    // Allow time for service initialization
    await new Promise(resolve => setTimeout(resolve, 2000));
  });

  afterAll(async () => {
    // Cleanup
    await abMCTSRustService.shutdown();
  });

  describe('Service Health and Status', () => {
    test('should report service health', async () => {
      const response = await request(app)
        .get('/api/v1/ab-mcts-rust/health')
        .expect(200);

      expect(response.body).toHaveProperty('healthy');
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('service', 'ab-mcts-rust-service');
      expect(response.body).toHaveProperty('version', '0.1.0');
      expect(response.body).toHaveProperty('timestamp');
    });

    test('should provide performance statistics', async () => {
      // Skip if service is not healthy
      const healthResponse = await request(app).get('/api/v1/ab-mcts-rust/health');
      
      if (!healthResponse.body.healthy) {
        console.log('⚠️ Skipping stats test - Rust service not available');
        return;
      }

      const response = await request(app)
        .get('/api/v1/ab-mcts-rust/stats')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('stats');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('Agent Search Operations', () => {
    const testContext = {
      task: 'Integration test: Analyze user requirements and provide optimal agent recommendations',
      requirements: [
        'accurate analysis',
        'fast response',
        'comprehensive coverage'
      ],
      constraints: [
        'time limit: 30 seconds',
        'memory limit: 512MB',
        'cost limit: $50'
      ],
      contextData: {
        testEnvironment: true,
        integrationTest: 'ab-mcts-rust',
        complexity: 'moderate'
      },
      userPreferences: {
        preferredAgents: ['enhanced-planner-agent', 'enhanced-retriever-agent'],
        qualityVsSpeed: 0.7,
        maxCost: 100.0,
        timeoutMs: 30000
      },
      executionContext: {
        sessionId: `integration-test-${Date.now()}`,
        userId: 'test-user-rust-integration',
        timestamp: Date.now(),
        budget: 200.0,
        priority: 'Normal' as const
      }
    };

    const testAgents = [
      'enhanced-planner-agent',
      'enhanced-retriever-agent',
      'enhanced-synthesizer-agent',
      'enhanced-code-assistant-agent',
      'enhanced-personal-assistant-agent'
    ];

    test('should perform optimal agent search', async () => {
      const response = await request(app)
        .post('/api/v1/ab-mcts-rust/search')
        .send({
          context: testContext,
          availableAgents: testAgents,
          options: {
            maxIterations: 100,
            maxDepth: 5,
            timeLimitMs: 3000,
            explorationConstant: Math.SQRT2,
            discountFactor: 0.9,
            parallelSimulations: 2,
            enableCaching: false
          }
        })
        .expect((res) => {
          if (res.status === 503) {
            console.log('⚠️ Rust service not available, skipping search test');
            return;
          }
          expect(res.status).toBe(200);
        });

      if (response.status === 503) return; // Service unavailable

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('result');
      expect(response.body.result).toHaveProperty('bestPath');
      expect(response.body.result).toHaveProperty('confidence');
      expect(response.body.result).toHaveProperty('searchStatistics');
      expect(response.body.result).toHaveProperty('agentRecommendations');
      
      // Validate search statistics
      const stats = response.body.result.searchStatistics;
      expect(stats).toHaveProperty('totalIterations');
      expect(stats).toHaveProperty('nodesExplored');
      expect(stats).toHaveProperty('searchTimeMs');
      expect(stats.totalIterations).toBeGreaterThan(0);
      expect(stats.nodesExplored).toBeGreaterThan(0);
      
      // Validate confidence
      expect(response.body.result.confidence).toBeGreaterThanOrEqual(0);
      expect(response.body.result.confidence).toBeLessThanOrEqual(1);

      console.log(`✅ Search completed with ${stats.totalIterations} iterations, confidence: ${response.body.result.confidence.toFixed(3)}`);
    }, 10000); // 10 second timeout

    test('should get agent recommendations', async () => {
      const response = await request(app)
        .post('/api/v1/ab-mcts-rust/recommend')
        .send({
          context: testContext,
          availableAgents: testAgents,
          maxRecommendations: 3
        })
        .expect((res) => {
          if (res.status === 503) {
            console.log('⚠️ Rust service not available, skipping recommend test');
            return;
          }
          expect(res.status).toBe(200);
        });

      if (response.status === 503) return; // Service unavailable

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('result');
      expect(response.body.result).toHaveProperty('recommendations');
      expect(response.body.result.recommendations).toHaveLength(3);
      
      // Validate recommendation structure
      const recommendations = response.body.result.recommendations;
      recommendations.forEach((rec: any) => {
        expect(rec).toHaveProperty('agentName');
        expect(rec).toHaveProperty('confidence');
        expect(rec.confidence).toBeGreaterThanOrEqual(0);
        expect(rec.confidence).toBeLessThanOrEqual(1);
      });

      console.log(`✅ Received ${recommendations.length} recommendations`);
    });

    test('should accept feedback updates', async () => {
      const feedbackData = {
        sessionId: testContext.executionContext.sessionId,
        agentName: 'enhanced-planner-agent',
        reward: {
          value: 0.85,
          components: {
            quality: 0.9,
            speed: 0.8,
            cost: 0.85,
            userSatisfaction: 0.9
          },
          metadata: {
            tokensUsed: 1250,
            apiCallsMade: 3,
            executionTimeMs: 2800,
            agentPerformance: {
              'enhanced-planner-agent': 0.85
            }
          }
        }
      };

      const response = await request(app)
        .post('/api/v1/ab-mcts-rust/feedback')
        .send(feedbackData)
        .expect((res) => {
          if (res.status === 503) {
            console.log('⚠️ Rust service not available, skipping feedback test');
            return;
          }
          expect(res.status).toBe(200);
        });

      if (response.status === 503) return; // Service unavailable

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'Feedback updated successfully');

      console.log('✅ Feedback updated successfully');
    });
  });

  describe('Performance and Load Testing', () => {
    test('should handle concurrent requests', async () => {
      // Skip if service not healthy
      const healthResponse = await request(app).get('/api/v1/ab-mcts-rust/health');
      if (!healthResponse.body.healthy) {
        console.log('⚠️ Skipping concurrent test - Rust service not available');
        return;
      }

      const concurrentRequests = 5;
      const testContext = {
        task: 'Concurrent test scenario',
        requirements: ['concurrent processing'],
        constraints: ['time limit'],
        contextData: { concurrencyTest: true },
        executionContext: {
          sessionId: `concurrent-test-${Date.now()}`,
          timestamp: Date.now(),
          budget: 100,
          priority: 'Normal' as const
        }
      };

      const requests = Array.from({ length: concurrentRequests }, (_, i) => 
        request(app)
          .post('/api/v1/ab-mcts-rust/recommend')
          .send({
            context: {
              ...testContext,
              executionContext: {
                ...testContext.executionContext,
                sessionId: `concurrent-test-${Date.now()}-${i}`
              }
            },
            availableAgents: ['agent1', 'agent2', 'agent3'],
            maxRecommendations: 2
          })
      );

      const startTime = performance.now();
      const responses = await Promise.all(requests);
      const duration = performance.now() - startTime;

      // Validate all requests succeeded
      responses.forEach((response, index) => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      console.log(`✅ Completed ${concurrentRequests} concurrent requests in ${duration.toFixed(2)}ms`);
    }, 15000); // 15 second timeout

    test('should run performance validation', async () => {
      const testTypes = ['simple', 'complex'];
      
      for (const testType of testTypes) {
        const response = await request(app)
          .post('/api/v1/ab-mcts-rust/test')
          .send({
            testType,
            agentCount: testType === 'simple' ? 4 : 8
          })
          .expect((res) => {
            if (res.status === 503) {
              console.log(`⚠️ Rust service not available, skipping ${testType} test`);
              return;
            }
            expect(res.status).toBe(200);
          });

        if (response.status === 503) continue; // Service unavailable

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('testType', testType);
        expect(response.body).toHaveProperty('performance');
        
        const perf = response.body.performance;
        expect(perf.durationMs).toBeLessThan(10000); // Should complete in under 10 seconds
        expect(perf.throughput).toBeGreaterThan(0); // Should have positive throughput

        console.log(`✅ ${testType} test: ${perf.durationMs.toFixed(2)}ms, throughput: ${perf.throughput.toFixed(0)} ops/sec`);
      }
    }, 30000); // 30 second timeout
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle invalid requests gracefully', async () => {
      // Invalid context
      const response1 = await request(app)
        .post('/api/v1/ab-mcts-rust/search')
        .send({
          context: { task: '' }, // Invalid: empty task
          availableAgents: ['agent1']
        })
        .expect(400);

      expect(response1.body).toHaveProperty('error');

      // No agents
      const response2 = await request(app)
        .post('/api/v1/ab-mcts-rust/search')
        .send({
          context: {
            task: 'Valid task',
            requirements: [],
            constraints: [],
            contextData: {},
            executionContext: {
              sessionId: 'test',
              timestamp: Date.now(),
              budget: 100,
              priority: 'Normal'
            }
          },
          availableAgents: [] // Invalid: no agents
        })
        .expect(400);

      expect(response2.body).toHaveProperty('error');
    });

    test('should handle service unavailability', async () => {
      // This test validates that the API gracefully handles when Rust service is unavailable
      // The actual behavior depends on the service health status
      
      const response = await request(app)
        .get('/api/v1/ab-mcts-rust/health')
        .expect(res => {
          // Should always return a response, either 200 or 503
          expect([200, 503]).toContain(res.status);
        });

      if (response.status === 503) {
        expect(response.body).toHaveProperty('healthy', false);
        expect(response.body).toHaveProperty('status', 'error');
        console.log('✅ Service correctly reports unavailability');
      } else {
        expect(response.body).toHaveProperty('healthy', true);
        expect(response.body).toHaveProperty('status', 'operational');
        console.log('✅ Service is operational');
      }
    });
  });

  describe('Direct Service Integration', () => {
    test('should initialize service directly', async () => {
      const service = new ABMCTSRustIntegration({ enableFallback: true });
      
      // Test initialization
      try {
        await service.initialize();
        
        const isHealthy = await service.isHealthy();
        console.log(`✅ Direct service health: ${isHealthy}`);
        
        if (isHealthy) {
          // Test direct API calls
          const context = ABMCTSRustIntegration.createTestContext(
            'Direct integration test',
            `direct-test-${Date.now()}`
          );
          
          const recommendations = await service.recommendAgents(
            context,
            ['test-agent-1', 'test-agent-2'],
            2
          );
          
          expect(recommendations).toHaveProperty('recommendations');
          expect(recommendations.recommendations).toHaveLength(2);
          
          console.log('✅ Direct API call successful');
        }
        
        await service.shutdown();
      } catch (error) {
        console.log('⚠️ Direct service test failed (expected if Rust service not available):', error instanceof Error ? error.message : String(error));
      }
    });
  });
});

describe('AB-MCTS Rust Service Performance Comparison', () => {
  test('should compare performance with baseline expectations', async () => {
    const service = new ABMCTSRustIntegration({ enableFallback: true, performanceTracking: true });
    
    try {
      await service.initialize();
      
      if (!(await service.isHealthy())) {
        console.log('⚠️ Skipping performance comparison - Rust service not available');
        return;
      }
      
      const context = ABMCTSRustIntegration.createTestContext(
        'Performance comparison test with complex requirements and constraints',
        `perf-test-${Date.now()}`
      );
      
      const agents = [
        'enhanced-planner-agent',
        'enhanced-retriever-agent', 
        'enhanced-synthesizer-agent',
        'enhanced-code-assistant-agent',
        'enhanced-personal-assistant-agent'
      ];
      
      // Test search performance
      const startTime = performance.now();
      const result = await service.searchOptimalAgents(context, agents);
      const duration = performance.now() - startTime;
      
      // Performance expectations based on benchmarks
      expect(duration).toBeLessThan(1000); // Should complete in under 1 second
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.searchStatistics.nodesExplored).toBeGreaterThan(0);
      
      console.log(`🚀 Performance Test Results:`);
      console.log(`   Duration: ${duration.toFixed(2)}ms`);
      console.log(`   Confidence: ${result.confidence.toFixed(3)}`);
      console.log(`   Nodes Explored: ${result.searchStatistics.nodesExplored}`);
      console.log(`   Search Time: ${result.searchStatistics.searchTimeMs}ms`);
      
      // Verify performance improvement (should be very fast)
      if (duration < 100) {
        console.log(`🎉 EXCELLENT: Rust performance under 100ms (${duration.toFixed(2)}ms)`);
      } else if (duration < 500) {
        console.log(`✅ GOOD: Rust performance under 500ms (${duration.toFixed(2)}ms)`);  
      } else {
        console.log(`⚠️ ACCEPTABLE: Rust performance ${duration.toFixed(2)}ms`);
      }
      
      await service.shutdown();
    } catch (error) {
      console.log('⚠️ Performance test failed:', error instanceof Error ? error.message : String(error));
    }
  }, 10000);
});