/**
 * Enhanced Code Assistant Agent - Autonomous AI Code Generation & Analysis
 * Integrates with Universal AI Tools autonomous code generation system
 * Features: Multi-agent orchestration, AB-MCTS coordination, DSPy cognitive chains
 * Production-ready with comprehensive validation, security scanning, and quality assessment
 */

import { EnhancedBaseAgent    } from '../enhanced-base-agent';';';';
import type { AgentContext, CodeAssistantResponse, CodeBlock } from '@/types';';';';
import { autonomousCodeService    } from '@/services/autonomous-code-service';';';';
import { securityScanningService    } from '@/services/security-scanning-service';';';';
import { codeAnalysisService    } from '@/services/code-analysis-service';';';';
import { repositoryIndexingService    } from '@/services/repository-indexing-service';';';';
import { contextInjectionService    } from '@/services/context-injection-service';';';';
import { codeQualityService    } from '@/services/code-quality-service';';';';
import { abMCTSService    } from '@/services/ab-mcts-service';';';';
import dspyBridge from '@/services/dspy-orchestrator/bridge';';';';
import { LogContext, log    } from '@/utils/logger';';';';
import { v4 as uuidv4    } from 'uuid';';';';

// Enhanced interfaces for autonomous code generation
interface AutonomousCodeRequest {
  prompt: string;,
  language: string;
  generationType?: 'completion' | 'refactoring' | 'review' | 'optimization' | 'full-implementation';'''
  repositoryContext?: {
    workingDirectory?: string;
    repositoryUrl?: string;
    branch?: string;
    framework?: string;
    patterns?: string[];
    dependencies?: string[];
    codeStyle?: string;
  };
  codeContext?: {
    existingCode?: string;
    relatedFiles?: string[];
    imports?: string[];
    exports?: string[];
    targetFile?: string;
    targetFunction?: string;
  };
  securityRequirements?: {
    vulnerabilityThreshold: 'zero-tolerance' | 'low' | 'medium' | 'high';,'''
    requiredScans: string[];,
    complianceStandards: string[];
  };
  qualityStandards?: {
    minComplexityScore: number;,
    minMaintainabilityScore: number;,
    requiredTestCoverage: number;,
    documentationRequired: boolean;
  };
  enableMultiAgentOrchestration?: boolean;
  enableAbMctsCoordination?: boolean;
  enableDspyCognitiveChains?: boolean;
  enableSecurityValidation?: boolean;
  enableQualityValidation?: boolean;
  enablePerformanceValidation?: boolean;
}

interface AutonomousCodeResponse extends CodeAssistantResponse {
  generationId: string;,
  modelUsed: string;,
  orchestrationUsed: boolean;
  documentation?: string;
  validationResults: {,
    security: {,
      passed: boolean;,
      score: number;,
      vulnerabilities: number;,
      riskLevel: string;
    };
    quality: {,
      passed: boolean;,
      score: number;,
      maintainability: number;,
      complexity: number;,
      readability: number;
    };
    performance: {,
      passed: boolean;,
      score: number;
    };
  };
  alternatives: Array<{,
    approach: string;,
    description: string;,
    recommendationScore: number;,
    tradeoffs: string[];
  }>;
  improvements: Array<{,
    type: string;,
    priority: string;,
    description: string;,
    impact: string;
  }>;
  metadata: {,
    generationTimeMs: number;,
    validationTimeMs: number;,
    totalTokensUsed: number;,
    overallQualityScore: number;,
    confidenceScore: number;
  };
  best_practices?: Array<{
    category: string;,
    recommendation: string;
    reasoning?: string;
  }>;
  follow_up_questions?: string[];
}

