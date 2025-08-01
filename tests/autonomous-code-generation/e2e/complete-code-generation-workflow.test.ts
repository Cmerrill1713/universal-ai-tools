/**
 * End-to-End Code Generation Workflow Tests
 * Tests the complete autonomous code generation system through API endpoints
 */

import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { Server } from 'http';
import { setupTestEnvironment, teardownTestEnvironment } from '../fixtures/test-environment';
import { generateMockGenerationRequest, mockTypeScriptCode, mockJavaScriptCode } from '../fixtures/test-data';

describe('Complete Code Generation Workflow E2E Tests', () => {
  let app: express.Application;
  let server: Server;
  let testApiKey: string;
  let testUserId: string;

  // Extend timeout for E2E tests
  jest.setTimeout(60000);

  beforeAll(async () => {
    // Setup test environment with database, Redis, and services
    const testEnv = await setupTestEnvironment();
    app = testEnv.app;
    server = testEnv.server;
    testApiKey = testEnv.apiKey;
    testUserId = testEnv.userId;
  });

  afterAll(async () => {
    await teardownTestEnvironment(server);
  });

  describe('POST /api/v1/code-generation/generate', () => {
    it('should generate TypeScript code with comprehensive validation', async () => {
      const generationRequest = {
        prompt: 'Create a secure TypeScript class for managing user authentication with JWT tokens',
        language: 'typescript',
        generationType: 'full-implementation',
        repositoryContext: {
          framework: 'express',
          patterns: ['mvc', 'dependency-injection'],
          dependencies: ['express', 'jsonwebtoken', 'bcrypt']
        },
        securityRequirements: {
          vulnerabilityThreshold: 'low',
          requiredScans: ['static', 'secrets', 'injection'],
          complianceStandards: ['owasp']
        },
        qualityStandards: {
          minComplexityScore: 0.7,
          minMaintainabilityScore: 0.8,
          requiredTestCoverage: 85,
          documentationRequired: true
        },
        enableSecurityValidation: true,
        enableQualityValidation: true,
        enablePerformanceValidation: true,
        maxTokens: 4000,
        temperature: 0.3
      };

      const response = await request(app)
        .post('/api/v1/code-generation/generate')
        .set('Authorization', `Bearer ${testApiKey}`)
        .set('X-Session-Id', 'e2e-test-session-1')
        .send(generationRequest)
        .expect(200);

      // Verify response structure
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();

      const { data } = response.body;

      // Verify generation metadata
      expect(data.generationId).toBeDefined();
      expect(data.generatedCode).toBeDefined();
      expect(data.language).toBe('typescript');
      expect(data.generationType).toBe('full-implementation');

      // Verify model information
      expect(data.model).toBeDefined();
      expect(data.model.name).toBeDefined();
      expect(data.model.confidence).toBeGreaterThan(0);

      // Verify validation results
      expect(data.validation).toBeDefined();
      expect(data.validation.security).toBeDefined();
      expect(data.validation.quality).toBeDefined();
      expect(data.validation.performance).toBeDefined();

      // Verify security validation
      expect(data.validation.security.passed).toBe(true);
      expect(data.validation.security.score).toBeGreaterThan(0.7);
      expect(data.validation.security.vulnerabilities).toBe(0);

      // Verify quality validation
      expect(data.validation.quality.passed).toBe(true);
      expect(data.validation.quality.score).toBeGreaterThan(0.8);
      expect(data.validation.quality.maintainability).toBeGreaterThan(0.8);

      // Verify code analysis
      expect(data.analysis).toBeDefined();
      expect(data.analysis.patterns).toBeGreaterThan(0);
      expect(data.analysis.complexity).toBeDefined();

      // Verify improvements and alternatives
      expect(data.improvements).toBeDefined();
      expect(Array.isArray(data.improvements)).toBe(true);
      expect(data.alternatives).toBeDefined();
      expect(Array.isArray(data.alternatives)).toBe(true);

      // Verify metadata
      expect(data.metadata).toBeDefined();
      expect(data.metadata.generationTimeMs).toBeGreaterThan(0);
      expect(data.metadata.overallQualityScore).toBeGreaterThan(0.7);
      expect(data.metadata.confidenceScore).toBeGreaterThan(0.7);

      // Verify generated code quality
      expect(data.generatedCode).toContain('class');
      expect(data.generatedCode).toContain('jwt');
      expect(data.generatedCode).toContain('async');
      expect(data.generatedCode.length).toBeGreaterThan(500);
    }, 30000);

    it('should handle JavaScript code generation with security focus', async () => {
      const generationRequest = {
        prompt: 'Create a JavaScript middleware for API rate limiting with Redis backend',
        language: 'javascript',
        generationType: 'completion',
        repositoryContext: {
          framework: 'express',
          dependencies: ['express', 'redis', 'express-rate-limit']
        },
        securityRequirements: {
          vulnerabilityThreshold: 'zero-tolerance',
          requiredScans: ['static', 'injection', 'dos'],
          complianceStandards: ['owasp']
        },
        enableSecurityValidation: true,
        enableQualityValidation: true,
        maxTokens: 2000
      };

      const response = await request(app)
        .post('/api/v1/code-generation/generate')
        .set('Authorization', `Bearer ${testApiKey}`)
        .set('X-Session-Id', 'e2e-test-session-2')
        .send(generationRequest)
        .expect(200);

      const { data } = response.body;

      expect(data.generatedCode).toContain('middleware');
      expect(data.generatedCode).toContain('redis');
      expect(data.generatedCode).toContain('rate');
      expect(data.validation.security.passed).toBe(true);
    }, 25000);

    it('should handle multi-agent orchestration for complex requests', async () => {
      const complexRequest = {
        prompt: 'Design and implement a complete microservice architecture with event sourcing, CQRS pattern, and comprehensive error handling',
        language: 'typescript',
        generationType: 'full-implementation',
        repositoryContext: {
          framework: 'nestjs',
          patterns: ['microservices', 'event-sourcing', 'cqrs'],
          dependencies: ['@nestjs/core', '@nestjs/microservices', 'event-store-client']
        },
        securityRequirements: {
          vulnerabilityThreshold: 'low',
          requiredScans: ['static', 'secrets', 'injection', 'auth'],
          complianceStandards: ['owasp', 'pci-dss']
        },
        qualityStandards: {
          minComplexityScore: 0.8,
          minMaintainabilityScore: 0.85,
          requiredTestCoverage: 90,
          documentationRequired: true
        },
        enableMultiAgentOrchestration: true,
        enableAbMctsCoordination: true,
        enableDspyCognitiveChains: true,
        enableSecurityValidation: true,
        enableQualityValidation: true,
        enablePerformanceValidation: true,
        maxTokens: 6000
      };

      const response = await request(app)
        .post('/api/v1/code-generation/generate')
        .set('Authorization', `Bearer ${testApiKey}`)
        .set('X-Session-Id', 'e2e-orchestration-session')
        .send(complexRequest)
        .expect(200);

      const { data } = response.body;

      // Verify orchestration was used
      expect(data.orchestrationUsed).toBe(true);
      expect(data.model.orchestrationStrategy).toBeDefined();
      expect(data.model.orchestrationStrategy).not.toBe('single-agent');

      // Verify high-quality output due to orchestration
      expect(data.metadata.overallQualityScore).toBeGreaterThan(0.85);
      expect(data.metadata.confidenceScore).toBeGreaterThan(0.8);

      // Verify complex patterns are implemented
      expect(data.generatedCode).toContain('microservice');
      expect(data.generatedCode).toContain('event');
      expect(data.generatedCode).toContain('command');
      expect(data.generatedCode).toContain('query');
      expect(data.generatedCode.length).toBeGreaterThan(2000);
    }, 45000);

    it('should handle validation failures gracefully', async () => {
      const lowQualityRequest = {
        prompt: 'quick dirty hack function',
        language: 'javascript',
        generationType: 'completion',
        qualityStandards: {
          minComplexityScore: 0.95,
          minMaintainabilityScore: 0.95,
          requiredTestCoverage: 95,
          documentationRequired: true
        },
        enableQualityValidation: true
      };

      const response = await request(app)
        .post('/api/v1/code-generation/generate')
        .set('Authorization', `Bearer ${testApiKey}`)
        .set('X-Session-Id', 'e2e-validation-failure-session')
        .send(lowQualityRequest)
        .expect(422);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Code generation failed');
      expect(response.body.details).toBeDefined();
      expect(response.body.details.errors).toBeDefined();
    });

    it('should validate input parameters', async () => {
      const invalidRequest = {
        prompt: '', // Empty prompt
        language: 'invalid-language',
        generationType: 'invalid-type'
      };

      await request(app)
        .post('/api/v1/code-generation/generate')
        .set('Authorization', `Bearer ${testApiKey}`)
        .send(invalidRequest)
        .expect(400);
    });

    it('should require authentication', async () => {
      const validRequest = generateMockGenerationRequest();

      await request(app)
        .post('/api/v1/code-generation/generate')
        .send(validRequest)
        .expect(401);
    });

    it('should respect rate limiting', async () => {
      const requests = Array.from({ length: 15 }, (_, i) => 
        request(app)
          .post('/api/v1/code-generation/generate')
          .set('Authorization', `Bearer ${testApiKey}`)
          .set('X-Session-Id', `rate-limit-session-${i}`)
          .send(generateMockGenerationRequest())
      );

      const responses = await Promise.allSettled(requests);
      
      // Some requests should be rate limited (429 status)
      const rateLimitedResponses = responses.filter(result => 
        result.status === 'fulfilled' && (result.value as any).status === 429
      );
      
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    }, 20000);
  });

  describe('POST /api/v1/code-generation/refactor', () => {
    it('should refactor existing code with improvements', async () => {
      const refactorRequest = {
        prompt: 'Refactor this code for better performance and security',
        language: 'javascript',
        generationType: 'refactoring',
        existingCode: mockJavaScriptCode,
        refactoringGoals: ['performance', 'security', 'maintainability'],
        securityRequirements: {
          vulnerabilityThreshold: 'low',
          requiredScans: ['static', 'secrets'],
          complianceStandards: ['owasp']
        },
        qualityStandards: {
          minComplexityScore: 0.8,
          minMaintainabilityScore: 0.8,
          requiredTestCoverage: 80,
          documentationRequired: true
        },
        enableSecurityValidation: true,
        enableQualityValidation: true
      };

      const response = await request(app)
        .post('/api/v1/code-generation/refactor')
        .set('Authorization', `Bearer ${testApiKey}`)
        .set('X-Session-Id', 'e2e-refactor-session')
        .send(refactorRequest)
        .expect(200);

      const { data } = response.body;

      expect(data.refactoredCode).toBeDefined();
      expect(data.refactoredCode).not.toBe(mockJavaScriptCode);
      expect(data.improvements).toBeDefined();
      expect(data.improvements.length).toBeGreaterThan(0);
      expect(data.qualityImprovement).toBeDefined();
      expect(data.qualityImprovement.improvement).toBeGreaterThan(0);
    }, 20000);
  });

  describe('POST /api/v1/code-generation/review', () => {
    it('should perform comprehensive code review', async () => {
      const reviewRequest = {
        prompt: 'Review this code for security vulnerabilities and quality issues',
        language: 'typescript',
        generationType: 'review',
        codeToReview: mockTypeScriptCode,
        reviewFocus: ['security', 'quality', 'performance'],
        enableSecurityValidation: true,
        enableQualityValidation: true,
        enablePerformanceValidation: true
      };

      const response = await request(app)
        .post('/api/v1/code-generation/review')
        .set('Authorization', `Bearer ${testApiKey}`)
        .set('X-Session-Id', 'e2e-review-session')
        .send(reviewRequest)
        .expect(200);

      const { data } = response.body;

      expect(data.reviewSummary).toBeDefined();
      expect(data.findings).toBeDefined();
      expect(data.findings.security).toBeDefined();
      expect(data.findings.quality).toBeDefined();
      expect(data.findings.performance).toBeDefined();
      expect(data.recommendations).toBeDefined();
      expect(data.scores).toBeDefined();
      expect(data.scores.overall).toBeGreaterThan(0);
    }, 20000);
  });

  describe('POST /api/v1/code-generation/analyze', () => {
    it('should perform comprehensive code analysis', async () => {
      const analysisRequest = {
        code: mockTypeScriptCode,
        language: 'typescript',
        analysisTypes: [
          { type: 'ast', options: {} },
          { type: 'complexity', options: {} },
          { type: 'patterns', options: {} },
          { type: 'security', options: {} },
          { type: 'quality', options: {} }
        ]
      };

      const response = await request(app)
        .post('/api/v1/code-generation/analyze')
        .set('Authorization', `Bearer ${testApiKey}`)
        .send(analysisRequest)
        .expect(200);

      const { data } = response.body;

      expect(data.analysisId).toBeDefined();
      expect(data.ast).toBeDefined();
      expect(data.ast.parseSuccess).toBe(true);
      expect(data.semantics).toBeDefined();
      expect(data.patterns).toBeDefined();
      expect(data.security).toBeDefined();
      expect(data.quality).toBeDefined();
      expect(data.dependencies).toBeDefined();
      expect(data.improvements).toBeDefined();
    }, 15000);
  });

  describe('POST /api/v1/code-generation/security-scan', () => {
    it('should perform comprehensive security scanning', async () => {
      const vulnerableCode = `
        const express = require('express');
        const app = express();
        
        app.get('/user/:id', (req, res) => {
          const query = "SELECT * FROM users WHERE id = " + req.params.id;
          database.query(query, (err, results) => {
            res.json(results);
          });
        });
      `;

      const scanRequest = {
        code: vulnerableCode,
        language: 'javascript',
        vulnerabilityThreshold: 'medium',
        scanTypes: [
          { type: 'static', options: {} },
          { type: 'injection', options: {} },
          { type: 'secrets', options: {} }
        ]
      };

      const response = await request(app)
        .post('/api/v1/code-generation/security-scan')
        .set('Authorization', `Bearer ${testApiKey}`)
        .send(scanRequest)
        .expect(200);

      const { data } = response.body;

      expect(data.scanId).toBeDefined();
      expect(data.security).toBeDefined();
      expect(data.security.vulnerabilities.length).toBeGreaterThan(0);
      expect(data.security.riskLevel).toBe('high');
      expect(data.security.automaticFixes).toBeDefined();
      expect(data.compliance).toBeDefined();
      expect(data.threatModel).toBeDefined();
      expect(data.riskAssessment).toBeDefined();
    }, 10000);
  });

  describe('POST /api/v1/code-generation/repository/index', () => {
    it('should index repository and extract patterns', async () => {
      const indexRequest = {
        repositoryUrl: 'https://github.com/test/sample-repo',
        repositoryPath: '/test/sample-repo',
        languages: ['typescript', 'javascript'],
        includeGitHistory: true,
        extractArchitecturalPatterns: true,
        extractCodingStyles: true,
        extractSecurityPatterns: true,
        enablePatternLearning: true,
        enableQualityScoring: true
      };

      const response = await request(app)
        .post('/api/v1/code-generation/repository/index')
        .set('Authorization', `Bearer ${testApiKey}`)
        .send(indexRequest)
        .expect(200);

      const { data } = response.body;

      expect(data.indexId).toBeDefined();
      expect(data.repository).toBeDefined();
      expect(data.repository.info).toBeDefined();
      expect(data.patterns).toBeDefined();
      expect(data.patterns.total).toBeGreaterThan(0);
      expect(data.codingStyles).toBeDefined();
      expect(data.quality).toBeDefined();
      expect(data.insights).toBeDefined();
      expect(data.recommendations).toBeDefined();
    }, 30000);
  });

  describe('GET /api/v1/code-generation/repository/patterns', () => {
    it('should retrieve repository patterns', async () => {
      const response = await request(app)
        .get('/api/v1/code-generation/repository/patterns')
        .set('Authorization', `Bearer ${testApiKey}`)
        .query({
          repositoryUrl: 'https://github.com/test/sample-repo',
          language: 'typescript',
          minQuality: 0.7,
          limit: 10
        })
        .expect(200);

      const { data } = response.body;

      expect(data.patterns).toBeDefined();
      expect(Array.isArray(data.patterns)).toBe(true);
      expect(data.metadata).toBeDefined();
      expect(data.metadata.total).toBeDefined();
    });
  });

  describe('GET /api/v1/code-generation/health', () => {
    it('should return service health status', async () => {
      const response = await request(app)
        .get('/api/v1/code-generation/health')
        .expect(200);

      const { data } = response.body;

      expect(data.status).toBe('healthy');
      expect(data.timestamp).toBeDefined();
      expect(data.services).toBeDefined();
      expect(data.services.autonomousCodeService).toBe('operational');
      expect(data.cache).toBeDefined();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle service timeouts gracefully', async () => {
      // Request that would typically take longer than timeout
      const timeoutRequest = {
        prompt: 'Generate an extremely complex enterprise-grade microservice architecture with complete implementation, comprehensive testing, full documentation, security audit, performance optimization, and deployment scripts',
        language: 'typescript',
        generationType: 'full-implementation',
        maxTokens: 8192,
        enableMultiAgentOrchestration: true,
        enableAbMctsCoordination: true,
        enableDspyCognitiveChains: true,
        enableSecurityValidation: true,
        enableQualityValidation: true,
        enablePerformanceValidation: true
      };

      const response = await request(app)
        .post('/api/v1/code-generation/generate')
        .set('Authorization', `Bearer ${testApiKey}`)
        .set('X-Session-Id', 'timeout-test-session')
        .send(timeoutRequest);

      // Should either succeed within timeout or return appropriate error
      expect([200, 408, 503]).toContain(response.status);
    }, 15000);

    it('should handle malformed requests', async () => {
      const malformedRequest = {
        prompt: null,
        language: undefined,
        generationType: 'invalid',
        invalidField: 'should be ignored'
      };

      await request(app)
        .post('/api/v1/code-generation/generate')
        .set('Authorization', `Bearer ${testApiKey}`)
        .send(malformedRequest)
        .expect(400);
    });

    it('should handle oversized requests', async () => {
      const oversizedRequest = {
        prompt: 'a'.repeat(20000), // 20KB prompt
        language: 'typescript',
        generationType: 'completion'
      };

      await request(app)
        .post('/api/v1/code-generation/generate')
        .set('Authorization', `Bearer ${testApiKey}`)
        .send(oversizedRequest)
        .expect(413); // Payload too large
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle concurrent requests efficiently', async () => {
      const concurrentRequests = Array.from({ length: 5 }, (_, i) =>
        request(app)
          .post('/api/v1/code-generation/generate')
          .set('Authorization', `Bearer ${testApiKey}`)
          .set('X-Session-Id', `concurrent-e2e-session-${i}`)
          .send({
            prompt: `Generate a simple function ${i}`,
            language: 'typescript',
            generationType: 'completion',
            enableSecurityValidation: false,
            enableQualityValidation: false,
            maxTokens: 500
          })
      );

      const startTime = Date.now();
      const responses = await Promise.all(concurrentRequests);
      const endTime = Date.now();

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(30000); // 30 seconds
    }, 35000);
  });
});