/**
 * Test Setup and Global Configuration
 * Sets up the test environment for autonomous code generation tests
 */

import { jest } from '@jest/globals';
import { performance } from 'perf_hooks';

// Global test configuration
global.performance = performance;

// Setup global mocks and utilities
beforeAll(async () => {
  console.log('🚀 Setting up Autonomous Code Generation Test Suite');
  
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'warn'; // Reduce logging noise in tests
  
  // Mock external services that we don't want to call during tests
  jest.mock('node-fetch', () => ({
    default: jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ mocked: true }),
      text: jest.fn().mockResolvedValue('mocked response')
    })
  }));

  // Mock file system operations for security
  jest.mock('fs', () => ({
    ...jest.requireActual('fs'),
    writeFileSync: jest.fn(),
    appendFileSync: jest.fn(),
    unlinkSync: jest.fn()
  }));

  // Mock child_process for security (prevent actual command execution)
  jest.mock('child_process', () => ({
    exec: jest.fn((cmd, callback) => callback(null, 'mocked output', '')),
    spawn: jest.fn(() => ({
      on: jest.fn(),
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() }
    }))
  }));

  console.log('✅ Test environment configured');
});

afterAll(async () => {
  console.log('🧹 Cleaning up test environment');
  
  // Clear all mocks
  jest.clearAllMocks();
  jest.resetAllMocks();
  
  console.log('✅ Test cleanup complete');
});

// Global test utilities
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidCode(): R;
      toContainSecurityPattern(pattern: string): R;
      toHaveQualityScore(minScore: number): R;
      toCompleteWithin(maxTime: number): R;
    }
  }
}

// Custom Jest matchers for autonomous code generation tests
expect.extend({
  toBeValidCode(received: string) {
    const isString = typeof received === 'string';
    const hasContent = received && received.trim().length > 0;
    const hasValidSyntax = !received.includes('undefined') && !received.includes('null');
    
    const pass = isString && hasContent && hasValidSyntax;
    
    if (pass) {
      return {
        message: () => `Expected ${received} not to be valid code`,
        pass: true,
      };
    } else {
      return {
        message: () => `Expected ${received} to be valid code`,
        pass: false,
      };
    }
  },

  toContainSecurityPattern(received: any, pattern: string) {
    const result = received?.securityValidation || received;
    const hasPattern = result.vulnerabilities?.some((vuln: any) => 
      vuln.type === pattern || vuln.category === pattern
    ) || false;
    
    const pass = hasPattern;
    
    if (pass) {
      return {
        message: () => `Expected security result not to contain pattern ${pattern}`,
        pass: true,
      };
    } else {
      return {
        message: () => `Expected security result to contain pattern ${pattern}`,
        pass: false,
      };
    }
  },

  toHaveQualityScore(received: any, minScore: number) {
    const score = received?.qualityValidation?.qualityScore || 
                 received?.qualityScores?.overall || 
                 received?.overallQualityScore || 0;
    
    const pass = score >= minScore;
    
    if (pass) {
      return {
        message: () => `Expected quality score ${score} not to be at least ${minScore}`,
        pass: true,
      };
    } else {
      return {
        message: () => `Expected quality score ${score} to be at least ${minScore}`,
        pass: false,
      };
    }
  },

  toCompleteWithin(received: Promise<any>, maxTime: number) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      
      received.then((result) => {
        const duration = Date.now() - startTime;
        const pass = duration <= maxTime;
        
        resolve({
          message: () => pass
            ? `Expected operation not to complete within ${maxTime}ms (completed in ${duration}ms)`
            : `Expected operation to complete within ${maxTime}ms (took ${duration}ms)`,
          pass,
        });
      }).catch((error) => {
        resolve({
          message: () => `Operation failed with error: ${error.message}`,
          pass: false,
        });
      });
    });
  }
});

// Performance monitoring utilities
export class PerformanceMonitor {
  private static measurements: Map<string, number[]> = new Map();

  static startMeasurement(name: string): () => number {
    const start = performance.now();
    return () => {
      const duration = performance.now() - start;
      
      if (!this.measurements.has(name)) {
        this.measurements.set(name, []);
      }
      this.measurements.get(name)!.push(duration);
      
      return duration;
    };
  }

  static getAverageTime(name: string): number {
    const times = this.measurements.get(name) || [];
    return times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
  }

