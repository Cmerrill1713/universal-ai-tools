/**
 * Performance Tests for Autonomous Code Generation
 * Validates performance requirements and benchmarks for the code generation system
 */

import { jest } from '@jest/globals';
import { autonomousCodeService } from '@/services/autonomous-code-service';
import { codeAnalysisService } from '@/services/code-analysis-service';
import { securityScanningService } from '@/services/security-scanning-service';
import { codeQualityService } from '@/services/code-quality-service';
import { 
  generateMockGenerationRequest, 
  mockPerformanceBenchmarks,
  mockTypeScriptCode,
  mockJavaScriptCode,
  mockPythonCode 
} from '../fixtures/test-data';

describe('Code Generation Performance Tests', () => {
  // Extended timeout for performance tests
  jest.setTimeout(30000);

  describe('Code Generation Performance', () => {
    it('should generate code within acceptable time limits', async () => {
      const request = generateMockGenerationRequest({
        prompt: 'Create a simple REST API endpoint for user management',
        language: 'typescript',
        generationType: 'completion',
        enableSecurityValidation: true,
        enableQualityValidation: true
      });

      const startTime = performance.now();
      const result = await autonomousCodeService.generateCode(request);
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(mockPerformanceBenchmarks.codeGeneration.expectedMaxTime);
      
      if (duration < mockPerformanceBenchmarks.codeGeneration.excellentTime) {
        console.log(`✨ Excellent performance: ${duration.toFixed(2)}ms`);
      } else if (duration < mockPerformanceBenchmarks.codeGeneration.acceptableTime) {
        console.log(`✅ Good performance: ${duration.toFixed(2)}ms`);
      } else {
        console.log(`⚠️  Acceptable performance: ${duration.toFixed(2)}ms`);
      }
    });

    it('should handle complex generation requests within time limits', async () => {
      const complexRequest = generateMockGenerationRequest({
        prompt: 'Design and implement a complete microservice architecture with event sourcing, CQRS pattern, comprehensive error handling, authentication, authorization, caching, monitoring, and deployment configuration',
        language: 'typescript',
        generationType: 'full-implementation',
        enableMultiAgentOrchestration: true,
        enableAbMctsCoordination: true,
        enableDspyCognitiveChains: true,
        enableSecurityValidation: true,
        enableQualityValidation: true,
        enablePerformanceValidation: true,
        maxTokens: 6000
      });

      const startTime = performance.now();
      const result = await autonomousCodeService.generateCode(complexRequest);
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result.success).toBeDefined();
      // Complex requests get more time but should still be reasonable
      expect(duration).toBeLessThan(mockPerformanceBenchmarks.codeGeneration.expectedMaxTime * 2);
      
      console.log(`Complex generation completed in: ${duration.toFixed(2)}ms`);
      console.log(`Orchestration used: ${result.orchestrationUsed}`);
      console.log(`Generated code length: ${result.generatedCode.length} characters`);
    });

    it('should maintain performance under concurrent load', async () => {
      const concurrentRequests = Array.from({ length: 10 }, (_, i) => 
        generateMockGenerationRequest({
          prompt: `Generate function ${i} for concurrent testing`,
          language: 'typescript',
          sessionId: `perf-test-session-${i}`,
          enableSecurityValidation: false, // Disable for faster testing
          enableQualityValidation: false
        })
      );

      const startTime = performance.now();
      const results = await Promise.all(
        concurrentRequests.map(req => autonomousCodeService.generateCode(req))
      );
      const endTime = performance.now();
      const totalDuration = endTime - startTime;
      const averageDuration = totalDuration / concurrentRequests.length;

      // All requests should succeed
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.sessionId).toBe(`perf-test-session-${index}`);
      });

      // Average time per request should be reasonable
      expect(averageDuration).toBeLessThan(mockPerformanceBenchmarks.codeGeneration.acceptableTime);
      
      console.log(`Concurrent requests completed:`);
      console.log(`  Total time: ${totalDuration.toFixed(2)}ms`);
      console.log(`  Average per request: ${averageDuration.toFixed(2)}ms`);
      console.log(`  Requests per second: ${(1000 / averageDuration * 10).toFixed(2)}`);
    });

    it('should demonstrate performance scaling with request complexity', async () => {
      const requests = [
        {
          name: 'Simple',
          request: generateMockGenerationRequest({
            prompt: 'Create a simple function',
            maxTokens: 200
          })
        },
        {
          name: 'Medium',
          request: generateMockGenerationRequest({
            prompt: 'Create a REST API with authentication',
            maxTokens: 1000,
            enableSecurityValidation: true
          })
        },
        {
          name: 'Complex',
          request: generateMockGenerationRequest({
            prompt: 'Create a complete microservice with all best practices',
            maxTokens: 4000,
            enableSecurityValidation: true,
            enableQualityValidation: true,
            enablePerformanceValidation: true
          })
        }
      ];

      const results = [];
      
      for (const { name, request } of requests) {
        const startTime = performance.now();
        const result = await autonomousCodeService.generateCode(request);
        const endTime = performance.now();
        const duration = endTime - startTime;

        results.push({
          name,
          duration,
          success: result.success,
          codeLength: result.generatedCode.length,
          tokensUsed: result.totalTokensUsed
        });

        expect(result.success).toBe(true);
      }

      // Performance should scale reasonably with complexity
      console.log('Performance scaling results:');
      results.forEach(result => {
        console.log(`  ${result.name}: ${result.duration.toFixed(2)}ms, ${result.codeLength} chars, ${result.tokensUsed} tokens`);
      });

      // Simple should be fastest, complex should be slowest, but not exponentially so
      expect(results[0].duration).toBeLessThan(results[1].duration);
      expect(results[1].duration).toBeLessThan(results[2].duration);
      expect(results[2].duration).toBeLessThan(results[0].duration * 10); // Not more than 10x slower
    });
  });

  describe('AST Parsing Performance', () => {
    const testCodes = [
      { name: 'TypeScript', code: mockTypeScriptCode, language: 'typescript' },
      { name: 'JavaScript', code: mockJavaScriptCode, language: 'javascript' },
      { name: 'Python', code: mockPythonCode, language: 'python' }
    ];

    testCodes.forEach(({ name, code, language }) => {
      it(`should parse ${name} code within performance limits`, async () => {
        const request = {
          code,
          language,
          userId: 'perf-test-user',
          analysisTypes: [
            { type: 'ast' as const, options: {} },
            { type: 'complexity' as const, options: {} },
            { type: 'patterns' as const, options: {} }
          ]
        };

        const startTime = performance.now();
        const result = await codeAnalysisService.analyzeCode(request);
        const endTime = performance.now();
        const duration = endTime - startTime;

        expect(result.success).toBe(true);
        expect(result.astAnalysis?.parseSuccess).toBe(true);
        expect(duration).toBeLessThan(mockPerformanceBenchmarks.astParsing.expectedMaxTime);

        console.log(`${name} AST parsing: ${duration.toFixed(2)}ms for ${code.length} characters`);
      });
    });

    it('should handle large code files efficiently', async () => {
      // Generate a large code file
      const largeCode = mockTypeScriptCode.repeat(50); // ~50KB of code
      
      const request = {
        code: largeCode,
        language: 'typescript',
        userId: 'perf-test-user',
        analysisTypes: [{ type: 'ast' as const, options: {} }]
      };

      const startTime = performance.now();
      const result = await codeAnalysisService.analyzeCode(request);
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result.success).toBe(true);
      // Large files get more time, but should still be reasonable
      expect(duration).toBeLessThan(mockPerformanceBenchmarks.astParsing.expectedMaxTime * 10);

      const throughput = largeCode.length / duration * 1000; // characters per second
      console.log(`Large file parsing: ${duration.toFixed(2)}ms for ${largeCode.length} characters`);
      console.log(`Throughput: ${throughput.toFixed(0)} characters/second`);
    });
  });

  describe('Security Scanning Performance', () => {
    it('should complete security scans within time limits', async () => {
      const vulnerableCode = `
        const express = require('express');
        const app = express();
        
        app.get('/user/:id', (req, res) => {
          const query = "SELECT * FROM users WHERE id = " + req.params.id;
          const password = crypto.createHash('md5').update(req.body.password).digest('hex');
          const apiKey = "sk-1234567890abcdef";
          
          database.query(query, (err, results) => {
            res.json(results);
          });
        });
      `;

      const request = {
        code: vulnerableCode,
        language: 'javascript',
        userId: 'perf-test-user',
        vulnerabilityThreshold: 'medium' as const,
        scanTypes: [
          { type: 'static' as const, options: {} },
          { type: 'injection' as const, options: {} },
          { type: 'secrets' as const, options: {} },
          { type: 'crypto' as const, options: {} }
        ]
      };

      const startTime = performance.now();
      const result = await securityScanningService.scanCode(request);
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result.success).toBe(true);
      expect(result.vulnerabilities.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(mockPerformanceBenchmarks.securityScan.expectedMaxTime);

      console.log(`Security scan: ${duration.toFixed(2)}ms, found ${result.vulnerabilities.length} vulnerabilities`);
    });

    it('should scale security scanning performance with code size', async () => {
      const codeSizes = [
        { name: 'Small', code: mockJavaScriptCode },
        { name: 'Medium', code: mockJavaScriptCode.repeat(5) },
        { name: 'Large', code: mockJavaScriptCode.repeat(20) }
      ];

      const results = [];

      for (const { name, code } of codeSizes) {
        const request = {
          code,
          language: 'javascript',
          userId: 'perf-test-user',
          vulnerabilityThreshold: 'medium' as const
        };

        const startTime = performance.now();
        const result = await securityScanningService.scanCode(request);
        const endTime = performance.now();
        const duration = endTime - startTime;

        results.push({
          name,
          duration,
          codeSize: code.length,
          vulnerabilities: result.vulnerabilities.length,
          throughput: code.length / duration * 1000
        });

        expect(result.success).toBe(true);
      }

      console.log('Security scanning performance scaling:');
      results.forEach(result => {
        console.log(`  ${result.name}: ${result.duration.toFixed(2)}ms for ${result.codeSize} chars (${result.throughput.toFixed(0)} chars/sec)`);
      });

      // Performance should scale sub-linearly with code size
      const smallThroughput = results[0].throughput;
      const largeThroughput = results[2].throughput;
      expect(largeThroughput).toBeGreaterThan(smallThroughput * 0.3); // Should maintain at least 30% of throughput
    });
  });

  describe('Quality Assessment Performance', () => {
    it('should complete quality assessments within time limits', async () => {
      const request = {
        code: mockTypeScriptCode,
        language: 'typescript',
        filePath: 'test.ts',
        userId: 'perf-test-user'
      };

      const startTime = performance.now();
      const result = await codeQualityService.assessQuality(request);
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result.success).toBe(true);
      expect(result.qualityScores.overall).toBeGreaterThan(0);
      expect(duration).toBeLessThan(mockPerformanceBenchmarks.qualityAssessment.expectedMaxTime);

      console.log(`Quality assessment: ${duration.toFixed(2)}ms, overall score: ${result.qualityScores.overall.toFixed(2)}`);
    });

    it('should handle concurrent quality assessments efficiently', async () => {
      const concurrentRequests = Array.from({ length: 5 }, (_, i) => ({
        code: mockTypeScriptCode + `\n// Test variation ${i}`,
        language: 'typescript',
        filePath: `test-${i}.ts`,
        userId: 'perf-test-user'
      }));

      const startTime = performance.now();
      const results = await Promise.all(
        concurrentRequests.map(req => codeQualityService.assessQuality(req))
      );
      const endTime = performance.now();
      const totalDuration = endTime - startTime;
      const averageDuration = totalDuration / concurrentRequests.length;

      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      expect(averageDuration).toBeLessThan(mockPerformanceBenchmarks.qualityAssessment.acceptableTime);

      console.log(`Concurrent quality assessments:`);
      console.log(`  Total: ${totalDuration.toFixed(2)}ms`);
      console.log(`  Average: ${averageDuration.toFixed(2)}ms`);
    });
  });

  describe('Memory and Resource Usage', () => {
    it('should maintain reasonable memory usage during generation', async () => {
      const initialMemory = process.memoryUsage();
      
      // Generate multiple code samples
      const requests = Array.from({ length: 20 }, (_, i) => 
        generateMockGenerationRequest({
          prompt: `Generate large function ${i} with comprehensive implementation`,
          maxTokens: 2000,
          sessionId: `memory-test-${i}`
        })
      );

      for (const request of requests) {
        await autonomousCodeService.generateCode(request);
      }

      const finalMemory = process.memoryUsage();
      const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryGrowthMB = memoryGrowth / (1024 * 1024);

      console.log(`Memory usage:`);
      console.log(`  Initial: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  Final: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  Growth: ${memoryGrowthMB.toFixed(2)} MB`);

      // Memory growth should be reasonable (less than 100MB for 20 generations)
      expect(memoryGrowthMB).toBeLessThan(100);
    });

    it('should clean up resources properly', async () => {
      const cacheStatsBefore = autonomousCodeService.getCacheStats();
      
      // Generate some code to populate cache
      await autonomousCodeService.generateCode(generateMockGenerationRequest());
      await autonomousCodeService.generateCode(generateMockGenerationRequest());
      
      const cacheStatsAfter = autonomousCodeService.getCacheStats();
      
      // Clear cache
      autonomousCodeService.clearCache();
      
      const cacheStatsCleared = autonomousCodeService.getCacheStats();

      expect(cacheStatsAfter.totalEntries).toBeGreaterThan(cacheStatsBefore.totalEntries);
      expect(cacheStatsCleared.totalEntries).toBe(0);

      console.log(`Cache management:`);
      console.log(`  Before: ${cacheStatsBefore.totalEntries} entries`);
      console.log(`  After: ${cacheStatsAfter.totalEntries} entries`);
      console.log(`  Cleared: ${cacheStatsCleared.totalEntries} entries`);
    });
  });

  describe('Performance Regression Detection', () => {
    it('should detect performance regressions in code generation', async () => {
      const baselineRequest = generateMockGenerationRequest({
        prompt: 'Standard baseline generation test',
        language: 'typescript'
      });

      // Run baseline multiple times to get average
      const baselineTimes = [];
      for (let i = 0; i < 5; i++) {
        const startTime = performance.now();
        await autonomousCodeService.generateCode(baselineRequest);
        const endTime = performance.now();
        baselineTimes.push(endTime - startTime);
      }

      const baselineAverage = baselineTimes.reduce((a, b) => a + b, 0) / baselineTimes.length;
      const baselineStdDev = Math.sqrt(
        baselineTimes.reduce((sq, n) => sq + Math.pow(n - baselineAverage, 2), 0) / baselineTimes.length
      );

      console.log(`Performance baseline:`);
      console.log(`  Average: ${baselineAverage.toFixed(2)}ms`);
      console.log(`  Std Dev: ${baselineStdDev.toFixed(2)}ms`);
      console.log(`  Times: ${baselineTimes.map(t => t.toFixed(2)).join(', ')}ms`);

      // Define acceptable performance range (within 2 standard deviations)
      const acceptableRange = {
        min: baselineAverage - (2 * baselineStdDev),
        max: baselineAverage + (2 * baselineStdDev)
      };

      // Test current performance
      const testStartTime = performance.now();
      const testResult = await autonomousCodeService.generateCode(baselineRequest);
      const testEndTime = performance.now();
      const testDuration = testEndTime - testStartTime;

      expect(testResult.success).toBe(true);
      expect(testDuration).toBeGreaterThan(acceptableRange.min);
      expect(testDuration).toBeLessThan(acceptableRange.max);

      console.log(`Current performance: ${testDuration.toFixed(2)}ms (acceptable range: ${acceptableRange.min.toFixed(2)}-${acceptableRange.max.toFixed(2)}ms)`);
    });
  });

  describe('Performance Monitoring and Metrics', () => {
    it('should provide detailed performance metrics', async () => {
      const request = generateMockGenerationRequest({
        prompt: 'Generate metrics test function',
        language: 'typescript',
        enableSecurityValidation: true,
        enableQualityValidation: true
      });

      const result = await autonomousCodeService.generateCode(request);

      expect(result.success).toBe(true);
      expect(result.generationTimeMs).toBeGreaterThan(0);
      expect(result.validationTimeMs).toBeGreaterThan(0);
      expect(result.totalTokensUsed).toBeGreaterThan(0);
      expect(result.contextTokens).toBeGreaterThan(0);

      console.log(`Performance metrics:`);
      console.log(`  Generation time: ${result.generationTimeMs}ms`);
      console.log(`  Validation time: ${result.validationTimeMs}ms`);
      console.log(`  Total tokens: ${result.totalTokensUsed}`);
      console.log(`  Context tokens: ${result.contextTokens}`);
      console.log(`  Confidence score: ${result.confidenceScore}`);
    });

    it('should track cache performance', async () => {
      // Clear cache first
      autonomousCodeService.clearCache();
      
      const request = generateMockGenerationRequest({
        prompt: 'Cache performance test',
        language: 'typescript'
      });

      // First request (cache miss)
      const firstStartTime = performance.now();
      await autonomousCodeService.generateCode(request);
      const firstEndTime = performance.now();
      const firstDuration = firstEndTime - firstStartTime;

      // Second identical request (potential cache hit)
      const secondStartTime = performance.now();
      await autonomousCodeService.generateCode(request);
      const secondEndTime = performance.now();
      const secondDuration = secondEndTime - secondStartTime;

      const cacheStats = autonomousCodeService.getCacheStats();

      console.log(`Cache performance:`);
      console.log(`  First request: ${firstDuration.toFixed(2)}ms`);
      console.log(`  Second request: ${secondDuration.toFixed(2)}ms`);
      console.log(`  Cache stats: ${JSON.stringify(cacheStats, null, 2)}`);

      expect(cacheStats.totalEntries).toBeGreaterThan(0);
    });
  });
});