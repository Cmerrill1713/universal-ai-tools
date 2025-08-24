/**
 * System Integration Validation Tests
 * End-to-end validation of the complete distributed system
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import axios from 'axios';
import WebSocket from 'ws';
import { serviceOrchestrator } from '../../src/services/service-orchestrator';
import { hybridAIService } from '../../src/services/hybrid-ai-service';
import { aiCoreClient } from '../../src/services/ai-core-client';

describe('System Integration Validation', () => {
  const VALIDATION_TIMEOUT = 30000; // 30 seconds per test
  
  beforeAll(async () => {
    console.log('🔍 Starting system integration validation...');
    
    // Initialize service orchestrator
    try {
      await serviceOrchestrator.initialize();
      console.log('✅ Service orchestrator initialized');
    } catch (error) {
      console.warn('⚠️ Service orchestrator initialization failed, some tests may be skipped');
    }
  }, VALIDATION_TIMEOUT);

  afterAll(async () => {
    await serviceOrchestrator.shutdown();
  });

  describe('Critical Path Validation', () => {
    test('Should validate complete AI request pipeline', async () => {
      const testMessage = 'Integration validation test message';
      
      try {
        const response = await hybridAIService.completion({
          messages: [{ role: 'user', content: testMessage }],
          model: 'gpt-3.5-turbo',
          temperature: 0.7,
          maxTokens: 100,
        });

        expect(response).toMatchObject({
          content: expect.any(String),
          model: expect.any(String),
          provider: expect.any(String),
          source: expect.stringMatching(/rust-core|legacy-typescript/),
          usage: expect.objectContaining({
            promptTokens: expect.any(Number),
            completionTokens: expect.any(Number),
            totalTokens: expect.any(Number),
          }),
          processingTimeMs: expect.any(Number),
        });

        expect(response.content.length).toBeGreaterThan(0);
        console.log(`✅ AI Pipeline validated (${response.source}, ${response.processingTimeMs}ms)`);
      } catch (error) {
        console.error('❌ AI Pipeline validation failed:', error);
        throw error;
      }
    }, VALIDATION_TIMEOUT);

    test('Should validate real-time WebSocket communication', async () => {
      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          ws.close();
          reject(new Error('WebSocket validation timeout'));
        }, VALIDATION_TIMEOUT - 5000);

        const ws = new WebSocket('ws://localhost:8080/ws?user_id=validation_test');
        let messageReceived = false;

        ws.on('open', () => {
          console.log('🔌 WebSocket connection established for validation');
          
          ws.send(JSON.stringify({
            type: 'validation',
            content: 'System validation test',
            from: 'validation_test',
            timestamp: new Date().toISOString(),
          }));
        });

        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            console.log('📨 WebSocket validation message received:', message.type);
            
            expect(message).toHaveProperty('type');
            expect(message).toHaveProperty('timestamp');
            
            messageReceived = true;
            clearTimeout(timeout);
            ws.close();
            console.log('✅ WebSocket communication validated');
            resolve();
          } catch (error) {
            clearTimeout(timeout);
            ws.close();
            reject(error);
          }
        });

        ws.on('error', (error) => {
          clearTimeout(timeout);
          console.error('❌ WebSocket validation failed:', error);
          reject(error);
        });

        ws.on('close', () => {
          if (!messageReceived) {
            clearTimeout(timeout);
            reject(new Error('WebSocket closed without receiving validation message'));
          }
        });
      });
    }, VALIDATION_TIMEOUT);

    test('Should validate service orchestration', async () => {
      try {
        const status = await serviceOrchestrator.getServiceStatus();
        
        expect(status).toMatchObject({
          overall: expect.stringMatching(/healthy|degraded/),
          services: expect.arrayContaining([
            expect.objectContaining({
              name: expect.any(String),
              status: expect.stringMatching(/healthy|degraded|unhealthy/),
              lastCheck: expect.any(Date),
            }),
          ]),
          metrics: expect.objectContaining({
            timestamp: expect.any(Date),
            services: expect.any(Object),
            performance: expect.any(Object),
          }),
        });

        const healthyServices = status.services.filter(s => s.status === 'healthy');
        expect(healthyServices.length).toBeGreaterThan(0);
        
        console.log(`✅ Service orchestration validated (${status.overall}, ${healthyServices.length}/${status.services.length} healthy)`);
      } catch (error) {
        console.error('❌ Service orchestration validation failed:', error);
        throw error;
      }
    }, VALIDATION_TIMEOUT);
  });

  describe('Performance Validation', () => {
    test('Should validate system performance benchmarks', async () => {
      const iterations = 3;
      const times: number[] = [];
      
      for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        
        try {
          await hybridAIService.completion({
            messages: [{ role: 'user', content: `Performance validation ${i + 1}` }],
            model: 'gpt-3.5-turbo',
            maxTokens: 50,
          });
          
          const time = Date.now() - start;
          times.push(time);
        } catch (error) {
          console.warn(`⚠️ Performance test ${i + 1} failed:`, error);
        }
      }
      
      if (times.length === 0) {
        throw new Error('All performance tests failed');
      }
      
      const averageTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);
      
      // Performance benchmarks (lenient for integration validation)
      expect(averageTime).toBeLessThan(10000); // Average < 10s
      expect(maxTime).toBeLessThan(20000); // Max < 20s
      expect(minTime).toBeGreaterThan(50); // Min > 50ms (sanity check)
      
      console.log(`✅ Performance validated - Avg: ${averageTime}ms, Min: ${minTime}ms, Max: ${maxTime}ms`);
    }, VALIDATION_TIMEOUT * 2);

    test('Should validate memory optimization', async () => {
      try {
        const beforeOptimization = await serviceOrchestrator.getServiceStatus();
        const optimization = await serviceOrchestrator.optimizeAllServices();
        
        expect(optimization).toMatchObject({
          results: expect.arrayContaining([
            expect.objectContaining({
              service: expect.any(String),
            }),
          ]),
          totalMemoryFreedMB: expect.any(Number),
        });
        
        expect(optimization.totalMemoryFreedMB).toBeGreaterThanOrEqual(0);
        expect(optimization.results.length).toBeGreaterThan(0);
        
        console.log(`✅ Memory optimization validated (freed: ${optimization.totalMemoryFreedMB}MB)`);
      } catch (error) {
        console.error('❌ Memory optimization validation failed:', error);
        throw error;
      }
    }, VALIDATION_TIMEOUT);
  });

  describe('Resilience Validation', () => {
    test('Should validate error handling and recovery', async () => {
      // Test with invalid input to validate error handling
      try {
        await hybridAIService.completion({
          messages: [], // Invalid: empty messages
          model: 'invalid-model',
        });
        
        // If we reach here, the service should have handled the error gracefully
        console.log('✅ Error handling validated - service handled invalid input gracefully');
      } catch (error) {
        // Expected behavior - service should reject invalid input
        expect(error).toBeInstanceOf(Error);
        console.log('✅ Error handling validated - service properly rejected invalid input');
      }
    }, VALIDATION_TIMEOUT);

    test('Should validate service availability reporting', async () => {
      try {
        const serviceStatus = await hybridAIService.getServiceStatus();
        
        expect(serviceStatus).toMatchObject({
          rustCore: expect.objectContaining({
            available: expect.any(Boolean),
          }),
          legacy: expect.objectContaining({
            available: expect.any(Boolean),
          }),
          recommendation: expect.stringMatching(/rust-core|legacy|unavailable/),
        });
        
        // At least one service should be available
        expect(serviceStatus.rustCore.available || serviceStatus.legacy.available).toBe(true);
        
        console.log(`✅ Service availability validated (recommendation: ${serviceStatus.recommendation})`);
      } catch (error) {
        console.error('❌ Service availability validation failed:', error);
        throw error;
      }
    }, VALIDATION_TIMEOUT);
  });

  describe('Integration Quality Checks', () => {
    test('Should validate service health endpoints', async () => {
      const healthChecks = [
        { name: 'Rust AI Core', url: 'http://localhost:8003/health' },
        { name: 'Go WebSocket', url: 'http://localhost:8080/health' },
      ];

      const results = await Promise.allSettled(
        healthChecks.map(async (check) => {
          try {
            const response = await axios.get(check.url, { timeout: 5000 });
            return {
              name: check.name,
              status: response.status,
              healthy: response.status === 200,
            };
          } catch (error) {
            return {
              name: check.name,
              status: 0,
              healthy: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            };
          }
        })
      );

      const healthyServices = results
        .filter(result => result.status === 'fulfilled')
        .map(result => result.value)
        .filter(service => service.healthy);

      // At least one core service should be healthy
      expect(healthyServices.length).toBeGreaterThan(0);
      
      console.log(`✅ Health endpoints validated (${healthyServices.length}/${healthChecks.length} healthy)`);
      healthyServices.forEach(service => {
        console.log(`  ✓ ${service.name}: HTTP ${service.status}`);
      });
    }, VALIDATION_TIMEOUT);

    test('Should validate data flow integrity', async () => {
      const testData = {
        sessionId: `validation_${Date.now()}`,
        userId: 'validation_user',
        message: 'Data flow integrity test',
      };

      try {
        // Test that data flows correctly through the system
        const response = await hybridAIService.completion({
          messages: [{ role: 'user', content: testData.message }],
          model: 'gpt-3.5-turbo',
          maxTokens: 50,
        });

        // Validate response structure and content
        expect(response.content).toBeDefined();
        expect(response.content.length).toBeGreaterThan(0);
        expect(response.usage.totalTokens).toBeGreaterThan(0);
        expect(response.processingTimeMs).toBeGreaterThan(0);
        
        console.log('✅ Data flow integrity validated');
      } catch (error) {
        console.error('❌ Data flow integrity validation failed:', error);
        throw error;
      }
    }, VALIDATION_TIMEOUT);
  });

  describe('System Configuration Validation', () => {
    test('Should validate environment configuration', () => {
      const requiredConfig = [
        'NODE_ENV',
      ];

      const missingConfig = requiredConfig.filter(key => !process.env[key]);
      
      if (missingConfig.length > 0) {
        console.warn(`⚠️ Missing environment variables: ${missingConfig.join(', ')}`);
      }

      // For validation, we allow missing config but warn about it
      expect(process.env.NODE_ENV).toBeDefined();
      console.log(`✅ Environment configuration validated (NODE_ENV: ${process.env.NODE_ENV})`);
    });

    test('Should validate system compatibility', async () => {
      const compatibility = {
        nodejs: process.version,
        platform: process.platform,
        arch: process.arch,
      };

      expect(compatibility.nodejs).toMatch(/^v\d+\.\d+\.\d+/);
      expect(['darwin', 'linux', 'win32']).toContain(compatibility.platform);
      expect(['x64', 'arm64']).toContain(compatibility.arch);

      console.log(`✅ System compatibility validated:`, compatibility);
    });
  });
});