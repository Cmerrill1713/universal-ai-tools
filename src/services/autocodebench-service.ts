/**
 * AutoCodeBench Integration Service
 * Implements automated code generation, testing, and validation using LLM-Sandbox Interaction
 * Based on research from: https://arxiv.org/pdf/2508.09101
 */

import { z } from 'zod';

import { llmRouter } from '@/services/llm-router-service';
import { log, LogContext } from '@/utils/logger';

// AutoCodeBench Configuration Schema
const AutoCodeBenchConfigSchema = z.object({
  enabled: z.boolean().default(true),
  maxProblems: z.number().default(100),
  supportedLanguages: z
    .array(z.string())
    .default([
      'python',
      'javascript',
      'typescript',
      'swift',
      'java',
      'cpp',
      'go',
      'rust',
      'php',
      'ruby',
      'csharp',
      'kotlin',
      'scala',
      'dart',
      'r',
      'matlab',
      'perl',
      'bash',
      'powershell',
      'sql',
    ]),
  difficultyLevels: z
    .array(z.enum(['easy', 'medium', 'hard', 'expert']))
    .default(['medium', 'hard']),
  testGenerationEnabled: z.boolean().default(true),
  qualityFilteringEnabled: z.boolean().default(true),
  sandboxTimeout: z.number().default(30000), // 30 seconds
});

export type AutoCodeBenchConfig = z.infer<typeof AutoCodeBenchConfigSchema>;

// Problem Generation Schema
const ProblemSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  language: z.string(),
  difficulty: z.enum(['easy', 'medium', 'hard', 'expert']),
  category: z.string(),
  constraints: z.array(z.string()),
  examples: z.array(
    z.object({
      input: z.string(),
      output: z.string(),
      explanation: z.string().optional(),
    })
  ),
  testCases: z.array(
    z.object({
      input: z.string(),
      expectedOutput: z.string(),
      isHidden: z.boolean().default(false),
    })
  ),
  solution: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

export type Problem = z.infer<typeof ProblemSchema>;

// Test Result Schema
const TestResultSchema = z.object({
  testCaseId: z.string(),
  input: z.string(),
  expectedOutput: z.string(),
  actualOutput: z.string(),
  passed: z.boolean(),
  executionTime: z.number(),
  memoryUsage: z.number(),
  errorMessage: z.string().optional(),
});

export type TestResult = z.infer<typeof TestResultSchema>;

// Code Generation Request Schema
const CodeGenerationRequestSchema = z.object({
  problem: ProblemSchema,
  language: z.string(),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).default(0.1),
  maxTokens: z.number().default(2000),
});

export type CodeGenerationRequest = z.infer<typeof CodeGenerationRequestSchema>;

export class AutoCodeBenchService {
  private config: AutoCodeBenchConfig;
  private problems: Map<string, Problem> = new Map();
  private testResults: Map<string, TestResult[]> = new Map();
  private performanceMetrics = {
    totalProblemsGenerated: 0,
    totalTestsExecuted: 0,
    successRate: 0,
    averageExecutionTime: 0,
    languagesSupported: 0,
  };

  constructor(config: Partial<AutoCodeBenchConfig> = {}) {
    this.config = AutoCodeBenchConfigSchema.parse({
      ...this.getDefaultConfig(),
      ...config,
    });
    this.performanceMetrics.languagesSupported = this.config.supportedLanguages.length;
  }

  private getDefaultConfig(): AutoCodeBenchConfig {
    return {
      enabled: true,
      maxProblems: 100,
      supportedLanguages: [
        'python',
        'javascript',
        'typescript',
        'swift',
        'java',
        'cpp',
        'go',
        'rust',
        'php',
        'ruby',
        'csharp',
        'kotlin',
        'scala',
        'dart',
        'r',
        'matlab',
        'perl',
        'bash',
        'powershell',
        'sql',
      ],
      difficultyLevels: ['medium', 'hard'],
      testGenerationEnabled: true,
      qualityFilteringEnabled: true,
      sandboxTimeout: 30000,
    };
  }

