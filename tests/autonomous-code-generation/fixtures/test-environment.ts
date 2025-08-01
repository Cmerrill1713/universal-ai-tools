/**
 * Test Environment Setup and Teardown
 * Provides comprehensive test environment configuration for autonomous code generation tests
 */

import express from 'express';
import { Server } from 'http';
import { createClient } from 'redis';
import { Pool } from 'pg';
import { jest } from '@jest/globals';

// Import application and services
import { createServer } from '@/server';
import { contextInjectionService } from '@/services/context-injection-service';
import { codeAnalysisService } from '@/services/code-analysis-service';
import { securityScanningService } from '@/services/security-scanning-service';
import { codeQualityService } from '@/services/code-quality-service';
import { repositoryIndexingService } from '@/services/repository-indexing-service';
import { autonomousCodeService } from '@/services/autonomous-code-service';

import { mockTestConfig } from './test-data';

interface TestEnvironment {
  app: express.Application;
  server: Server;
  apiKey: string;
  userId: string;
  redis: any;
  database: Pool;
}

// Test database and Redis instances
let testDatabase: Pool;
let testRedis: any;
let testServer: Server;

/**
 * Setup comprehensive test environment
 */
export async function setupTestEnvironment(): Promise<TestEnvironment> {
  console.log('🔧 Setting up test environment...');

  // Setup test database
  testDatabase = new Pool({
    connectionString: mockTestConfig.database.url,
    max: mockTestConfig.database.maxConnections,
    idleTimeoutMillis: mockTestConfig.database.timeout
  });

  try {
    await testDatabase.query('SELECT 1');
    console.log('✅ Test database connected');
  } catch (error) {
    console.warn('⚠️  Test database not available, using mocks');
    // Continue with mocked database
  }

  // Setup test Redis
  testRedis = createClient({
    url: mockTestConfig.redis.url,
    socket: {
      connectTimeout: mockTestConfig.redis.timeout
    }
  });

  try {
    await testRedis.connect();
    console.log('✅ Test Redis connected');
  } catch (error) {
    console.warn('⚠️  Test Redis not available, using mocks');
    // Continue with mocked Redis
  }

  // Setup mock services for testing
  await setupMockServices();

  // Create test application
  const app = await createTestApplication();

  // Start test server
  testServer = app.listen(0); // Use random port
  const address = testServer.address();
  const port = typeof address === 'object' && address ? address.port : 3000;
  
  console.log(`🚀 Test server started on port ${port}`);

  // Generate test API key and user
  const testUserId = 'test-user-' + Date.now();
  const testApiKey = await generateTestApiKey(testUserId);

  console.log('✅ Test environment setup complete');

  return {
    app,
    server: testServer,
    apiKey: testApiKey,
    userId: testUserId,
    redis: testRedis,
    database: testDatabase
  };
}

/**
 * Teardown test environment
 */
export async function teardownTestEnvironment(server?: Server): Promise<void> {
  console.log('🧹 Tearing down test environment...');

  // Close server
  if (server || testServer) {
    const serverToClose = server || testServer;
    await new Promise<void>((resolve) => {
      serverToClose.close(() => resolve());
    });
    console.log('✅ Test server closed');
  }

  // Close Redis connection
  if (testRedis) {
    try {
      await testRedis.quit();
      console.log('✅ Test Redis disconnected');
    } catch (error) {
      console.warn('⚠️  Error closing Redis connection:', error);
    }
  }

  // Close database connection
  if (testDatabase) {
    try {
      await testDatabase.end();
      console.log('✅ Test database disconnected');
    } catch (error) {
      console.warn('⚠️  Error closing database connection:', error);
    }
  }

  // Clear service mocks
  jest.clearAllMocks();

  console.log('✅ Test environment teardown complete');
}

/**
 * Create test application with proper middleware and routes
 */
