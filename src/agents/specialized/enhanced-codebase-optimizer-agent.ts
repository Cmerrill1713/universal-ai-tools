/**
 * Enhanced Codebase Optimizer Agent
 * 
 * An intelligent agent wrapper that integrates the CodebaseOptimizerAgent
 * with the Universal AI Tools platform for comprehensive codebase analysis
 * and optimization through the agent system.
 */

import type { AgentCapability,AgentConfig, AgentContext, AgentResponse } from '@/types';
import { log, LogContext } from '@/utils/logger';

import { 
  type CodeAnalysis,
  codebaseOptimizerAgent, 
  type OptimizationResult,
  type OptimizationSuggestion 
} from '../codebase-optimizer-agent';
import { EnhancedBaseAgent } from '../enhanced-base-agent';

interface CodebaseOptimizationContext extends AgentContext {
  basePath?: string;
  options?: {
    autoFix?: boolean;
    includeTests?: boolean;
    performanceOnly?: boolean;
    dryRun?: boolean;
  };
  targetPath?: string;
  filePatterns?: string[];
  excludePatterns?: string[];
}

interface CodebaseOptimizationResponse extends AgentResponse {
  data: {
    result: OptimizationResult;
    analyses?: CodeAnalysis[];
    suggestions?: OptimizationSuggestion[];
    executionTime?: number;
    recommendations?: string[];
  };
}

export class EnhancedCodebaseOptimizerAgent extends EnhancedBaseAgent {
  private agentCapabilities: AgentCapability[];

  constructor(config: AgentConfig) {
    super(config);
    this.agentCapabilities = [
      {
        name: 'codebase_analysis',
        description: 'Comprehensive codebase analysis and quality assessment',
        inputSchema: {
          type: 'object',
          properties: {
            basePath: { type: 'string' },
            includeTests: { type: 'boolean' },
            performanceOnly: { type: 'boolean' }
          }
        },
        outputSchema: {
          type: 'object',
          properties: {
            result: { type: 'object' },
            analyses: { type: 'array' },
            suggestions: { type: 'array' }
          }
        }
      },
      {
        name: 'code_optimization',
        description: 'Automated code optimization and refactoring suggestions',
        inputSchema: {
          type: 'object',
          properties: {
            basePath: { type: 'string' },
            autoFix: { type: 'boolean' },
            dryRun: { type: 'boolean' }
          }
        },
        outputSchema: {
          type: 'object',
          properties: {
            result: { type: 'object' },
            fixesApplied: { type: 'number' },
            recommendations: { type: 'array' }
          }
        }
      },
      {
        name: 'performance_analysis',
        description: 'Performance bottleneck detection and optimization',
        inputSchema: {
          type: 'object',
          properties: {
            basePath: { type: 'string' },
            performanceOnly: { type: 'boolean' }
          }
        },
        outputSchema: {
          type: 'object',
          properties: {
            performanceIssues: { type: 'array' },
            recommendations: { type: 'array' },
            codeQualityScore: { type: 'number' }
          }
        }
      },
      {
        name: 'security_analysis',
        description: 'Security vulnerability detection and remediation',
        inputSchema: {
          type: 'object',
          properties: {
            basePath: { type: 'string' }
          }
        },
        outputSchema: {
          type: 'object',
          properties: {
            securityIssues: { type: 'array' },
            recommendations: { type: 'array' },
            severity: { type: 'string' }
          }
        }
      }
    ];
  }

  public async initialize(): Promise<void> {
    await super.initialize();
    log.info('Enhanced Codebase Optimizer Agent initialized', LogContext.AGENT, {
      capabilities: this.agentCapabilities.map(c => c.name)
    });
  }

  public getCapabilities(): string[] {
    return this.agentCapabilities.map(cap => cap.name);
  }

  protected buildSystemPrompt(): string {
    return `You are an advanced codebase optimizer agent specializing in comprehensive code analysis, optimization, and quality improvement.

Your capabilities include:
- Comprehensive codebase analysis and quality assessment
- Automated code optimization and refactoring suggestions
- Performance bottleneck detection and optimization
- Security vulnerability detection and remediation
- Code quality metrics and technical debt assessment

You analyze codebases systematically, identify improvement opportunities, and provide actionable recommendations for better code quality, performance, and security.`;
  }

  protected getInternalModelName(): string {
    return 'codebase-optimizer-v1';
  }