  /**
   * Generate a new programming problem using AutoCodeGen workflow
   */
  async generateProblem(options: {
    language: string;
    difficulty: 'easy' | 'medium' | 'hard' | 'expert';
    category: string;
    complexity: 'single' | 'multi-logical';
  }): Promise<Problem> {
    if (!this.config.enabled) {
      throw new Error('AutoCodeBench service is disabled');
    }

    if (!this.config.supportedLanguages.includes(options.language)) {
      throw new Error(`Language ${options.language} is not supported`);
    }

    log.info('🚀 Generating new programming problem', LogContext.AI, {
      language: options.language,
      difficulty: options.difficulty,
      category: options.category,
      complexity: options.complexity,
    });

    try {
      // Step 1: Generate code solution using LLM
      const solution = await this.generateCodeSolution(options);

      // Step 2: Generate test function with test inputs
      const testFunction = await this.generateTestFunction(solution, options);

      // Step 3: Generate the problem description
      const problemDescription = await this.generateProblemDescription(
        solution,
        testFunction,
        options
      );

      // Step 4: Apply quality filtering
      const filteredProblem = await this.applyQualityFiltering({
        id: `problem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ...problemDescription,
        solution,
        testCases: testFunction.testCases,
      });

      // Store the problem
      this.problems.set(filteredProblem.id, filteredProblem);
      this.performanceMetrics.totalProblemsGenerated++;

      log.info('✅ Problem generated successfully', LogContext.AI, {
        problemId: filteredProblem.id,
        language: filteredProblem.language,
        difficulty: filteredProblem.difficulty,
      });

      return filteredProblem;
    } catch (error) {
      log.error('❌ Failed to generate problem', LogContext.AI, {
        error: error instanceof Error ? error.message : String(error),
        options,
      });
      throw error;
    }
  }

  /**
   * Generate code solution using LLM (Step 1 of AutoCodeGen)
   */
  private async generateCodeSolution(options: {
    language: string;
    difficulty: string;
    category: string;
    complexity: string;
  }): Promise<string> {
    const prompt = `You are an expert ${options.language} programmer. Generate a complete, self-contained, and executable ${options.language} solution for a ${options.difficulty} difficulty ${options.category} problem.

Requirements:
- The solution should be ${options.complexity === 'multi-logical' ? 'complex and require multiple logical steps' : 'focused on a single logical concept'}
- Include proper error handling and edge cases
- Follow ${options.language} best practices and conventions
- The code should be production-ready and well-documented
- Ensure the solution is complete and can run independently

Generate only the ${options.language} code without explanations:`;

    const response = await llmRouter.generateResponse(
      'deepseek-coder',
      [{ role: 'user', content: prompt }],
      {
        temperature: 0.1,
        maxTokens: 2000,
      }
    );

    return response.content;
  }

  /**
   * Generate test function with test inputs (Step 2 of AutoCodeGen)
   */
  private async generateTestFunction(
    solution: string,
    options: {
      language: string;
      difficulty: string;
      category: string;
    }
  ): Promise<{ testCases: any[]; testFunction: string }> {
    const prompt = `Given this ${options.language} solution:

\`\`\`${options.language}
${solution}
\`\`\`

Generate comprehensive test cases that verify the solution works correctly. Include:
1. Normal cases with expected inputs
2. Edge cases and boundary conditions
3. Error cases that should be handled gracefully
4. At least 5-10 test cases total

For each test case, provide:
- Input values
- Expected output
- Brief description of what is being tested

Format as JSON array of test cases:`;

    const response = await llmRouter.generateResponse(
      'deepseek-coder',
      [{ role: 'user', content: prompt }],
      {
        temperature: 0.1,
        maxTokens: 1500,
      }
    );

    // Parse test cases from response
    const testCases = this.parseTestCases(response.content, options.language);

    // Generate the actual test function
    const testFunction = this.generateTestFunctionCode(testCases, options.language);

    return { testCases, testFunction };
  }

  /**
   * Generate problem description (Step 3 of AutoCodeGen)
   */
  private async generateProblemDescription(
    solution: string,
    testFunction: { testCases: any[] },
    options: {
      language: string;
      difficulty: string;
      category: string;
    }
  ): Promise<Omit<Problem, 'id' | 'solution' | 'testCases'>> {
    const prompt = `Based on this ${options.language} solution and test cases, create a clear programming problem description:

Solution:
\`\`\`${options.language}
${solution}
\`\`\`

Test Cases: ${JSON.stringify(testFunction.testCases, null, 2)}

Generate a problem description that:
1. Clearly states what the program should do
2. Specifies input/output requirements
3. Lists any constraints or limitations
4. Provides example usage
5. Is challenging but solvable for ${options.difficulty} level
6. Focuses on ${options.category} concepts

Format the response as a structured problem description.`;

    const response = await llmRouter.generateResponse(
      'deepseek-coder',
      [{ role: 'user', content: prompt }],
      {
        temperature: 0.1,
        maxTokens: 1000,
      }
    );

    // Parse and structure the problem description
    return this.parseProblemDescription(response.content, options);
  }

  /**
   * Apply quality filtering (Step 4 of AutoCodeGen)
   */
  private async applyQualityFiltering(problem: Problem): Promise<Problem> {
    if (!this.config.qualityFilteringEnabled) {
      return problem;
    }

    // Apply multiple filtering steps
    const filteredProblem = await this.applyMultipleSampling(problem);
    const validatedProblem = await this.applyLLMAsCritic(filteredProblem);
    const taggedProblem = await this.applyTagging(validatedProblem);

    return taggedProblem;
  }

  /**
   * Multiple sampling filtering
   */
  private async applyMultipleSampling(problem: Problem): Promise<Problem> {
    // Generate multiple variations and select the best one
    const variations = await Promise.all([
      this.generateVariation(problem, 'complexity'),
      this.generateVariation(problem, 'clarity'),
      this.generateVariation(problem, 'difficulty'),
    ]);

    // Select the best variation based on quality metrics
    const bestVariation = await this.selectBestVariation(variations);
    return bestVariation;
  }

  /**
   * LLM-as-Critic filtering
   */
  private async applyLLMAsCritic(problem: Problem): Promise<Problem> {
    const prompt = `Review this programming problem for quality and correctness:

Problem: ${JSON.stringify(problem, null, 2)}

Evaluate the problem on:
1. Clarity and understandability
2. Correctness of requirements
3. Appropriate difficulty level
4. Completeness of test cases
5. Real-world applicability

Rate each aspect 1-10 and provide specific feedback for improvement.`;

    const response = await llmRouter.generateResponse(
      'deepseek-coder',
      [{ role: 'user', content: prompt }],
      {
        temperature: 0.1,
        maxTokens: 1000,
      }
    );

    // Apply improvements based on feedback
    return this.applyCriticFeedback(problem, response.content);
  }

  /**
   * Apply tagging for categorization
   */
  private async applyTagging(problem: Problem): Promise<Problem> {
    const prompt = `Analyze this programming problem and assign appropriate tags:

Problem: ${JSON.stringify(problem, null, 2)}

Assign tags for:
1. Primary concept (e.g., algorithms, data structures, system design)
2. Difficulty level
3. Programming paradigm
4. Domain area
5. Required skills

Return only the tags as a JSON array.`;

    const response = await llmRouter.generateResponse(
      'deepseek-coder',
      [{ role: 'user', content: prompt }],
      {
        temperature: 0.1,
        maxTokens: 500,
      }
    );

    const tags = this.parseTags(response.content);
    return { ...problem, metadata: { ...problem.metadata, tags } };
  }

  /**
   * Execute code in sandbox environment
   */
  async executeInSandbox(code: string, language: string, testCases: any[]): Promise<TestResult[]> {
    log.info('🔒 Executing code in sandbox', LogContext.AI, {
      language,
      testCaseCount: testCases.length,
    });

    try {
      // For now, implement a basic sandbox execution
      // In production, this would use Docker containers or similar isolation
      const results: TestResult[] = [];

      for (const testCase of testCases) {
        const startTime = Date.now();
        const startMemory = process.memoryUsage().heapUsed;

        try {
          // Execute the code with test input
          const actualOutput = await this.executeCode(code, language, testCase.input);

          const executionTime = Date.now() - startTime;
          const memoryUsage = process.memoryUsage().heapUsed - startMemory;

          results.push({
            testCaseId: `test_${testCase.input}`,
            input: testCase.input,
            expectedOutput: testCase.expectedOutput,
            actualOutput: String(actualOutput),
            passed: this.compareOutputs(actualOutput, testCase.expectedOutput),
            executionTime,
            memoryUsage,
          });
        } catch (error) {
          results.push({
            testCaseId: `test_${testCase.input}`,
            input: testCase.input,
            expectedOutput: testCase.expectedOutput,
            actualOutput: '',
            passed: false,
            executionTime: Date.now() - startTime,
            memoryUsage: 0,
            errorMessage: error instanceof Error ? error.message : String(error),
          });
        }
      }

      this.testResults.set(code, results);
      this.performanceMetrics.totalTestsExecuted += testCases.length;
      this.updatePerformanceMetrics(results);

      return results;
    } catch (error) {
      log.error('❌ Sandbox execution failed', LogContext.AI, {
        error: error instanceof Error ? error.message : String(error),
        language,
      });
      throw error;
    }
  }

  /**
   * Execute code for a specific language
   */
  private async executeCode(code: string, language: string, input: string): Promise<any> {
    // This is a simplified implementation
    // In production, you'd want proper language-specific execution
    switch (language) {
      case 'python':
        return this.executePythonCode(code, input);
      case 'javascript':
        return this.executeJavaScriptCode(code, input);
      case 'typescript':
        return this.executeTypeScriptCode(code, input);
      default:
        throw new Error(`Language ${language} execution not implemented`);
    }
  }

  /**
   * Execute Python code
   */
  private async executePythonCode(code: string, input: string): Promise<any> {
    // In production, use proper Python execution with sandboxing
    // For now, return a mock result
    return `Python execution result for input: ${input}`;
  }

  /**
   * Execute JavaScript code
   */
  private async executeJavaScriptCode(code: string, input: string): Promise<any> {
    try {
      // Create a safe execution context
      const safeEval = new Function(
        'input',
        `
        "use strict";
        ${code}
        return result; // Assuming the code sets a 'result' variable
      `
      );

      return safeEval(input);
    } catch (error) {
      throw new Error(
        `JavaScript execution error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Execute TypeScript code
   */
  private async executeTypeScriptCode(code: string, input: string): Promise<any> {
    // In production, you'd compile TypeScript to JavaScript first
    // For now, treat as JavaScript
    return this.executeJavaScriptCode(code, input);
  }

  /**
   * Compare actual vs expected output
   */
  private compareOutputs(actual: any, expected: any): boolean {
    if (typeof actual === 'number' && typeof expected === 'number') {
      // Use approximate comparison for floating point numbers
      return Math.abs(actual - expected) < 1e-10;
    }

    return String(actual).trim() === String(expected).trim();
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(results: TestResult[]): void {
    const passedTests = results.filter((r) => r.passed).length;
    const totalTests = results.length;

    if (totalTests > 0) {
      this.performanceMetrics.successRate = passedTests / totalTests;
    }

    const avgExecutionTime = results.reduce((sum, r) => sum + r.executionTime, 0) / totalTests;
    this.performanceMetrics.averageExecutionTime = avgExecutionTime;
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics() {
    return { ...this.performanceMetrics };
  }

  /**
   * Get all problems
   */
  getProblems(): Problem[] {
    return Array.from(this.problems.values());
  }

  /**
   * Get problem by ID
   */
  getProblem(id: string): Problem | undefined {
    return this.problems.get(id);
  }

  /**
   * Get test results for code
   */
  getTestResults(code: string): TestResult[] | undefined {
    return this.testResults.get(code);
  }

  // Helper methods for parsing and generation
  private parseTestCases(content: string, language: string): any[] {
    try {
      // Extract JSON from the response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return [];
    } catch (error) {
      log.warn('Failed to parse test cases', LogContext.AI, { error: String(error) });
      return [];
    }
  }

  private generateTestFunctionCode(testCases: any[], language: string): string {
    // Generate language-specific test function code
    switch (language) {
      case 'python':
        return this.generatePythonTestFunction(testCases);
      case 'javascript':
        return this.generateJavaScriptTestFunction(testCases);
      default:
        return this.generateGenericTestFunction(testCases, language);
    }
  }

  private generatePythonTestFunction(testCases: any[]): string {
    return `def run_tests():
    test_cases = ${JSON.stringify(testCases, null, 2)}
    for i, test_case in enumerate(test_cases):
        try:
            result = your_function(test_case['input'])
            if result == test_case['expected_output']:
                print(f"Test {i+1}: PASSED")
            else:
                print(f"Test {i+1}: FAILED - Expected {test_case['expected_output']}, got {result}")
        except Exception as e:
            print(f"Test {i+1}: ERROR - {e}")

if __name__ == "__main__":
    run_tests()`;
  }

  private generateJavaScriptTestFunction(testCases: any[]): string {
    return `function runTests() {
    const testCases = ${JSON.stringify(testCases, null, 2)};
    testCases.forEach((testCase, index) => {
        try {
            const result = yourFunction(testCase.input);
            if (result === testCase.expected_output) {
                console.log(\`Test \${index + 1}: PASSED\`);
            } else {
                console.log(\`Test \${index + 1}: FAILED - Expected \${testCase.expected_output}, got \${result}\`);
            }
        } catch (error) {
            console.log(\`Test \${index + 1}: ERROR - \${error.message}\`);
        }
    });
}

runTests();`;
  }

  private generateGenericTestFunction(testCases: any[], language: string): string {
    return `// Test function for ${language}
// Test cases: ${JSON.stringify(testCases, null, 2)}
// Implement test execution logic for ${language}`;
  }

  private parseProblemDescription(content: string, options: any): any {
    // Parse the generated problem description
    // This is a simplified parser - in production you'd want more sophisticated parsing
    return {
      title: `Generated ${options.category} Problem`,
      description: content,
      language: options.language,
      difficulty: options.difficulty,
      category: options.category,
      constraints: [],
      examples: [],
    };
  }

  private async generateVariation(problem: Problem, aspect: string): Promise<Problem> {
    // Generate a variation of the problem focusing on a specific aspect
    const prompt = `Modify this problem to improve the ${aspect}:

${JSON.stringify(problem, null, 2)}

Focus on improving ${aspect} while maintaining the core requirements.`;

    const response = await llmRouter.generateResponse(
      'deepseek-coder',
      [{ role: 'user', content: prompt }],
      {
        temperature: 0.3,
        maxTokens: 1000,
      }
    );

    return this.parseProblemDescription(response.content, {
      language: problem.language,
      difficulty: problem.difficulty,
      category: problem.category,
    });
  }

  private async selectBestVariation(variations: Problem[]): Promise<Problem> {
    // Select the best variation based on quality metrics
    // Return the first available variation, or throw if none exist
    const bestVariation = variations.find(v => v != null);
    if (!bestVariation) {
      throw new Error('No valid variations generated');
    }
    return bestVariation;
  }

  private async applyCriticFeedback(problem: Problem, feedback: string): Promise<Problem> {
    // Apply improvements based on critic feedback
    // For now, return the original problem
    return problem;
  }

  private parseTags(content: string): string[] {
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return [];
    } catch (error) {
      return [];
    }
  }
}

// Export singleton instance
export const autoCodeBenchService = new AutoCodeBenchService();
