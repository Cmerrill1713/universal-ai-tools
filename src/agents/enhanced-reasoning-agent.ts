/**
 * Enhanced Reasoning Agent
 * Integrates AutoCodeBench and ReasonRank capabilities for advanced AI reasoning
 * Based on research from AutoCodeBench and ReasonRank papers
 */

import {
  autoCodeBenchService,
  type Problem,
  type TestResult,
} from '@/services/autocodebench-service';
import {
  reasonRankService,
  type Passage,
  type RankingQuery,
  type RankingResult,
} from '@/services/reasonrank-service';
import type { AgentContext, AgentResponse } from '@/types';
import { log, LogContext } from '@/utils/logger';
import { z } from 'zod';
import { EnhancedBaseAgent } from './enhanced-base-agent';

// Agent Capabilities Schema
const ReasoningAgentCapabilitiesSchema = z.object({
  codeGeneration: z.boolean().default(true),
  automatedTesting: z.boolean().default(true),
  reasoningRanking: z.boolean().default(true),
  problemSolving: z.boolean().default(true),
  multiLanguageSupport: z.boolean().default(true),
  qualityAssurance: z.boolean().default(true),
});

export type ReasoningAgentCapabilities = z.infer<typeof ReasoningAgentCapabilitiesSchema>;

// Agent Request Schema
const ReasoningAgentRequestSchema = z.object({
  action: z.enum([
    'generate_problem',
    'solve_problem',
    'rank_passages',
    'generate_tests',
    'execute_code',
    'analyze_solution',
    'improve_code',
    'explain_reasoning',
  ]),
  parameters: z.record(z.any()),
  context: z.string().optional(),
  language: z.string().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard', 'expert']).optional(),
  domain: z.string().optional(),
});

export type ReasoningAgentRequest = z.infer<typeof ReasoningAgentRequestSchema>;

// Agent Response Schema
const ReasoningAgentResponseSchema = z.object({
  success: z.boolean(),
  action: z.string(),
  result: z.any(),
  reasoning: z.string().optional(),
  confidence: z.number().optional(),
  metadata: z.record(z.any()).optional(),
  suggestions: z.array(z.string()).optional(),
  errors: z.array(z.string()).optional(),
});

export type ReasoningAgentResponse = z.infer<typeof ReasoningAgentResponseSchema>;

export class EnhancedReasoningAgent extends EnhancedBaseAgent {
  private capabilities: ReasoningAgentCapabilities;
  private problemCache: Map<string, Problem> = new Map();
  private solutionCache: Map<string, any> = new Map();
  private reasoningHistory: Array<{
    query: string;
    reasoning: string;
    timestamp: Date;
    confidence: number;
  }> = [];

  constructor(capabilities: Partial<ReasoningAgentCapabilities> = {}) {
    super({
      name: 'Enhanced Reasoning Agent',
      description:
        'Advanced AI agent with reasoning-intensive capabilities for code generation, testing, and analysis',
      capabilities: [
        { name: 'code_generation', priority: 1 },
        { name: 'automated_testing', priority: 2 },
        { name: 'reasoning_ranking', priority: 3 },
        { name: 'problem_solving', priority: 4 },
        { name: 'multi_language_support', priority: 5 },
        { name: 'quality_assurance', priority: 6 },
      ],
      priority: 1,
      model: 'deepseek-coder',
      temperature: 0.1,
      maxTokens: 4000,
    });

    this.capabilities = ReasoningAgentCapabilitiesSchema.parse({
      ...this.getDefaultCapabilities(),
      ...capabilities,
    });
  }

  private getDefaultCapabilities(): ReasoningAgentCapabilities {
    return {
      codeGeneration: true,
      automatedTesting: true,
      reasoningRanking: true,
      problemSolving: true,
      multiLanguageSupport: true,
      qualityAssurance: true,
    };
  }

