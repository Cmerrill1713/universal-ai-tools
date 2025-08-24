/**
 * Intelligent Parameter Service
 * Automatically adjusts context length, prompts, and temperature based on task type
 */

import { TaskType } from '../types/index.js';
import { TWO } from '../utils/constants';
import { log,LogContext } from '../utils/logger';

export interface TaskParameters {
  contextLength: number;
  temperature: number;
  topP?: number;
  maxTokens: number;
  systemPrompt: string;
  userPromptTemplate: string;
  stopSequences?: string[];
  presencePenalty?: number;
  frequencyPenalty?: number;
}

export interface TaskContext {
  type: TaskType;
  userInput: string;
  additionalContext?: Record<string, any>;
  userPreferences?: UserPreferences;
  complexity?: 'simple' | 'medium' | 'complex';
  domain?: string;
  expectedOutputLength?: 'short' | 'medium' | 'long';
}

export interface UserPreferences {
  preferredTemperature?: number;
  preferredLength?: 'concise' | 'detailed' | 'comprehensive';
  writingStyle?: 'formal' | 'casual' | 'technical';
  creativity?: 'conservative' | 'balanced' | 'creative';
}

export class IntelligentParameterService {
  private taskProfiles: Map<TaskType, TaskParameters>;
  private contextTemplates: Map<TaskType, string>;
  private domainAdjustments: Map<string, Partial<TaskParameters>>;

  constructor() {
    this.taskProfiles = new Map();
    this.contextTemplates = new Map();
    this.domainAdjustments = new Map();
    this.initializeTaskProfiles();
    this.initializeContextTemplates();
    this.initializeDomainAdjustments();
  }

