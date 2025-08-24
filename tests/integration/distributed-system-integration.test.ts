/**
 * Distributed System Integration Tests
 * Tests the complete flow: TypeScript → Rust AI Core → Go WebSocket → Client
 */

import { describe, test, expect, beforeAll, afterAll, jest } from '@jest/globals';
import axios from 'axios';
import WebSocket from 'ws';
import { spawn, ChildProcess } from 'child_process';
import { serviceOrchestrator } from '../../src/services/service-orchestrator';
import { aiCoreClient } from '../../src/services/ai-core-client';
import { hybridAIService } from '../../src/services/hybrid-ai-service';
import path from 'path';

interface TestServices {
  rustAiCore?: ChildProcess;
  goWebSocket?: ChildProcess;
  typescriptBackend?: ChildProcess;
}

describe('Distributed System Integration Tests', () => {
  let services: TestServices = {};
  const TEST_TIMEOUT = 60000; // 60 seconds
  const WAIT_FOR_SERVICE = 5000; // 5 seconds
  
  // Service endpoints
  const RUST_AI_CORE_URL = 'http://localhost:8003';
  const GO_WEBSOCKET_URL = 'http://localhost:8080';
  const TYPESCRIPT_BACKEND_URL = 'http://localhost:9999';

  beforeAll(async () => {
    console.log('🚀 Starting distributed system integration tests...');
    
    // Start services in correct order
    await startTestServices();
    
    // Wait for services to be ready
    await waitForServicesReady();
    
    // Initialize service orchestrator
    await serviceOrchestrator.initialize();
  }, TEST_TIMEOUT);

  afterAll(async () => {
    console.log('🛑 Shutting down test services...');
    
    // Shutdown service orchestrator
    await serviceOrchestrator.shutdown();
    
    // Stop all services
    await stopTestServices();
  }, TEST_TIMEOUT);

  describe('Service Health Checks', () => {
    test('Rust AI Core should be healthy', async () => {
      const response = await axios.get(`${RUST_AI_CORE_URL}/health`);
      
      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        status: expect.any(String),
        version: expect.any(String),
        uptime_seconds: expect.any(Number),
        memory_usage_mb: expect.any(Number),
      });
      
      console.log('✅ Rust AI Core health check passed');
    });

    test('Go WebSocket service should be healthy', async () => {
      const response = await axios.get(`${GO_WEBSOCKET_URL}/health`);
      
      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        status: expect.any(String),
        connected_clients: expect.any(Number),
        uptime_seconds: expect.any(Number),
      });
      
      console.log('✅ Go WebSocket health check passed');
    });

    test('Service Orchestrator should report all services healthy', async () => {
      const status = await serviceOrchestrator.getServiceStatus();
      
      expect(status.overall).toBe('healthy');
      expect(status.services).toHaveLength(3); // ai-core, websocket, backend
      
      const healthyServices = status.services.filter(s => s.status === 'healthy');
      expect(healthyServices).toHaveLength(3);
      
      console.log('✅ Service orchestrator health check passed');
    });
  });

  describe('AI Core Integration', () => {
    test('Should complete AI request through Rust service', async () => {
      const startTime = Date.now();
      
      const response = await aiCoreClient.completion({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'user', content: 'Hello, this is a test message' }
        ],
        max_tokens: 100,
        temperature: 0.7,
      });
      
      const processingTime = Date.now() - startTime;
      
      expect(response).toMatchObject({
        id: expect.any(String),
        model: expect.any(String),
        choices: expect.arrayContaining([
          expect.objectContaining({
            message: expect.objectContaining({
              role: expect.any(String),
              content: expect.any(String),
            }),
          }),
        ]),
        usage: expect.objectContaining({
          prompt_tokens: expect.any(Number),
          completion_tokens: expect.any(Number),
          total_tokens: expect.any(Number),
        }),
      });
      
      expect(response.choices[0].message.content.length).toBeGreaterThan(0);
      expect(processingTime).toBeLessThan(30000); // Should complete within 30s
      
      console.log(`✅ AI completion test passed (${processingTime}ms)`);
    });

    test('Should handle hybrid AI service routing', async () => {
      const response = await hybridAIService.completion({
        messages: [{ role: 'user', content: 'Test hybrid routing' }],
        model: 'gpt-3.5-turbo',
        temperature: 0.5,
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
      });
      
      expect(response.content.length).toBeGreaterThan(0);
      
      console.log(`✅ Hybrid AI service test passed (source: ${response.source})`);
    });
  });

  describe('WebSocket Real-Time Communication', () => {
    test('Should establish WebSocket connection and receive messages', async () => {
      return new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(`ws://localhost:8080/ws?user_id=test_user`);
        const timeout = setTimeout(() => {
          ws.close();
          reject(new Error('WebSocket test timeout'));
        }, 15000);
        
        let messageReceived = false;

        ws.on('open', () => {
          console.log('🔌 WebSocket connection established');
          
          // Send test message
          ws.send(JSON.stringify({
            type: 'chat',
            content: 'Hello from integration test',
            from: 'test_user',
            timestamp: new Date().toISOString(),
          }));
        });

        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            console.log('📨 Received WebSocket message:', message);
            
            expect(message).toHaveProperty('type');
            expect(message).toHaveProperty('timestamp');
            
            messageReceived = true;
            clearTimeout(timeout);
            ws.close();
            resolve();
          } catch (error) {
            clearTimeout(timeout);
            ws.close();
            reject(error);
          }
        });

        ws.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });

        ws.on('close', () => {
          if (!messageReceived) {
            clearTimeout(timeout);
            reject(new Error('WebSocket closed without receiving expected message'));
          }
        });
      });
    });

    test('Should broadcast messages to multiple clients', async () => {
      const numClients = 3;
      const clients: WebSocket[] = [];
      const messagesReceived: number[] = new Array(numClients).fill(0);
      
      try {
        // Create multiple WebSocket connections
        for (let i = 0; i < numClients; i++) {
          const ws = new WebSocket(`ws://localhost:8080/ws?user_id=test_client_${i}`);
          clients.push(ws);
          
          await new Promise<void>((resolve, reject) => {
            ws.on('open', resolve);
            ws.on('error', reject);
            setTimeout(() => reject(new Error('Connection timeout')), 5000);
          });
        }

        // Set up message listeners
        const messagePromises = clients.map((ws, index) => {
          return new Promise<void>((resolve) => {
            ws.on('message', (data) => {
              const message = JSON.parse(data.toString());
              if (message.type === 'broadcast') {
                messagesReceived[index]++;
                if (messagesReceived[index] >= 1) {
                  resolve();
                }
              }
            });
          });
        });

        // Send broadcast message via service orchestrator
        await serviceOrchestrator.broadcastMessage({
          type: 'broadcast',
          content: 'Integration test broadcast message',
        });

        // Wait for all clients to receive the message
        await Promise.all(messagePromises.map(p => 
          Promise.race([p, new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Broadcast timeout')), 10000)
          )])
        ));

        expect(messagesReceived.every(count => count >= 1)).toBe(true);
        
        console.log('✅ WebSocket broadcast test passed');
      } finally {
        // Clean up connections
        clients.forEach(ws => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.close();
          }
        });
      }
    });
  });

  describe('Real-Time AI Processing Flow', () => {
    test('Should process AI request with real-time WebSocket updates', async () => {
      const sessionId = `test_session_${Date.now()}`;
      const userId = 'integration_test_user';
      
      return new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(`ws://localhost:8080/ws?user_id=${userId}`);
        const timeout = setTimeout(() => {
          ws.close();
          reject(new Error('Real-time AI test timeout'));
        }, 30000);
        
        const expectedEvents = ['ai_request_started', 'ai_response', 'ai_request_completed'];
        const receivedEvents: string[] = [];

        ws.on('open', async () => {
          console.log('🔌 Starting real-time AI processing test');
          
          try {
            // Process real-time AI request through service orchestrator
            await serviceOrchestrator.processRealTimeAI(
              {
                sessionId,
                userId,
                message: 'This is a real-time AI processing test',
                model: 'gpt-3.5-turbo',
                temperature: 0.7,
                maxTokens: 150,
                streaming: false,
              },
              undefined, // onChunk
              (response) => {
                console.log('🎯 AI processing completed:', response);
                expect(response.content.length).toBeGreaterThan(0);
                expect(response.source).toMatch(/rust-core|legacy-typescript/);
              },
              (error) => {
                clearTimeout(timeout);
                ws.close();
                reject(error);
              }
            );
          } catch (error) {
            clearTimeout(timeout);
            ws.close();
            reject(error);
          }
        });

        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            console.log('📨 Real-time AI message:', message.type);
            
            if (message.sessionId === sessionId) {
              receivedEvents.push(message.type);
              
              // Check if we received all expected events
              const hasAllEvents = expectedEvents.every(event => 
                receivedEvents.includes(event)
              );
              
              if (hasAllEvents) {
                clearTimeout(timeout);
                ws.close();
                
                expect(receivedEvents).toEqual(
                  expect.arrayContaining(expectedEvents)
                );
                
                console.log('✅ Real-time AI processing test passed');
                resolve();
              }
            }
          } catch (error) {
            clearTimeout(timeout);
            ws.close();
            reject(error);
          }
        });

        ws.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    });
  });

  describe('Memory Optimization Integration', () => {
    test('Should optimize memory across all services', async () => {
      const beforeStatus = await serviceOrchestrator.getServiceStatus();
      const beforeMemory = beforeStatus.metrics.services.aiCore.memoryUsageMB;
      
      const optimization = await serviceOrchestrator.optimizeAllServices();
      
      expect(optimization.results).toBeDefined();
      expect(Array.isArray(optimization.results)).toBe(true);
      expect(optimization.totalMemoryFreedMB).toBeGreaterThanOrEqual(0);
      
      // Check that optimization attempted on all services
      const serviceNames = optimization.results.map(r => r.service);
      expect(serviceNames).toEqual(
        expect.arrayContaining(['ai-core', 'hybrid-ai'])
      );
      
      console.log(`✅ Memory optimization test passed (freed: ${optimization.totalMemoryFreedMB}MB)`);
    });
  });

  describe('Performance Benchmarks', () => {
    test('Should meet performance benchmarks for AI requests', async () => {
      const iterations = 5;
      const times: number[] = [];
      
      for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        
        await hybridAIService.completion({
          messages: [{ role: 'user', content: `Performance test ${i + 1}` }],
          model: 'gpt-3.5-turbo',
          maxTokens: 50,
        });
        
        const time = Date.now() - start;
        times.push(time);
      }
      
      const averageTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);
      
      // Performance requirements
      expect(averageTime).toBeLessThan(5000); // Average < 5s
      expect(maxTime).toBeLessThan(10000); // Max < 10s
      expect(minTime).toBeGreaterThan(100); // Min > 100ms (sanity check)
      
      console.log(`✅ Performance test passed - Avg: ${averageTime}ms, Min: ${minTime}ms, Max: ${maxTime}ms`);
    });
  });

  // Helper functions
  async function startTestServices(): Promise<void> {
    const projectRoot = path.resolve(__dirname, '../../');
    
    try {
      // Start Rust AI Core service
      console.log('🦀 Starting Rust AI Core service...');
      const rustBinary = path.join(projectRoot, 'rust-services/llm-router/target/release/llm-router');
      services.rustAiCore = spawn(rustBinary, [], {
        env: { 
          ...process.env, 
          PORT: '8003',
          RUST_LOG: 'info',
        },
        cwd: path.join(projectRoot, 'rust-services/llm-router'),
      });

      // Start Go WebSocket service
      console.log('🐹 Starting Go WebSocket service...');
      services.goWebSocket = spawn('go', ['run', '.'], {
        env: { 
          ...process.env, 
          WEBSOCKET_PORT: '8080',
          REQUIRE_AUTH: 'false', // Disable auth for testing
        },
        cwd: path.join(projectRoot, 'rust-services/go-websocket'),
      });

      console.log('✅ Test services started');
    } catch (error) {
      console.error('❌ Failed to start test services:', error);
      throw error;
    }
  }

  async function waitForServicesReady(): Promise<void> {
    console.log('⏳ Waiting for services to be ready...');
    
    const maxAttempts = 30;
    const delayMs = 1000;
    
    // Wait for Rust AI Core
    await waitForService(RUST_AI_CORE_URL, 'Rust AI Core', maxAttempts, delayMs);
    
    // Wait for Go WebSocket
    await waitForService(GO_WEBSOCKET_URL, 'Go WebSocket', maxAttempts, delayMs);
    
    console.log('✅ All services ready');
  }

  async function waitForService(url: string, name: string, maxAttempts: number, delayMs: number): Promise<void> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await axios.get(`${url}/health`, { timeout: 3000 });
        if (response.status === 200) {
          console.log(`✅ ${name} ready after ${attempt} attempts`);
          return;
        }
      } catch (error) {
        console.log(`⏳ ${name} not ready (attempt ${attempt}/${maxAttempts})`);
      }
      
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    
    throw new Error(`${name} failed to start after ${maxAttempts} attempts`);
  }

  async function stopTestServices(): Promise<void> {
    const killPromises: Promise<void>[] = [];
    
    if (services.rustAiCore) {
      killPromises.push(killProcess(services.rustAiCore, 'Rust AI Core'));
    }
    
    if (services.goWebSocket) {
      killPromises.push(killProcess(services.goWebSocket, 'Go WebSocket'));
    }
    
    await Promise.all(killPromises);
    console.log('✅ All test services stopped');
  }

  function killProcess(process: ChildProcess, name: string): Promise<void> {
    return new Promise((resolve) => {
      process.on('exit', () => {
        console.log(`✅ ${name} stopped`);
        resolve();
      });
      
      process.kill('SIGTERM');
      
      // Force kill after 5 seconds
      setTimeout(() => {
        if (!process.killed) {
          console.log(`⚠️ Force killing ${name}`);
          process.kill('SIGKILL');
        }
      }, 5000);
    });
  }
});