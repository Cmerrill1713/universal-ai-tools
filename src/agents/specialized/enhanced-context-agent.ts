/**
 * Enhanced Context Agent - TypeScript Context Analysis
 * Specializes in analyzing TypeScript project context, dependencies, and structure
 */

import { EnhancedBaseAgent } from '../enhanced-base-agent';
import type { AgentContext, AgentResponse } from '@/types';

export interface TypeScriptContext {
  imports: Array<{
    module: string;
    type: 'default' | 'named' | 'namespace' | 'side-effect';
    items?: string[];
    isTypeOnly?: boolean;
  }>;
  exports: Array<{
    name: string;
    type: 'function' | 'class' | 'interface' | 'type' | 'const' | 'variable';
    isDefault?: boolean;
  }>;
  interfaces: Array<{
    name: string;
    extends?: string[];
    properties: Array<{
      name: string;
      type: string;
      optional: boolean;
    }>;
  }>;
  types: Array<{
    name: string;
    definition: string;
    category: 'union' | 'literal' | 'generic' | 'mapped' | 'conditional';
  }>;
  functions: Array<{
    name: string;
    parameters: Array<{
      name: string;
      type: string;
      optional: boolean;
    }>;
    returnType: string;
    isAsync: boolean;
  }>;
  classes: Array<{
    name: string;
    extends?: string;
    implements?: string[];
    methods: Array<{
      name: string;
      visibility: 'public' | 'private' | 'protected';
      isStatic: boolean;
      returnType: string;
    }>;
    properties: Array<{
      name: string;
      type: string;
      visibility: 'public' | 'private' | 'protected';
      isStatic: boolean;
    }>;
  }>;
  dependencies: {
    internal: string[];
    external: string[];
    types: string[];
  };
  complexity: {
    cyclomaticComplexity: number;
    nestingDepth: number;
    typeComplexity: number;
  };
}

export interface ContextAnalysisResponse {
  context_analysis: {
    analysis_type: 'typescript_context';
    file_info: {
      filename?: string;
      lines: number;
      characters: number;
      language: 'typescript';
    };
    typescript_context: TypeScriptContext;
    insights: {
      architecture_patterns: string[];
      design_principles: string[];
      potential_issues: Array<{
        type: 'warning' | 'suggestion';
        message: string;
        line?: number;
      }>;
      recommendations: string[];
    };
    quality_metrics: {
      maintainability: 'poor' | 'fair' | 'good' | 'excellent';
      testability: 'poor' | 'fair' | 'good' | 'excellent';
      reusability: 'poor' | 'fair' | 'good' | 'excellent';
      type_safety: 'poor' | 'fair' | 'good' | 'excellent';
    };
  };
  confidence: number;
  reasoning: string;
  next_steps: string[];
}