  private initializeTaskProfiles(): void {
    // Code Generation Tasks
    this.taskProfiles.set(TaskType.CODE_GENERATION, {
      contextLength: 8192,
      temperature: 0.2,
      topP: 0.9,
      maxTokens: 2048,
      systemPrompt:
        'You are an expert software engineer. Write clean, efficient, well-documented code following best practices.',
      userPromptTemplate:
        'Generate {language} code for: {request}\n\nRequirements:\n- Follow best practices and conventions\n- Include appropriate comments\n- Handle edge cases\n- Make code maintainable\n\nCode:',
      stopSequences: ['```\n\n', '---'],
      presencePenalty: 0.1,
      frequencyPenalty: 0.1,
    });

    this.taskProfiles.set(TaskType.CODE_REVIEW, {
      contextLength: 16384,
      temperature: 0.1,
      topP: 0.8,
      maxTokens: 1024,
      systemPrompt:
        'You are a senior code reviewer. Provide thorough, constructive feedback focusing on security, performance, maintainability, and best practices.',
      userPromptTemplate:
        'Review this code and provide detailed feedback:\n\n```{language}\n{code}\n```\n\nFocus on:\n- Security vulnerabilities\n- Performance issues\n- Code quality and maintainability\n- Best practices\n- Potential bugs\n\nReview:',
      presencePenalty: 0.0,
      frequencyPenalty: 0.0,
    });

    this.taskProfiles.set(TaskType.CODE_DEBUGGING, {
      contextLength: 12288,
      temperature: 0.1,
      topP: 0.8,
      maxTokens: 1536,
      systemPrompt:
        'You are a debugging expert. Analyze code systematically to identify and fix issues.',
      userPromptTemplate:
        'Debug this code issue:\n\n**Code:**\n```{language}\n{code}\n```\n\n**Error/Issue:** {error}\n\n**Expected Behavior:** {expected}\n\nAnalyze the issue step-by-step and provide a fix:',
      presencePenalty: 0.0,
      frequencyPenalty: 0.0,
    });

    // Creative Tasks
    this.taskProfiles.set(TaskType.CREATIVE_WRITING, {
      contextLength: 8192,
      temperature: 0.8,
      topP: 0.95,
      maxTokens: 2048,
      systemPrompt:
        'You are a creative writer with expertise in storytelling, character development, and engaging prose.',
      userPromptTemplate:
        'Write creatively about: {request}\n\nStyle: {style}\nTone: {tone}\nLength: {length}\n\nStory:',
      presencePenalty: 0.6,
      frequencyPenalty: 0.3,
    });

    this.taskProfiles.set(TaskType.BRAINSTORMING, {
      contextLength: 4096,
      temperature: 0.9,
      topP: 0.95,
      maxTokens: 1024,
      systemPrompt:
        'You are an innovative thinker who generates diverse, creative ideas. Think outside the box.',
      userPromptTemplate:
        'Generate creative ideas for: {request}\n\nContext: {context}\nConstraints: {constraints}\n\nBrainstorm diverse, innovative solutions:',
      presencePenalty: 0.8,
      frequencyPenalty: 0.4,
    });

    // Analysis Tasks
    this.taskProfiles.set(TaskType.DATA_ANALYSIS, {
      contextLength: 16384,
      temperature: 0.2,
      topP: 0.9,
      maxTokens: 2048,
      systemPrompt:
        'You are a data scientist who provides thorough, accurate analysis with actionable insights.',
      userPromptTemplate:
        'Analyze this data:\n\n{data}\n\nAnalysis goals: {goals}\n\nProvide:\n- Key insights\n- Patterns and trends\n- Statistical summary\n- Recommendations\n\nAnalysis:',
      presencePenalty: 0.1,
      frequencyPenalty: 0.1,
    });

    this.taskProfiles.set(TaskType.RESEARCH, {
      contextLength: 20480,
      temperature: 0.3,
      topP: 0.9,
      maxTokens: 3072,
      systemPrompt:
        'You are a research expert who provides comprehensive, well-sourced analysis on complex topics.',
      userPromptTemplate:
        'Research topic: {topic}\n\nScope: {scope}\nFocus areas: {focus}\n\nProvide a comprehensive research summary with:\n- Key findings\n- Supporting evidence\n- Different perspectives\n- Implications\n\nResearch:',
      presencePenalty: 0.2,
      frequencyPenalty: 0.1,
    });

    // Question Answering
    this.taskProfiles.set(TaskType.FACTUAL_QA, {
      contextLength: 8192,
      temperature: 0.1,
      topP: 0.8,
      maxTokens: 512,
      systemPrompt:
        'You provide accurate, factual answers. If uncertain, clearly state limitations.',
      userPromptTemplate:
        'Question: {question}\n\nContext: {context}\n\nProvide a clear, accurate answer:',
      presencePenalty: 0.0,
      frequencyPenalty: 0.0,
    });

    this.taskProfiles.set(TaskType.REASONING, {
      contextLength: 12288,
      temperature: 0.2,
      topP: 0.9,
      maxTokens: 1536,
      systemPrompt:
        'You reason through problems step-by-step, showing your logical process clearly.',
      userPromptTemplate:
        'Problem: {problem}\n\nGiven information: {given}\n\nSolve this step-by-step, showing your reasoning:',
      presencePenalty: 0.1,
      frequencyPenalty: 0.1,
    });

    // Conversation Types
    this.taskProfiles.set(TaskType.CASUAL_CHAT, {
      contextLength: 4096,
      temperature: 0.7,
      topP: 0.9,
      maxTokens: 512,
      systemPrompt: 'You are a friendly, helpful assistant who engages in natural conversation.',
      userPromptTemplate: '{message}',
      presencePenalty: 0.3,
      frequencyPenalty: 0.2,
    });

    this.taskProfiles.set(TaskType.TECHNICAL_SUPPORT, {
      contextLength: 8192,
      temperature: 0.2,
      topP: 0.9,
      maxTokens: 1024,
      systemPrompt:
        'You are a technical support expert who provides clear, step-by-step solutions.',
      userPromptTemplate:
        'Technical issue: {issue}\n\nSystem: {system}\nError details: {error}\n\nProvide a clear solution with steps:',
      presencePenalty: 0.1,
      frequencyPenalty: 0.1,
    });

    // Specialized Tasks
    this.taskProfiles.set(TaskType.SUMMARIZATION, {
      contextLength: 16384,
      temperature: 0.2,
      topP: 0.9,
      maxTokens: 1024,
      systemPrompt:
        'You create clear, comprehensive summaries that capture key information and insights.',
      userPromptTemplate:
        'Summarize this content:\n\n{content}\n\nSummary length: {length}\nFocus: {focus}\n\nSummary:',
      presencePenalty: 0.1,
      frequencyPenalty: 0.2,
    });

    this.taskProfiles.set(TaskType.TRANSLATION, {
      contextLength: 8192,
      temperature: 0.1,
      topP: 0.8,
      maxTokens: 2048,
      systemPrompt:
        'You are an expert translator who preserves meaning, tone, and cultural nuances.',
      userPromptTemplate:
        'Translate from {source_lang} to {target_lang}:\n\n{text}\n\nMaintain tone and cultural context. Translation:',
      presencePenalty: 0.0,
      frequencyPenalty: 0.0,
    });

    // Vision Tasks
    this.taskProfiles.set(TaskType.IMAGE_ANALYSIS, {
      contextLength: 4096,
      temperature: 0.3,
      topP: 0.9,
      maxTokens: 1024,
      systemPrompt:
        'You are an expert at analyzing images in detail, identifying objects, scenes, and patterns.',
      userPromptTemplate:
        'Analyze this image in detail:\n\nFocus on: {focus}\nContext: {context}\n\nProvide a comprehensive analysis:',
      presencePenalty: 0.2,
      frequencyPenalty: 0.1,
    });

    this.taskProfiles.set(TaskType.VISUAL_REASONING, {
      contextLength: 6144,
      temperature: 0.4,
      topP: 0.9,
      maxTokens: 1536,
      systemPrompt:
        'You analyze images and reason about their contents, relationships, and implications.',
      userPromptTemplate:
        'Look at this image and answer: {question}\n\nReason through your analysis step by step:',
      presencePenalty: 0.2,
      frequencyPenalty: 0.1,
    });

    // Fine-tuning Tasks
    this.taskProfiles.set(TaskType.MODEL_TRAINING, {
      contextLength: 2048,
      temperature: 0.1,
      topP: 0.8,
      maxTokens: 512,
      systemPrompt: 'You are an ML engineer optimizing model training parameters and processes.',
      userPromptTemplate:
        'Training task: {task}\nDataset: {dataset}\nModel: {model}\n\nOptimize training parameters:',
      presencePenalty: 0.0,
      frequencyPenalty: 0.0,
    });
  }

