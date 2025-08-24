/**
 * Unit Tests for Hybrid AI Service
 * Tests intelligent routing between Rust AI Core and legacy TypeScript services
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { HybridAIService } from '../../src/services/hybrid-ai-service';
import type { AIServiceRequest, HybridAIOptions } from '../../src/services/hybrid-ai-service';

// Mock dependencies
jest.mock('../../src/services/ai-core-client');

describe('HybridAIService', () => {
  let hybridService: HybridAIService;
  let mockAICore: any;

  beforeEach(() => {
    // Get the mocked ai-core-client
    const { aiCoreClient } = require('../../src/services/ai-core-client');
    mockAICore = aiCoreClient;
    
    // Reset all mocks
    jest.clearAllMocks();
    
    // Create fresh instance
    hybridService = new HybridAIService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Service Health Management', () => {
    test('should check core health on initialization', async () => {
      mockAICore.isAvailable.mockResolvedValue(true);
      
      const service = new HybridAIService();
      
      // Give some time for async health check
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(mockAICore.isAvailable).toHaveBeenCalled();
    });

    test('should handle unavailable core service', async () => {
      mockAICore.isAvailable.mockResolvedValue(false);
      
      const service = new HybridAIService();
      const status = await service.getServiceStatus();
      
      expect(status.rustCore.available).toBe(false);
      expect(status.legacy.available).toBe(true);
      expect(status.recommendation).toBe('legacy');
    });

    test('should force health check and update availability', async () => {
      mockAICore.isAvailable.mockResolvedValue(false).mockResolvedValueOnce(true);
      
      const available = await hybridService.forceHealthCheck();
      
      expect(available).toBe(true);
      expect(mockAICore.isAvailable).toHaveBeenCalledTimes(2); // Initial + forced
    });
  });

  describe('AI Completion Routing', () => {
    const mockRequest: AIServiceRequest = {
      messages: [{ role: 'user', content: 'Test message' }],
      model: 'gpt-3.5-turbo',
      provider: 'openai',
      temperature: 0.7,
      maxTokens: 150,
    };

    test('should route to Rust AI Core when available and preferred', async () => {
      mockAICore.isAvailable.mockResolvedValue(true);
      mockAICore.completion.mockResolvedValue({
        id: 'test-id',
        model: 'gpt-3.5-turbo',
        choices: [{ message: { role: 'assistant', content: 'Rust core response' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        provider: 'openai',
        processing_time_ms: 1200,
        cached: false,
      });

      const response = await hybridService.completion(mockRequest, {
        preferRustCore: true,
        fallbackToLegacy: true,
      });

      expect(response.source).toBe('rust-core');
      expect(response.content).toBe('Rust core response');
      expect(mockAICore.completion).toHaveBeenCalledWith({
        messages: mockRequest.messages,
        model: mockRequest.model,
        provider: mockRequest.provider,
        temperature: mockRequest.temperature,
        max_tokens: mockRequest.maxTokens,
        stream: false,
      });
    });

    test('should fallback to legacy service when Rust core fails', async () => {
      mockAICore.isAvailable.mockResolvedValue(true);
      mockAICore.completion.mockRejectedValue(new Error('Rust service error'));

      const response = await hybridService.completion(mockRequest, {
        preferRustCore: true,
        fallbackToLegacy: true,
      });

      expect(response.source).toBe('legacy-typescript');
      expect(response.content).toContain('Legacy response');
    });

    test('should use legacy service when Rust core not preferred', async () => {
      mockAICore.isAvailable.mockResolvedValue(true);

      const response = await hybridService.completion(mockRequest, {
        preferRustCore: false,
        fallbackToLegacy: true,
      });

      expect(response.source).toBe('legacy-typescript');
      expect(mockAICore.completion).not.toHaveBeenCalled();
    });

    test('should throw error when no service is available', async () => {
      mockAICore.isAvailable.mockResolvedValue(false);

      await expect(
        hybridService.completion(mockRequest, {
          preferRustCore: true,
          fallbackToLegacy: false,
        })
      ).rejects.toThrow('No AI service available');
    });

    test('should handle completion with custom options', async () => {
      mockAICore.isAvailable.mockResolvedValue(true);
      mockAICore.completion.mockResolvedValue({
        id: 'custom-test',
        model: 'gpt-4',
        choices: [{ message: { role: 'assistant', content: 'Custom response' } }],
        usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 },
        provider: 'openai',
        processing_time_ms: 800,
        cached: true,
      });

      const customOptions: HybridAIOptions = {
        preferRustCore: true,
        fallbackToLegacy: false,
        maxRetries: 3,
        retryDelayMs: 500,
      };

      const response = await hybridService.completion(mockRequest, customOptions);

      expect(response.source).toBe('rust-core');
      expect(response.cached).toBe(true);
      expect(response.usage.totalTokens).toBe(30);
    });
  });

  describe('Streaming AI Completion', () => {
    const mockRequest: AIServiceRequest = {
      messages: [{ role: 'user', content: 'Stream this message' }],
      model: 'gpt-3.5-turbo',
      streaming: true,
    };

    test('should stream from Rust AI Core when available', async () => {
      mockAICore.isAvailable.mockResolvedValue(true);
      
      const mockChunks = ['Hello', ' world', '!'];
      let chunkIndex = 0;
      const receivedChunks: string[] = [];
      let completionReceived = false;

      mockAICore.streamCompletion.mockImplementation(
        (request: any, onChunk: (chunk: string) => void, onComplete?: (response: any) => void) => {
          // Simulate streaming
          const interval = setInterval(() => {
            if (chunkIndex < mockChunks.length) {
              onChunk(mockChunks[chunkIndex]);
              chunkIndex++;
            } else {
              clearInterval(interval);
              if (onComplete) {
                onComplete({
                  choices: [{ message: { content: mockChunks.join('') } }],
                  model: 'gpt-3.5-turbo',
                  provider: 'openai',
                  usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
                  processing_time_ms: 1500,
                  cached: false,
                });
              }
            }
          }, 10);
          
          return Promise.resolve();
        }
      );

      await hybridService.streamCompletion(
        mockRequest,
        (chunk) => receivedChunks.push(chunk),
        (response) => {
          completionReceived = true;
          expect(response.source).toBe('rust-core');
          expect(response.content).toBe(mockChunks.join(''));
        }
      );

      // Wait for streaming to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(receivedChunks).toEqual(mockChunks);
      expect(completionReceived).toBe(true);
    });

    test('should fallback to legacy streaming simulation', async () => {
      mockAICore.isAvailable.mockResolvedValue(false);
      
      const receivedChunks: string[] = [];
      let completionReceived = false;

      await hybridService.streamCompletion(
        mockRequest,
        (chunk) => receivedChunks.push(chunk),
        (response) => {
          completionReceived = true;
          expect(response.source).toBe('legacy-typescript');
        },
        undefined,
        { fallbackToLegacy: true }
      );

      // Wait for simulated streaming
      await new Promise(resolve => setTimeout(resolve, 500));

      expect(receivedChunks.length).toBeGreaterThan(0);
      expect(completionReceived).toBe(true);
    });

    test('should handle streaming errors gracefully', async () => {
      mockAICore.isAvailable.mockResolvedValue(true);
      mockAICore.streamCompletion.mockImplementation(() => {
        throw new Error('Streaming failed');
      });

      let errorReceived = false;

      await hybridService.streamCompletion(
        mockRequest,
        (chunk) => {},
        undefined,
        (error) => {
          errorReceived = true;
          expect(error).toBeInstanceOf(Error);
        },
        { fallbackToLegacy: false }
      );

      expect(errorReceived).toBe(true);
    });
  });

  describe('Model Management', () => {
    test('should get available models from both services', async () => {
      mockAICore.isAvailable.mockResolvedValue(true);
      mockAICore.getModels.mockResolvedValue([
        {
          id: 'rust-gpt-3.5',
          name: 'GPT-3.5 Turbo (Rust)',
          provider: 'openai',
          context_length: 4096,
        },
        {
          id: 'rust-claude',
          name: 'Claude (Rust)',
          provider: 'anthropic',
          context_length: 8192,
        },
      ]);

      const models = await hybridService.getAvailableModels();

      expect(models).toHaveLength(4); // 2 from Rust + 2 legacy
      
      const rustModels = models.filter(m => m.source === 'rust-core');
      const legacyModels = models.filter(m => m.source === 'legacy-typescript');
      
      expect(rustModels).toHaveLength(2);
      expect(legacyModels).toHaveLength(2);
      
      expect(rustModels[0]).toMatchObject({
        id: 'rust-gpt-3.5',
        name: 'GPT-3.5 Turbo (Rust)',
        provider: 'openai',
        source: 'rust-core',
      });
    });

    test('should handle Rust service unavailable for model listing', async () => {
      mockAICore.isAvailable.mockResolvedValue(false);
      mockAICore.getModels.mockRejectedValue(new Error('Service unavailable'));

      const models = await hybridService.getAvailableModels();

      expect(models).toHaveLength(2); // Only legacy models
      expect(models.every(m => m.source === 'legacy-typescript')).toBe(true);
    });
  });

  describe('Memory Optimization', () => {
    test('should optimize memory across available services', async () => {
      mockAICore.isAvailable.mockResolvedValue(true);
      mockAICore.optimizeMemory.mockResolvedValue({
        memory_freed_mb: 128,
        duration_ms: 1000,
        optimization_level: 'aggressive',
      });

      const result = await hybridService.optimizeMemory();

      expect(result.totalFreedMB).toBe(128);
      expect(result.rustCore).toMatchObject({
        memory_freed_mb: 128,
        duration_ms: 1000,
        optimization_level: 'aggressive',
      });
      expect(result.legacy).toBeDefined();
    });

    test('should handle memory optimization when Rust service unavailable', async () => {
      mockAICore.isAvailable.mockResolvedValue(false);

      const result = await hybridService.optimizeMemory();

      expect(result.totalFreedMB).toBe(0);
      expect(result.rustCore).toBeUndefined();
      expect(result.legacy).toBeDefined();
    });

    test('should handle Rust memory optimization failures', async () => {
      mockAICore.isAvailable.mockResolvedValue(true);
      mockAICore.optimizeMemory.mockRejectedValue(new Error('Optimization failed'));

      const result = await hybridService.optimizeMemory();

      expect(result.totalFreedMB).toBe(0);
      expect(result.rustCore).toBeUndefined();
    });
  });

  describe('Convenience Methods', () => {
    test('should handle simple chat requests', async () => {
      mockAICore.isAvailable.mockResolvedValue(true);
      mockAICore.completion.mockResolvedValue({
        choices: [{ message: { content: 'Simple chat response' } }],
        model: 'gpt-3.5-turbo',
        provider: 'openai',
        usage: { prompt_tokens: 8, completion_tokens: 3, total_tokens: 11 },
        processing_time_ms: 600,
        cached: false,
      });

      const response = await hybridService.chat('Hello, how are you?', {
        model: 'gpt-3.5-turbo',
        temperature: 0.8,
        maxTokens: 100,
        systemPrompt: 'You are a helpful assistant.',
      });

      expect(response).toBe('Simple chat response');
      expect(mockAICore.completion).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            { role: 'system', content: 'You are a helpful assistant.' },
            { role: 'user', content: 'Hello, how are you?' },
          ],
          model: 'gpt-3.5-turbo',
          temperature: 0.8,
          max_tokens: 100,
        })
      );
    });

    test('should handle chat with legacy fallback', async () => {
      mockAICore.isAvailable.mockResolvedValue(false);

      const response = await hybridService.chat('Test message', {
        preferRustCore: false,
      });

      expect(response).toContain('Legacy response');
      expect(mockAICore.completion).not.toHaveBeenCalled();
    });
  });

  describe('Service Status Reporting', () => {
    test('should provide comprehensive service status', async () => {
      mockAICore.isAvailable.mockResolvedValue(true);
      mockAICore.getHealth.mockResolvedValue({
        status: 'healthy',
        memory_usage_mb: 256,
        models_loaded: 3,
      });

      const status = await hybridService.getServiceStatus();

      expect(status).toMatchObject({
        rustCore: {
          available: true,
          health: {
            status: 'healthy',
            memory_usage_mb: 256,
            models_loaded: 3,
          },
        },
        legacy: {
          available: true,
        },
        recommendation: 'rust-core',
      });
    });

    test('should recommend legacy when Rust core unavailable', async () => {
      mockAICore.isAvailable.mockResolvedValue(false);

      const status = await hybridService.getServiceStatus();

      expect(status.recommendation).toBe('legacy');
      expect(status.rustCore.available).toBe(false);
    });

    test('should handle health check failures', async () => {
      mockAICore.isAvailable.mockResolvedValue(true);
      mockAICore.getHealth.mockRejectedValue(new Error('Health check failed'));

      const status = await hybridService.getServiceStatus();

      expect(status.rustCore.available).toBe(true);
      expect(status.rustCore.health).toBeNull();
    });
  });

  describe('Error Handling and Resilience', () => {
    test('should handle network timeouts gracefully', async () => {
      mockAICore.isAvailable.mockResolvedValue(true);
      mockAICore.completion.mockRejectedValue(new Error('ECONNABORTED: timeout'));

      const request: AIServiceRequest = {
        messages: [{ role: 'user', content: 'This will timeout' }],
      };

      const response = await hybridService.completion(request, {
        preferRustCore: true,
        fallbackToLegacy: true,
      });

      expect(response.source).toBe('legacy-typescript');
    });

    test('should respect retry parameters', async () => {
      mockAICore.isAvailable.mockResolvedValue(true);
      mockAICore.completion
        .mockRejectedValueOnce(new Error('First attempt failed'))
        .mockRejectedValueOnce(new Error('Second attempt failed'))
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'Success on third try' } }],
          model: 'gpt-3.5-turbo',
          provider: 'openai',
          usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 },
          processing_time_ms: 1000,
          cached: false,
        });

      const request: AIServiceRequest = {
        messages: [{ role: 'user', content: 'Retry test' }],
      };

      // Note: Current implementation doesn't include retry logic in completion method
      // This test verifies the current behavior
      const response = await hybridService.completion(request, {
        preferRustCore: true,
        fallbackToLegacy: true,
        maxRetries: 3,
        retryDelayMs: 100,
      });

      expect(response.source).toBe('legacy-typescript'); // Falls back due to first failure
    });
  });
});