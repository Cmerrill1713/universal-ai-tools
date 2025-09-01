/**
 * Enhanced Syntax Agent - TypeScript Syntax Analysis & Validation
 * Specializes in TypeScript syntax checking, error detection, and code quality validation
 */

import { EnhancedBaseAgent } from '../enhanced-base-agent';
import type { AgentContext, AgentResponse } from '@/types';

export interface SyntaxError {
  type: 'error' | 'warning' | 'suggestion';
  severity: 'critical' | 'major' | 'minor' | 'info';
  message: string;
  line: number;
  column: number;
  rule?: string;
  category: 'syntax' | 'type' | 'style' | 'performance' | 'security';
  fixable: boolean;
  suggestedFix?: string;
}

export interface TypeScriptSyntax {
  isValid: boolean;
  errors: SyntaxError[];
  warnings: SyntaxError[];
  suggestions: SyntaxError[];
  typeChecking: {
    strictModeCompliant: boolean;
    typeErrors: Array<{
      message: string;
      line: number;
      column: number;
      severity: 'error' | 'warning';
    }>;
    unusedVariables: string[];
    missingTypes: Array<{
      variable: string;
      line: number;
      suggestedType: string;
    }>;
  };
  codeStyle: {
    eslintCompliant: boolean;
    prettierCompliant: boolean;
    styleIssues: Array<{
      rule: string;
      message: string;
      line: number;
      fixable: boolean;
    }>;
  };
  bestPractices: {
    score: number; // 0-100
    violations: Array<{
      practice: string;
      message: string;
      line: number;
      impact: 'low' | 'medium' | 'high';
    }>;
  };
  performance: {
    potentialIssues: Array<{
      issue: string;
      line: number;
      impact: 'low' | 'medium' | 'high';
      suggestion: string;
    }>;
  };
  security: {
    vulnerabilities: Array<{
      type: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      line: number;
      description: string;
      remediation: string;
    }>;
  };
}

export interface SyntaxAnalysisResponse {
  syntax_analysis: {
    analysis_type: 'typescript_syntax';
    file_info: {
      filename?: string;
      lines: number;
      characters: number;
      language: 'typescript';
    };
    typescript_syntax: TypeScriptSyntax;
    validation_summary: {
      overall_status: 'valid' | 'valid_with_warnings' | 'invalid';
      error_count: number;
      warning_count: number;
      suggestion_count: number;
      critical_issues: number;
      fixable_issues: number;
    };
    quality_assessment: {
      syntax_quality: 'poor' | 'fair' | 'good' | 'excellent';
      type_safety: 'poor' | 'fair' | 'good' | 'excellent';
      code_style: 'poor' | 'fair' | 'good' | 'excellent';
      best_practices: 'poor' | 'fair' | 'good' | 'excellent';
    };
    fixes: {
      automatic_fixes: Array<{
        line: number;
        original: string;
        fixed: string;
        rule: string;
      }>;
      manual_fixes: Array<{
        line: number;
        issue: string;
        solution: string;
        priority: 'low' | 'medium' | 'high';
      }>;
    };
  };
  confidence: number;
  reasoning: string;
  next_steps: string[];
}