  private initializeContextTemplates(): void {
    // Code-specific templates
    this.contextTemplates.set(
      TaskType.CODE_GENERATION,
      'Programming Language: {language}\nFramework: {framework}\nComplexity: {complexity}\nEnvironment: {environment}'
    );

    // Analysis templates
    this.contextTemplates.set(
      TaskType.DATA_ANALYSIS,
      'Data Type: {dataType}\nSize: {size}\nObjective: {objective}\nConstraints: {constraints}'
    );

    // Creative templates
    this.contextTemplates.set(
      TaskType.CREATIVE_WRITING,
      'Genre: {genre}\nAudience: {audience}\nMood: {mood}\nSetting: {setting}'
    );
  }

  private initializeDomainAdjustments(): void {
    // Academic domain - more formal, thorough
    this.domainAdjustments.set('academic', {
      temperature: -0.1,
      maxTokens: 512,
      systemPrompt:
        'You are an academic expert. Provide thorough, well-researched responses with proper reasoning.',
    });

    // Creative domain - more expressive
    this.domainAdjustments.set('creative', {
      temperature: 0.2,
      presencePenalty: 0.2,
      frequencyPenalty: 0.1,
    });

    // Technical domain - precise and detailed
    this.domainAdjustments.set('technical', {
      temperature: -0.1,
      contextLength: 4096,
      systemPrompt:
        'You are a technical expert. Provide precise, detailed, and accurate technical information.',
    });

    // Business domain - practical and actionable
    this.domainAdjustments.set('business', {
      temperature: -0.05,
      maxTokens: 256,
      systemPrompt:
        'You are a business consultant. Provide practical, actionable advice with clear ROI considerations.',
    });
  }