async function createTestApplication(): Promise<express.Application> {
  // For testing, we'll create a minimal express app with our routes
  const app = express();

  // Basic middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Add CORS for testing
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With, X-Session-Id');
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
    } else {
      next();
    }
  });

  // Mock authentication middleware
  app.use('/api/v1/code-generation', (req, res, next) => {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const token = auth.split(' ')[1];
    if (!token.startsWith('test-api-key-')) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Mock user context
    (req as any).user = { id: token.replace('test-api-key-', '') };
    (req as any).apiKey = { userId: token.replace('test-api-key-', '') };
    next();
  });

  // Import and use code generation routes
  const codeGenerationRouter = await import('@/routers/code-generation');
  app.use('/api/v1/code-generation', codeGenerationRouter.default);

  // Error handling middleware
  app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Test error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'test' ? error.message : undefined
    });
  });

  return app;
}

/**
 * Setup mock services for testing
 */
async function setupMockServices(): Promise<void> {
  // Mock Context Injection Service
  jest.spyOn(contextInjectionService, 'getProjectContext').mockImplementation(async (request) => {
    return {
      workingDirectory: request.workingDirectory || '/test/project',
      repositoryUrl: request.repositoryUrl || 'https://github.com/test/repo',
      userRequest: request.userRequest,
      taskType: request.taskType || 'code_generation',
      contextualInformation: {
        projectFramework: 'typescript',
        dependencies: ['express', 'jest'],
        codeStyle: 'clean',
        architecturalPatterns: ['mvc'],
        recentChanges: []
      },
      astAnalysis: request.astAnalysis,
      repositoryPatterns: request.repositoryPatterns || [],
      securityRequirements: request.securityRequirements,
      qualityStandards: request.qualityStandards
    };
  });

  // Mock Code Analysis Service
  jest.spyOn(codeAnalysisService, 'analyzeCode').mockImplementation(async (request) => {
    return {
      success: true,
      analysisId: 'analysis-' + Date.now(),
      language: request.language,
      filePath: request.filePath || 'test.ts',
      astAnalysis: {
        parseSuccess: true,
        patterns: [
          { type: 'function', name: 'testFunction', complexity: 0.3 },
          { type: 'class', name: 'TestClass', complexity: 0.6 }
        ],
        complexity: 0.5,
        qualityMetrics: {
          maintainability: 0.8,
          readability: 0.85,
          testability: 0.7
        },
        securityIssues: [],
        contextSummary: 'Simple TypeScript code with basic patterns'
      },
      semanticInsights: {
        codeStyle: 'clean',
        architecturalPatterns: ['mvc'],
        designPatterns: ['singleton'],
        frameworkUsage: ['express'],
        codeSmells: []
      },
      codePatterns: [],
      securityAssessment: {
        overallSecurityScore: 0.9,
        riskLevel: 'low',
        vulnerabilities: [],
        securityRecommendations: []
      },
      qualityMetrics: {
        overallQualityScore: 0.85,
        maintainabilityIndex: 0.8,
        readabilityScore: 0.85,
        testability: 0.7,
        performance: 0.8,
        documentation: 0.75,
        recommendations: []
      },
      dependencies: {
        directDependencies: ['express'],
        indirectDependencies: [],
        circularDependencies: [],
        unusedImports: [],
        securityRisks: [],
        updateRecommendations: []
      },
      improvements: [],
      refactoringOpportunities: [],
      analysisTimeMs: 200,
      confidenceScore: 0.9,
      cacheHit: false
    };
  });

  // Mock Security Scanning Service
  jest.spyOn(securityScanningService, 'scanCode').mockImplementation(async (request) => {
    const hasVulnerabilities = request.code.includes('eval(') || 
                              request.code.includes('innerHTML') ||
                              request.code.includes("' + ") ||
                              request.code.includes('md5');

    return {
      success: true,
      scanId: 'scan-' + Date.now(),
      language: request.language,
      overallSecurityScore: hasVulnerabilities ? 0.3 : 0.95,
      riskLevel: hasVulnerabilities ? 'high' : 'low',
      vulnerabilities: hasVulnerabilities ? [
        {
          id: 'vuln-test-1',
          type: 'injection',
          severity: 'high',
          title: 'Code Injection Vulnerability',
          description: 'Potential code injection detected',
          location: { line: 10, column: 5 },
          cweId: 'CWE-94',
          owasp: 'A03:2021',
          category: 'injection',
          evidence: 'eval() or innerHTML usage',
          fixable: true,
          exploitability: 'high',
          impact: 'high',
          confidenceLevel: 0.9
        }
      ] : [],
      automaticFixes: [],
      manualRecommendations: [],
      complianceReport: {
        overallCompliance: hasVulnerabilities ? 0.5 : 0.95,
        standards: [],
        gaps: []
      },
      threatModel: {
        threats: [],
        attackSurface: hasVulnerabilities ? 'high' : 'minimal',
        mitigations: []
      },
      riskAssessment: {
        overallRisk: hasVulnerabilities ? 'high' : 'low',
        businessImpact: hasVulnerabilities ? 'severe' : 'minimal',
        recommendations: []
      },
      scanTimeMs: 150,
      patternsScanned: 25,
      rulesApplied: 50,
      confidenceScore: 0.9
    };
  });

  // Mock Code Quality Service
  jest.spyOn(codeQualityService, 'assessQuality').mockImplementation(async (request) => {
    const codeLength = request.code.length;
    const hasComments = request.code.includes('//') || request.code.includes('/*');
    const hasTypes = request.code.includes('interface') || request.code.includes('type');
    
    const baseScore = 0.7;
    const lengthBonus = Math.min(codeLength / 1000 * 0.1, 0.1);
    const commentsBonus = hasComments ? 0.05 : 0;
    const typesBonus = hasTypes ? 0.1 : 0;
    
    const overallScore = Math.min(baseScore + lengthBonus + commentsBonus + typesBonus, 1.0);

    return {
      success: true,
      assessmentId: 'quality-' + Date.now(),
      language: request.language,
      filePath: request.filePath,
      qualityScores: {
        overall: overallScore,
        maintainability: overallScore * 0.95,
        readability: overallScore * 1.05,
        testability: overallScore * 0.9,
        performance: overallScore * 0.85,
        security: overallScore * 1.1,
        documentation: hasComments ? overallScore * 1.2 : overallScore * 0.6,
        consistency: overallScore * 0.98,
        complexity: overallScore * 0.92
      },
      benchmarkComparison: {
        industryAverage: 0.75,
        projectAverage: 0.80,
        performanceDelta: overallScore - 0.75
      },
      trends: {
        monthlyTrend: 'improving',
        weeklyChange: 0.02,
        consistencyTrend: 'stable'
      },
      recommendations: overallScore < 0.8 ? [
        {
          category: 'maintainability',
          priority: 'medium',
          description: 'Consider adding more documentation',
          impact: 'moderate',
          estimatedEffort: 'low',
          suggestedActions: ['add comments', 'improve naming']
        }
      ] : [],
      predictiveAnalysis: {
        projectedQuality: overallScore + 0.05,
        timeToTargetQuality: 3,
        riskFactors: []
      },
      assessmentTimeMs: 180,
      confidenceScore: 0.88
    };
  });

  // Mock Repository Indexing Service
  jest.spyOn(repositoryIndexingService, 'indexRepository').mockImplementation(async (request) => {
    return {
      success: true,
      indexId: 'index-' + Date.now(),
      repositoryUrl: request.repositoryUrl,
      repositoryPath: request.repositoryPath,
      repositoryInfo: {
        name: 'test-repo',
        description: 'Test repository',
        primaryLanguage: 'typescript',
        languages: request.languages || ['typescript'],
        framework: 'express',
        size: 1000000,
        contributors: 3,
        lastUpdated: new Date().toISOString()
      },
      codePatterns: [
        {
          id: 'pattern-1',
          type: 'function',
          name: 'asyncHandler',
          complexity: 0.4,
          qualityRating: 0.85,
          frequency: 10
        }
      ],
      architecturalPatterns: ['mvc', 'middleware'],
      securityPatterns: ['jwt-auth', 'input-validation'],
      performancePatterns: ['caching', 'connection-pooling'],
      testingPatterns: ['unit-tests', 'integration-tests'],
      codingStyles: [
        {
          category: 'naming',
          pattern: 'camelCase',
          consistency: 0.95,
          prevalence: 0.9,
          recommendation: 'continue using camelCase'
        }
      ],
      gitAnalysis: request.includeGitHistory ? {
        totalCommits: 150,
        totalAuthors: 3,
        averageCommitSize: 50,
        branchingStrategy: 'git-flow',
        hotspots: []
      } : null,
      commitPatterns: [],
      authorInsights: [],
      qualityMetrics: {
        overallQuality: 0.85,
        maintainabilityIndex: 0.8,
        technicalDebt: 0.2,
        testCoverage: 0.75,
        documentation: 0.7,
        consistency: 0.85,
        security: 0.9,
        performance: 0.8
      },
      learningInsights: [
        {
          category: 'patterns',
          insight: 'Repository uses consistent MVC pattern',
          confidence: 0.9,
          actionable: true,
          recommendation: 'Continue using MVC pattern for new features'
        }
      ],
      recommendations: [],
      patternsExtracted: 25,
      indexingTimeMs: 5000,
      filesProcessed: 45,
      storageUsed: 1024000
    };
  });

  jest.spyOn(repositoryIndexingService, 'getRepositoryPatterns').mockImplementation(async (repositoryUrl, options) => {
    return [
      {
        id: 'pattern-1',
        type: 'function',
        name: 'asyncHandler',
        signature: 'async (req, res, next) => {}',
        complexity: 0.4,
        qualityScore: 0.85,
        frequency: 10,
        filePath: 'src/middleware/asyncHandler.ts',
        lineStart: 1,
        lineEnd: 15,
        usageContext: 'Error handling middleware',
        relatedPatterns: ['error-handling'],
        documentation: 'Async error handling wrapper'
      }
    ];
  });

  // Mock Autonomous Code Service
  jest.spyOn(autonomousCodeService, 'generateCode').mockImplementation(async (request) => {
    const startTime = Date.now();
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 100));

    const generatedCode = generateMockCode(request.language, request.prompt);
    const hasSecurityIssues = request.prompt.toLowerCase().includes('unsafe') || 
                             request.prompt.toLowerCase().includes('hack');
    const hasQualityIssues = request.prompt.toLowerCase().includes('quick') ||
                            request.prompt.toLowerCase().includes('dirty');

    return {
      success: !hasSecurityIssues && !hasQualityIssues,
      generationId: 'gen-' + Date.now(),
      generatedCode,
      language: request.language,
      generationType: request.generationType || 'completion',
      modelUsed: 'test-model',
      modelConfidence: 0.85,
      orchestrationStrategy: request.enableAbMctsCoordination ? 'multi-agent' : 'single-agent',
      orchestrationUsed: !!request.enableAbMctsCoordination,
      generationParameters: {
        temperature: 0.3,
        maxTokens: 2000,
        topP: 0.9
      },
      securityValidation: {
        passed: !hasSecurityIssues,
        securityScore: hasSecurityIssues ? 0.3 : 0.95,
        vulnerabilities: hasSecurityIssues ? [
          {
            type: 'injection',
            severity: 'high',
            description: 'Security issue detected',
            location: { line: 5, column: 10 }
          }
        ] : [],
        riskLevel: hasSecurityIssues ? 'high' : 'low',
        automaticFixes: []
      },
      qualityValidation: {
        passed: !hasQualityIssues,
        qualityScore: hasQualityIssues ? 0.4 : 0.85,
        maintainabilityScore: hasQualityIssues ? 0.3 : 0.8,
        complexityScore: 0.7,
        readabilityScore: 0.8,
        issues: hasQualityIssues ? [
          {
            type: 'maintainability',
            severity: 'medium',
            description: 'Code quality issues detected',
            location: { line: 3, column: 5 }
          }
        ] : []
      },
      performanceValidation: {
        passed: true,
        performanceScore: 0.8,
        bottlenecks: []
      },
      codeAnalysis: {
        patterns: ['function', 'class'],
        complexity: 0.6,
        maintainability: { score: 0.8 },
        testability: { score: 0.75 }
      },
      alternatives: [
        {
          approach: 'functional',
          description: 'Use functional programming approach',
          recommendationScore: 0.7,
          tradeoffs: ['more concise', 'less familiar']
        }
      ],
      improvements: hasQualityIssues ? [
        {
          type: 'quality',
          priority: 'medium',
          description: 'Improve code structure',
          impact: 'moderate'
        }
      ] : [],
      repositoryPatternsUsed: [],
      cognitiveEnhancement: {
        dspyUsed: !!request.enableDspyCognitiveChains
      },
      learningInsights: [
        {
          category: 'generation',
          insight: 'Standard generation pattern applied',
          confidence: 0.8,
          actionable: true
        }
      ],
      overallQualityScore: hasQualityIssues ? 0.4 : 0.85,
      confidenceScore: 0.8,
      recommendationScore: 0.75,
      recommendedFeedback: 'Code generated successfully',
      generationTimeMs: Date.now() - startTime,
      validationTimeMs: 50,
      totalTokensUsed: 1500,
      contextTokens: 500
    };
  });

  // Mock refactor and review methods
  jest.spyOn(autonomousCodeService, 'refactorCode').mockImplementation(async (request) => {
    const generationResult = await autonomousCodeService.generateCode({
      ...request,
      generationType: 'refactoring'
    });
    return generationResult;
  });

  jest.spyOn(autonomousCodeService, 'reviewCode').mockImplementation(async (request) => {
    const generationResult = await autonomousCodeService.generateCode({
      ...request,
      generationType: 'review'
    });
    return generationResult;
  });

  // Mock cache methods
  jest.spyOn(autonomousCodeService, 'getCacheStats').mockImplementation(() => ({
    hits: 10,
    misses: 5,
    hitRate: 0.67,
    totalEntries: 15,
    size: '2.5MB'
  }));

  jest.spyOn(autonomousCodeService, 'clearCache').mockImplementation(() => {
    // Mock cache clearing
  });

  console.log('✅ Mock services configured');
}

/**
 * Generate test API key for authentication
 */
async function generateTestApiKey(userId: string): Promise<string> {
  return `test-api-key-${userId}`;
}

/**
 * Generate mock code based on language and prompt
 */
function generateMockCode(language: string, prompt: string): string {
  const templates = {
    typescript: `
interface User {
  id: string;
  name: string;
  email: string;
}

class UserService {
  async createUser(userData: Omit<User, 'id'>): Promise<User> {
    const user: User = {
      id: Math.random().toString(36).substring(7),
      ...userData
    };
    
    // Implementation based on: ${prompt}
    return user;
  }
}
    `.trim(),
    
    javascript: `
const express = require('express');

function createMiddleware() {
  return (req, res, next) => {
    // Implementation based on: ${prompt}
    next();
  };
}

module.exports = { createMiddleware };
    `.trim(),
    
    python: `
from typing import Dict, Any

class DataProcessor:
    def __init__(self):
        self.data = {}
    
    def process(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Implementation based on: ${prompt}
        """
        return input_data

processor = DataProcessor()
    `.trim()
  };

  return templates[language as keyof typeof templates] || `// Generated code for: ${prompt}`;
}