  static getPercentile(name: string, percentile: number): number {
    const times = this.measurements.get(name) || [];
    if (times.length === 0) return 0;
    
    const sorted = [...times].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index];
  }

  static reset(name?: string): void {
    if (name) {
      this.measurements.delete(name);
    } else {
      this.measurements.clear();
    }
  }

  static getAllMeasurements(): Record<string, { avg: number; p50: number; p95: number; p99: number; count: number }> {
    const results: Record<string, any> = {};
    
    for (const [name, times] of this.measurements.entries()) {
      results[name] = {
        avg: this.getAverageTime(name),
        p50: this.getPercentile(name, 50),
        p95: this.getPercentile(name, 95),
        p99: this.getPercentile(name, 99),
        count: times.length
      };
    }
    
    return results;
  }
}

// Test data validation utilities
export class TestDataValidator {
  static validateGenerationResult(result: any): void {
    expect(result).toBeDefined();
    expect(result.success).toBeDefined();
    expect(result.generationId).toBeDefined();
    expect(result.generatedCode).toBeDefined();
    expect(result.language).toBeDefined();
    expect(result.generationType).toBeDefined();
    expect(result.overallQualityScore).toBeGreaterThanOrEqual(0);
    expect(result.overallQualityScore).toBeLessThanOrEqual(1);
    expect(result.confidenceScore).toBeGreaterThanOrEqual(0);
    expect(result.confidenceScore).toBeLessThanOrEqual(1);
  }

  static validateSecurityResult(result: any): void {
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.scanId).toBeDefined();
    expect(result.language).toBeDefined();
    expect(result.overallSecurityScore).toBeGreaterThanOrEqual(0);
    expect(result.overallSecurityScore).toBeLessThanOrEqual(1);
    expect(result.riskLevel).toMatch(/^(low|medium|high|critical)$/);
    expect(Array.isArray(result.vulnerabilities)).toBe(true);
  }

  static validateQualityResult(result: any): void {
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.assessmentId).toBeDefined();
    expect(result.language).toBeDefined();
    expect(result.qualityScores).toBeDefined();
    expect(result.qualityScores.overall).toBeGreaterThanOrEqual(0);
    expect(result.qualityScores.overall).toBeLessThanOrEqual(1);
  }

  static validateAnalysisResult(result: any): void {
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.analysisId).toBeDefined();
    expect(result.language).toBeDefined();
    expect(result.analysisTimeMs).toBeGreaterThan(0);
    expect(result.confidenceScore).toBeGreaterThanOrEqual(0);
    expect(result.confidenceScore).toBeLessThanOrEqual(1);
  }
}

// Memory leak detection
export class MemoryLeakDetector {
  private static initialMemory: NodeJS.MemoryUsage;
  private static measurements: Array<{ name: string; memory: NodeJS.MemoryUsage; timestamp: number }> = [];

  static startMonitoring(): void {
    this.initialMemory = process.memoryUsage();
    this.measurements = [];
  }

  static recordMeasurement(name: string): void {
    this.measurements.push({
      name,
      memory: process.memoryUsage(),
      timestamp: Date.now()
    });
  }

  static detectLeaks(): { hasLeak: boolean; report: string } {
    if (this.measurements.length === 0) {
      return { hasLeak: false, report: 'No measurements recorded' };
    }

    const latest = this.measurements[this.measurements.length - 1];
    const memoryGrowth = latest.memory.heapUsed - this.initialMemory.heapUsed;
    const memoryGrowthMB = memoryGrowth / (1024 * 1024);

    // Flag as potential leak if memory growth > 50MB
    const hasLeak = memoryGrowthMB > 50;

    const report = `
Memory Usage Report:
  Initial: ${(this.initialMemory.heapUsed / 1024 / 1024).toFixed(2)} MB
  Final: ${(latest.memory.heapUsed / 1024 / 1024).toFixed(2)} MB
  Growth: ${memoryGrowthMB.toFixed(2)} MB
  Measurements: ${this.measurements.length}
  Potential Leak: ${hasLeak ? 'YES' : 'NO'}
    `.trim();

    return { hasLeak, report };
  }

  static reset(): void {
    this.measurements = [];
    this.initialMemory = process.memoryUsage();
  }
}

// Export test utilities for use in test files
export { PerformanceMonitor, TestDataValidator, MemoryLeakDetector };

console.log('🧪 Test utilities loaded and ready');