  /**
   * Get optimized parameters for a specific task
   */
  public getTaskParameters(context: TaskContext): TaskParameters {
    const baseParams = this.taskProfiles.get(context.type);
    if (!baseParams) {
      log.warn('Unknown task type, using default parameters', LogContext.AI, {
        taskType: context.type,
      });
      return this.getDefaultParameters();
    }

    // Clone base parameters
    let params: TaskParameters = JSON.parse(JSON.stringify(baseParams));

    // Apply complexity adjustments
    params = this.adjustForComplexity(params, context.complexity || 'medium');

    // Apply domain adjustments
    if (context.domain) {
      params = this.adjustForDomain(params, context.domain);
    }

    // Apply user preferences
    if (context.userPreferences) {
      params = this.adjustForUserPreferences(params, context.userPreferences);
    }

    // Apply output length adjustments
    if (context.expectedOutputLength) {
      params = this.adjustForOutputLength(params, context.expectedOutputLength);
    }

    // Apply dynamic template
    params.userPromptTemplate = this.buildDynamicPrompt(params.userPromptTemplate, context);

    log.info('Generated task parameters', LogContext.AI, {
      taskType: context.type,
      contextLength: params.contextLength,
      temperature: params.temperature,
      maxTokens: params.maxTokens,
    });

    return params;
  }

  private adjustForComplexity(params: TaskParameters, complexity: string): TaskParameters {
    const adjustments = {
      simple: { contextLength: 0.7, maxTokens: 0.7, temperature: -0.1 },
      medium: { contextLength: 1.0, maxTokens: 1.0, temperature: 0.0 },
      complex: { contextLength: 1.5, maxTokens: 1.3, temperature: 0.1 },
    };

    const adjustment = adjustments[complexity as keyof typeof adjustments] || adjustments.medium;

    return {
      ...params,
      contextLength: Math.round(params.contextLength * adjustment.contextLength),
      maxTokens: Math.round(params.maxTokens * adjustment.maxTokens),
      temperature: Math.max(0.0, Math.min(1.0, params.temperature + adjustment.temperature)),
    };
  }

  private adjustForDomain(params: TaskParameters, domain: string): TaskParameters {
    const domainAdjustment = this.domainAdjustments.get(domain);
    if (!domainAdjustment) {return params;}

    return {
      ...params,
      ...domainAdjustment,
      contextLength: domainAdjustment.contextLength || params.contextLength,
      temperature:
        domainAdjustment.temperature !== undefined
          ? Math.max(0.0, Math.min(1.0, params.temperature + domainAdjustment.temperature))
          : params.temperature,
    };
  }

  private adjustForUserPreferences(params: TaskParameters, prefs: UserPreferences): TaskParameters {
    const adjusted = { ...params };

    // Temperature preference
    if (prefs.preferredTemperature !== undefined) {
      adjusted.temperature = prefs.preferredTemperature;
    } else if (prefs.creativity) {
      const creativityAdjustments = {
        conservative: -0.2,
        balanced: 0.0,
        creative: 0.3,
      };
      adjusted.temperature = Math.max(
        0.0,
        Math.min(1.0, adjusted.temperature + creativityAdjustments[prefs.creativity])
      );
    }

    // Length preference
    if (prefs.preferredLength) {
      const lengthMultipliers = {
        concise: 0.7,
        detailed: 1.2,
        comprehensive: 1.5,
      };
      adjusted.maxTokens = Math.round(
        adjusted.maxTokens * lengthMultipliers[prefs.preferredLength]
      );
    }

    // Writing style adjustments
    if (prefs.writingStyle === 'formal') {
      adjusted.temperature = Math.max(0.1, adjusted.temperature - 0.1);
      adjusted.presencePenalty = (adjusted.presencePenalty || 0) - 0.1;
    } else if (prefs.writingStyle === 'casual') {
      adjusted.temperature = Math.min(0.9, adjusted.temperature + 0.1);
      adjusted.presencePenalty = (adjusted.presencePenalty || 0) + 0.1;
    }

    return adjusted;
  }

