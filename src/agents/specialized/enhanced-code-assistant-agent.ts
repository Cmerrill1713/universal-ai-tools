/**
 * Enhanced Code Assistant Agent - Real AI Code Capabilities
 * Uses code-specialized models for programming assistance
 */

import { safeCalculate } from '@/services/tools/calculator';
import type { AgentContext, CodeBlock } from '@/types';

import { EnhancedBaseAgent } from '../enhanced-base-agent';

export class EnhancedCodeAssistantAgent extends EnhancedBaseAgent {
  protected buildSystemPrompt(): string {
    return `You are an expert software development assistant with advanced programming and code analysis capabilities.

ROLE: Code Generation, Analysis & Development Support Specialist

EXPERTISE:
- Full-stack web development (JavaScript, TypeScript, Python, etc.)
- Software architecture and design patterns
- Code review and optimization
- Debugging and troubleshooting
- API design and integration
- Database design and queries
- DevOps and deployment practices
- Testing strategies and implementation

CAPABILITIES:
- Generate clean, efficient, well-documented code
- Analyze existing code for issues and improvements
- Provide architectural recommendations
- Debug complex problems with step-by-step solutions
- Refactor code for better performance and maintainability
- Create comprehensive tests and documentation
- Suggest best practices and industry standards

RESPONSE FORMAT:
Always respond with a structured JSON format:
{
  "code_response": {
    "solution_type": "generation|analysis|debugging|refactoring|review",
    "language": "Primary programming language",
    "code_blocks": [
      {
        "filename": "filename.ext",
        "language": "programming_language",
        "code": "actual code content",
        "explanation": "What this code does and why"
      }
    ],
    "analysis": {
      "complexity": "low|medium|high",
      "performance_rating": "poor|fair|good|excellent",
      "maintainability": "poor|fair|good|excellent",
      "security_considerations": ["Security issues or recommendations"],
      "potential_improvements": ["Suggested enhancements"]
    }
  },
  "implementation_guide": {
    "setup_steps": ["Steps to set up or integrate the code"],
    "dependencies": ["Required packages, libraries, or tools"],
    "configuration": ["Configuration requirements or suggestions"],
    "testing_approach": "How to test the implementation"
  },
  "best_practices": [
    {
      "category": "performance|security|maintainability|scalability",
      "recommendation": "Specific best practice recommendation",
      "reasoning": "Why this practice is important"
    }
  ],
  "follow_up_questions": [
    "Questions to help refine or improve the solution"
  ],
  "reasoning": "Detailed explanation of approach and technical decisions",
  "confidence": number_between_0_and_1,
  "documentation": "Comments on documentation needs or suggestions"
}

CODING PRINCIPLES:
1. Write clean, readable, and maintainable code
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
    return 'code-expert';
  }

  protected getTemperature(): number {
    return 0.2; // Lower temperature for more consistent, reliable code generation
  }

  protected getMaxTokens(): number {
    return 6000; // Allow for larger code responses
  }

  protected getAdditionalContext(context: AgentContext): string | null {
    let additionalContext = '';

    // Detect programming language
    const language = this.detectProgrammingLanguage(context.userRequest);
    if (language) {
      additionalContext += `Programming language: ${language}\n`;
    }

    // Identify request type
    const requestType = this.identifyCodeRequestType(context.userRequest);
    if (requestType) {
      additionalContext += `Request type: ${requestType}\n`;
    }

    // Extract framework/technology mentions
    const technologies = this.extractTechnologies(context.userRequest);
    if (technologies.length > 0) {
      additionalContext += `Technologies mentioned: ${technologies.join(', ')}\n`;
    }

    // Check for specific patterns or requirements
    const patterns = this.extractDesignPatterns(context.userRequest);
    if (patterns.length > 0) {
      additionalContext += `Design patterns/requirements: ${patterns.join(', ')}\n`;
    }

    // Working directory context for code projects
    if (context.workingDirectory) {
      additionalContext += `Project directory: ${context.workingDirectory}\n`;
    }

    // Lightweight tool use: calculator for simple math expressions
    try {
      const mathMatch = context.userRequest.match(/(?:^|\b)([-+*/%.() 0-9]{3,})(?:$|\b)/);
      if (mathMatch && mathMatch[1] && /[0-9]/.test(mathMatch[1])) {
        const calc = safeCalculate(mathMatch[1]);
        if (typeof calc === 'number' && Number.isFinite(calc)) {
          additionalContext += `Precomputed calculation: ${mathMatch[1]} = ${calc}\n`;
        }
      }
    } catch {}

    // Note: deeper filesystem introspection is performed via dedicated tools when needed

    return additionalContext || null;
  }

  private detectProgrammingLanguage(request: string): string | null {
    const languagePatterns = [
      { pattern: /javascript|js|node.?js/gi, language: 'JavaScript' },
      { pattern: /typescript|ts/gi, language: 'TypeScript' },
      { pattern: /python|py/gi, language: 'Python' },
      { pattern: /java(?!script)/gi, language: 'Java' },
      { pattern: /c\+\+|cpp/gi, language: 'C++' },
      { pattern: /c#|csharp/gi, language: 'C#' },
      { pattern: /php/gi, language: 'PHP' },
      { pattern: /ruby|rb/gi, language: 'Ruby' },
      { pattern: /go\b|golang/gi, language: 'Go' },
      { pattern: /rust/gi, language: 'Rust' },
      { pattern: /swift/gi, language: 'Swift' },
      { pattern: /kotlin/gi, language: 'Kotlin' },
      { pattern: /scala/gi, language: 'Scala' },
      { pattern: /html|css/gi, language: 'Web' },
      { pattern: /sql|database/gi, language: 'SQL' },
    ];

    for (const { pattern, language } of languagePatterns) {
      if (pattern.test(request)) {
        return language;
      }
    }

    return null;
  }

  private identifyCodeRequestType(request: string): string | null {
    const requestTypes = [
      { pattern: /create|generate|write|build/gi, type: 'code_generation' },
      { pattern: /fix|debug|error|bug|issue/gi, type: 'debugging' },
      { pattern: /review|analyze|check|evaluate/gi, type: 'code_review' },
      { pattern: /refactor|improve|optimize|clean/gi, type: 'refactoring' },
      { pattern: /explain|understand|how does/gi, type: 'code_explanation' },
      { pattern: /test|testing|unit test/gi, type: 'testing' },
      { pattern: /documentation|document|comment/gi, type: 'documentation' },
      { pattern: /performance|speed|optimize/gi, type: 'optimization' },
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
    const techPatterns = [
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
      /webpack|vite|rollup|babel/gi,
    ];

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
    const patternKeywords = [
      /singleton|factory|observer|strategy|decorator/gi,
      /mvc|mvp|mvvm/gi,
      /microservices|monolith/gi,
      /rest|graphql|websocket/gi,
      /async|await|promise|callback/gi,
      /crud|api|endpoint/gi,
    ];

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
          const hasValidCode = parsed.code_response.code_blocks.some(
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
}

export default EnhancedCodeAssistantAgent;