  protected buildSystemPrompt(): string {
    return `You are an Enhanced Reasoning Agent with advanced capabilities for code generation, testing, and analysis.

Your capabilities include:
- Code Generation: Create high-quality, production-ready code in multiple programming languages
- Automated Testing: Generate comprehensive test cases and validate code correctness
- Reasoning Ranking: Use step-by-step reasoning to rank and evaluate information
- Problem Solving: Break down complex problems into logical steps
- Multi-Language Support: Work with Python, JavaScript, TypeScript, Swift, Java, C++, Go, Rust, and more
- Quality Assurance: Ensure code quality through automated validation and improvement

Always provide clear reasoning for your decisions and maintain high standards of code quality and security.`;
  }

  protected getInternalModelName(): string {
    return 'deepseek-coder';
  }

  /**
   * Execute reasoning-intensive tasks
   */
  async execute(context: AgentContext): Promise<AgentResponse> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    log.info('🧠 Enhanced Reasoning Agent executing task', LogContext.AGENT, {
      agentName: this.getName(),
      context: context.query?.substring(0, 100),
      capabilities: Object.keys(this.capabilities).filter(
        (k) => this.capabilities[k as keyof ReasoningAgentCapabilities]
      ),
    });

    try {
      // Parse the request
      const request = this.parseRequest(context);

      // Execute based on action type
      let result: any;
      let reasoning = '';
      let confidence = 0.8;

      switch (request.action) {
        case 'generate_problem':
          result = await this.generateProgrammingProblem(request.parameters);
          reasoning =
            'Generated programming problem using AutoCodeBench workflow with quality filtering';
          break;

        case 'solve_problem':
          result = await this.solveProgrammingProblem(request.parameters);
          reasoning = 'Solved programming problem using step-by-step reasoning and code generation';
          break;

        case 'rank_passages':
          result = await this.rankPassagesWithReasoning(request.parameters);
          reasoning = 'Ranked passages using ReasonRank multi-view reasoning approach';
          break;

        case 'generate_tests':
          result = await this.generateAutomatedTests(request.parameters);
          reasoning = 'Generated comprehensive test cases using automated testing framework';
          break;

        case 'execute_code':
          result = await this.executeCodeInSandbox(request.parameters);
          reasoning = 'Executed code in secure sandbox environment with comprehensive testing';
          break;

        case 'analyze_solution':
          result = await this.analyzeCodeSolution(request.parameters);
          reasoning = 'Analyzed code solution for quality, efficiency, and best practices';
          break;

        case 'improve_code':
          result = await this.improveCodeQuality(request.parameters);
          reasoning = 'Improved code quality through automated analysis and optimization';
          break;

        case 'explain_reasoning':
          result = await this.explainReasoningProcess(request.parameters);
          reasoning = 'Provided detailed explanation of reasoning process and decision-making';
          break;

        default:
          throw new Error(`Unknown action: ${request.action}`);
      }

      // Store reasoning history
      this.reasoningHistory.push({
        query: context.query || '',
        reasoning,
        timestamp: new Date(),
        confidence,
      });

      const executionTime = Date.now() - startTime;

      log.info('✅ Enhanced Reasoning Agent completed task', LogContext.AGENT, {
        agentName: this.getName(),
        action: request.action,
        executionTime,
        confidence,
      });

      return {
        success: true,
        content: result,
        metadata: {
          action: request.action,
          reasoning,
          confidence,
          executionTime,
          agent: this.getName(),
        },
      };
    } catch (error) {
      log.error('❌ Enhanced Reasoning Agent failed', LogContext.AGENT, {
        agentName: this.getName(),
        error: error instanceof Error ? error.message : String(error),
        context: context.query?.substring(0, 100),
      });

      return {
        success: false,
        content: null,
        error: error instanceof Error ? error.message : String(error),
        metadata: {
          agent: this.getName(),
          timestamp: new Date(),
        },
      };
    }
  }

  /**
   * Generate programming problem using AutoCodeBench
   */
  private async generateProgrammingProblem(parameters: any): Promise<Problem> {
    const {
      language = 'python',
      difficulty = 'medium',
      category = 'algorithms',
      complexity = 'single',
    } = parameters;

    log.info('🚀 Generating programming problem', LogContext.AI, {
      language,
      difficulty,
      category,
      complexity,
    });

    const problem = await autoCodeBenchService.generateProblem({
      language,
      difficulty,
      category,
      complexity,
    });

    // Cache the problem
    this.problemCache.set(problem.id, problem);

    return problem;
  }

  /**
   * Solve programming problem with reasoning
   */
  private async solveProgrammingProblem(parameters: any): Promise<{
    problem: Problem;
    solution: string;
    reasoning: string;
    testResults: TestResult[];
  }> {
    const { problemId, language = 'python', approach = 'step_by_step' } = parameters;

    // Get problem from cache or generate new one
    let problem: Problem;
    if (problemId && this.problemCache.has(problemId)) {
      problem = this.problemCache.get(problemId)!;
    } else {
      problem = await this.generateProgrammingProblem(parameters);
    }

    log.info('🧩 Solving programming problem', LogContext.AI, {
      problemId: problem.id,
      language,
      approach,
    });

    // Generate solution using reasoning
    const solution = await this.generateReasonedSolution(problem, language, approach);

    // Generate and execute tests
    const testResults = await autoCodeBenchService.executeInSandbox(
      solution,
      language,
      problem.testCases
    );

    // Cache the solution
    this.solutionCache.set(problem.id, {
      solution,
      testResults,
      timestamp: new Date(),
    });

    return {
      problem,
      solution,
      reasoning: this.generateSolutionReasoning(problem, solution, testResults),
      testResults,
    };
  }

  /**
   * Rank passages using ReasonRank
   */
  private async rankPassagesWithReasoning(parameters: any): Promise<RankingResult[]> {
    const { query, passages, topK = 10, domain = 'general', complexity = 'moderate' } = parameters;

    log.info('📊 Ranking passages with reasoning', LogContext.AI, {
      query: query.substring(0, 100),
      passageCount: passages.length,
      topK,
      domain,
      complexity,
    });

    // Convert passages to ReasonRank format
    const reasonRankPassages: Passage[] = passages.map((p: any, index: number) => ({
      id: p.id || `passage_${index}`,
      content: p.content,
      metadata: p.metadata || {},
      source: p.source,
      timestamp: p.timestamp ? new Date(p.timestamp) : new Date(),
    }));

    // Create ranking query
    const rankingQuery: RankingQuery = {
      query,
      domain: domain as any,
      complexity: complexity as any,
      reasoningRequired: true,
    };

    // Execute ranking
    const results = await reasonRankService.rankPassages(rankingQuery, reasonRankPassages, {
      topK,
      includeReasoning: true,
      useMultiViewRewards: true,
    });

    return results;
  }

  /**
   * Generate automated tests
   */
  private async generateAutomatedTests(parameters: any): Promise<{
    testCases: any[];
    testFunction: string;
    coverage: number;
  }> {
    const { code, language = 'python', testType = 'comprehensive' } = parameters;

    log.info('🧪 Generating automated tests', LogContext.AI, {
      language,
      testType,
      codeLength: code.length,
    });

    // Generate test cases using LLM
    const testCases = await this.generateTestCases(code, language, testType);

    // Generate test function
    const testFunction = this.generateTestFunctionCode(testCases, language);

    // Calculate test coverage (simplified)
    const coverage = this.calculateTestCoverage(code, testCases);

    return {
      testCases,
      testFunction,
      coverage,
    };
  }

  /**
   * Execute code in sandbox
   */
  private async executeCodeInSandbox(parameters: any): Promise<{
    results: TestResult[];
    performance: any;
    security: any;
  }> {
    const { code, language = 'python', testCases, timeout = 30000 } = parameters;

    log.info('🔒 Executing code in sandbox', LogContext.AI, {
      language,
      testCaseCount: testCases.length,
      timeout,
    });

    // Execute tests
    const results = await autoCodeBenchService.executeInSandbox(code, language, testCases);

    // Analyze performance
    const performance = this.analyzePerformance(results);

    // Security analysis
    const security = this.analyzeSecurity(code, language);

    return {
      results,
      performance,
      security,
    };
  }

  /**
   * Analyze code solution
   */
  private async analyzeCodeSolution(parameters: any): Promise<{
    quality: number;
    efficiency: number;
    maintainability: number;
    security: number;
    suggestions: string[];
  }> {
    const { code, language = 'python', context = '' } = parameters;

    log.info('🔍 Analyzing code solution', LogContext.AI, {
      language,
      codeLength: code.length,
    });

    // Generate analysis using LLM
    const analysis = await this.generateCodeAnalysis(code, language, context);

    // Parse analysis results
    const parsedAnalysis = this.parseCodeAnalysis(analysis);

    return parsedAnalysis;
  }

  /**
   * Improve code quality
   */
  private async improveCodeQuality(parameters: any): Promise<{
    originalCode: string;
    improvedCode: string;
    improvements: string[];
    metrics: any;
  }> {
    const { code, language = 'python', focus = 'all' } = parameters;

    log.info('✨ Improving code quality', LogContext.AI, {
      language,
      focus,
      codeLength: code.length,
    });

    // Generate improvements using LLM
    const improvedCode = await this.generateCodeImprovements(code, language, focus);

    // Analyze improvements
    const improvements = this.analyzeImprovements(code, improvedCode);

    // Calculate metrics
    const metrics = this.calculateCodeMetrics(improvedCode, language);

    return {
      originalCode: code,
      improvedCode,
      improvements,
      metrics,
    };
  }

  /**
   * Explain reasoning process
   */
  private async explainReasoningProcess(parameters: any): Promise<{
    explanation: string;
    steps: string[];
    confidence: number;
    alternatives: string[];
  }> {
    const { query, context = '', approach = 'detailed' } = parameters;

    log.info('💭 Explaining reasoning process', LogContext.AI, {
      query: query.substring(0, 100),
      approach,
    });

    // Generate reasoning explanation
    const explanation = await this.generateReasoningExplanation(query, context, approach);

    // Extract reasoning steps
    const steps = this.extractReasoningSteps(explanation);

    // Calculate confidence
    const confidence = this.calculateReasoningConfidence(explanation, steps);

    // Generate alternatives
    const alternatives = await this.generateReasoningAlternatives(query, context);

    return {
      explanation,
      steps,
      confidence,
      alternatives,
    };
  }

  // Helper methods for reasoning and analysis
  private async generateReasonedSolution(
    problem: Problem,
    language: string,
    approach: string
  ): Promise<string> {
    const prompt = `Solve this programming problem using ${approach} reasoning:

Problem: ${problem.description}
Language: ${language}
Difficulty: ${problem.difficulty}
Category: ${problem.category}

Constraints: ${problem.constraints.join(', ')}
Examples: ${JSON.stringify(problem.examples, null, 2)}

Provide a complete, well-documented solution in ${language}. Include:
1. Clear problem understanding
2. Step-by-step solution approach
3. Efficient implementation
4. Error handling
5. Comments explaining key decisions

Generate only the ${language} code:`;

    const response = await this.llmRouter.generateText({
      prompt,
      model: this.getInternalModelName(),
      temperature: 0.1,
      maxTokens: 3000,
    });

    return response.content;
  }

  private generateSolutionReasoning(
    problem: Problem,
    solution: string,
    testResults: TestResult[]
  ): string {
    const passedTests = testResults.filter((t) => t.passed).length;
    const totalTests = testResults.length;
    const successRate = totalTests > 0 ? (passedTests / totalTests) * 100 : 0;

    return `Solution Analysis:
- Problem Type: ${problem.category} (${problem.difficulty} difficulty)
- Language: ${problem.language}
- Test Results: ${passedTests}/${totalTests} tests passed (${successRate.toFixed(1)}%)
- Code Quality: ${this.assessCodeQuality(solution)}
- Performance: ${this.assessPerformance(testResults)}
- Maintainability: ${this.assessMaintainability(solution)}`;
  }

  private async generateTestCases(
    code: string,
    language: string,
    testType: string
  ): Promise<any[]> {
    const prompt = `Generate ${testType} test cases for this ${language} code:

\`\`\`${language}
${code}
\`\`\`

Include:
1. Normal cases with expected inputs
2. Edge cases and boundary conditions
3. Error cases that should be handled gracefully
4. At least 8-12 test cases total

For each test case, provide:
- Input values
- Expected output
- Brief description

Format as JSON array:`;

    const response = await this.llmRouter.generateText({
      prompt,
      model: this.getInternalModelName(),
      temperature: 0.1,
      maxTokens: 1500,
    });

    return this.parseTestCases(response.content);
  }

  private generateTestFunctionCode(testCases: any[], language: string): string {
    switch (language) {
      case 'python':
        return this.generatePythonTestFunction(testCases);
      case 'javascript':
        return this.generateJavaScriptTestFunction(testCases);
      case 'typescript':
        return this.generateTypeScriptTestFunction(testCases);
      default:
        return this.generateGenericTestFunction(testCases, language);
    }
  }

  private generatePythonTestFunction(testCases: any[]): string {
    return `import unittest

class TestSolution(unittest.TestCase):
    def setUp(self):
        # Initialize your solution here
        pass

    ${testCases
      .map(
        (testCase, index) => `
    def test_case_${index + 1}(self):
        """${testCase.description || `Test case ${index + 1}`}"""
        input_data = ${JSON.stringify(testCase.input)}
        expected = ${JSON.stringify(testCase.expected_output)}
        result = your_function(input_data)
        self.assertEqual(result, expected)

`
      )
      .join('')}
if __name__ == '__main__':
    unittest.main()`;
  }

  private generateJavaScriptTestFunction(testCases: any[]): string {
    return `// Test function for JavaScript
${testCases
  .map(
    (testCase, index) => `
function testCase${index + 1}() {
    // ${testCase.description || `Test case ${index + 1}`}
    const input = ${JSON.stringify(testCase.input)};
    const expected = ${JSON.stringify(testCase.expected_output)};
    const result = yourFunction(input);

    if (result === expected) {
        console.log(\`Test ${index + 1}: PASSED\`);
    } else {
        console.log(\`Test ${index + 1}: FAILED - Expected \${expected}, got \${result}\`);
    }
}

`
  )
  .join('')}
// Run all tests
${testCases.map((_, index) => `testCase${index + 1}();`).join('\n')}`;
  }

  private generateTypeScriptTestFunction(testCases: any[]): string {
    return `// Test function for TypeScript
${testCases
  .map(
    (testCase, index) => `
function testCase${index + 1}(): void {
    // ${testCase.description || `Test case ${index + 1}`}
    const input: any = ${JSON.stringify(testCase.input)};
    const expected: any = ${JSON.stringify(testCase.expected_output)};
    const result: any = yourFunction(input);

    if (result === expected) {
        console.log(\`Test ${index + 1}: PASSED\`);
    } else {
        console.log(\`Test ${index + 1}: FAILED - Expected \${expected}, got \${result}\`);
    }
}

`
  )
  .join('')}
// Run all tests
${testCases.map((_, index) => `testCase${index + 1}();`).join('\n')}`;
  }

  private generateGenericTestFunction(testCases: any[], language: string): string {
    return `// Test function for ${language}
// Test cases: ${JSON.stringify(testCases, null, 2)}
// Implement test execution logic for ${language}`;
  }

  private calculateTestCoverage(code: string, testCases: any[]): number {
    // Simplified coverage calculation
    const lines = code.split('\n').length;
    const testLines = testCases.length * 2; // Rough estimate
    return Math.min(100, Math.round((testLines / lines) * 100));
  }

  private analyzePerformance(testResults: TestResult[]): any {
    const totalTime = testResults.reduce((sum, t) => sum + t.executionTime, 0);
    const avgTime = totalTime / testResults.length;
    const totalMemory = testResults.reduce((sum, t) => sum + t.memoryUsage, 0);
    const avgMemory = totalMemory / testResults.length;

    return {
      totalExecutionTime: totalTime,
      averageExecutionTime: avgTime,
      totalMemoryUsage: totalMemory,
      averageMemoryUsage: avgMemory,
      performanceRating: this.ratePerformance(avgTime, avgMemory),
    };
  }

  private analyzeSecurity(code: string, language: string): any {
    const securityIssues: string[] = [];

    // Basic security checks
    if (code.includes('eval(') || code.includes('exec(')) {
      securityIssues.push('Dangerous code execution functions detected');
    }

    if (code.includes('process.env') && !code.includes('NODE_ENV')) {
      securityIssues.push('Environment variable access detected');
    }

    if (code.includes('innerHTML') || code.includes('outerHTML')) {
      securityIssues.push('Potential XSS vulnerability detected');
    }

    return {
      issues: securityIssues,
      riskLevel: this.calculateRiskLevel(securityIssues.length),
      recommendations: this.generateSecurityRecommendations(securityIssues),
    };
  }

  private async generateCodeAnalysis(
    code: string,
    language: string,
    context: string
  ): Promise<string> {
    const prompt = `Analyze this ${language} code for quality, efficiency, maintainability, and security:

\`\`\`${language}
${code}
\`\`\`

Context: ${context}

Provide analysis in this format:
Quality: [0-10] - [explanation]
Efficiency: [0-10] - [explanation]
Maintainability: [0-10] - [explanation]
Security: [0-10] - [explanation]
Suggestions: [list of specific improvements]`;

    const response = await this.llmRouter.generateText({
      prompt,
      model: this.getInternalModelName(),
      temperature: 0.1,
      maxTokens: 1000,
    });

    return response.content;
  }

  private parseCodeAnalysis(analysis: string): any {
    const qualityMatch = analysis.match(/Quality:\s*(\d+)/);
    const efficiencyMatch = analysis.match(/Efficiency:\s*(\d+)/);
    const maintainabilityMatch = analysis.match(/Maintainability:\s*(\d+)/);
    const securityMatch = analysis.match(/Security:\s*(\d+)/);
    const suggestionsMatch = analysis.match(/Suggestions:\s*([\s\S]*?)(?=\n|$)/);

    return {
      quality: parseInt(qualityMatch?.[1] || '5'),
      efficiency: parseInt(efficiencyMatch?.[1] || '5'),
      maintainability: parseInt(maintainabilityMatch?.[1] || '5'),
      security: parseInt(securityMatch?.[1] || '5'),
      suggestions: suggestionsMatch?.[1]?.split('\n').filter((s) => s.trim()) || [],
    };
  }

  private async generateCodeImprovements(
    code: string,
    language: string,
    focus: string
  ): Promise<string> {
    const prompt = `Improve this ${language} code focusing on ${focus}:

\`\`\`${language}
${code}
\`\`\`

Focus areas for improvement:
- Code structure and organization
- Performance optimization
- Error handling and robustness
- Security best practices
- Readability and maintainability
- Following ${language} conventions

Provide the improved code with explanations of key changes:`;

    const response = await this.llmRouter.generateText({
      prompt,
      model: this.getInternalModelName(),
      temperature: 0.1,
      maxTokens: 3000,
    });

    return response.content;
  }

  private analyzeImprovements(originalCode: string, improvedCode: string): string[] {
    const improvements: string[] = [];

    if (improvedCode.length < originalCode.length) {
      improvements.push('Code length reduced - more concise implementation');
    }

    if (improvedCode.includes('try') && !originalCode.includes('try')) {
      improvements.push('Added error handling with try-catch blocks');
    }

    if (improvedCode.includes('const') && !originalCode.includes('const')) {
      improvements.push('Improved variable declarations with const/let');
    }

    if (improvedCode.includes('async') && !originalCode.includes('async')) {
      improvements.push('Added asynchronous handling where appropriate');
    }

    return improvements;
  }

  private calculateCodeMetrics(code: string, language: string): any {
    const lines = code.split('\n').length;
    const characters = code.length;
    const functions = (code.match(/function|def|fn/g) || []).length;
    const comments = (code.match(/\/\/|\/\*|#/g) || []).length;

    return {
      linesOfCode: lines,
      characterCount: characters,
      functionCount: functions,
      commentCount: comments,
      commentRatio: lines > 0 ? (comments / lines) * 100 : 0,
      complexity: this.calculateComplexity(code),
    };
  }

  private async generateReasoningExplanation(
    query: string,
    context: string,
    approach: string
  ): Promise<string> {
    const prompt = `Explain your reasoning process for this query using ${approach} approach:

Query: "${query}"
Context: ${context}

Provide a detailed explanation that includes:
1. Initial understanding of the query
2. Key considerations and factors
3. Step-by-step reasoning process
4. Decision-making criteria
5. Alternative approaches considered
6. Final conclusion and confidence level

Make your reasoning clear, logical, and well-structured.`;

    const response = await this.llmRouter.generateText({
      prompt,
      model: this.getInternalModelName(),
      temperature: 0.1,
      maxTokens: 1500,
    });

    return response.content;
  }

  private extractReasoningSteps(explanation: string): string[] {
    // Extract numbered steps from explanation
    const stepMatches = explanation.match(/\d+\.\s*([^\n]+)/g);
    if (stepMatches) {
      return stepMatches.map((step) => step.replace(/^\d+\.\s*/, ''));
    }

    // Fallback: split by sentences
    return explanation.split(/[.!?]+/).filter((s) => s.trim().length > 10);
  }

  private calculateReasoningConfidence(explanation: string, steps: string[]): number {
    let confidence = 0.5; // Base confidence

    // Boost for structured reasoning
    if (steps.length >= 3) {
      confidence += 0.2;
    }

    // Boost for logical connectors
    if (
      explanation.includes('because') ||
      explanation.includes('therefore') ||
      explanation.includes('however')
    ) {
      confidence += 0.15;
    }

    // Boost for specific details
    if (
      explanation.includes('specifically') ||
      explanation.includes('in particular') ||
      explanation.includes('for example')
    ) {
      confidence += 0.1;
    }

    // Penalty for uncertainty indicators
    if (
      explanation.includes('maybe') ||
      explanation.includes('perhaps') ||
      explanation.includes('might')
    ) {
      confidence -= 0.1;
    }

    return Math.max(0, Math.min(1, confidence));
  }

  private async generateReasoningAlternatives(query: string, context: string): Promise<string[]> {
    const prompt = `Generate alternative reasoning approaches for this query:

Query: "${query}"
Context: ${context}

Provide 3-5 different reasoning approaches that could be used to address this query.
Each approach should be distinct and offer a different perspective or methodology.

Format as a numbered list:`;

    const response = await this.llmRouter.generateText({
      prompt,
      model: this.getInternalModelName(),
      temperature: 0.3,
      maxTokens: 800,
    });

    return this.extractAlternatives(response.content);
  }

  // Utility methods
  private parseRequest(context: AgentContext): ReasoningAgentRequest {
    // Parse the context to determine the action and parameters
    const query = context.query || '';

    // Simple action detection based on keywords
    if (query.includes('generate') && query.includes('problem')) {
      return { action: 'generate_problem', parameters: this.extractProblemParameters(query) };
    } else if (query.includes('solve') || query.includes('problem')) {
      return { action: 'solve_problem', parameters: this.extractProblemParameters(query) };
    } else if (query.includes('rank') || query.includes('passage')) {
      return { action: 'rank_passages', parameters: this.extractRankingParameters(query) };
    } else if (query.includes('test') || query.includes('generate')) {
      return { action: 'generate_tests', parameters: this.extractTestParameters(query) };
    } else if (query.includes('execute') || query.includes('run')) {
      return { action: 'execute_code', parameters: this.extractExecutionParameters(query) };
    } else if (query.includes('analyze') || query.includes('review')) {
      return { action: 'analyze_solution', parameters: this.extractAnalysisParameters(query) };
    } else if (query.includes('improve') || query.includes('optimize')) {
      return { action: 'improve_code', parameters: this.extractImprovementParameters(query) };
    } else {
      return { action: 'explain_reasoning', parameters: { query, context: query } };
    }
  }

  private extractProblemParameters(query: string): any {
    const params: any = {};

    // Extract language
    const languageMatch = query.match(/(?:in|using|with)\s+(\w+)/i);
    if (languageMatch) params.language = languageMatch[1];

    // Extract difficulty
    const difficultyMatch = query.match(/(easy|medium|hard|expert)/i);
    if (difficultyMatch) params.difficulty = difficultyMatch[1];

    // Extract category
    const categoryMatch = query.match(/(algorithm|data structure|system design|web|api|database)/i);
    if (categoryMatch) params.category = categoryMatch[1];

    return params;
  }

  private extractRankingParameters(query: string): any {
    return { query, passages: [], topK: 10 };
  }

  private extractTestParameters(query: string): any {
    return { code: '', language: 'python' };
  }

  private extractExecutionParameters(query: string): any {
    return { code: '', language: 'python', testCases: [] };
  }

  private extractAnalysisParameters(query: string): any {
    return { code: '', language: 'python' };
  }

  private extractImprovementParameters(query: string): any {
    return { code: '', language: 'python', focus: 'all' };
  }

  private parseTestCases(content: string): any[] {
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

  private extractAlternatives(content: string): string[] {
    const alternatives: string[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const match = line.match(/^\d+\.\s*(.+)/);
      if (match) {
        alternatives.push(match[1].trim());
      }
    }

    return alternatives.length > 0
      ? alternatives
      : ['Alternative approach 1', 'Alternative approach 2'];
  }

  private assessCodeQuality(code: string): string {
    const lines = code.split('\n').length;
    const comments = (code.match(/\/\/|\/\*|#/g) || []).length;
    const commentRatio = lines > 0 ? comments / lines : 0;

    if (commentRatio > 0.3) return 'Excellent';
    if (commentRatio > 0.2) return 'Good';
    if (commentRatio > 0.1) return 'Fair';
    return 'Needs improvement';
  }

  private assessPerformance(testResults: TestResult[]): string {
    const avgTime = testResults.reduce((sum, t) => sum + t.executionTime, 0) / testResults.length;

    if (avgTime < 10) return 'Excellent';
    if (avgTime < 50) return 'Good';
    if (avgTime < 100) return 'Fair';
    return 'Needs optimization';
  }

  private assessMaintainability(code: string): string {
    const lines = code.split('\n').length;
    const functions = (code.match(/function|def|fn/g) || []).length;
    const avgFunctionSize = functions > 0 ? lines / functions : lines;

    if (avgFunctionSize < 20) return 'Excellent';
    if (avgFunctionSize < 40) return 'Good';
    if (avgFunctionSize < 60) return 'Fair';
    return 'Needs refactoring';
  }

  private ratePerformance(avgTime: number, avgMemory: number): string {
    if (avgTime < 10 && avgMemory < 1000000) return 'Excellent';
    if (avgTime < 50 && avgMemory < 5000000) return 'Good';
    if (avgTime < 100 && avgMemory < 10000000) return 'Fair';
    return 'Needs optimization';
  }

  private calculateRiskLevel(issueCount: number): string {
    if (issueCount === 0) return 'Low';
    if (issueCount <= 2) return 'Medium';
    return 'High';
  }

  private generateSecurityRecommendations(issues: string[]): string[] {
    const recommendations: string[] = [];

    if (issues.some((i) => i.includes('eval'))) {
      recommendations.push(
        'Replace eval() with safer alternatives like JSON.parse() or direct function calls'
      );
    }

    if (issues.some((i) => i.includes('innerHTML'))) {
      recommendations.push('Use textContent instead of innerHTML to prevent XSS attacks');
    }

    if (issues.some((i) => i.includes('process.env'))) {
      recommendations.push('Limit environment variable access and validate all inputs');
    }

    return recommendations.length > 0 ? recommendations : ['No specific security recommendations'];
  }

  private calculateComplexity(code: string): string {
    const lines = code.split('\n').length;
    const functions = (code.match(/function|def|fn/g) || []).length;
    const loops = (code.match(/for|while|do/g) || []).length;
    const conditionals = (code.match(/if|else|switch/g) || []).length;

    const complexity = lines + functions * 2 + loops * 3 + conditionals * 2;

    if (complexity < 50) return 'Low';
    if (complexity < 100) return 'Medium';
    if (complexity < 200) return 'High';
    return 'Very High';
  }

  // Getter methods for external access
  getCapabilities(): ReasoningAgentCapabilities {
    return { ...this.capabilities };
  }

  getReasoningHistory(): Array<{
    query: string;
    reasoning: string;
    timestamp: Date;
    confidence: number;
  }> {
    return [...this.reasoningHistory];
  }

  getProblemCache(): Map<string, Problem> {
    return new Map(this.problemCache);
  }

  getSolutionCache(): Map<string, any> {
    return new Map(this.solutionCache);
  }
}

// Export the enhanced reasoning agent
export const enhancedReasoningAgent = new EnhancedReasoningAgent();