  private adjustForOutputLength(params: TaskParameters, expectedLength: string): TaskParameters {
    const lengthMultipliers = {
      short: 0.5,
      medium: 1.0,
      long: 1.8,
    };

    const multiplier = lengthMultipliers[expectedLength as keyof typeof lengthMultipliers] || 1.0;

    return {
      ...params,
      maxTokens: Math.round(params.maxTokens * multiplier),
      contextLength: Math.round(params.contextLength * Math.min(multiplier, 1.2)), // Don't increase context as much
    };
  }

  private buildDynamicPrompt(template: string, context: TaskContext): string {
    let prompt = template;

    // Replace common placeholders
    const replacements: Record<string, string> = {
      '{request}': context.userInput,
      '{user_input}': context.userInput,
      '{question}': context.userInput,
      '{problem}': context.userInput,
      '{message}': context.userInput,
      '{topic}': context.userInput,
      '{content}': context.userInput,
      '{text}': context.userInput,
      ...context.additionalContext,
    };

    for (const [placeholder, value] of Object.entries(replacements)) {
      if (value !== undefined) {
        prompt = prompt.replace(
          new RegExp(placeholder.replace(/[.*+?^${}()|[]\]/g, '\$&'), 'g'),
          value
        );
      }
    }

    return prompt;
  }

  /**
   * Automatically detect task type from user input
   */
  public detectTaskType(userInput: string, context?: Record<string, any>): TaskType {
    const input = userInput.toLowerCase();

    // Code-related keywords
    if (
      this.containsKeywords(input, [
        'write code',
        'generate code',
        'create function',
        'implement',
        'code for',
        'program',
        'script',
      ])
    ) {
      return TaskType.CODE_GENERATION;
    }
    if (
      this.containsKeywords(input, [
        'review code',
        'check code',
        'code review',
        'improve code',
        'optimize code',
      ])
    ) {
      return TaskType.CODE_REVIEW;
    }
    if (
      this.containsKeywords(input, ['debug', 'fix bug', 'error', 'not working', 'troubleshoot'])
    ) {
      return TaskType.CODE_DEBUGGING;
    }
    if (
      this.containsKeywords(input, [
        'explain code',
        'how does',
        'what does this code',
        'understand code',
      ])
    ) {
      return TaskType.CODE_EXPLANATION;
    }

    // Creative tasks
    if (
      this.containsKeywords(input, [
        'write story',
        'creative writing',
        'story about',
        'write fiction',
        'novel',
      ])
    ) {
      return TaskType.CREATIVE_WRITING;
    }
    if (
      this.containsKeywords(input, [
        'brainstorm',
        'ideas for',
        'creative ideas',
        'think of ways',
        'suggestions',
      ])
    ) {
      return TaskType.BRAINSTORMING;
    }

    // Analysis tasks
    if (
      this.containsKeywords(input, [
        'analyze data',
        'data analysis',
        'statistical',
        'trends',
        'patterns',
      ])
    ) {
      return TaskType.DATA_ANALYSIS;
    }
    if (
      this.containsKeywords(input, [
        'research',
        'study',
        'investigate',
        'find information',
        'comprehensive analysis',
      ])
    ) {
      return TaskType.RESEARCH;
    }

    // Question answering
    if (
      this.containsKeywords(input, [
        'what is',
        'who is',
        'when did',
        'where is',
        'how many',
        'define',
      ])
    ) {
      return TaskType.FACTUAL_QA;
    }
    if (
      this.containsKeywords(input, ['solve', 'calculate', 'reasoning', 'logic', 'step by step'])
    ) {
      return TaskType.REASONING;
    }
    if (this.containsKeywords(input, ['explain', 'how to', 'tutorial', 'guide', 'teach me'])) {
      return TaskType.EXPLANATION;
    }

    // Specialized tasks
    if (
      this.containsKeywords(input, [
        'translate',
        'translation',
        'in spanish',
        'in french',
        'language',
      ])
    ) {
      return TaskType.TRANSLATION;
    }
    if (this.containsKeywords(input, ['summarize', 'summary', 'tldr', 'key points', 'brief'])) {
      return TaskType.SUMMARIZATION;
    }

    // Vision tasks
    if (
      context?.hasImage ||
      this.containsKeywords(input, ['image', 'picture', 'photo', 'visual', 'analyze image'])
    ) {
      if (this.containsKeywords(input, ['what is in', 'describe image', 'what do you see'])) {
        return TaskType.IMAGE_DESCRIPTION;
      }
      if (this.containsKeywords(input, ['why', 'how', 'reasoning', 'explain image'])) {
        return TaskType.VISUAL_REASONING;
      }
      return TaskType.IMAGE_ANALYSIS;
    }

    // Default to casual chat
    return TaskType.CASUAL_CHAT;
  }