export class EnhancedCodeAssistantAgent extends EnhancedBaseAgent {
  protected buildSystemPrompt(): string {
    return `You are an expert software development assistant with advanced programming and code analysis capabilities.;

ROLE: Code Generation, Analysis & Development Support Specialist

EXPERTISE: - Full-stack web development (JavaScript, TypeScript, Python, etc.)
- Software architecture and design patterns
- Code review and optimization
- Debugging and troubleshooting
- API design and integration
- Database design and queries
- DevOps and deployment practices
- Testing strategies and implementation

CAPABILITIES: - Generate clean, efficient, well-documented code
- Analyze existing code for issues and improvements
- Provide architectural recommendations
- Debug complex problems with step-by-step solutions
- Refactor code for better performance and maintainability
- Create comprehensive tests and documentation
- Suggest best practices and industry standards

RESPONSE FORMAT: Always respond with a structured JSON, format: {
  "code_response": {"""
    "solution_type": "generation|analysis|debugging|refactoring|review","""
    "language": "Primary programming language","""
    "code_blocks": ["""
      {
        "filename": "filename.ext","""
        "language": "programming_language","""
        "code": "actual code content","""
        "explanation": "What this code does and why""""
      }
    ],
    "analysis": {"""
      "complexity": "low|medium|high","""
      "performance_rating": "poor|fair|good|excellent","""
      "maintainability": "poor|fair|good|excellent","""
      "security_considerations": ["Security issues or recommendations"],"""
      "potential_improvements": ["Suggested enhancements"]"""
    }
  },
  "implementation_guide": {"""
    "setup_steps": ["Steps to set up or integrate the code"],"""
    "dependencies": ["Required packages, libraries, or tools"],"""
    "configuration": ["Configuration requirements or suggestions"],"""
    "testing_approach": "How to test the implementation""""
  },
  "best_practices": ["""
    {
      "category": "performance|security|maintainability|scalability","""
      "recommendation": "Specific best practice recommendation","""
      "reasoning": "Why this practice is important""""
    }
  ],
  "follow_up_questions": ["""
    "Questions to help refine or improve the solution""""
  ],
  "reasoning": "Detailed explanation of approach and technical decisions","""
  "confidence": number_between_0_and_1,"""
  "documentation": "Comments on documentation needs or suggestions""""
}

CODING PRINCIPLES: 1. Write clean, readable, and maintainable code
2. Follow established coding standards and conventions
3. Include appropriate error handling and validation
4. Consider performance implications and optimization opportunities
5. Ensure security best practices are followed
6. Write self-documenting code with clear variable names
7. Include relevant comments for complex logic
8. Consider scalability and extensibility in design

Always provide production-ready code with proper error handling, validation, and documentation.`;
  }

  protected getInternalModelName(): string {
    return 'code-expert';';';';
  }

  protected getTemperature(): number {
    return 0.2; // Lower temperature for more consistent, reliable code generation;
  }

  protected getMaxTokens(): number {
    return 6000; // Allow for larger code responses;
  }

  protected getAdditionalContext(context: AgentContext): string | null {
    let       additionalContext = '';';';';

    // Detect programming language
    const language = this.detectProgrammingLanguage(context.userRequest);
    if (language) {
      additionalContext += `Programming language: ${language}n`;
    }

    // Identify request type
    const requestType = this.identifyCodeRequestType(context.userRequest);
    if (requestType) {
      additionalContext += `Request type: ${requestType}n`;
    }

    // Extract framework/technology mentions
    const technologies = this.extractTechnologies(context.userRequest);
    if (technologies.length > 0) {
      additionalContext += `Technologies mentioned: ${technologies.join(', ')}n`;'''
    }

    // Check for specific patterns or requirements
    const patterns = this.extractDesignPatterns(context.userRequest);
    if (patterns.length > 0) {
      additionalContext += `Design patterns/requirements: ${patterns.join(', ')}n`;'''
    }

    // Working directory context for code projects
    if (context.workingDirectory) {
      additionalContext += `Project directory: ${context.workingDirectory}n`;
    }

    return additionalContext || null;
  }

