/**
 * Enhanced Reasoning Agent
 * 
 * An advanced reasoning agent that combines multiple reasoning approaches:
 * - Chain-of-thought reasoning
 * - Tree-of-thought exploration
 * - Multi-step problem decomposition
 * - Critical thinking and verification
 * - AutoCodeBench and ReasonRank integration
 */

import { z } from 'zod';

import { llmRouter } from '@/services/llm-router-service';
import type { AgentConfig, AgentContext, AgentResponse } from '@/types';
import { log, LogContext } from '@/utils/logger';

import { EnhancedBaseAgent } from './enhanced-base-agent';

// Reasoning types and schemas
const ReasoningStepSchema = z.object({
  step: z.number(),
  description: z.string(),
  reasoning: z.string(),
  confidence: z.number().min(0).max(1),
  evidence: z.array(z.string()).optional(),
  alternatives: z.array(z.string()).optional(),
});

const ReasoningTreeSchema = z.object({
  root_question: z.string(),
  reasoning_paths: z.array(z.object({
    path_id: z.string(),
    steps: z.array(ReasoningStepSchema),
    conclusion: z.string(),
    confidence: z.number().min(0).max(1),
    supporting_evidence: z.array(z.string()).optional(),
  })),
  final_synthesis: z.string(),
  confidence: z.number().min(0).max(1),
  reasoning_quality: z.enum(['high', 'medium', 'low']),
});

const CriticalAnalysisSchema = z.object({
  assumptions: z.array(z.string()),
  potential_biases: z.array(z.string()),
  alternative_perspectives: z.array(z.string()),
  logical_fallacies: z.array(z.string()).optional(),
  evidence_quality: z.enum(['strong', 'moderate', 'weak']),
  confidence_assessment: z.string(),
});

export interface ReasoningStep {
  step: number;
  description: string;
  reasoning: string;
  confidence: number;
  evidence?: string[];
  alternatives?: string[];
}

export interface ReasoningPath {
  path_id: string;
  steps: ReasoningStep[];
  conclusion: string;
  confidence: number;
  supporting_evidence?: string[];
}

export interface ReasoningTree {
  root_question: string;
  reasoning_paths: ReasoningPath[];
  final_synthesis: string;
  confidence: number;
  reasoning_quality: 'high' | 'medium' | 'low';
}

export interface CriticalAnalysis {
  assumptions: string[];
  potential_biases: string[];
  alternative_perspectives: string[];
  logical_fallacies?: string[];
  evidence_quality: 'strong' | 'moderate' | 'weak';
  confidence_assessment: string;
}

export interface EnhancedReasoningResponse {
  reasoning_tree: ReasoningTree;
  critical_analysis: CriticalAnalysis;
  final_answer: string;
  confidence: number;
  reasoning_approach: string;
  verification_steps?: string[];
  autocodebench_score?: number;
  reasonrank_evaluation?: {
    clarity: number;
    correctness: number;
    completeness: number;
    overall_score: number;
  };
}

export class EnhancedReasoningAgent extends EnhancedBaseAgent {
  private readonly REASONING_APPROACHES = [
    'chain_of_thought',
    'tree_of_thought', 
    'step_by_step',
    'systematic_analysis',
    'critical_thinking',
  ];

  constructor() {
    const config: AgentConfig = {
      name: 'Enhanced Reasoning Agent',
      description: 'Advanced reasoning agent with multiple reasoning approaches and verification',
      priority: 8,
      capabilities: [
        {
          name: 'complex_reasoning',
          description: 'Performs complex multi-step reasoning with verification',
          inputSchema: {
            type: 'object',
            properties: {
              question: { type: 'string' },
              context: { type: 'string', optional: true },
              reasoning_approach: { 
                type: 'string', 
                enum: ['chain_of_thought', 'tree_of_thought', 'step_by_step', 'systematic_analysis', 'critical_thinking'],
                optional: true 
              }
            },
            required: ['question']
          },
          outputSchema: {
            type: 'object',
            properties: {
              reasoning_tree: { type: 'object' },
              critical_analysis: { type: 'object' },
              final_answer: { type: 'string' },
              confidence: { type: 'number' }
            }
          }
        },
        {
          name: 'logical_verification',
          description: 'Verifies logical consistency and identifies potential flaws',
          inputSchema: {
            type: 'object',
            properties: {
              reasoning: { type: 'string' },
              conclusion: { type: 'string' }
            },
            required: ['reasoning', 'conclusion']
          },
          outputSchema: {
            type: 'object',
            properties: {
              is_logically_consistent: { type: 'boolean' },
              identified_flaws: { type: 'array' },
              suggestions: { type: 'array' }
            }
          }
        },
        {
          name: 'problem_decomposition',
          description: 'Breaks down complex problems into manageable components',
          inputSchema: {
            type: 'object',
            properties: {
              problem: { type: 'string' },
              complexity_level: { type: 'string', enum: ['simple', 'medium', 'complex'], optional: true }
            },
            required: ['problem']
          },
          outputSchema: {
            type: 'object',
            properties: {
              subproblems: { type: 'array' },
              dependencies: { type: 'array' },
              solution_strategy: { type: 'string' }
            }
          }
        }
      ],
      maxLatencyMs: 30000,
      retryAttempts: 2,
      dependencies: ['llm-router-service'],
      memoryEnabled: true,
      toolExecutionEnabled: false,
    };

    super(config);
  }

