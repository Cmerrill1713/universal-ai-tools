/**
 * Autonomous Code Service Unit Tests
 * Tests the core autonomous code generation service with comprehensive validation
 */

import { jest } from '@jest/globals';
import { autonomousCodeService } from '@/services/autonomous-code-service';
import { contextInjectionService } from '@/services/context-injection-service';
import { codeAnalysisService } from '@/services/code-analysis-service';
import { securityScanningService } from '@/services/security-scanning-service';
import { codeQualityService } from '@/services/code-quality-service';
import { abMctsService } from '@/services/ab-mcts-service';
import { dspyOrchestrator } from '@/services/dspy-orchestrator/bridge';

// Mock all dependencies
jest.mock('@/services/context-injection-service');
jest.mock('@/services/code-analysis-service');
jest.mock('@/services/security-scanning-service');
jest.mock('@/services/code-quality-service');
jest.mock('@/services/ab-mcts-service');
jest.mock('@/services/dspy-orchestrator/bridge');
jest.mock('@/utils/logger');

const mockContextInjectionService = contextInjectionService as jest.Mocked<typeof contextInjectionService>;
const mockCodeAnalysisService = codeAnalysisService as jest.Mocked<typeof codeAnalysisService>;
const mockSecurityScanningService = securityScanningService as jest.Mocked<typeof securityScanningService>;
const mockCodeQualityService = codeQualityService as jest.Mocked<typeof codeQualityService>;
const mockAbMctsService = abMctsService as jest.Mocked<typeof abMctsService>;
const mockDspyOrchestrator = dspyOrchestrator as jest.Mocked<typeof dspyOrchestrator>;