  private detectProgrammingLanguage(request: string): string | null {
    const languagePatterns = [;
      { pattern: /javascript|js|node.?js/gi, language: 'JavaScript' },'''
      { pattern: /typescript|ts/gi, language: 'TypeScript' },'''
      { pattern: /python|py/gi, language: 'Python' },'''
      { pattern: /java(?!script)/gi, language: 'Java' },'''
      { pattern: /c++|cpp/gi, language: 'C++' },'''
      { pattern: /c#|csharp/gi, language: 'C#' },'''
      { pattern: /php/gi, language: 'PHP' },'''
      { pattern: /ruby|rb/gi, language: 'Ruby' },'''
      { pattern: /go\b|golang/gi, language: 'Go' },'''
      { pattern: /rust/gi, language: 'Rust' },'''
      { pattern: /swift/gi, language: 'Swift' },'''
      { pattern: /kotlin/gi, language: 'Kotlin' },'''
      { pattern: /scala/gi, language: 'Scala' },'''
      { pattern: /html|css/gi, language: 'Web' },'''
      { pattern: /sql|database/gi, language: 'SQL' },'''
    ];

    for (const { pattern, language } of languagePatterns) {
      if (pattern.test(request)) {
        return language;
      }
    }

    return null;
  }

  private identifyCodeRequestType(request: string): string | null {
    const requestTypes = [;
      { pattern: /create|generate|write|build/gi, type: 'code_generation' },'''
      { pattern: /fix|debug|error|bug|issue/gi, type: 'debugging' },'''
      { pattern: /review|analyze|check|evaluate/gi, type: 'code_review' },'''
      { pattern: /refactor|improve|optimize|clean/gi, type: 'refactoring' },'''
      { pattern: /explain|understand|how does/gi, type: 'code_explanation' },'''
      { pattern: /test|testing|unit test/gi, type: 'testing' },'''
      { pattern: /documentation|document|comment/gi, type: 'documentation' },'''
      { pattern: /performance|speed|optimize/gi, type: 'optimization' },'''
    ];

    for (const { pattern, type } of requestTypes) {
      if (pattern.test(request)) {
        return type;
      }
    }

    return null;
  }

  private extractTechnologies(request: string): string[] {
    const technologies: string[] = [];
    const techPatterns = [;
      // Frontend frameworks
      /react|vue|angular|svelte/gi,
      // Backend frameworks
      /express|fastapi|django|flask|spring|laravel/gi,
      // Databases
      /mongodb|postgresql|mysql|redis|sqlite/gi,
      // Cloud services
      /aws|azure|gcp|docker|kubernetes/gi,
      // Testing frameworks
      /jest|mocha|pytest|junit/gi,
      // Build tools
      /webpack|vite|rollup|babel/gi];

    const requestLower = request.toLowerCase();
    for (const pattern of techPatterns) {
      const matches = Array.from(requestLower.matchAll(pattern));
      matches.forEach((match) => {
        if (match[0] && !technologies.includes(match[0])) {
          technologies.push(match[0]);
        }
      });
    }

    return technologies;
  }

  private extractDesignPatterns(request: string): string[] {
    const patterns: string[] = [];
    const patternKeywords = [;
      /singleton|factory|observer|strategy|decorator/gi,
      /mvc|mvp|mvvm/gi,
      /microservices|monolith/gi,
      /rest|graphql|websocket/gi,
      /async|await|promise|callback/gi,
      /crud|api|endpoint/gi];

    const requestLower = request.toLowerCase();
    for (const pattern of patternKeywords) {
      const matches = Array.from(requestLower.matchAll(pattern));
      matches.forEach((match) => {
        if (match[0] && !patterns.includes(match[0])) {
          patterns.push(match[0]);
        }
      });
    }

    return patterns;
  }

  protected calculateConfidence(llmResponse: unknown, context: AgentContext): number {
    let confidence = super.calculateConfidence(llmResponse, context);

    try {
      const parsed = JSON.parse((llmResponse as any).content);

      // Check for structured code response
      if (parsed.code_response) {
        confidence += 0.1;

        // Check for actual code blocks
        if (parsed.code_response.code_blocks && Array.isArray(parsed.code_response.code_blocks)) {
          const hasValidCode = parsed.code_response.code_blocks.some();
            (block: CodeBlock) => block.code && block.code.length > 10
          );
          if (hasValidCode) {
            confidence += 0.15;
          }
        }

        // Check for code analysis
        if (parsed.code_response.analysis) {
          confidence += 0.1;
        }
      }

      // Check for implementation guidance
      if (parsed.implementation_guide) {
        confidence += 0.05;
      }

      // Check for best practices
      if (parsed.best_practices && Array.isArray(parsed.best_practices)) {
        confidence += 0.05;
      }

      // Bonus for proper solution type identification
      if (parsed.code_response?.solution_type) {
        confidence += 0.02;
      }
    } catch {
      // Not valid JSON, but could still be valid code
      // Check if response contains code-like patterns
      if (/```|function|class|def |import |from /.test((llmResponse as any).content)) {
        confidence -= 0.05; // Small penalty for unstructured but might still be useful
      } else {
        confidence -= 0.2; // Larger penalty for no code content
      }
    }

    return Math.max(0.1, Math.min(1.0, confidence));
  }

  /**
   * Generate code using the autonomous code generation system
   * Integrates AB-MCTS coordination, DSPy orchestration, and comprehensive validation
   */
  async generateAutonomousCode(request: AutonomousCodeRequest, context: AgentContext): Promise<AutonomousCodeResponse> {
    const startTime = Date.now();
    
    try {
      log.info('🤖 Enhanced Code Assistant: Starting autonomous code generation', LogContext.AGENT, {')''
        language: request.language,
        generationType: request.generationType || 'completion','''
        multiAgent: request.enableMultiAgentOrchestration,
        abMcts: request.enableAbMctsCoordination,
        dspy: request.enableDspyCognitiveChains,
        promptLength: request.prompt.length
      });