export class EnhancedContextAgent extends EnhancedBaseAgent {
  protected buildSystemPrompt(): string {
    return `You are a TypeScript Context Analysis Specialist with deep expertise in modern TypeScript development patterns and project architecture.

ROLE: TypeScript Context & Structure Analyzer

EXPERTISE:
- TypeScript language features and advanced typing
- Modern JavaScript/TypeScript project architecture
- Dependency analysis and module relationships  
- Design patterns and architectural principles
- Code organization and project structure
- Import/export analysis and module boundaries
- Interface and type system analysis
- Class hierarchy and inheritance patterns

CAPABILITIES:
- Analyze TypeScript code structure and context
- Extract and categorize imports, exports, types, interfaces
- Map dependency relationships and module boundaries
- Identify architectural patterns and design principles
- Assess code organization and maintainability
- Detect potential structural issues and improvements
- Evaluate type system usage and complexity
- Provide architectural recommendations and insights

ANALYSIS FOCUS:
- Project structure and organization
- Module dependencies and relationships
- Type definitions and interface design
- Code architecture and design patterns
- Maintainability and scalability factors
- Best practices compliance
- Refactoring opportunities

RESPONSE FORMAT:
Always respond with a structured JSON format following the ContextAnalysisResponse interface:

{
  "context_analysis": {
    "analysis_type": "typescript_context",
    "file_info": {
      "filename": "extracted from context or 'unknown'",
      "lines": count_of_lines,
      "characters": character_count,
      "language": "typescript"
    },
    "typescript_context": {
      "imports": [
        {
          "module": "module_name",
          "type": "default|named|namespace|side-effect",
          "items": ["imported_items"],
          "isTypeOnly": boolean
        }
      ],
      "exports": [
        {
          "name": "export_name",
          "type": "function|class|interface|type|const|variable",
          "isDefault": boolean
        }
      ],
      "interfaces": [
        {
          "name": "interface_name",
          "extends": ["parent_interfaces"],
          "properties": [
            {
              "name": "property_name",
              "type": "property_type",
              "optional": boolean
            }
          ]
        }
      ],
      "types": [
        {
          "name": "type_name",
          "definition": "type_definition",
          "category": "union|literal|generic|mapped|conditional"
        }
      ],
      "functions": [
        {
          "name": "function_name",
          "parameters": [
            {
              "name": "param_name",
              "type": "param_type",
              "optional": boolean
            }
          ],
          "returnType": "return_type",
          "isAsync": boolean
        }
      ],
      "classes": [
        {
          "name": "class_name",
          "extends": "parent_class",
          "implements": ["implemented_interfaces"],
          "methods": [
            {
              "name": "method_name",
              "visibility": "public|private|protected",
              "isStatic": boolean,
              "returnType": "return_type"
            }
          ],
          "properties": [
            {
              "name": "property_name",
              "type": "property_type",
              "visibility": "public|private|protected",
              "isStatic": boolean
            }
          ]
        }
      ],
      "dependencies": {
        "internal": ["internal_modules"],
        "external": ["external_packages"],
        "types": ["type_dependencies"]
      },
      "complexity": {
        "cyclomaticComplexity": complexity_score,
        "nestingDepth": max_nesting_level,
        "typeComplexity": type_complexity_score
      }
    },
    "insights": {
      "architecture_patterns": ["identified_patterns"],
      "design_principles": ["applied_principles"],
      "potential_issues": [
        {
          "type": "warning|suggestion",
          "message": "issue_description",
          "line": line_number_optional
        }
      ],
      "recommendations": ["improvement_suggestions"]
    },
    "quality_metrics": {
      "maintainability": "poor|fair|good|excellent",
      "testability": "poor|fair|good|excellent", 
      "reusability": "poor|fair|good|excellent",
      "type_safety": "poor|fair|good|excellent"
    }
  },
  "confidence": confidence_score_0_to_1,
  "reasoning": "explanation_of_analysis_approach_and_findings",
  "next_steps": ["suggested_next_actions"]
}

INSTRUCTIONS:
1. Analyze the provided TypeScript code for structural context
2. Extract all imports, exports, types, interfaces, functions, and classes
3. Map dependency relationships and architectural patterns
4. Assess code quality and provide actionable insights
5. Focus on context and structure, not syntax errors
6. Provide specific, actionable recommendations
7. Always maintain the exact JSON structure specified above`;
  }

  protected getInternalModelName(): string {
    return 'context-analyzer';
  }

  protected getTemperature(): number {
    return 0.1; // Lower temperature for more consistent structural analysis
  }

  protected getMaxTokens(): number {
    return 4000; // Allow for detailed context analysis
  }

  protected getAdditionalContext(context: AgentContext): string | null {
    let additionalContext = '';

    // Extract file information
    if (context.metadata?.filename) {
      additionalContext += `File: ${context.metadata.filename}\n`;
    }

    // Add language context
    additionalContext += `Language: TypeScript\n`;
    additionalContext += `Analysis Type: Context and Structure\n`;
    
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

      // Check for structured context analysis
      if (parsed.context_analysis) {
        confidence += 0.1;

        if (parsed.context_analysis.typescript_context) {
          confidence += 0.15;

          // Check for comprehensive context data
          if (parsed.context_analysis.typescript_context.imports) {
            confidence += 0.05;
          }
          if (parsed.context_analysis.typescript_context.exports) {
            confidence += 0.05;
          }
          if (parsed.context_analysis.typescript_context.dependencies) {
            confidence += 0.05;
          }
        }

        if (parsed.context_analysis.insights) {
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
    
    // Add TypeScript context analysis metadata
    const enhancedContext = {
      ...context,
      analysisType: 'typescript_context',
      metadata: {
        ...context.metadata,
        specialization: 'context_analysis',
        language: 'typescript',
        focus: 'structure_and_dependencies'
      }
    };

    const result = await super.execute(enhancedContext);
    
    // Enhance the result with context analysis metadata
    if (result.data && typeof result.data === 'object') {
      (result.data as any).analysisMetadata = {
        analysisType: 'typescript_context',
        processingTime: Date.now() - startTime,
        specialization: 'context_analysis'
      };
    }

    return result;
  }
}