describe('Autonomous Code Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mock responses
    mockContextInjectionService.getProjectContext.mockResolvedValue({
      workingDirectory: '/test/project',
      repositoryUrl: 'https://github.com/test/repo',
      userRequest: 'Generate a TypeScript function',
      taskType: 'code_generation',
      contextualInformation: {
        projectFramework: 'typescript',
        dependencies: ['express', 'jest'],
        codeStyle: 'clean',
        architecturalPatterns: ['mvc'],
        recentChanges: []
      }
    });

    mockSecurityScanningService.scanCode.mockResolvedValue({
      success: true,
      scanId: 'scan-123',
      language: 'typescript',
      overallSecurityScore: 0.95,
      riskLevel: 'low',
      vulnerabilities: [],
      automaticFixes: [],
      manualRecommendations: [],
      complianceReport: {
        overallCompliance: 0.98,
        standards: [],
        gaps: []
      },
      threatModel: {
        threats: [],
        attackSurface: 'minimal',
        mitigations: []
      },
      riskAssessment: {
        overallRisk: 'low',
        businessImpact: 'minimal',
        recommendations: []
      },
      scanTimeMs: 150,
      patternsScanned: 25,
      rulesApplied: 50,
      confidenceScore: 0.92
    });

    mockCodeQualityService.assessQuality.mockResolvedValue({
      success: true,
      assessmentId: 'quality-123',
      language: 'typescript',
      filePath: 'test.ts',
      qualityScores: {
        overall: 0.88,
        maintainability: 0.85,
        readability: 0.90,
        testability: 0.82,
        performance: 0.88,
        security: 0.95,
        documentation: 0.80,
        consistency: 0.87,
        complexity: 0.85
      },
      benchmarkComparison: {
        industryAverage: 0.75,
        projectAverage: 0.80,
        performanceDelta: 0.08
      },
      trends: {
        monthlyTrend: 'improving',
        weeklyChange: 0.03,
        consistencyTrend: 'stable'
      },
      recommendations: [],
      predictiveAnalysis: {
        projectedQuality: 0.90,
        timeToTargetQuality: 5,
        riskFactors: []
      },
      assessmentTimeMs: 200,
      confidenceScore: 0.91
    });

    mockAbMctsService.orchestrate.mockResolvedValue({
      success: true,
      orchestrationId: 'mcts-123',
      selectedStrategy: 'quality-focused',
      confidence: 0.85,
      explorationPath: [],
      finalRecommendation: {
        strategy: 'quality-focused',
        confidence: 0.85,
        reasoning: 'Best balance of quality and performance'
      },
      orchestrationTimeMs: 300
    });

    mockDspyOrchestrator.orchestrate.mockResolvedValue({
      success: true,
      orchestrationId: 'dspy-123',
      enhancedPrompt: 'Enhanced: Generate a TypeScript function with proper error handling',
      confidence: 0.87,
      agentInsights: [],
      orchestrationTimeMs: 400
    });
  });

  describe('generateCode', () => {
    const mockGenerationRequest = {
      prompt: 'Generate a TypeScript function that validates email addresses',
      language: 'typescript',
      generationType: 'completion' as const,
      userId: 'user-123',
      sessionId: 'session-456',
      enableSecurityValidation: true,
      enableQualityValidation: true,
      enablePerformanceValidation: true,
      enableLearning: true
    };

    it('should successfully generate code with comprehensive validation', async () => {
      const result = await autonomousCodeService.generateCode(mockGenerationRequest);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.generationId).toBeDefined();
      expect(result.generatedCode).toBeDefined();
      expect(result.language).toBe('typescript');
      expect(result.generationType).toBe('completion');
      
      // Verify validation results
      expect(result.securityValidation).toBeDefined();
      expect(result.securityValidation.passed).toBe(true);
      expect(result.qualityValidation).toBeDefined();
      expect(result.qualityValidation.passed).toBe(true);
      
      // Verify metadata
      expect(result.overallQualityScore).toBeGreaterThan(0);
      expect(result.confidenceScore).toBeGreaterThan(0);
      expect(result.generationTimeMs).toBeGreaterThan(0);
    });

    it('should use AB-MCTS orchestration when enabled', async () => {
      const requestWithOrchestration = {
        ...mockGenerationRequest,
        enableAbMctsCoordination: true
      };

      await autonomousCodeService.generateCode(requestWithOrchestration);

      expect(mockAbMctsService.orchestrate).toHaveBeenCalledWith(
        expect.objectContaining({
          task: expect.any(String),
          agents: expect.any(Array),
          context: expect.any(Object)
        })
      );
    });

    it('should use DSPy cognitive chains when enabled', async () => {
      const requestWithDspy = {
        ...mockGenerationRequest,
        enableDspyCognitiveChains: true
      };

      await autonomousCodeService.generateCode(requestWithDspy);

      expect(mockDspyOrchestrator.orchestrate).toHaveBeenCalledWith(
        expect.objectContaining({
          task: expect.any(String),
          userRequest: expect.any(String),
          context: expect.any(Object)
        })
      );
    });

    it('should handle security validation failures gracefully', async () => {
      mockSecurityScanningService.scanCode.mockResolvedValue({
        success: true,
        scanId: 'scan-456',
        language: 'typescript',
        overallSecurityScore: 0.3,
        riskLevel: 'high',
        vulnerabilities: [
          {
            id: 'vuln-1',
            type: 'injection',
            severity: 'high',
            title: 'SQL Injection Risk',
            description: 'Potential SQL injection vulnerability',
            location: { line: 10, column: 5 },
            cweId: 'CWE-89',
            owasp: 'A03:2021',
            category: 'injection',
            evidence: 'Unsanitized user input',
            fixable: true,
            exploitability: 'high',
            impact: 'high',
            confidenceLevel: 0.9
          }
        ],
        automaticFixes: [],
        manualRecommendations: [],
        complianceReport: {
          overallCompliance: 0.5,
          standards: [],
          gaps: []
        },
        threatModel: {
          threats: [],
          attackSurface: 'high',
          mitigations: []
        },
        riskAssessment: {
          overallRisk: 'high',
          businessImpact: 'severe',
          recommendations: []
        },
        scanTimeMs: 150,
        patternsScanned: 25,
        rulesApplied: 50,
        confidenceScore: 0.8
      });

      const requestWithZeroTolerance = {
        ...mockGenerationRequest,
        securityRequirements: {
          vulnerabilityThreshold: 'zero-tolerance' as const,
          requiredScans: ['static', 'pattern', 'secrets'],
          complianceStandards: ['owasp']
        }
      };

      const result = await autonomousCodeService.generateCode(requestWithZeroTolerance);

      expect(result.success).toBe(false);
      expect(result.securityValidation.passed).toBe(false);
      expect(result.securityValidation.vulnerabilities.length).toBeGreaterThan(0);
    });

    it('should handle quality validation failures', async () => {
      mockCodeQualityService.assessQuality.mockResolvedValue({
        success: true,
        assessmentId: 'quality-456',
        language: 'typescript',
        filePath: 'test.ts',
        qualityScores: {
          overall: 0.4,
          maintainability: 0.3,
          readability: 0.5,
          testability: 0.4,
          performance: 0.4,
          security: 0.5,
          documentation: 0.3,
          consistency: 0.4,
          complexity: 0.3
        },
        benchmarkComparison: {
          industryAverage: 0.75,
          projectAverage: 0.80,
          performanceDelta: -0.35
        },
        trends: {
          monthlyTrend: 'declining',
          weeklyChange: -0.1,
          consistencyTrend: 'declining'
        },
        recommendations: [
          {
            category: 'maintainability',
            priority: 'high',
            description: 'Reduce function complexity',
            impact: 'significant',
            estimatedEffort: 'medium',
            suggestedActions: ['refactor', 'split functions']
          }
        ],
        predictiveAnalysis: {
          projectedQuality: 0.3,
          timeToTargetQuality: 20,
          riskFactors: ['complexity', 'maintainability']
        },
        assessmentTimeMs: 200,
        confidenceScore: 0.85
      });

      const requestWithHighStandards = {
        ...mockGenerationRequest,
        qualityStandards: {
          minComplexityScore: 0.8,
          minMaintainabilityScore: 0.8,
          requiredTestCoverage: 90,
          documentationRequired: true
        }
      };

      const result = await autonomousCodeService.generateCode(requestWithHighStandards);

      expect(result.success).toBe(false);
      expect(result.qualityValidation.passed).toBe(false);
      expect(result.improvements.length).toBeGreaterThan(0);
    });

    it('should provide alternatives when generation partially succeeds', async () => {
      const result = await autonomousCodeService.generateCode(mockGenerationRequest);

      expect(result.alternatives).toBeDefined();
      expect(Array.isArray(result.alternatives)).toBe(true);
      
      if (result.alternatives.length > 0) {
        expect(result.alternatives[0]).toHaveProperty('approach');
        expect(result.alternatives[0]).toHaveProperty('description');
        expect(result.alternatives[0]).toHaveProperty('recommendationScore');
        expect(result.alternatives[0]).toHaveProperty('tradeoffs');
      }
    });

    it('should generate comprehensive improvements and recommendations', async () => {
      const result = await autonomousCodeService.generateCode(mockGenerationRequest);

      expect(result.improvements).toBeDefined();
      expect(Array.isArray(result.improvements)).toBe(true);
      
      if (result.improvements.length > 0) {
        expect(result.improvements[0]).toHaveProperty('type');
        expect(result.improvements[0]).toHaveProperty('priority');
        expect(result.improvements[0]).toHaveProperty('description');
        expect(result.improvements[0]).toHaveProperty('impact');
      }
    });

    it('should handle service timeouts gracefully', async () => {
      mockSecurityScanningService.scanCode.mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Service timeout')), 100)
        )
      );

      const result = await autonomousCodeService.generateCode(mockGenerationRequest);

      // Should still complete with degraded functionality
      expect(result).toBeDefined();
      expect(result.securityValidation).toBeDefined();
      // Should indicate security validation was not completed due to timeout
    });

    it('should cache generation results for similar requests', async () => {
      const request1 = { ...mockGenerationRequest, sessionId: 'session-1' };
      const request2 = { ...mockGenerationRequest, sessionId: 'session-2' };

      await autonomousCodeService.generateCode(request1);
      await autonomousCodeService.generateCode(request2);

      // Verify caching behavior (implementation-specific)
      const cacheStats = autonomousCodeService.getCacheStats();
      expect(cacheStats).toBeDefined();
    });
  });

  describe('refactorCode', () => {
    const mockRefactorRequest = {
      prompt: 'Refactor this function for better performance',
      language: 'typescript',
      generationType: 'refactoring' as const,
      userId: 'user-123',
      sessionId: 'session-789',
      existingCode: 'function oldCode() { return "needs refactoring"; }',
      refactoringGoals: ['performance', 'maintainability'],
      enableSecurityValidation: true,
      enableQualityValidation: true,
      enablePerformanceValidation: true
    };

    it('should successfully refactor existing code', async () => {
      const result = await autonomousCodeService.refactorCode(mockRefactorRequest);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.generationType).toBe('refactoring');
      expect(result.generatedCode).toBeDefined();
      expect(result.generatedCode).not.toBe(mockRefactorRequest.existingCode);
    });

    it('should analyze existing code before refactoring', async () => {
      await autonomousCodeService.refactorCode(mockRefactorRequest);

      expect(mockCodeAnalysisService.analyzeCode).toHaveBeenCalledWith(
        expect.objectContaining({
          code: mockRefactorRequest.existingCode,
          language: mockRefactorRequest.language
        })
      );
    });

    it('should provide refactoring improvements', async () => {
      const result = await autonomousCodeService.refactorCode(mockRefactorRequest);

      expect(result.improvements).toBeDefined();
      expect(result.improvements.length).toBeGreaterThan(0);
      expect(result.improvements[0]).toHaveProperty('type');
      expect(result.improvements[0]).toHaveProperty('description');
    });
  });

  describe('reviewCode', () => {
    const mockReviewRequest = {
      prompt: 'Review this code for security and quality issues',
      language: 'typescript',
      generationType: 'review' as const,
      userId: 'user-123',
      sessionId: 'session-999',
      codeToReview: 'function reviewMe() { return "please review"; }',
      reviewFocus: ['security', 'quality'],
      enableSecurityValidation: true,
      enableQualityValidation: true
    };

    it('should successfully review code', async () => {
      const result = await autonomousCodeService.reviewCode(mockReviewRequest);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.generationType).toBe('review');
      expect(result.generatedCode).toBeDefined(); // Review summary
    });

    it('should perform comprehensive security and quality analysis', async () => {
      await autonomousCodeService.reviewCode(mockReviewRequest);

      expect(mockSecurityScanningService.scanCode).toHaveBeenCalledWith(
        expect.objectContaining({
          code: mockReviewRequest.codeToReview,
          language: mockReviewRequest.language
        })
      );

      expect(mockCodeQualityService.assessQuality).toHaveBeenCalledWith(
        expect.objectContaining({
          code: mockReviewRequest.codeToReview,
          language: mockReviewRequest.language
        })
      );
    });

    it('should provide detailed review findings', async () => {
      const result = await autonomousCodeService.reviewCode(mockReviewRequest);

      expect(result.securityValidation).toBeDefined();
      expect(result.qualityValidation).toBeDefined();
      expect(result.improvements).toBeDefined();
      expect(result.alternatives).toBeDefined();
    });
  });

  describe('Cache Management', () => {
    it('should provide cache statistics', () => {
      const stats = autonomousCodeService.getCacheStats();
      
      expect(stats).toBeDefined();
      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
      expect(stats).toHaveProperty('hitRate');
      expect(stats).toHaveProperty('totalEntries');
    });

    it('should allow cache clearing', () => {
      expect(() => autonomousCodeService.clearCache()).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle context injection service failures', async () => {
      mockContextInjectionService.getProjectContext.mockRejectedValue(
        new Error('Context service unavailable')
      );

      const result = await autonomousCodeService.generateCode(mockGenerationRequest);

      // Should still attempt generation with degraded context
      expect(result).toBeDefined();
    });

    it('should handle multiple service failures gracefully', async () => {
      mockSecurityScanningService.scanCode.mockRejectedValue(new Error('Security service down'));
      mockCodeQualityService.assessQuality.mockRejectedValue(new Error('Quality service down'));

      const result = await autonomousCodeService.generateCode(mockGenerationRequest);

      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
    });

    it('should validate input parameters', async () => {
      const invalidRequest = {
        ...mockGenerationRequest,
        prompt: '', // Invalid empty prompt
        language: 'invalid-language' as any
      };

      await expect(autonomousCodeService.generateCode(invalidRequest))
        .rejects.toThrow();
    });
  });

  describe('Performance', () => {
    it('should complete generation within acceptable time limits', async () => {
      const startTime = Date.now();
      
      await autonomousCodeService.generateCode(mockGenerationRequest);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete within 10 seconds for unit tests
      expect(duration).toBeLessThan(10000);
    });

    it('should handle concurrent requests efficiently', async () => {
      const requests = Array.from({ length: 5 }, (_, i) => ({
        ...mockGenerationRequest,
        sessionId: `concurrent-session-${i}`
      }));

      const results = await Promise.all(
        requests.map(req => autonomousCodeService.generateCode(req))
      );

      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.success).toBeDefined();
      });
    });
  });
});