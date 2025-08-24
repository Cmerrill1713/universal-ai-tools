/**
 * Unit Tests for Service Orchestrator
 * Tests the orchestration layer between Rust AI Core, Go WebSocket, and TypeScript services
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ServiceOrchestrator } from '../../src/services/service-orchestrator';
import type { ServiceEndpoints, RealTimeAIRequest } from '../../src/services/service-orchestrator';

// Mock dependencies
jest.mock('../../src/services/hybrid-ai-service');
jest.mock('../../src/services/ai-core-client');
jest.mock('axios');
jest.mock('ws');

describe('ServiceOrchestrator', () => {
  let orchestrator: ServiceOrchestrator;
  let mockEndpoints: ServiceEndpoints;

  beforeEach(() => {
    mockEndpoints = {
      aiCore: 'http://localhost:8003',
      websocket: 'http://localhost:8080', 
      mainBackend: 'http://localhost:9999',
    };
    
    orchestrator = new ServiceOrchestrator(mockEndpoints);
  });

  afterEach(async () => {
    await orchestrator.shutdown();
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    test('should initialize with default endpoints when none provided', () => {
      const defaultOrchestrator = new ServiceOrchestrator();
      expect(defaultOrchestrator).toBeInstanceOf(ServiceOrchestrator);
    });

    test('should initialize with custom endpoints', () => {
      const customEndpoints = {
        aiCore: 'http://custom:8003',
        websocket: 'http://custom:8080',
        mainBackend: 'http://custom:9999',
      };
      
      const customOrchestrator = new ServiceOrchestrator(customEndpoints);
      expect(customOrchestrator).toBeInstanceOf(ServiceOrchestrator);
    });
  });

  describe('Service Health Management', () => {
    test('should perform health checks on all services', async () => {
      const axios = require('axios');
      
      // Mock successful health checks
      axios.create.mockReturnValue({
        get: jest.fn()
          .mockResolvedValueOnce({ status: 200, data: { status: 'healthy' }, headers: {} })
          .mockResolvedValueOnce({ status: 200, data: { status: 'healthy' }, headers: {} })
          .mockResolvedValueOnce({ status: 200, data: { status: 'healthy' }, headers: {} }),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
      });

      const status = await orchestrator.getServiceStatus();
      
      expect(status.overall).toBe('healthy');
      expect(status.services).toHaveLength(3);
      expect(status.metrics).toBeDefined();
    });

    test('should handle degraded service state', async () => {
      const axios = require('axios');
      
      // Mock mixed health check responses
      axios.create.mockReturnValue({
        get: jest.fn()
          .mockResolvedValueOnce({ status: 200, data: { status: 'healthy' }, headers: {} })
          .mockRejectedValueOnce(new Error('Service unavailable'))
          .mockResolvedValueOnce({ status: 200, data: { status: 'healthy' }, headers: {} }),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
      });

      const status = await orchestrator.getServiceStatus();
      
      expect(status.overall).toBe('degraded');
      expect(status.services.some(s => s.status === 'unhealthy')).toBe(true);
    });

    test('should handle all services unhealthy', async () => {
      const axios = require('axios');
      
      // Mock all health checks failing
      axios.create.mockReturnValue({
        get: jest.fn().mockRejectedValue(new Error('All services down')),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
      });

      const status = await orchestrator.getServiceStatus();
      
      expect(status.overall).toBe('unhealthy');
      expect(status.services.every(s => s.status === 'unhealthy')).toBe(true);
    });
  });

  describe('Real-Time AI Processing', () => {
    test('should process streaming AI request successfully', async () => {
      const { hybridAIService } = require('../../src/services/hybrid-ai-service');
      
      const mockRequest: RealTimeAIRequest = {
        sessionId: 'test-session-123',
        userId: 'test-user-456', 
        message: 'Test message for streaming',
        model: 'gpt-3.5-turbo',
        temperature: 0.7,
        maxTokens: 150,
        streaming: true,
      };

      const mockChunks = ['Hello', ' there', '!', ' This', ' is', ' a', ' test', '.'];
      let chunkIndex = 0;
      const receivedChunks: string[] = [];
      let completionCalled = false;

      // Mock streaming completion
      hybridAIService.streamCompletion.mockImplementation(
        (request: any, onChunk: (chunk: string) => void, onComplete?: (response: any) => void) => {
          // Simulate streaming chunks
          const interval = setInterval(() => {
            if (chunkIndex < mockChunks.length) {
              onChunk(mockChunks[chunkIndex]);
              chunkIndex++;
            } else {
              clearInterval(interval);
              if (onComplete) {
                onComplete({
                  content: mockChunks.join(''),
                  model: 'gpt-3.5-turbo',
                  provider: 'openai',
                  source: 'rust-core',
                  processingTimeMs: 1500,
                });
              }
            }
          }, 10);

          return Promise.resolve();
        }
      );

      await orchestrator.processRealTimeAI(
        mockRequest,
        (chunk) => {
          receivedChunks.push(chunk);
        },
        (response) => {
          completionCalled = true;
          expect(response.content).toBe(mockChunks.join(''));
          expect(response.source).toBe('rust-core');
        }
      );

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(receivedChunks).toEqual(mockChunks);
      expect(completionCalled).toBe(true);
    });

    test('should process non-streaming AI request successfully', async () => {
      const { hybridAIService } = require('../../src/services/hybrid-ai-service');
      
      const mockRequest: RealTimeAIRequest = {
        sessionId: 'test-session-456',
        userId: 'test-user-789',
        message: 'Test message for completion',
        model: 'gpt-3.5-turbo',
        temperature: 0.5,
        maxTokens: 100,
        streaming: false,
      };

      const mockResponse = {
        content: 'This is a test response.',
        model: 'gpt-3.5-turbo',
        provider: 'openai',
        source: 'rust-core',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        processingTimeMs: 800,
        cached: false,
      };

      hybridAIService.completion.mockResolvedValue(mockResponse);

      let completionCalled = false;

      await orchestrator.processRealTimeAI(
        mockRequest,
        undefined,
        (response) => {
          completionCalled = true;
          expect(response).toEqual(mockResponse);
        }
      );

      expect(completionCalled).toBe(true);
      expect(hybridAIService.completion).toHaveBeenCalledWith({
        messages: [{ role: 'user', content: mockRequest.message }],
        model: mockRequest.model,
        provider: mockRequest.provider,
        temperature: mockRequest.temperature,
        maxTokens: mockRequest.maxTokens,
      });
    });

    test('should handle AI processing errors gracefully', async () => {
      const { hybridAIService } = require('../../src/services/hybrid-ai-service');
      
      const mockRequest: RealTimeAIRequest = {
        sessionId: 'test-error-session',
        userId: 'test-error-user',
        message: 'This will fail',
        streaming: false,
      };

      const mockError = new Error('AI service unavailable');
      hybridAIService.completion.mockRejectedValue(mockError);

      let errorCalled = false;

      await orchestrator.processRealTimeAI(
        mockRequest,
        undefined,
        undefined,
        (error) => {
          errorCalled = true;
          expect(error).toBeInstanceOf(Error);
        }
      );

      expect(errorCalled).toBe(true);
    });
  });

  describe('Memory Optimization', () => {
    test('should optimize memory across all services', async () => {
      const { aiCoreClient } = require('../../src/services/ai-core-client');
      const { hybridAIService } = require('../../src/services/hybrid-ai-service');
      
      // Mock memory optimization results
      aiCoreClient.optimizeMemory.mockResolvedValue({
        memory_freed_mb: 150,
        duration_ms: 2000,
        operations_performed: ['cache_clear', 'gc_run'],
        optimization_level: 'standard',
      });

      hybridAIService.optimizeMemory.mockResolvedValue({
        rustCore: { memory_freed_mb: 100 },
        totalFreedMB: 50,
      });

      const result = await orchestrator.optimizeAllServices();
      
      expect(result.results).toHaveLength(3); // ai-core, hybrid-ai, nodejs-gc
      expect(result.totalMemoryFreedMB).toBe(200); // 150 + 50
      
      const services = result.results.map(r => r.service);
      expect(services).toEqual(expect.arrayContaining(['ai-core', 'hybrid-ai']));
    });

    test('should handle memory optimization failures gracefully', async () => {
      const { aiCoreClient } = require('../../src/services/ai-core-client');
      const { hybridAIService } = require('../../src/services/hybrid-ai-service');
      
      // Mock failures
      aiCoreClient.optimizeMemory.mockRejectedValue(new Error('Rust service error'));
      hybridAIService.optimizeMemory.mockRejectedValue(new Error('Hybrid service error'));

      const result = await orchestrator.optimizeAllServices();
      
      expect(result.results).toHaveLength(3);
      expect(result.totalMemoryFreedMB).toBe(0);
      
      const failedServices = result.results.filter(r => r.error);
      expect(failedServices).toHaveLength(2);
    });
  });

  describe('WebSocket Broadcasting', () => {
    test('should broadcast messages successfully', async () => {
      const axios = require('axios');
      
      const mockAxios = {
        post: jest.fn().mockResolvedValue({ status: 200, data: { success: true } }),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
        get: jest.fn(),
      };
      axios.create.mockReturnValue(mockAxios);

      const message = {
        type: 'notification',
        content: { title: 'Test', body: 'This is a test notification' },
      };

      await orchestrator.broadcastMessage(message);
      
      expect(mockAxios.post).toHaveBeenCalledWith(
        `${mockEndpoints.websocket}/broadcast`,
        expect.objectContaining({
          type: message.type,
          content: message.content,
          metadata: expect.objectContaining({
            source: 'service-orchestrator',
            timestamp: expect.any(String),
          }),
        })
      );
    });

    test('should handle broadcast failures', async () => {
      const axios = require('axios');
      
      const mockAxios = {
        post: jest.fn().mockRejectedValue(new Error('WebSocket service unavailable')),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
        get: jest.fn(),
      };
      axios.create.mockReturnValue(mockAxios);

      const message = {
        type: 'notification',
        content: { title: 'Test' },
      };

      await expect(orchestrator.broadcastMessage(message)).rejects.toThrow();
    });
  });

  describe('Real-time Metrics', () => {
    test('should collect metrics from all services', async () => {
      const axios = require('axios');
      const { aiCoreClient } = require('../../src/services/ai-core-client');
      
      const mockAxios = {
        get: jest.fn()
          .mockResolvedValueOnce({ data: { connected_clients: 5, messages_total: 1000 } })
          .mockResolvedValueOnce({ data: { uptime: 3600, memory_usage: 512 } }),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
        post: jest.fn(),
      };
      axios.create.mockReturnValue(mockAxios);

      aiCoreClient.getMetrics.mockResolvedValue({
        memory_usage_mb: 256,
        models_loaded: 3,
        requests_total: 500,
      });

      const metrics = await orchestrator.getRealtimeMetrics();
      
      expect(metrics).toMatchObject({
        aiCore: expect.any(Object),
        websocket: expect.objectContaining({
          connected_clients: 5,
          messages_total: 1000,
        }),
        backend: expect.objectContaining({
          uptime: 3600,
          memory_usage: 512,
        }),
      });
    });

    test('should handle partial metrics failures', async () => {
      const axios = require('axios');
      const { aiCoreClient } = require('../../src/services/ai-core-client');
      
      const mockAxios = {
        get: jest.fn()
          .mockRejectedValueOnce(new Error('WebSocket metrics unavailable'))
          .mockResolvedValueOnce({ data: { uptime: 3600 } }),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
        post: jest.fn(),
      };
      axios.create.mockReturnValue(mockAxios);

      aiCoreClient.getMetrics.mockResolvedValue({ memory_usage_mb: 256 });

      const metrics = await orchestrator.getRealtimeMetrics();
      
      expect(metrics.aiCore).toBeDefined();
      expect(metrics.websocket).toBeNull(); // Failed
      expect(metrics.backend).toBeDefined();
    });
  });

  describe('Lifecycle Management', () => {
    test('should initialize successfully', async () => {
      const axios = require('axios');
      const WebSocket = require('ws');
      
      // Mock successful initialization
      const mockAxios = {
        get: jest.fn().mockResolvedValue({ status: 200, data: { status: 'healthy' } }),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
        post: jest.fn(),
      };
      axios.create.mockReturnValue(mockAxios);

      const mockWebSocket = {
        on: jest.fn(),
        readyState: 1, // OPEN
      };
      WebSocket.mockImplementation(() => mockWebSocket);

      await expect(orchestrator.initialize()).resolves.not.toThrow();
    });

    test('should shutdown gracefully', async () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      
      await expect(orchestrator.shutdown()).resolves.not.toThrow();
      
      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });

  describe('Error Recovery', () => {
    test('should recover from temporary service failures', async () => {
      const axios = require('axios');
      
      let callCount = 0;
      const mockAxios = {
        get: jest.fn().mockImplementation(() => {
          callCount++;
          if (callCount <= 2) {
            throw new Error('Temporary failure');
          }
          return Promise.resolve({ status: 200, data: { status: 'healthy' } });
        }),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
        post: jest.fn(),
      };
      axios.create.mockReturnValue(mockAxios);

      // First call should fail
      const status1 = await orchestrator.getServiceStatus();
      expect(status1.overall).toBe('unhealthy');

      // Third call should succeed
      const status2 = await orchestrator.getServiceStatus();
      expect(status2.overall).toBe('healthy');
    });
  });
});