  protected buildSystemPrompt(): string {
    return `You are an Enhanced Reasoning Agent specialized in complex problem-solving and critical thinking.

Your capabilities include:
- Multi-step logical reasoning with verification
- Tree-of-thought exploration of solution paths
- Critical analysis of assumptions and biases
- Problem decomposition and synthesis
- AutoCodeBench-style code reasoning
- ReasonRank evaluation of reasoning quality

Core Principles:
1. Think step-by-step and show your reasoning process
2. Consider multiple perspectives and alternative solutions
3. Identify and challenge assumptions
4. Verify logical consistency at each step
5. Provide confidence estimates for your reasoning
6. Acknowledge uncertainty when appropriate

When solving problems:
- Break complex problems into manageable components
- Explore multiple reasoning paths when beneficial
- Apply critical thinking to evaluate evidence
- Consider edge cases and potential counterarguments
- Synthesize insights from different approaches
- Provide clear, well-structured explanations

Always structure your responses with clear reasoning trees, critical analysis, and confidence assessments.`;
  }

  protected getInternalModelName(): string {
    return 'gpt-4-turbo'; // Use high-capability model for complex reasoning
  }

  protected getTemperature(): number {
    return 0.3; // Lower temperature for more consistent reasoning
  }

  protected getMaxTokens(): number {
    return 4000; // Allow for detailed reasoning explanations
  }

  public async performEnhancedReasoning(
    question: string,
    context?: string,
    approach?: string
  ): Promise<EnhancedReasoningResponse> {
    const startTime = Date.now();

    try {
      log.info('🧠 Starting enhanced reasoning', LogContext.AGENT, {
        question: question.substring(0, 100),
        approach: approach || 'auto-select',
      });

      // Auto-select reasoning approach if not specified
      const selectedApproach = approach || this.selectReasoningApproach(question);

      // Generate reasoning tree
      const reasoningTree = await this.generateReasoningTree(question, context, selectedApproach);

      // Perform critical analysis
      const criticalAnalysis = await this.performCriticalAnalysis(reasoningTree);

      // Verify and synthesize final answer
      const finalAnswer = await this.synthesizeFinalAnswer(reasoningTree, criticalAnalysis);

      // Calculate overall confidence
      const confidence = this.calculateOverallConfidence(reasoningTree, criticalAnalysis);

      // AutoCodeBench evaluation (if applicable)
      const autocodebenchScore = this.isCodeRelatedQuestion(question) 
        ? await this.evaluateWithAutoCodeBench(question, finalAnswer)
        : undefined;

      // ReasonRank evaluation
      const reasonrankEvaluation = await this.evaluateWithReasonRank(
        question,
        reasoningTree,
        finalAnswer
      );

      const response: EnhancedReasoningResponse = {
        reasoning_tree: reasoningTree,
        critical_analysis: criticalAnalysis,
        final_answer: finalAnswer,
        confidence,
        reasoning_approach: selectedApproach,
        autocodebench_score: autocodebenchScore,
        reasonrank_evaluation: reasonrankEvaluation,
      };

      const executionTime = Date.now() - startTime;
      log.info('✅ Enhanced reasoning completed', LogContext.AGENT, {
        approach: selectedApproach,
        confidence,
        executionTime: `${executionTime}ms`,
        reasoningPaths: reasoningTree.reasoning_paths.length,
      });

      return response;
    } catch (error) {
      log.error('❌ Enhanced reasoning failed', LogContext.AGENT, {
        error: error instanceof Error ? error.message : String(error),
        question: question.substring(0, 100),
      });
      throw error;
    }
  }

