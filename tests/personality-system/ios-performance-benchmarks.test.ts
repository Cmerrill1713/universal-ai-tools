/**
 * iOS Performance Benchmarks Test Suite
 * 
 * Specialized performance testing for iOS device optimization in the
 * Adaptive AI Personality System. Tests device-specific constraints,
 * battery awareness, thermal management, and real-time optimization.
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/test-globals';
import { IoSPerformanceOptimizer } from '../../src/services/ios-performance-optimizer';
import { PersonalityAnalyticsService } from '../../src/services/personality-analytics-service';
import { AdaptiveModelRegistry } from '../../src/services/adaptive-model-registry';

describe('iOS Performance Benchmarks', () => {
  let performanceOptimizer: IoSPerformanceOptimizer;
  let personalityService: PersonalityAnalyticsService;
  let modelRegistry: AdaptiveModelRegistry;

  beforeAll(async () => {
    performanceOptimizer = new IoSPerformanceOptimizer();
    personalityService = new PersonalityAnalyticsService();
    modelRegistry = new AdaptiveModelRegistry();
    await performanceOptimizer.initialize();
  });

  afterAll(async () => {
    await performanceOptimizer.cleanup();
  });

  describe('Device-Specific Performance Constraints', () => {
    test('Apple Watch - Ultra-Aggressive Optimization', async () => {
      const deviceContext = {
        deviceType: 'apple_watch' as const,
        modelSize: 50 * 1024 * 1024, // 50MB
        availableMemory: 100 * 1024 * 1024, // 100MB
        batteryLevel: 0.4,
        thermalState: 'normal' as const,
        isLowPowerMode: false,
        cpuUsage: 0.3,
        networkCondition: 'wifi' as const
      };

      const optimizationStrategy = await performanceOptimizer.getOptimizationStrategy(
        'test-user-id',
        deviceContext,
        'quick_response'
      );

      // Apple Watch should have the most aggressive constraints
      expect(optimizationStrategy.maxConcurrentAgents).toBe(1);
      expect(optimizationStrategy.maxMemoryUsage).toBeLessThanOrEqual(50 * 1024 * 1024);
      expect(optimizationStrategy.maxInferenceTime).toBeLessThanOrEqual(3000); // 3s max
      expect(optimizationStrategy.batteryAwareness).toBe('aggressive');
      expect(optimizationStrategy.modelQuantization).toBe('int4');
    });

    test('iPhone - Balanced Optimization', async () => {
      const deviceContext = {
        deviceType: 'iphone' as const,
        modelSize: 250 * 1024 * 1024, // 250MB
        availableMemory: 500 * 1024 * 1024, // 500MB
        batteryLevel: 0.6,
        thermalState: 'normal' as const,
        isLowPowerMode: false,
        cpuUsage: 0.4,
        networkCondition: 'cellular' as const
      };

      const optimizationStrategy = await performanceOptimizer.getOptimizationStrategy(
        'test-user-id',
        deviceContext,
        'balanced_response'
      );

      expect(optimizationStrategy.maxConcurrentAgents).toBe(2);
      expect(optimizationStrategy.maxMemoryUsage).toBeLessThanOrEqual(250 * 1024 * 1024);
      expect(optimizationStrategy.maxInferenceTime).toBeLessThanOrEqual(5000); // 5s max
      expect(optimizationStrategy.batteryAwareness).toBe('moderate');
      expect(optimizationStrategy.modelQuantization).toBe('int8');
    });

    test('iPad - Performance-Optimized', async () => {
      const deviceContext = {
        deviceType: 'ipad' as const,
        modelSize: 500 * 1024 * 1024, // 500MB
        availableMemory: 1024 * 1024 * 1024, // 1GB
        batteryLevel: 0.8,
        thermalState: 'normal' as const,
        isLowPowerMode: false,
        cpuUsage: 0.2,
        networkCondition: 'wifi' as const
      };

      const optimizationStrategy = await performanceOptimizer.getOptimizationStrategy(
        'test-user-id',
        deviceContext,
        'detailed_response'
      );

      expect(optimizationStrategy.maxConcurrentAgents).toBe(4);
      expect(optimizationStrategy.maxMemoryUsage).toBeLessThanOrEqual(500 * 1024 * 1024);
      expect(optimizationStrategy.maxInferenceTime).toBeLessThanOrEqual(8000); // 8s max
      expect(optimizationStrategy.batteryAwareness).toBe('minimal');
      expect(optimizationStrategy.modelQuantization).toBe('float16');
    });

    test('Mac - Maximum Performance', async () => {
      const deviceContext = {
        deviceType: 'mac' as const,
        modelSize: 2 * 1024 * 1024 * 1024, // 2GB
        availableMemory: 4 * 1024 * 1024 * 1024, // 4GB
        batteryLevel: 1.0, // Plugged in
        thermalState: 'normal' as const,
        isLowPowerMode: false,
        cpuUsage: 0.1,
        networkCondition: 'wifi' as const
      };

      const optimizationStrategy = await performanceOptimizer.getOptimizationStrategy(
        'test-user-id',
        deviceContext,
        'comprehensive_response'
      );

      expect(optimizationStrategy.maxConcurrentAgents).toBe(8);
      expect(optimizationStrategy.maxMemoryUsage).toBeLessThanOrEqual(2 * 1024 * 1024 * 1024);
      expect(optimizationStrategy.maxInferenceTime).toBeLessThanOrEqual(15000); // 15s max
      expect(optimizationStrategy.batteryAwareness).toBe('none');
      expect(optimizationStrategy.modelQuantization).toBe('float32');
    });
  });

  describe('Battery and Thermal Awareness', () => {
    test('Low Battery Optimization', async () => {
      const lowBatteryContext = {
        deviceType: 'iphone' as const,
        modelSize: 250 * 1024 * 1024,
        availableMemory: 500 * 1024 * 1024,
        batteryLevel: 0.15, // Low battery
        thermalState: 'normal' as const,
        isLowPowerMode: true,
        cpuUsage: 0.3,
        networkCondition: 'cellular' as const
      };

      const strategy = await performanceOptimizer.getOptimizationStrategy(
        'test-user-id',
        lowBatteryContext,
        'quick_response'
      );

      // Should apply aggressive battery optimization
      expect(strategy.batteryAwareness).toBe('aggressive');
      expect(strategy.maxConcurrentAgents).toBe(1); // Reduced from normal 2
      expect(strategy.maxInferenceTime).toBeLessThan(3000); // Reduced time limit
      expect(strategy.modelQuantization).toBe('int4'); // More aggressive quantization
    });

    test('High Thermal State Throttling', async () => {
      const highThermalContext = {
        deviceType: 'iphone' as const,
        modelSize: 250 * 1024 * 1024,
        availableMemory: 500 * 1024 * 1024,
        batteryLevel: 0.7,
        thermalState: 'serious' as const, // High thermal state
        isLowPowerMode: false,
        cpuUsage: 0.8,
        networkCondition: 'wifi' as const
      };

      const strategy = await performanceOptimizer.getOptimizationStrategy(
        'test-user-id',
        highThermalContext,
        'balanced_response'
      );

      // Should apply thermal throttling
      expect(strategy.maxConcurrentAgents).toBe(1); // Reduced for thermal management
      expect(strategy.maxInferenceTime).toBeLessThan(4000); // Shorter execution time
      expect(strategy.thermalAwareness).toBe('aggressive');
    });
  });

  describe('Performance Benchmarking', () => {
    test('Model Loading Performance', async () => {
      const startTime = Date.now();
      
      const modelInfo = await modelRegistry.getOptimalModel('test-user-id', {
        deviceType: 'iphone',
        taskType: 'code_generation',
        availableMemory: 250 * 1024 * 1024,
        batteryLevel: 0.6
      });
      
      const loadTime = Date.now() - startTime;
      
      // Model selection should be fast
      expect(loadTime).toBeLessThan(100); // 100ms
      expect(modelInfo).toBeDefined();
      expect(modelInfo.modelSize).toBeLessThanOrEqual(250 * 1024 * 1024);
    });

    test('Inference Performance', async () => {
      const deviceContext = {
        deviceType: 'iphone' as const,
        modelSize: 250 * 1024 * 1024,
        availableMemory: 500 * 1024 * 1024,
        batteryLevel: 0.6,
        thermalState: 'normal' as const,
        isLowPowerMode: false,
        cpuUsage: 0.3,
        networkCondition: 'wifi' as const
      };

      const startTime = Date.now();
      
      const benchmark = await performanceOptimizer.runBenchmarkSuite(
        'test-user-id',
        deviceContext
      );
      
      const totalTime = Date.now() - startTime;
      
      // Benchmark should complete within reasonable time
      expect(totalTime).toBeLessThan(30000); // 30s max
      expect(benchmark.modelLoadingTime).toBeLessThan(5000); // 5s max
      expect(benchmark.inferenceTime).toBeLessThan(5000); // 5s max
      expect(benchmark.memoryUsage).toBeLessThanOrEqual(deviceContext.availableMemory);
      expect(benchmark.qualityScore).toBeGreaterThan(0.7); // 70% quality minimum
    });

    test('Adaptive Strategy Evolution', async () => {
      const deviceContext = {
        deviceType: 'iphone' as const,
        modelSize: 250 * 1024 * 1024,
        availableMemory: 500 * 1024 * 1024,
        batteryLevel: 0.6,
        thermalState: 'normal' as const,
        isLowPowerMode: false,
        cpuUsage: 0.3,
        networkCondition: 'wifi' as const
      };

      // Get initial strategy
      const initialStrategy = await performanceOptimizer.getOptimizationStrategy(
        'test-user-id',
        deviceContext,
        'balanced_response'
      );

      // Simulate poor performance feedback
      await performanceOptimizer.updatePerformanceMetrics('test-user-id', {
        latency: 8000, // High latency
        memoryUsage: 400 * 1024 * 1024,
        batteryImpact: 0.15, // High battery impact
        qualityScore: 0.6, // Low quality
        userSatisfaction: 0.5 // Low satisfaction
      });

      // Get adapted strategy
      const adaptedStrategy = await performanceOptimizer.getOptimizationStrategy(
        'test-user-id',
        deviceContext,
        'balanced_response'
      );

      // Strategy should adapt to improve performance
      expect(adaptedStrategy.maxInferenceTime).toBeLessThan(initialStrategy.maxInferenceTime);
      expect(adaptedStrategy.maxConcurrentAgents).toBeLessThanOrEqual(initialStrategy.maxConcurrentAgents);
    });
  });

  describe('Memory Management', () => {
    test('Memory Constraint Enforcement', async () => {
      const constrainedContext = {
        deviceType: 'apple_watch' as const,
        modelSize: 50 * 1024 * 1024, // 50MB
        availableMemory: 80 * 1024 * 1024, // Only 80MB available
        batteryLevel: 0.3,
        thermalState: 'normal' as const,
        isLowPowerMode: true,
        cpuUsage: 0.4,
        networkCondition: 'cellular' as const
      };

      const strategy = await performanceOptimizer.getOptimizationStrategy(
        'test-user-id',
        constrainedContext,
        'quick_response'
      );

      // Should enforce strict memory limits
      expect(strategy.maxMemoryUsage).toBeLessThanOrEqual(constrainedContext.availableMemory * 0.8); // 80% of available
      expect(strategy.maxConcurrentAgents).toBe(1);
      expect(strategy.modelQuantization).toBe('int4'); // Aggressive quantization
    });

    test('Memory Cleanup and Optimization', async () => {
      const memoryUsageBefore = process.memoryUsage().heapUsed;
      
      // Simulate memory-intensive operations
      const results = [];
      for (let i = 0; i < 10; i++) {
        const result = await performanceOptimizer.getOptimizationStrategy(
          `test-user-${i}`,
          {
            deviceType: 'iphone',
            modelSize: 250 * 1024 * 1024,
            availableMemory: 500 * 1024 * 1024,
            batteryLevel: 0.6,
            thermalState: 'normal',
            isLowPowerMode: false,
            cpuUsage: 0.3,
            networkCondition: 'wifi'
          },
          'balanced_response'
        );
        results.push(result);
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const memoryUsageAfter = process.memoryUsage().heapUsed;
      const memoryIncrease = memoryUsageAfter - memoryUsageBefore;
      
      // Memory increase should be reasonable (less than 100MB)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
    });
  });

  describe('Real-time Performance Monitoring', () => {
    test('Performance Metrics Collection', async () => {
      const metrics = await performanceOptimizer.collectPerformanceMetrics('test-user-id');
      
      expect(metrics).toBeDefined();
      expect(metrics.averageLatency).toBeGreaterThan(0);
      expect(metrics.memoryEfficiency).toBeGreaterThan(0);
      expect(metrics.batteryEfficiency).toBeGreaterThan(0);
      expect(metrics.userSatisfactionScore).toBeGreaterThan(0);
      expect(Array.isArray(metrics.devicePerformance)).toBe(true);
    });

    test('Real-time Strategy Adaptation', async () => {
      const deviceContext = {
        deviceType: 'iphone' as const,
        modelSize: 250 * 1024 * 1024,
        availableMemory: 500 * 1024 * 1024,
        batteryLevel: 0.6,
        thermalState: 'normal' as const,
        isLowPowerMode: false,
        cpuUsage: 0.3,
        networkCondition: 'wifi' as const
      };

      // Subscribe to performance updates
      const updates: any[] = [];
      performanceOptimizer.on('strategyUpdated', (update) => {
        updates.push(update);
      });

      // Simulate device state changes
      const updatedContext = {
        ...deviceContext,
        batteryLevel: 0.2, // Battery dropped
        thermalState: 'fair' as const, // Temperature increased
        cpuUsage: 0.7 // CPU usage increased
      };

      const newStrategy = await performanceOptimizer.getOptimizationStrategy(
        'test-user-id',
        updatedContext,
        'balanced_response'
      );

      // Should receive real-time updates
      expect(updates.length).toBeGreaterThan(0);
      expect(newStrategy.batteryAwareness).toBe('aggressive'); // Adapted to low battery
    });
  });

  describe('Quality and User Satisfaction', () => {
    test('Quality Score Calculation', async () => {
      const benchmark = await performanceOptimizer.runBenchmarkSuite('test-user-id', {
        deviceType: 'iphone',
        modelSize: 250 * 1024 * 1024,
        availableMemory: 500 * 1024 * 1024,
        batteryLevel: 0.6,
        thermalState: 'normal',
        isLowPowerMode: false,
        cpuUsage: 0.3,
        networkCondition: 'wifi'
      });

      expect(benchmark.qualityScore).toBeGreaterThan(0);
      expect(benchmark.qualityScore).toBeLessThanOrEqual(1);
      
      // Quality score should consider multiple factors
      expect(benchmark.qualityBreakdown).toBeDefined();
      expect(benchmark.qualityBreakdown.accuracy).toBeGreaterThan(0);
      expect(benchmark.qualityBreakdown.relevance).toBeGreaterThan(0);
      expect(benchmark.qualityBreakdown.completeness).toBeGreaterThan(0);
    });

    test('User Satisfaction Tracking', async () => {
      // Simulate user feedback
      await performanceOptimizer.recordUserFeedback('test-user-id', {
        satisfactionScore: 0.85,
        responseTime: 3500,
        responseQuality: 0.9,
        batteryImpact: 0.05,
        deviceExperience: 'smooth'
      });

      const metrics = await performanceOptimizer.collectPerformanceMetrics('test-user-id');
      
      expect(metrics.userSatisfactionScore).toBeGreaterThan(0.8);
      expect(metrics.feedbackCount).toBeGreaterThan(0);
    });
  });
});