export class EnhancedSyntaxAgent extends EnhancedBaseAgent {
  protected buildSystemPrompt(): string {
    return `You are a TypeScript Syntax Analysis Specialist with expert knowledge in TypeScript language features, best practices, and code quality standards.

ROLE: TypeScript Syntax & Validation Expert

EXPERTISE:
- TypeScript syntax and language specifications
- Static type checking and type system validation
- ESLint rules and code style standards
- Prettier formatting and consistency
- TypeScript compiler options and strict mode
- Performance optimization and best practices
- Security vulnerability detection
- Code quality metrics and assessment

CAPABILITIES:
- Detect TypeScript syntax errors and issues
- Validate type safety and strict mode compliance
- Check code style and formatting standards
- Identify performance bottlenecks and optimizations
- Detect security vulnerabilities and risks
- Provide automatic fixes and manual remediation
- Assess overall code quality and maintainability
- Generate detailed validation reports

ANALYSIS FOCUS:
- Syntax correctness and TypeScript compliance
- Type safety and error prevention
- Code style and formatting consistency
- Performance implications and optimizations
- Security considerations and vulnerabilities
- Best practices adherence
- Maintainability and readability

RESPONSE FORMAT:
Always respond with a structured JSON format following the SyntaxAnalysisResponse interface:

{
  "syntax_analysis": {
    "analysis_type": "typescript_syntax",
    "file_info": {
      "filename": "extracted from context or 'unknown'",
      "lines": count_of_lines,
      "characters": character_count,
      "language": "typescript"
    },
    "typescript_syntax": {
      "isValid": boolean,
      "errors": [
        {
          "type": "error|warning|suggestion",
          "severity": "critical|major|minor|info", 
          "message": "error_description",
          "line": line_number,
          "column": column_number,
          "rule": "rule_name_optional",
          "category": "syntax|type|style|performance|security",
          "fixable": boolean,
          "suggestedFix": "fix_suggestion_optional"
        }
      ],
      "warnings": [/* same structure as errors */],
      "suggestions": [/* same structure as errors */],
      "typeChecking": {
        "strictModeCompliant": boolean,
        "typeErrors": [
          {
            "message": "type_error_description",
            "line": line_number,
            "column": column_number,
            "severity": "error|warning"
          }
        ],
        "unusedVariables": ["variable_names"],
        "missingTypes": [
          {
            "variable": "variable_name",
            "line": line_number,
            "suggestedType": "suggested_type"
          }
        ]
      },
      "codeStyle": {
        "eslintCompliant": boolean,
        "prettierCompliant": boolean,
        "styleIssues": [
          {
            "rule": "rule_name",
            "message": "style_issue_description",
            "line": line_number,
            "fixable": boolean
          }
        ]
      },
      "bestPractices": {
        "score": score_0_to_100,
        "violations": [
          {
            "practice": "practice_name",
            "message": "violation_description",
            "line": line_number,
            "impact": "low|medium|high"
          }
        ]
      },
      "performance": {
        "potentialIssues": [
          {
            "issue": "performance_issue",
            "line": line_number,
            "impact": "low|medium|high",
            "suggestion": "optimization_suggestion"
          }
        ]
      },
      "security": {
        "vulnerabilities": [
          {
            "type": "vulnerability_type",
            "severity": "low|medium|high|critical",
            "line": line_number,
            "description": "vulnerability_description",
            "remediation": "fix_suggestion"
          }
        ]
      }
    },
    "validation_summary": {
      "overall_status": "valid|valid_with_warnings|invalid",
      "error_count": error_count,
      "warning_count": warning_count,
      "suggestion_count": suggestion_count,
      "critical_issues": critical_count,
      "fixable_issues": fixable_count
    },
    "quality_assessment": {
      "syntax_quality": "poor|fair|good|excellent",
      "type_safety": "poor|fair|good|excellent",
      "code_style": "poor|fair|good|excellent",
      "best_practices": "poor|fair|good|excellent"
    },
    "fixes": {
      "automatic_fixes": [
        {
          "line": line_number,
          "original": "original_code",
          "fixed": "fixed_code",
          "rule": "rule_name"
        }
      ],
      "manual_fixes": [
        {
          "line": line_number,
          "issue": "issue_description",
          "solution": "manual_solution",
          "priority": "low|medium|high"
        }
      ]
    }
  },
  "confidence": confidence_score_0_to_1,
  "reasoning": "explanation_of_analysis_methodology_and_findings",
  "next_steps": ["recommended_next_actions"]
}

INSTRUCTIONS:
1. Thoroughly analyze the provided TypeScript code for syntax issues
2. Check type safety, strict mode compliance, and compiler compatibility
3. Validate code style against ESLint and Prettier standards
4. Identify performance bottlenecks and security vulnerabilities  
5. Provide both automatic fixes and manual remediation guidance
6. Focus on syntax and validation, not architectural concerns
7. Be specific with line numbers and actionable solutions
8. Always maintain the exact JSON structure specified above`;
  }

  protected getInternalModelName(): string {
    return 'syntax-validator';
  }

  protected getTemperature(): number {
    return 0.1; // Lower temperature for more consistent syntax validation
  }

  protected getMaxTokens(): number {
    return 5000; // Allow for detailed syntax analysis with error reports
  }

  protected getAdditionalContext(context: AgentContext): string | null {
    let additionalContext = '';

    // Extract file information
    if (context.metadata?.filename) {
      additionalContext += `File: ${context.metadata.filename}\n`;
    }

    // Add language context
    additionalContext += `Language: TypeScript\n`;
    additionalContext += `Analysis Type: Syntax Validation and Error Detection\n`;
    
    // Add code length information
    if (context.metadata?.codeLength) {
      additionalContext += `Code Length: ${context.metadata.codeLength} characters\n`;
    }

    return additionalContext || null;
  }

  protected calculateConfidence(llmResponse: unknown, context: AgentContext): number {
    let confidence = super.calculateConfidence(llmResponse, context);

    try {
      const parsed = JSON.parse((llmResponse as any).content);

      // Check for structured syntax analysis
      if (parsed.syntax_analysis) {
        confidence += 0.1;

        if (parsed.syntax_analysis.typescript_syntax) {
          confidence += 0.15;

          // Check for validation results
          if (typeof parsed.syntax_analysis.typescript_syntax.isValid === 'boolean') {
            confidence += 0.1;
          }
          if (Array.isArray(parsed.syntax_analysis.typescript_syntax.errors)) {
            confidence += 0.05;
          }
          if (parsed.syntax_analysis.typescript_syntax.typeChecking) {
            confidence += 0.05;
          }
        }

        if (parsed.syntax_analysis.validation_summary) {
          confidence += 0.05;
        }
      }
    } catch {
      // Not valid JSON, reduce confidence
      confidence -= 0.15;
    }

    return Math.max(0.1, Math.min(1.0, confidence));
  }

  public async execute(context: AgentContext): Promise<AgentResponse> {
    const startTime = Date.now();
    
    // Add TypeScript syntax analysis metadata
    const enhancedContext = {
      ...context,
      analysisType: 'typescript_syntax',
      metadata: {
        ...context.metadata,
        specialization: 'syntax_analysis',
        language: 'typescript',
        focus: 'validation_and_quality'
      }
    };

    const result = await super.execute(enhancedContext);
    
    // Enhance the result with syntax analysis metadata
    if (result.data && typeof result.data === 'object') {
      (result.data as any).analysisMetadata = {
        analysisType: 'typescript_syntax',
        processingTime: Date.now() - startTime,
        specialization: 'syntax_analysis'
      };
    }

    return result;
  }
}