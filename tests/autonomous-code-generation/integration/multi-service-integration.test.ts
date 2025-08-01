/**
 * Multi-Service Integration Tests
 * Tests the interaction between all autonomous code generation services
 */

import { jest } from '@jest/globals';
import { autonomousCodeService } from '@/services/autonomous-code-service';
import { contextInjectionService } from '@/services/context-injection-service';
import { codeAnalysisService } from '@/services/code-analysis-service';
import { securityScanningService } from '@/services/security-scanning-service';
import { codeQualityService } from '@/services/code-quality-service';
import { repositoryIndexingService } from '@/services/repository-indexing-service';
import { abMCTSService } from '@/services/ab-mcts-service';
import dspyBridge from '@/services/dspy-orchestrator/bridge';

// Import test fixtures
import { 
  mockTypeScriptCode, 
  mockJavaScriptCode, 
  mockPythonCode,
  mockRepositoryStructure,
  mockSecurityVulnerabilities,
  mockQualityIssues
} from '../fixtures/test-data';

describe('Multi-Service Integration Tests', () => {
  // Test timeout for integration tests
  jest.setTimeout(30000);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Complete Code Generation Pipeline', () => {
    it('should execute full pipeline with all services integrated', async () => {
      const generationRequest = {
        prompt: 'Create a secure REST API endpoint for user authentication',
        language: 'typescript',
        generationType: 'full-implementation' as const,
        userId: 'integration-test-user',
        sessionId: 'integration-test-session',
        repositoryContext: {
          workingDirectory: '/test/project',
          repositoryUrl: 'https://github.com/test/secure-api',
          framework: 'express',
          patterns: ['mvc', 'middleware'],
          dependencies: ['express', 'bcrypt', 'jsonwebtoken']
        },
        securityRequirements: {
          vulnerabilityThreshold: 'low' as const,
          requiredScans: ['static', 'secrets', 'injection'],
          complianceStandards: ['owasp', 'pci-dss']
        },
        qualityStandards: {
          minComplexityScore: 0.7,
          minMaintainabilityScore: 0.8,
          requiredTestCoverage: 85,
          documentationRequired: true
        },
        enableMultiAgentOrchestration: true,
        enableAbMctsCoordination: true,
        enableDspyCognitiveChains: true,
        enableSecurityValidation: true,
        enableQualityValidation: true,
        enablePerformanceValidation: true
      };

      const result = await autonomousCodeService.generateCode(generationRequest);

      // Verify successful completion
      expect(result.success).toBe(true);
      expect(result.generationId).toBeDefined();
      expect(result.generatedCode).toBeDefined();
      expect(result.generatedCode.length).toBeGreaterThan(100);

      // Verify all validation results are present
      expect(result.securityValidation).toBeDefined();
      expect(result.qualityValidation).toBeDefined();
      expect(result.performanceValidation).toBeDefined();

      // Verify service orchestration
      expect(result.modelUsed).toBeDefined();
      expect(result.orchestrationStrategy).toBeDefined();
      expect(result.confidenceScore).toBeGreaterThan(0.5);

      // Verify comprehensive analysis
      expect(result.codeAnalysis).toBeDefined();
      expect(result.codeAnalysis.patterns).toBeDefined();
      expect(result.codeAnalysis.complexity).toBeDefined();

      // Verify learning insights
      expect(result.learningInsights).toBeDefined();
      expect(Array.isArray(result.learningInsights)).toBe(true);
    }, 25000);

    it('should handle context-aware generation with repository patterns', async () => {
      // First, index a repository to establish patterns
      const indexingRequest = {
        repositoryUrl: 'https://github.com/test/patterns-repo',
        repositoryPath: '/test/patterns-repo',
        languages: ['typescript'],
        includeGitHistory: true,
        extractArchitecturalPatterns: true,
        extractCodingStyles: true,
        extractSecurityPatterns: true,
        enablePatternLearning: true,
        userId: 'integration-test-user'
      };

      const indexingResult = await repositoryIndexingService.indexRepository(indexingRequest);
      expect(indexingResult.success).toBe(true);

      // Then, generate code using those patterns
      const generationRequest = {
        prompt: 'Create a new service following the established patterns',
        language: 'typescript',
        generationType: 'completion' as const,
        userId: 'integration-test-user',
        sessionId: 'context-aware-session',
        repositoryContext: {
          repositoryUrl: 'https://github.com/test/patterns-repo',
          workingDirectory: '/test/patterns-repo'
        },
        enableSecurityValidation: true,
        enableQualityValidation: true
      };

      const result = await autonomousCodeService.generateCode(generationRequest);

      expect(result.success).toBe(true);
      expect(result.repositoryPatternsUsed).toBeDefined();
      expect(result.repositoryPatternsUsed.length).toBeGreaterThan(0);
    });

    it('should integrate AB-MCTS orchestration with DSPy cognitive chains', async () => {
      const complexRequest = {
        prompt: 'Design and implement a distributed microservice architecture with event sourcing',
        language: 'typescript',
        generationType: 'full-implementation' as const,
        userId: 'integration-test-user',
        sessionId: 'orchestration-test-session',
        enableAbMctsCoordination: true,
        enableDspyCognitiveChains: true,
        enableSecurityValidation: true,
        enableQualityValidation: true
      };

      const result = await autonomousCodeService.generateCode(complexRequest);

      // Verify orchestration was used
      expect(result.orchestrationUsed).toBe(true);
      expect(result.orchestrationStrategy).toBeDefined();
      expect(result.orchestrationStrategy).not.toBe('single-agent');

      // Verify DSPy enhancement
      expect(result.cognitiveEnhancement).toBeDefined();
      expect(result.cognitiveEnhancement.dspyUsed).toBe(true);

      // Verify quality due to advanced orchestration
      expect(result.overallQualityScore).toBeGreaterThan(0.8);
      expect(result.confidenceScore).toBeGreaterThan(0.8);
    });
  });

  describe('Security-Quality Integration', () => {
    it('should detect and fix security issues while maintaining quality', async () => {
      const vulnerableCode = `
        function authenticate(username, password) {
          const query = "SELECT * FROM users WHERE username = '" + username + "' AND password = '" + password + "'";
          const result = database.query(query);
          return result.length > 0;
        }
      `;

      const refactorRequest = {
        prompt: 'Fix security vulnerabilities in this authentication function',
        language: 'javascript',
        generationType: 'refactoring' as const,
        userId: 'security-test-user',
        sessionId: 'security-quality-session',
        codeContext: {
          existingCode: vulnerableCode
        },
        securityRequirements: {
          vulnerabilityThreshold: 'zero-tolerance' as const,
          requiredScans: ['injection', 'auth', 'crypto'],
          complianceStandards: ['owasp']
        },
        qualityStandards: {
          minComplexityScore: 0.8,
          minMaintainabilityScore: 0.8,
          requiredTestCoverage: 90,
          documentationRequired: true
        },
        enableSecurityValidation: true,
        enableQualityValidation: true
      };

      const result = await autonomousCodeService.refactorCode(refactorRequest);

      // Verify security improvements
      expect(result.securityValidation.passed).toBe(true);
      expect(result.securityValidation.vulnerabilities.length).toBe(0);
      expect(result.securityValidation.automaticFixes.length).toBeGreaterThan(0);

      // Verify quality is maintained or improved
      expect(result.qualityValidation.passed).toBe(true);
      expect(result.qualityValidation.qualityScore).toBeGreaterThan(0.8);

      // Verify the code no longer contains SQL injection vulnerability
      expect(result.generatedCode).not.toContain("' + username + '");
      expect(result.generatedCode).toContain('prepared statement' || 'parameterized query' || '$1');
    });

    it('should balance security fixes with performance considerations', async () => {
      const performanceCriticalCode = `
        function processLargeDataset(data) {
          let result = [];
          for (let i = 0; i < data.length; i++) {
            // Performance-critical but potentially insecure operation
            result.push(eval('transform(' + data[i] + ')'));
          }
          return result;
        }
      `;

      const optimizationRequest = {
        prompt: 'Optimize this code for security and performance',
        language: 'javascript',
        generationType: 'optimization' as const,
        userId: 'performance-test-user',
        sessionId: 'security-performance-session',
        codeContext: {
          existingCode: performanceCriticalCode
        },
        securityRequirements: {
          vulnerabilityThreshold: 'low' as const,
          requiredScans: ['injection', 'eval'],
          complianceStandards: ['owasp']
        },
        enableSecurityValidation: true,
        enableQualityValidation: true,
        enablePerformanceValidation: true
      };

      const result = await autonomousCodeService.generateCode(optimizationRequest);

      // Verify security improvement (no eval)
      expect(result.generatedCode).not.toContain('eval(');
      expect(result.securityValidation.passed).toBe(true);

      // Verify performance considerations
      expect(result.performanceValidation.passed).toBe(true);
      expect(result.performanceValidation.performanceScore).toBeGreaterThan(0.7);

      // Verify alternatives are provided for performance trade-offs
      expect(result.alternatives.length).toBeGreaterThan(0);
      expect(result.alternatives.some(alt => alt.approach.includes('performance'))).toBe(true);
    });
  });

  describe('Multi-Language Support Integration', () => {
    const languages = [
      { lang: 'typescript', extension: 'ts', code: mockTypeScriptCode },
      { lang: 'javascript', extension: 'js', code: mockJavaScriptCode },
      { lang: 'python', extension: 'py', code: mockPythonCode }
    ];

    languages.forEach(({ lang, extension, code }) => {
      it(`should handle complete pipeline for ${lang}`, async () => {
        const request = {
          prompt: `Analyze and improve this ${lang} code`,
          language: lang,
          generationType: 'review' as const,
          userId: `${lang}-test-user`,
          sessionId: `${lang}-test-session`,
          codeContext: {
            existingCode: code,
            targetFile: `test.${extension}`
          },
          enableSecurityValidation: true,
          enableQualityValidation: true,
          enablePerformanceValidation: true
        };

        const result = await autonomousCodeService.reviewCode(request);

        expect(result.success).toBe(true);
        expect(result.language).toBe(lang);
        expect(result.codeAnalysis).toBeDefined();
        expect(result.securityValidation).toBeDefined();
        expect(result.qualityValidation).toBeDefined();

        // Language-specific validations
        if (lang === 'typescript') {
          expect(result.codeAnalysis.typeInformation).toBeDefined();
        }
        if (lang === 'python') {
          expect(result.codeAnalysis.pythonSpecific).toBeDefined();
        }
      });
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should handle partial service failures gracefully', async () => {
      // Mock security service failure
      const originalScanCode = securityScanningService.scanCode;
      securityScanningService.scanCode = jest.fn().mockRejectedValue(
        new Error('Security service temporarily unavailable')
      );

      const request = {
        prompt: 'Generate a simple function',
        language: 'typescript',
        generationType: 'completion' as const,
        userId: 'resilience-test-user',
        sessionId: 'resilience-test-session',
        enableSecurityValidation: true,
        enableQualityValidation: true
      };

      const result = await autonomousCodeService.generateCode(request);

      // Should still complete successfully with degraded functionality
      expect(result.success).toBe(true);
      expect(result.generatedCode).toBeDefined();
      
      // Should indicate security validation was not completed
      expect(result.securityValidation.warning).toBeDefined();
      expect(result.securityValidation.warning).toContain('service unavailable');

      // Quality validation should still work
      expect(result.qualityValidation.passed).toBeDefined();

      // Restore original service
      securityScanningService.scanCode = originalScanCode;
    });

    it('should handle context service failures with fallback', async () => {
      // Mock context injection service failure
      const originalGetContext = contextInjectionService.getProjectContext;
      contextInjectionService.getProjectContext = jest.fn().mockRejectedValue(
        new Error('Context service unavailable')
      );

      const request = {
        prompt: 'Generate code with context awareness',
        language: 'typescript',
        generationType: 'completion' as const,
        userId: 'fallback-test-user',
        sessionId: 'fallback-test-session',
        repositoryContext: {
          workingDirectory: '/test/fallback-project'
        }
      };

      const result = await autonomousCodeService.generateCode(request);

      // Should still complete with basic context
      expect(result.success).toBe(true);
      expect(result.generatedCode).toBeDefined();
      expect(result.contextUsed).toBe('fallback');

      // Restore original service
      contextInjectionService.getProjectContext = originalGetContext;
    });

    it('should handle cascading service failures', async () => {
      // Mock multiple service failures
      const originalServices = {
        scanCode: securityScanningService.scanCode,
        assessQuality: codeQualityService.assessQuality,
        getContext: contextInjectionService.getProjectContext
      };

      securityScanningService.scanCode = jest.fn().mockRejectedValue(new Error('Security down'));
      codeQualityService.assessQuality = jest.fn().mockRejectedValue(new Error('Quality down'));
      contextInjectionService.getProjectContext = jest.fn().mockRejectedValue(new Error('Context down'));

      const request = {
        prompt: 'Generate code despite service failures',
        language: 'typescript',
        generationType: 'completion' as const,
        userId: 'cascade-test-user',
        sessionId: 'cascade-test-session',
        enableSecurityValidation: true,
        enableQualityValidation: true
      };

      const result = await autonomousCodeService.generateCode(request);

      // Should still provide basic code generation
      expect(result).toBeDefined();
      expect(result.generatedCode).toBeDefined();
      expect(result.degradedMode).toBe(true);
      expect(result.availableServices.length).toBeLessThan(3);

      // Restore original services
      Object.assign(securityScanningService, { scanCode: originalServices.scanCode });
      Object.assign(codeQualityService, { assessQuality: originalServices.assessQuality });
      Object.assign(contextInjectionService, { getProjectContext: originalServices.getContext });
    });
  });

  describe('Performance and Concurrency', () => {
    it('should handle concurrent requests efficiently', async () => {
      const concurrentRequests = Array.from({ length: 10 }, (_, i) => ({
        prompt: `Generate function ${i}`,
        language: 'typescript',
        generationType: 'completion' as const,
        userId: `concurrent-user-${i}`,
        sessionId: `concurrent-session-${i}`,
        enableSecurityValidation: true,
        enableQualityValidation: true
      }));

      const startTime = Date.now();
      const results = await Promise.all(
        concurrentRequests.map(req => autonomousCodeService.generateCode(req))
      );
      const endTime = Date.now();

      // All requests should succeed
      expect(results).toHaveLength(10);
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.sessionId).toBe(`concurrent-session-${index}`);
      });

      // Should complete within reasonable time (less than 20 seconds for 10 concurrent)
      expect(endTime - startTime).toBeLessThan(20000);
    });

    it('should maintain service isolation under load', async () => {
      // Create requests that would stress different services
      const securityHeavyRequest = {
        prompt: 'Generate security-critical authentication system',
        language: 'typescript',
        generationType: 'full-implementation' as const,
        userId: 'load-test-security',
        sessionId: 'load-test-security-session',
        securityRequirements: {
          vulnerabilityThreshold: 'zero-tolerance' as const,
          requiredScans: ['static', 'secrets', 'injection', 'crypto', 'auth'],
          complianceStandards: ['owasp', 'pci-dss', 'hipaa']
        },
        enableSecurityValidation: true
      };

      const qualityHeavyRequest = {
        prompt: 'Generate highly optimized complex algorithm',
        language: 'typescript',
        generationType: 'optimization' as const,
        userId: 'load-test-quality',
        sessionId: 'load-test-quality-session',
        qualityStandards: {
          minComplexityScore: 0.95,
          minMaintainabilityScore: 0.95,
          requiredTestCoverage: 95,
          documentationRequired: true
        },
        enableQualityValidation: true,
        enablePerformanceValidation: true
      };

      // Run both concurrently
      const [securityResult, qualityResult] = await Promise.all([
        autonomousCodeService.generateCode(securityHeavyRequest),
        autonomousCodeService.generateCode(qualityHeavyRequest)
      ]);

      // Both should succeed despite different resource demands
      expect(securityResult.success).toBe(true);
      expect(qualityResult.success).toBe(true);

      // Verify service-specific results
      expect(securityResult.securityValidation.thoroughnessLevel).toBe('comprehensive');
      expect(qualityResult.qualityValidation.optimizationLevel).toBe('advanced');
    });
  });

  describe('Learning and Improvement Integration', () => {
    it('should capture and apply learning insights across generations', async () => {
      // First generation - establish baseline
      const initialRequest = {
        prompt: 'Create a REST API endpoint',
        language: 'typescript',
        generationType: 'completion' as const,
        userId: 'learning-test-user',
        sessionId: 'learning-session-1',
        enableLearning: true,
        enableSecurityValidation: true,
        enableQualityValidation: true
      };

      const firstResult = await autonomousCodeService.generateCode(initialRequest);
      expect(firstResult.success).toBe(true);
      expect(firstResult.learningInsights.length).toBeGreaterThan(0);

      // Second generation - should apply learning
      const improvedRequest = {
        prompt: 'Create another REST API endpoint with better patterns',
        language: 'typescript',
        generationType: 'completion' as const,
        userId: 'learning-test-user',
        sessionId: 'learning-session-2',
        enableLearning: true,
        enableSecurityValidation: true,
        enableQualityValidation: true
      };

      const secondResult = await autonomousCodeService.generateCode(improvedRequest);
      expect(secondResult.success).toBe(true);

      // Second generation should show improvement
      expect(secondResult.overallQualityScore).toBeGreaterThanOrEqual(firstResult.overallQualityScore);
      expect(secondResult.learningApplied).toBe(true);
      expect(secondResult.previousLearnings.length).toBeGreaterThan(0);
    });
  });
});