  protected async processLLMResponse(
    llmResponse: any,
    context: AgentContext
  ): Promise<AgentResponse> {
    try {
      // Check if this is an enhanced reasoning request
      const userRequest = context.userRequest.toLowerCase();
      const isReasoningRequest = userRequest.includes('reason') || 
                                 userRequest.includes('analyze') ||
                                 userRequest.includes('think') ||
                                 userRequest.includes('explain') ||
                                 userRequest.includes('solve');

      if (isReasoningRequest) {
        // Perform enhanced reasoning
        const reasoningResponse = await this.performEnhancedReasoning(
          context.userRequest,
          context.metadata?.context as string,
          context.metadata?.approach as string
        );

        return {
          success: true,
          data: reasoningResponse,
          confidence: reasoningResponse.confidence,
          message: 'Enhanced reasoning completed successfully',
          reasoning: `Applied ${reasoningResponse.reasoning_approach} reasoning approach with confidence ${reasoningResponse.confidence.toFixed(2)}`,
          metadata: {
            reasoning_approach: reasoningResponse.reasoning_approach,
            reasoning_paths: reasoningResponse.reasoning_tree.reasoning_paths.length,
            autocodebench_score: reasoningResponse.autocodebench_score,
            reasonrank_score: reasoningResponse.reasonrank_evaluation?.overall_score,
          },
        };
      } else {
        // Standard processing for non-reasoning requests
        return super.processLLMResponse(llmResponse, context);
      }
    } catch (error) {
      return {
        success: false,
        data: null,
        confidence: 0,
        message: 'Enhanced reasoning failed',
        reasoning: `Error in reasoning process: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  private selectReasoningApproach(question: string): string {
    const lowerQuestion = question.toLowerCase();

    // Code-related questions benefit from systematic analysis
    if (this.isCodeRelatedQuestion(question)) {
      return 'systematic_analysis';
    }

    // Complex logical problems benefit from tree-of-thought
    if (lowerQuestion.includes('if') && lowerQuestion.includes('then') || 
        lowerQuestion.includes('because') || 
        lowerQuestion.includes('multiple') ||
        lowerQuestion.includes('various')) {
      return 'tree_of_thought';
    }

    // Step-by-step for procedural questions
    if (lowerQuestion.includes('how to') || 
        lowerQuestion.includes('steps') || 
        lowerQuestion.includes('process')) {
      return 'step_by_step';
    }

    // Critical thinking for evaluative questions
    if (lowerQuestion.includes('evaluate') || 
        lowerQuestion.includes('assess') || 
        lowerQuestion.includes('compare') ||
        lowerQuestion.includes('pros and cons')) {
      return 'critical_thinking';
    }

    // Default to chain-of-thought
    return 'chain_of_thought';
  }

  private async generateReasoningTree(
    question: string,
    context: string | undefined,
    approach: string
  ): Promise<ReasoningTree> {
    const prompt = `Generate a comprehensive reasoning tree for the following question using the ${approach} approach.

Question: ${question}
${context ? `Context: ${context}` : ''}

Please provide your response as a JSON object with the following structure:
{
  "root_question": "string",
  "reasoning_paths": [
    {
      "path_id": "string",
      "steps": [
        {
          "step": number,
          "description": "string",
          "reasoning": "string",
          "confidence": number,
          "evidence": ["string"],
          "alternatives": ["string"]
        }
      ],
      "conclusion": "string",
      "confidence": number,
      "supporting_evidence": ["string"]
    }
  ],
  "final_synthesis": "string",
  "confidence": number,
  "reasoning_quality": "high|medium|low"
}

Generate 2-4 different reasoning paths, explore alternatives at each step, and provide detailed reasoning.`;

    const response = await llmRouter.generateResponse(this.getInternalModelName(), [
      { role: 'system', content: this.buildSystemPrompt() },
      { role: 'user', content: prompt }
    ], {
      temperature: this.getTemperature(),
      maxTokens: this.getMaxTokens(),
    });

    try {
      const parsed = JSON.parse(response.content);
      return ReasoningTreeSchema.parse(parsed);
    } catch (parseError) {
      // Fallback: create a basic reasoning tree from the text response
      return this.createFallbackReasoningTree(question, response.content);
    }
  }

  private async performCriticalAnalysis(reasoningTree: ReasoningTree): Promise<CriticalAnalysis> {
    const prompt = `Perform a critical analysis of the following reasoning tree. Identify assumptions, potential biases, alternative perspectives, and assess the quality of evidence.

Reasoning Tree:
${JSON.stringify(reasoningTree, null, 2)}

Please provide your analysis as a JSON object:
{
  "assumptions": ["string"],
  "potential_biases": ["string"],
  "alternative_perspectives": ["string"],
  "logical_fallacies": ["string"],
  "evidence_quality": "strong|moderate|weak",
  "confidence_assessment": "string"
}`;

    const response = await llmRouter.generateResponse(this.getInternalModelName(), [
      { role: 'system', content: this.buildSystemPrompt() },
      { role: 'user', content: prompt }
    ], {
      temperature: 0.4, // Slightly higher for diverse critical perspectives
      maxTokens: 2000,
    });

    try {
      const parsed = JSON.parse(response.content);
      return CriticalAnalysisSchema.parse(parsed);
    } catch (parseError) {
      // Fallback critical analysis
      return {
        assumptions: ['Basic assumptions identified from reasoning'],
        potential_biases: ['Potential confirmation bias in reasoning paths'],
        alternative_perspectives: ['Alternative viewpoints to consider'],
        evidence_quality: 'moderate',
        confidence_assessment: 'Moderate confidence based on available evidence',
      };
    }
  }

  private async synthesizeFinalAnswer(
    reasoningTree: ReasoningTree,
    criticalAnalysis: CriticalAnalysis
  ): Promise<string> {
    const prompt = `Based on the reasoning tree and critical analysis provided, synthesize a final, well-reasoned answer.

Reasoning Tree Final Synthesis: ${reasoningTree.final_synthesis}

Critical Analysis:
- Assumptions: ${criticalAnalysis.assumptions.join(', ')}
- Potential Biases: ${criticalAnalysis.potential_biases.join(', ')}
- Alternative Perspectives: ${criticalAnalysis.alternative_perspectives.join(', ')}
- Evidence Quality: ${criticalAnalysis.evidence_quality}

Provide a final answer that:
1. Incorporates insights from multiple reasoning paths
2. Acknowledges limitations and assumptions
3. Considers alternative perspectives
4. Provides actionable conclusions when appropriate
5. Indicates confidence level and reasoning quality

Final Answer:`;

    const response = await llmRouter.generateResponse(this.getInternalModelName(), [
      { role: 'system', content: this.buildSystemPrompt() },
      { role: 'user', content: prompt }
    ], {
      temperature: 0.3,
      maxTokens: 1500,
    });

    return response.content;
  }

  private calculateOverallConfidence(
    reasoningTree: ReasoningTree,
    criticalAnalysis: CriticalAnalysis
  ): number {
    // Base confidence from reasoning tree
    let {confidence} = reasoningTree;

    // Adjust based on reasoning quality
    if (reasoningTree.reasoning_quality === 'high') {
      confidence += 0.1;
    } else if (reasoningTree.reasoning_quality === 'low') {
      confidence -= 0.1;
    }

    // Adjust based on evidence quality
    if (criticalAnalysis.evidence_quality === 'strong') {
      confidence += 0.05;
    } else if (criticalAnalysis.evidence_quality === 'weak') {
      confidence -= 0.1;
    }

    // Adjust based on number of reasoning paths (more paths = higher confidence)
    const pathBonus = Math.min(0.1, reasoningTree.reasoning_paths.length * 0.02);
    confidence += pathBonus;

    // Ensure confidence stays within bounds
    return Math.max(0.1, Math.min(1.0, confidence));
  }

  private isCodeRelatedQuestion(question: string): boolean {
    const codeKeywords = [
      'code', 'programming', 'algorithm', 'function', 'class', 'method',
      'variable', 'loop', 'conditional', 'array', 'object', 'string',
      'python', 'javascript', 'typescript', 'java', 'cpp', 'c++',
      'html', 'css', 'sql', 'database', 'api', 'framework',
      'debug', 'error', 'bug', 'syntax', 'compile', 'runtime'
    ];

    const lowerQuestion = question.toLowerCase();
    return codeKeywords.some(keyword => lowerQuestion.includes(keyword));
  }

  private async evaluateWithAutoCodeBench(question: string, answer: string): Promise<number> {
    // AutoCodeBench-style evaluation for code-related reasoning
    const evaluationPrompt = `Evaluate the following code-related reasoning using AutoCodeBench criteria:

Question: ${question}
Answer: ${answer}

Rate the answer on a scale of 0-100 based on:
1. Correctness of the technical reasoning
2. Completeness of the solution approach
3. Code quality considerations
4. Best practices adherence
5. Problem-solving methodology

Provide only the numeric score (0-100):`;

    try {
      const response = await llmRouter.generateResponse(this.getInternalModelName(), [
        { role: 'user', content: evaluationPrompt }
      ], {
        temperature: 0.1,
        maxTokens: 50,
      });

      const score = parseInt(response.content.trim(), 10);
      return isNaN(score) ? 75 : Math.max(0, Math.min(100, score));
    } catch (error) {
      log.warn('⚠️ AutoCodeBench evaluation failed', LogContext.AGENT, {
        error: error instanceof Error ? error.message : String(error),
      });
      return 75; // Default score
    }
  }

  private async evaluateWithReasonRank(
    question: string,
    reasoningTree: ReasoningTree,
    finalAnswer: string
  ): Promise<{
    clarity: number;
    correctness: number;
    completeness: number;
    overall_score: number;
  }> {
    // ReasonRank-style evaluation
    const evaluationPrompt = `Evaluate the reasoning quality using ReasonRank criteria:

Question: ${question}
Final Answer: ${finalAnswer}
Reasoning Quality: ${reasoningTree.reasoning_quality}
Number of Reasoning Paths: ${reasoningTree.reasoning_paths.length}

Rate each aspect on a scale of 0-10:

1. Clarity: How clear and well-structured is the reasoning?
2. Correctness: How logically sound and accurate is the reasoning?
3. Completeness: How thoroughly does the reasoning address the question?

Provide scores as JSON:
{
  "clarity": number,
  "correctness": number,
  "completeness": number
}`;

    try {
      const response = await llmRouter.generateResponse(this.getInternalModelName(), [
        { role: 'user', content: evaluationPrompt }
      ], {
        temperature: 0.1,
        maxTokens: 200,
      });

      const parsed = JSON.parse(response.content);
      const clarity = Math.max(0, Math.min(10, parsed.clarity || 7));
      const correctness = Math.max(0, Math.min(10, parsed.correctness || 7));
      const completeness = Math.max(0, Math.min(10, parsed.completeness || 7));
      const overall_score = (clarity + correctness + completeness) / 3;

      return { clarity, correctness, completeness, overall_score };
    } catch (error) {
      log.warn('⚠️ ReasonRank evaluation failed', LogContext.AGENT, {
        error: error instanceof Error ? error.message : String(error),
      });
      return { clarity: 7, correctness: 7, completeness: 7, overall_score: 7 };
    }
  }

  private createFallbackReasoningTree(question: string, content: string): ReasoningTree {
    return {
      root_question: question,
      reasoning_paths: [
        {
          path_id: 'fallback_path',
          steps: [
            {
              step: 1,
              description: 'Initial analysis',
              reasoning: content.substring(0, 200),
              confidence: 0.7,
            },
          ],
          conclusion: content.substring(0, 100),
          confidence: 0.7,
        },
      ],
      final_synthesis: content,
      confidence: 0.7,
      reasoning_quality: 'medium',
    };
  }

  protected getAdditionalContext(context: AgentContext): string | null {
    const contextParts: string[] = [];

    if (context.metadata?.reasoning_approach) {
      contextParts.push(`Preferred reasoning approach: ${context.metadata.reasoning_approach}`);
    }

    if (context.metadata?.domain) {
      contextParts.push(`Domain context: ${context.metadata.domain}`);
    }

    if (context.metadata?.complexity) {
      contextParts.push(`Problem complexity: ${context.metadata.complexity}`);
    }

    return contextParts.length > 0 ? contextParts.join("\n") : null;
  }

  protected getContextTypes(): string[] {
    return [
      'reasoning_patterns',
      'logical_frameworks',
      'problem_solving_approaches',
      'critical_thinking_methods',
      'verification_techniques',
    ];
  }
}

export default EnhancedReasoningAgent;