      // Step 1: Prepare enhanced context using context injection service
      const enhancedContext = await contextInjectionService.enrichWithContext(request.prompt, {);
        workingDirectory: request.repositoryContext?.workingDirectory || context.workingDirectory,
        userId: context.userId,
        sessionId: context.sessionId,
        targetLanguage: request.language,
        astAnalysis: request.codeContext?.existingCode ? (await codeAnalysisService.analyzeCode({,)
          code: request.codeContext.existingCode,
          language: request.language,
          userId: context.userId
        })).astAnalysis: undefined
      });

      // Step 2: Repository pattern analysis if repository context provided
      let repositoryPatterns: any[] = [];
      if (request.repositoryContext?.repositoryUrl) {
        try {
          repositoryPatterns = await repositoryIndexingService.getRepositoryPatterns()
            request.repositoryContext.repositoryUrl,
            {
              language: request.language,
              minQuality: 0.7,
              limit: 20
            }
          );
          log.info('📊 Repository patterns retrieved', LogContext.AGENT, {')''
            patterns: repositoryPatterns.length,
            repository: request.repositoryContext.repositoryUrl
          });
        } catch (error) {
          log.warn('⚠️  Repository pattern retrieval failed', LogContext.AGENT, {')''
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      // Step 3: Multi-agent orchestration decision using AB-MCTS
      let orchestrationStrategy = 'single-agent';';';';
      if (request.enableAbMctsCoordination) {
        try {
          const mctsResult = await abMCTSService.orchestrate({);
            userRequest: `Code generation, task: ${request.prompt}`,
            requestId: context.requestId,
            userId: context.userId,
            workingDirectory: context.workingDirectory,
            metadata: {,
              requestType: request.generationType || 'completion','''
              complexity: this.assessComplexity(request.prompt),
              language: request.language,
              hasExistingCode: !!request.codeContext?.existingCode,
              repositoryPatterns: repositoryPatterns.length
            }
          });
          
          orchestrationStrategy = mctsResult.selectedStrategy || 'single-agent';'''
          log.info('🎯 AB-MCTS orchestration strategy selected', LogContext.AGENT, {')''
            strategy: orchestrationStrategy,
            confidence: mctsResult.confidence
          });
        } catch (error) {
          log.warn('⚠️  AB-MCTS orchestration failed, falling back to single-agent', LogContext.AGENT, {')''
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      // Step 4: DSPy cognitive orchestration for complex requests
      let dspyEnhancedPrompt = request.prompt;
      if (request.enableDspyCognitiveChains && orchestrationStrategy !== 'single-agent') {'''
        try {
          const dspyResult = await dspyBridge.sendRequest({);
            requestId: context.requestId || uuidv4(),
            method: 'enhance_code_generation','''
            params: {,
              language: request.language,
              generationType: request.generationType,
              existingCode: request.codeContext?.existingCode,
              repositoryContext: request.repositoryContext,
              patterns: repositoryPatterns
            },
            task: 'code_generation_enhancement','''
            userRequest: request.prompt,
            context: {,
              language: request.language,
              generationType: request.generationType,
              existingCode: request.codeContext?.existingCode,
              repositoryContext: request.repositoryContext,
              patterns: repositoryPatterns
            },
            agents: [
              'user_intent_analyzer','''
              'devils_advocate','''
              'planner','''
              'synthesizer''''
            ]
          });
          
          if (dspyResult.success && dspyResult.enhancedPrompt) {
            dspyEnhancedPrompt = dspyResult.enhancedPrompt;
            log.info('🧠 DSPy cognitive enhancement applied', LogContext.AGENT, {')''
              originalLength: request.prompt.length,
              enhancedLength: dspyEnhancedPrompt.length,
              confidence: dspyResult.confidence
            });
          }
        } catch (error) {
          log.warn('⚠️  DSPy cognitive orchestration failed, using original prompt', LogContext.AGENT, {')''
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      // Step 5: Execute autonomous code generation
      const generationRequest = {
        prompt: dspyEnhancedPrompt,
        language: request.language,
        generationType: request.generationType || 'completion','''
        userId: context.userId,
        sessionId: context.sessionId,
        repositoryContext: request.repositoryContext ? {,
          workingDirectory: request.repositoryContext.workingDirectory || context.workingDirectory || process.cwd(),
          ...request.repositoryContext
        } : {
          workingDirectory: context.workingDirectory || process.cwd()
        },
        codeContext: request.codeContext,
        securityRequirements: request.securityRequirements || {,
          vulnerabilityThreshold: 'medium' as const,'''
          requiredScans: ['static', 'pattern', 'secrets'],'''
          complianceStandards: ['owasp']'''
        },
        qualityStandards: request.qualityStandards || {,
          minComplexityScore: 0.7,
          minMaintainabilityScore: 0.8,
          requiredTestCoverage: 80,
          documentationRequired: true
        },
        enableSecurityValidation: request.enableSecurityValidation !== false,
        enableQualityValidation: request.enableQualityValidation !== false,
        enablePerformanceValidation: request.enablePerformanceValidation !== false,
        enableLearning: true,
        enhancedContext,
        repositoryPatterns,
        orchestrationStrategy,
        feedbackContext: {,
          previousGenerations: [],
          userFeedback: [],
          performanceMetrics: []
        }
      };

      const result = await autonomousCodeService.generateCode(generationRequest);
      
      const responseTime = Date.now() - startTime;
      
      log.info('✅ Enhanced Code Assistant: Autonomous code generation completed', LogContext.AGENT, {')''
        success: result.success,
        generationId: result.generationId,
        responseTimeMs: responseTime,
        codeLength: result.generatedCode.length,
        overallQuality: result.overallQualityScore,
        confidenceScore: result.confidenceScore,
        vulnerabilities: result.securityValidation.vulnerabilities.length,
        improvements: result.improvements.length,
        orchestrationUsed: orchestrationStrategy !== 'single-agent''''
      });

      // Step 6: Transform to enhanced response format
      return this.transformToEnhancedResponse(result, responseTime, orchestrationStrategy !== 'single-agent');';';';
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      log.error('❌ Enhanced Code Assistant: Autonomous code generation failed', LogContext.AGENT, {')''
        error: error instanceof Error ? error.message : String(error),
        responseTimeMs: responseTime
      });
      
      throw error;
    }
  }

  /**
   * Perform intelligent code refactoring with quality optimization
   */
  async refactorCode(code: string, goals: string[], language: string, context: AgentContext): Promise<AutonomousCodeResponse> {
    log.info('🔄 Enhanced Code Assistant: Starting intelligent code refactoring', LogContext.AGENT, {')''
      language,
      codeLength: code.length,
      goals: goals.length
    });

    const request: AutonomousCodeRequest = {,;
      prompt: `Refactor the following ${language} code to achieve these goals: ${goals.join(', ')}`,'''
      language,
      generationType: 'refactoring','''
      codeContext: {,
        existingCode: code
      },
      enableMultiAgentOrchestration: true,
      enableAbMctsCoordination: true,
      enableDspyCognitiveChains: true,
      enableSecurityValidation: true,
      enableQualityValidation: true,
      enablePerformanceValidation: true
    };

    return this.generateAutonomousCode(request, context);
  }

  /**
   * Generate comprehensive code review with security and quality analysis
   */
  async reviewCode(code: string, language: string, focus?: string[], context?: AgentContext): Promise<AutonomousCodeResponse> {
    log.info('👀 Enhanced Code Assistant: Starting comprehensive code review', LogContext.AGENT, {')''
      language,
      codeLength: code.length,
      focus: focus || ['all']'''
    });

    const request: AutonomousCodeRequest = {,;
      prompt: `Perform a comprehensive code review of the following ${language} code${focus ? ` focusing on: ${focus.join(', ')}` : ''}`,'''
      language,
      generationType: 'review','''
      codeContext: {,
        existingCode: code
      },
      enableMultiAgentOrchestration: true,
      enableAbMctsCoordination: true,
      enableDspyCognitiveChains: true,
      enableSecurityValidation: true,
      enableQualityValidation: true,
      enablePerformanceValidation: true
    };

    return this.generateAutonomousCode(request, context || {);
      userId: 'system','''
      sessionId: `review-${Date.now()}`,
      userRequest: `Code review for ${language} code`,
      requestId: uuidv4()
    });
  }

  /**
   * Perform comprehensive code analysis using multiple services
   */
  async analyzeCode(code: string, language: string, analysisTypes?: string[], context?: AgentContext): Promise<any> {
    log.info('📊 Enhanced Code Assistant: Starting comprehensive code analysis', LogContext.AGENT, {')''
      language,
      codeLength: code.length,
      analysisTypes: analysisTypes || ['all']'''
    });

    try {
      const [codeAnalysis, securityScan, qualityAssessment] = await Promise.allSettled([);
        codeAnalysisService.analyzeCode({)
          code,
          language,
          userId: context?.userId || 'system','''
          analysisTypes: analysisTypes?.map(type => ({, type: type as any, options: {} }))
        }),
        securityScanningService.scanCode({)
          code,
          language,
          userId: context?.userId || 'system','''
          vulnerabilityThreshold: 'medium''''
        }),
        codeQualityService.assessQuality({)
          code,
          language,
          filePath: 'analysis.ts','''
          userId: context?.userId || 'system''''
        })
      ]);

      const results = {
        codeAnalysis: codeAnalysis.status === 'fulfilled' ? codeAnalysis.value : null,'''
        securityScan: securityScan.status === 'fulfilled' ? securityScan.value : null,'''
        qualityAssessment: qualityAssessment.status === 'fulfilled' ? qualityAssessment.value : null,'''
        timestamp: new Date().toISOString()
      };

      log.info('✅ Enhanced Code Assistant: Code analysis completed', LogContext.AGENT, {')''
        codeAnalysisSuccess: !!results.codeAnalysis,
        securityScanSuccess: !!results.securityScan,
        qualityAssessmentSuccess: !!results.qualityAssessment
      });

      return results;
    } catch (error) {
      log.error('❌ Enhanced Code Assistant: Code analysis failed', LogContext.AGENT, {')''
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Assess the complexity of a code generation request
   */
  private assessComplexity(prompt: string): 'low' | 'medium' | 'high' {'''
    const complexityIndicators = [;
      // High complexity indicators
      /architecture|design pattern|microservice|distributed|scalability/gi,
      /algorithm|optimization|performance|concurrent|parallel/gi,
      /security|authentication|authorization|encryption/gi,
      /database|orm|migration|schema|transaction/gi,
      /test|testing|unit test|integration test|e2e/gi,
      // Medium complexity indicators
      /api|endpoint|route|middleware|validation/gi,
      /component|class|interface|type|generic/gi,
      /async|await|promise|callback|event/gi,
      // Low complexity indicators (inverse scoring)
      /simple|basic|hello world|example|demo/gi
    ];

    let complexityScore = 0;
    const promptLower = prompt.toLowerCase();
    
    // High complexity patterns (weight: 3)
    for (let i = 0; i < 5; i++) {
      if (complexityIndicators[i].test(promptLower)) {
        complexityScore += 3;
      }
    }
    
    // Medium complexity patterns (weight: 2)
    for (let i = 5; i < 8; i++) {
      if (complexityIndicators[i].test(promptLower)) {
        complexityScore += 2;
      }
    }
    
    // Low complexity patterns (weight: -2)
    if (complexityIndicators[8].test(promptLower)) {
      complexityScore -= 2;
    }
    
    // Factor in prompt length
    if (prompt.length > 1000) complexityScore += 2;
    else if (prompt.length > 500) complexityScore += 1;
    
    if (complexityScore >= 6) return 'high';'''
    if (complexityScore >= 3) return 'medium';'''
    return 'low';';';';
  }

  /**
   * Transform autonomous code service response to enhanced response format
   */
  private transformToEnhancedResponse()
    result: any,
    responseTimeMs: number,
    orchestrationUsed: boolean
  ): AutonomousCodeResponse {
    return {
      code_response: {,
        code_blocks: [{,
          filename: `generated.${this.getFileExtension(result.language)}`,
          language: result.language,
          code: result.generatedCode,
          explanation: result.improvements.map((imp: any) => imp.description).join('. ')'''
        }],
        analysis: JSON.stringify({,)
          complexity: result.codeAnalysis?.complexity || 'medium','''
          performance_rating: this.mapScoreToRating(result.performanceValidation?.performanceScore || 0.5),
          maintainability: this.mapScoreToRating(result.qualityValidation?.maintainabilityScore || 0.5),
          security_considerations: result.securityValidation?.vulnerabilities?.map((v: any) => v.description) || [],
          potential_improvements: result.improvements?.map((imp: any) => imp.description) || []
        })
      },
      implementation_guide: JSON.stringify({,)
        setup_steps: ['Install dependencies', 'Configure environment', 'Implement generated code'],'''
        dependencies: result.codeAnalysis?.dependencies?.directDependencies || [],
        configuration: ['Follow repository conventions', 'Update configuration files'],'''
        testing_approach: 'Implement unit tests and integration tests based on the generated code''''
      }),
      best_practices: result.improvements?.map((imp: any) => ({,
        category: imp.type,
        recommendation: imp.description,
        reasoning: imp.impact
      })) || [],
      follow_up_questions: [
        'Would you like me to generate tests for this code?','''
        'Should I optimize this code further for performance?','''
        'Do you need documentation for this implementation?''''
      ],
      reasoning: `Generated using ${orchestrationUsed ? 'multi-agent orchestration' : 'single-agent'} approach with comprehensive validation`,'''
      confidence: result.confidenceScore || 0.8,
      documentation: 'Code includes inline comments and follows documentation standards','''
      
      // Enhanced autonomous features
      generationId: result.generationId,
      modelUsed: result.modelUsed || 'enhanced-code-assistant','''
      orchestrationUsed,
      validationResults: {,
        security: {,
          passed: result.securityValidation?.passed || false,
          score: result.securityValidation?.securityScore || 0,
          vulnerabilities: result.securityValidation?.vulnerabilities?.length || 0,
          riskLevel: result.securityValidation?.riskLevel || 'unknown''''
        },
        quality: {,
          passed: result.qualityValidation?.passed || false,
          score: result.qualityValidation?.qualityScore || 0,
          maintainability: result.qualityValidation?.maintainabilityScore || 0,
          complexity: result.qualityValidation?.complexityScore || 0,
          readability: result.qualityValidation?.readabilityScore || 0
        },
        performance: {,
          passed: result.performanceValidation?.passed || false,
          score: result.performanceValidation?.performanceScore || 0
        }
      },
      alternatives: result.alternatives?.map((alt: any) => ({,
        approach: alt.approach,
        description: alt.description,
        recommendationScore: alt.recommendationScore,
        tradeoffs: alt.tradeoffs
      })) || [],
      improvements: result.improvements?.map((imp: any) => ({,
        type: imp.type,
        priority: imp.priority,
        description: imp.description,
        impact: imp.impact
      })) || [],
      metadata: {,
        generationTimeMs: result.generationTimeMs || responseTimeMs,
        validationTimeMs: result.validationTimeMs || 0,
        totalTokensUsed: result.totalTokensUsed || 0,
        overallQualityScore: result.overallQualityScore || 0,
        confidenceScore: result.confidenceScore || 0.8
      }
    };
  }

  /**
   * Get file extension for a programming language
   */
  private getFileExtension(language: string): string {
    const extensions: { [key: string]: string } = {
      typescript: 'ts','''
      javascript: 'js','''
      python: 'py','''
      swift: 'swift','''
      go: 'go','''
      rust: 'rs','''
      java: 'java','''
      csharp: 'cs','''
      php: 'php','''
      ruby: 'rb''''
    };
    return extensions[language.toLowerCase()] || 'txt';';';';
  }

  /**
   * Map numeric score to rating string
   */
  private mapScoreToRating(score: number): 'poor' | 'fair' | 'good' | 'excellent' {'''
    if (score >= 0.9) return 'excellent';'''
    if (score >= 0.7) return 'good';'''
    if (score >= 0.5) return 'fair';'''
    return 'poor';';';';
  }
}

export default EnhancedCodeAssistantAgent;