  private containsKeywords(text: string, keywords: string[]): boolean {
    return keywords.some((keyword) => text.includes(keyword));
  }

  private getDefaultParameters(): TaskParameters {
    return {
      contextLength: 4096,
      temperature: 0.5,
      topP: 0.9,
      maxTokens: 1024,
      systemPrompt: 'You are a helpful AI assistant.',
      userPromptTemplate: '{user_input}',
      presencePenalty: 0.1,
      frequencyPenalty: 0.1,
    };
  }

  /**
   * Get parameters optimized for a specific model
   */
  public getModelOptimizedParameters(
    baseParams: TaskParameters,
    modelName: string
  ): TaskParameters {
    const params = { ...baseParams };

    // Model-specific optimizations
    if (modelName.includes('gpt-4')) {
      // GPT-4 handles longer contexts well
      params.contextLength = Math.min(params.contextLength * 1.5, 32768);
    } else if (modelName.includes('gpt-3.5')) {
      // GPT-3.5 is more limited
      params.contextLength = Math.min(params.contextLength, 4096);
      params.maxTokens = Math.min(params.maxTokens, 2048);
    } else if (modelName.includes('claude')) {
      // Claude handles very long contexts
      params.contextLength = Math.min(params.contextLength * TWO, 100000);
    } else if (modelName.includes('llama')) {
      // Llama models vary in context length
      if (modelName.includes('70b') || modelName.includes('65b')) {
        params.contextLength = Math.min(params.contextLength * 1.2, 8192);
      } else {
        params.contextLength = Math.min(params.contextLength, 4096);
      }
    }

    return params;
  }

  /**
   * Create task context from request
   */
  public createTaskContext(
    userInput: string,
    taskType?: TaskType,
    additionalContext?: Record<string, any>,
    userPreferences?: UserPreferences
  ): TaskContext {
    const detectedType = taskType || this.detectTaskType(userInput, additionalContext);

    // Determine complexity based on input length and content
    let complexity: 'simple' | 'medium' | 'complex' = 'medium';
    if (userInput.length < 50) {complexity = 'simple';} else if (
      userInput.length > 200 ||
      userInput.includes('complex') ||
      userInput.includes('detailed')
    ) {complexity = 'complex';}

    // Determine expected output length
    let expectedOutputLength: 'short' | 'medium' | 'long' = 'medium';
    if (this.containsKeywords(userInput.toLowerCase(), ['brief', 'short', 'quick', 'tldr'])) {
      expectedOutputLength = 'short';
    } else if (
      this.containsKeywords(userInput.toLowerCase(), [
        'detailed',
        'comprehensive',
        'thorough',
        'complete',
      ])
    ) {
      expectedOutputLength = 'long';
    }

    return {
      type: detectedType,
      userInput,
      additionalContext,
      userPreferences,
      complexity,
      expectedOutputLength,
    };
  }
}

// Export singleton instance
export const intelligentParameterService = new IntelligentParameterService();
export default intelligentParameterService;
