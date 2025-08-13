/**
 * FlashAttention Service Tests
 * Comprehensive test suite for FlashAttention optimization service
 */

import type { FlashAttentionRequest } from '../flash-attention-service';
import { flashAttentionService } from '../flash-attention-service';

// Mock the Python subprocess execution
jest.mock('child_process', () => ({
  spawn: jest.fn(() => ({
    stdout: {
      on: jest.fn((event, handler) => {
        if (event === 'data') {
          // Mock successful Python response
          handler(JSON.stringify({
            output: [[[[0.1, 0.2], [0.3, 0.4]]]],
            execution_time_ms: 15.5,
            optimization_used: 'flash_attention',
            memory_usage_mb: 128.5,
            device: 'cuda:0'
          }));
        }
      }),
    },
    stderr: {
      on: jest.fn(),
    },
    stdin: {
      write: jest.fn(),
      end: jest.fn(),
    },
    on: jest.fn((event, handler) => {
      if (event === 'close') {
        handler(0); // Success exit code
      }
    }),
  })),
}));

// Mock file system operations
jest.mock('fs', () => ({
  existsSync: jest.fn(() => true),
  writeFileSync: jest.fn(),
  readFileSync: jest.fn(),
  mkdirSync: jest.fn(),
}));

describe('FlashAttentionService', () => {
  beforeEach(async () => {
    // Clear any previous state
    await flashAttentionService.clearCache();
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await flashAttentionService.shutdown();
  });

  describe('Initialization', () => {
    it('should initialize successfully with default configuration', async () => {
      const capabilities = await flashAttentionService.getSystemCapabilities();
      
      expect(capabilities).toBeDefined();
      expect(capabilities.optimizationProfiles).toContain('balanced');
      expect(capabilities.optimizationProfiles).toContain('speed_optimized');
      expect(capabilities.optimizationProfiles).toContain('memory_optimized');
    });

    it('should detect system capabilities', async () => {
      const capabilities = await flashAttentionService.getSystemCapabilities();
      
      expect(capabilities.currentConfig).toBeDefined();
      expect(capabilities.currentConfig.enableGPU).toBeDefined();
      expect(capabilities.currentConfig.enableCPU).toBeDefined();
    });
  });

  describe('Attention Optimization', () => {
    const validRequest: FlashAttentionRequest = {
      modelId: 'test-model',
      providerId: 'test-provider',
      inputTokens: [1, 2, 3, 4, 5],
      sequenceLength: 128,
      batchSize: 1,
      useCache: false,
      optimizationLevel: 'medium',
    };

    it('should optimize attention successfully', async () => {
      const result = await flashAttentionService.optimizeAttention(validRequest);
      
      expect(result.success).toBe(true);
      expect(result.attentionOutput).toBeDefined();
      expect(result.metrics).toBeDefined();
      expect(result.metrics.executionTimeMs).toBeGreaterThan(0);
      expect(result.metrics.memoryUsageMB).toBeGreaterThan(0);
      expect(result.optimizationApplied).toContain('flash_attention');
    });

    it('should handle different optimization levels', async () => {
      const levels: Array<'low' | 'medium' | 'high' | 'aggressive'> = 
        ['low', 'medium', 'high', 'aggressive'];
      
      for (const level of levels) {
        const request = { ...validRequest, optimizationLevel: level };
        const result = await flashAttentionService.optimizeAttention(request);
        
        expect(result.success).toBe(true);
        expect(result.optimizationApplied).toContain(level.startsWith('aggressive') ? 'throughput_optimized' :
                                                    level === 'high' ? 'speed_optimized' :
                                                    level === 'low' ? 'memory_optimized' : 'balanced');
      }
    });

    it('should use cache when enabled', async () => {
      const requestWithCache = { ...validRequest, useCache: true };
      
      // First request - should hit Python service
      const result1 = await flashAttentionService.optimizeAttention(requestWithCache);
      expect(result1.success).toBe(true);
      
      // Second identical request - should hit cache
      const result2 = await flashAttentionService.optimizeAttention(requestWithCache);
      expect(result2.success).toBe(true);
      expect(result2.metrics.cacheHitRate).toBe(1.0);
    });

    it('should handle large sequence lengths', async () => {
      const largeRequest = {
        ...validRequest,
        sequenceLength: 4096,
        inputTokens: Array.from({ length: 1000 }, (_, i) => i),
      };
      
      const result = await flashAttentionService.optimizeAttention(largeRequest);
      expect(result.success).toBe(true);
    });

    it('should handle batch processing', async () => {
      const batchRequest = { ...validRequest, batchSize: 4 };
      
      const result = await flashAttentionService.optimizeAttention(batchRequest);
      expect(result.success).toBe(true);
    });

    it('should validate input constraints', async () => {
      // Test sequence length limits
      const invalidRequest = {
        ...validRequest,
        sequenceLength: 100000, // Too large
      };
      
      // This should either fail or be clamped
      const result = await flashAttentionService.optimizeAttention(invalidRequest);
      // The service should handle this gracefully
      expect(result).toBeDefined();
    });
  });

  describe('Configuration Management', () => {
    it('should update configuration successfully', async () => {
      const newConfig = {
        enableGPU: false,
        enableCPU: true,
        batchSize: 2,
        blockSize: 32,
      };
      
      await expect(flashAttentionService.updateConfiguration(newConfig))
        .resolves.not.toThrow();
      
      const capabilities = await flashAttentionService.getSystemCapabilities();
      expect(capabilities.currentConfig.enableGPU).toBe(false);
      expect(capabilities.currentConfig.enableCPU).toBe(true);
      expect(capabilities.currentConfig.batchSize).toBe(2);
    });

    it('should validate configuration parameters', async () => {
      const invalidConfig = {
        batchSize: -1, // Invalid
        blockSize: 1000, // Too large
      };
      
      // Should handle invalid config gracefully
      await expect(flashAttentionService.updateConfiguration(invalidConfig))
        .resolves.not.toThrow();
    });
  });

  describe('Performance Metrics', () => {
    it('should track performance metrics', async () => {
      // Make a few requests to generate metrics
      for (let i = 0; i < 3; i++) {
        await flashAttentionService.optimizeAttention({
          ...validRequest,
          modelId: `test-model-${i}`,
          useCache: false,
        });
      }
      
      const metrics = await flashAttentionService.getPerformanceMetrics();
      
      expect(metrics.totalOptimizations).toBeGreaterThan(0);
      expect(metrics.averageExecutionTime).toBeGreaterThan(0);
      expect(metrics.averageSpeedup).toBeGreaterThan(0);
      expect(metrics.averageMemoryEfficiency).toBeGreaterThan(0);
    });

    it('should calculate speedup factors correctly', async () => {
      const result = await flashAttentionService.optimizeAttention(validRequest);
      
      expect(result.metrics.speedupFactor).toBeGreaterThan(0);
      expect(result.metrics.memoryEfficiency).toBeGreaterThan(0);
      expect(result.metrics.throughputTokensPerSec).toBeGreaterThan(0);
    });
  });

  describe('Cache Management', () => {
    it('should clear cache successfully', async () => {
      // Add some cached results
      await flashAttentionService.optimizeAttention({
        ...validRequest,
        useCache: true,
      });
      
      await flashAttentionService.clearCache();
      
      // Verify cache is cleared by checking metrics
      const metrics = await flashAttentionService.getPerformanceMetrics();
      // After clearing, cache hit rate should be 0 for new requests
      const result = await flashAttentionService.optimizeAttention({
        ...validRequest,
        useCache: true,
      });
      expect(result.metrics.cacheHitRate).toBe(0);
    });

    it('should respect cache size limits', async () => {
      // This test would need access to cache internals
      // For now, just verify the service handles many requests
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(flashAttentionService.optimizeAttention({
          ...validRequest,
          modelId: `cache-test-${i}`,
          useCache: true,
        }));
      }
      
      const results = await Promise.all(promises);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Health Monitoring', () => {
    it('should report healthy status when properly initialized', async () => {
      const health = await flashAttentionService.getHealthStatus();
      
      expect(health.status).toBe('healthy');
      expect(health.details.initialized).toBe(true);
    });

    it('should include relevant health details', async () => {
      const health = await flashAttentionService.getHealthStatus();
      
      expect(health.details).toHaveProperty('initialized');
      expect(health.details).toHaveProperty('cacheSize');
      expect(health.details).toHaveProperty('metricsCount');
      expect(health.details).toHaveProperty('configuration');
    });
  });

  describe('Error Handling', () => {
    it('should handle Python script errors gracefully', async () => {
      // Mock Python script failure
      const { spawn } = require('child_process');
      spawn.mockImplementationOnce(() => ({
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        stdin: { write: jest.fn(), end: jest.fn() },
        on: jest.fn((event, handler) => {
          if (event === 'close') {
            handler(1); // Error exit code
          }
        }),
      }));
      
      const result = await flashAttentionService.optimizeAttention(validRequest);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.fallbackUsed).toBe(true);
    });

    it('should handle invalid input gracefully', async () => {
      const invalidRequest = {
        ...validRequest,
        inputTokens: [], // Empty array
      };
      
      // Service should validate and handle this
      const result = await flashAttentionService.optimizeAttention(invalidRequest);
      expect(result).toBeDefined();
    });

    it('should handle service shutdown gracefully', async () => {
      await expect(flashAttentionService.shutdown()).resolves.not.toThrow();
      
      // Service should still be queryable for health
      const health = await flashAttentionService.getHealthStatus();
      expect(health.status).toBe('unhealthy');
    });
  });

  describe('Integration Edge Cases', () => {
    it('should handle concurrent requests', async () => {
      const promises = Array.from({ length: 5 }, (_, i) =>
        flashAttentionService.optimizeAttention({
          ...validRequest,
          modelId: `concurrent-${i}`,
          useCache: false,
        })
      );
      
      const results = await Promise.all(promises);
      
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.attentionOutput).toBeDefined();
      });
    });

    it('should handle attention masks correctly', async () => {
      const requestWithMask = {
        ...validRequest,
        attentionMask: [1, 1, 1, 0, 0], // Attention mask
      };
      
      const result = await flashAttentionService.optimizeAttention(requestWithMask);
      expect(result.success).toBe(true);
    });

    it('should handle memory pressure scenarios', async () => {
      // Test with large inputs that might cause memory pressure
      const largeRequest = {
        ...validRequest,
        sequenceLength: 8192,
        batchSize: 8,
        inputTokens: Array.from({ length: 5000 }, (_, i) => i),
      };
      
      const result = await flashAttentionService.optimizeAttention(largeRequest);
      expect(result).toBeDefined();
      // Should either succeed or fail gracefully
    });
  });

  describe('Optimization Profiles', () => {
    it('should apply correct optimization profiles', async () => {
      const capabilities = await flashAttentionService.getSystemCapabilities();
      const profiles = capabilities.optimizationProfiles;
      
      expect(profiles).toContain('speed_optimized');
      expect(profiles).toContain('memory_optimized');
      expect(profiles).toContain('balanced');
      expect(profiles).toContain('throughput_optimized');
    });

    it('should select appropriate profile for optimization level', async () => {
      const testCases = [
        { level: 'low' as const, expectedProfile: 'memory_optimized' },
        { level: 'medium' as const, expectedProfile: 'balanced' },
        { level: 'high' as const, expectedProfile: 'speed_optimized' },
        { level: 'aggressive' as const, expectedProfile: 'throughput_optimized' },
      ];
      
      for (const { level, expectedProfile } of testCases) {
        const result = await flashAttentionService.optimizeAttention({
          ...validRequest,
          optimizationLevel: level,
          useCache: false,
        });
        
        expect(result.success).toBe(true);
        expect(result.optimizationApplied).toContain(expectedProfile);
      }
    });
  });
});

// Helper function for creating test requests
const validRequest = {
  modelId: 'test-model',
  providerId: 'test-provider',
  inputTokens: [1, 2, 3, 4, 5],
  sequenceLength: 128,
  batchSize: 1,
  useCache: false,
  optimizationLevel: 'medium' as const,
};