  protected async executeCore(context: CodebaseOptimizationContext): Promise<CodebaseOptimizationResponse> {
    const startTime = Date.now();
    
    log.info('🔧 Starting codebase optimization', LogContext.AGENT, {
      userRequest: context.userRequest,
      basePath: context.basePath,
      options: context.options
    });

    try {
      // Default to current working directory if no path specified
      const basePath = context.basePath || context.workingDirectory || process.cwd();
      
      // Execute the codebase optimization
      const result = await codebaseOptimizerAgent.optimizeCodebase(basePath, context.options);
      
      const executionTime = Date.now() - startTime;
      
      // Generate high-level recommendations based on results
      const recommendations = this.generateRecommendations(result);
      
      log.info('✅ Codebase optimization completed', LogContext.AGENT, {
        executionTime: `${executionTime}ms`,
        issuesFound: result.issuesFound,
        suggestionsGenerated: result.suggestionsGenerated,
        codeQualityScore: result.codeQualityScore
      });

      return {
        success: true,
        data: {
          result,
          executionTime,
          recommendations
        },
        confidence: this.calculateConfidence(result),
        message: `Analyzed ${result.analyzedFiles} files and found ${result.issuesFound} issues with ${result.suggestionsGenerated} optimization suggestions`,
        reasoning: `Code quality score: ${result.codeQualityScore}/100. ` +
                  `Found ${result.performanceImprovements.length} performance improvements and ` +
                  `${result.securityImprovements.length} security improvements.`,
        metadata: {
          executionTime,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      log.error('❌ Codebase optimization failed', LogContext.AGENT, {
        error: error instanceof Error ? error.message : String(error),
        executionTime: `${executionTime}ms`
      });

      return {
        success: false,
        data: {
          result: {
            totalFiles: 0,
            analyzedFiles: 0,
            issuesFound: 0,
            suggestionsGenerated: 0,
            autoFixesApplied: 0,
            performanceImprovements: [],
            securityImprovements: [],
            codeQualityScore: 0
          },
          executionTime,
          recommendations: ['Failed to analyze codebase - check logs for details']
        },
        confidence: 0,
        message: 'Codebase optimization failed',
        reasoning: `Error occurred during analysis: ${error instanceof Error ? error.message : String(error)}`,
        metadata: {
          executionTime,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Generate high-level recommendations based on optimization results
   */
  private generateRecommendations(result: OptimizationResult): string[] {
    const recommendations: string[] = [];

    // Code quality recommendations
    if (result.codeQualityScore < 60) {
      recommendations.push('🚨 Code quality is below acceptable levels. Consider prioritizing refactoring efforts.');
    } else if (result.codeQualityScore < 80) {
      recommendations.push('⚠️ Code quality has room for improvement. Focus on addressing high-priority issues.');
    } else {
      recommendations.push('✅ Code quality is good. Continue maintaining best practices.');
    }

    // Performance recommendations
    if (result.performanceImprovements.length > 10) {
      recommendations.push('🏃‍♂️ Multiple performance improvements identified. Consider implementing async/await patterns and optimizing loops.');
    } else if (result.performanceImprovements.length > 5) {
      recommendations.push('⚡ Several performance optimizations available. Review and implement high-impact changes.');
    }

    // Security recommendations
    if (result.securityImprovements.length > 0) {
      recommendations.push('🔒 Security vulnerabilities detected. Address critical and high-severity issues immediately.');
    }

    // Issues density
    const issuesDensity = result.analyzedFiles > 0 ? result.issuesFound / result.analyzedFiles : 0;
    if (issuesDensity > 5) {
      recommendations.push('🧹 High issue density detected. Consider implementing stricter linting and code review processes.');
    }

    // Auto-fixes
    if (result.autoFixesApplied > 0) {
      recommendations.push(`🔧 ${result.autoFixesApplied} automatic fixes were applied. Review changes before committing.`);
    }

    // General recommendations
    if (result.suggestionsGenerated > 20) {
      recommendations.push('📋 Many optimization opportunities identified. Consider creating a technical debt backlog.');
    }

    return recommendations;
  }

  /**
   * Calculate confidence score based on results
   */
  protected calculateConfidence(result: OptimizationResult): number {
    let confidence = 0.5; // Base confidence

    // Increase confidence based on files analyzed
    if (result.analyzedFiles > 10) confidence += 0.2;
    if (result.analyzedFiles > 50) confidence += 0.1;

    // Increase confidence based on suggestions generated
    if (result.suggestionsGenerated > 5) confidence += 0.1;
    if (result.suggestionsGenerated > 20) confidence += 0.1;

    // Increase confidence based on code quality score
    confidence += (result.codeQualityScore / 100) * 0.1;

    return Math.min(1.0, Math.max(0.1, confidence));
  }

  /**
   * Handle specific optimization requests (performance, security, etc.)
   */
  public async optimizeForPerformance(context: CodebaseOptimizationContext): Promise<CodebaseOptimizationResponse> {
    const performanceContext = {
      ...context,
      options: {
        ...context.options,
        performanceOnly: true,
        includeTests: false
      },
      userRequest: context.userRequest || 'Optimize codebase for performance'
    };

    return this.executeCore(performanceContext);
  }

  public async analyzeSecurity(context: CodebaseOptimizationContext): Promise<CodebaseOptimizationResponse> {
    const securityContext = {
      ...context,
      options: {
        ...context.options,
        performanceOnly: false,
        includeTests: true,
        dryRun: true
      },
      userRequest: context.userRequest || 'Analyze codebase for security vulnerabilities'
    };

    return this.executeCore(securityContext);
  }

  public async shutdown(): Promise<void> {
    log.info('Shutting down Enhanced Codebase Optimizer Agent', LogContext.AGENT);
    await super.shutdown();
  }
}