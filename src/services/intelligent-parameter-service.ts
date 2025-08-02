/**
 * Intelligent Parameter Service
 * Automatically adjusts context length, prompts, and temperature based on task type
 */

import { LogContext, log    } from '../utils/logger';';';';
import { TWO    } from '../utils/constants';';';';

export interface TaskParameters {
  contextLength: number;,
  temperature: number;
  topP?: number;
  maxTokens: number;,
  systemPrompt: string;,
  userPromptTemplate: string;
  stopSequences?: string[];
  presencePenalty?: number;
  frequencyPenalty?: number;
}

export interface TaskContext {
  type: TaskType;,
  userInput: string;
  additionalContext?: Record<string, any>;
  userPreferences?: UserPreferences;
  complexity?: 'simple' | 'medium' | 'complex';'''
  domain?: string;
  expectedOutputLength?: 'short' | 'medium' | 'long';'''
  // Enhanced iOS-specific context
  deviceContext?: iOSDeviceContext;
  biometricContext?: BiometricContext;
}

export interface UserPreferences {
  preferredTemperature?: number;
  preferredLength?: 'concise' | 'detailed' | 'comprehensive';'''
  writingStyle?: 'formal' | 'casual' | 'technical';'''
  creativity?: 'conservative' | 'balanced' | 'creative';'''
}

// iOS-specific interfaces for mobile optimization
export interface iOSDeviceContext {
  deviceType: 'iPhone' | 'iPad' | 'AppleWatch' | 'Mac';,'''
  connectionType: 'wifi' | 'cellular' | 'offline';',''
  batteryLevel: number;,
  isLowPowerMode: boolean;,
  availableMemory: number; // MB,
  processingCapability: 'low' | 'medium' | 'high';',''
  coreMLAvailable: boolean;,
  neuralEngineAvailable: boolean;,
  screenSize: 'small' | 'medium' | 'large';'''
}

export interface BiometricContext {
  authenticationState: 'authenticated' | 'unauthenticated' | 'locked' | 'authenticating';,'''
  confidenceLevel: number; // 0.0 to 1.0,
  timeSinceLastAuth: number; // minutes,
  securityLevel: 'high' | 'medium' | 'low';',''
  biometricCapabilities: string[];
}

export enum TaskType {
  // Code Tasks
    CODE_GENERATION = 'code_generation','''
  CODE_REVIEW = 'code_review','''
  CODE_DEBUGGING = 'code_debugging','''
  CODE_EXPLANATION = 'code_explanation','''
  CODE_REFACTORING = 'code_refactoring','''

  // Analysis Tasks
  DATA_ANALYSIS = 'data_analysis','''
  TEXT_ANALYSIS = 'text_analysis','''
  DOCUMENT_ANALYSIS = 'document_analysis','''
  RESEARCH = 'research','''

  // Creative Tasks
  CREATIVE_WRITING = 'creative_writing','''
  CONTENT_GENERATION = 'content_generation','''
  BRAINSTORMING = 'brainstorming','''
  STORY_GENERATION = 'story_generation','''

  // Question Answering
  FACTUAL_QA = 'factual_qa','''
  REASONING = 'reasoning','''
  EXPLANATION = 'explanation','''
  TUTORIAL = 'tutorial','''

  // Conversation
  CASUAL_CHAT = 'casual_chat','''
  PROFESSIONAL_CONSULTATION = 'professional_consultation','''
  TECHNICAL_SUPPORT = 'technical_support','''

  // Specialized
  TRANSLATION = 'translation','''
  SUMMARIZATION = 'summarization','''
  CLASSIFICATION = 'classification','''
  EXTRACTION = 'extraction','''

  // Vision Tasks
  IMAGE_ANALYSIS = 'image_analysis','''
  IMAGE_DESCRIPTION = 'image_description','''
  VISUAL_REASONING = 'visual_reasoning','''

  // Fine-tuning
  MODEL_TRAINING = 'model_training','''
  DATASET_PREPARATION = 'dataset_preparation','''

  // iOS-specific tasks
  IOS_DEVELOPMENT = 'ios_development','''
  SWIFT_CODING = 'swift_coding','''
  SWIFTUI_DESIGN = 'swiftui_design','''
  APPLE_ECOSYSTEM = 'apple_ecosystem','''
  DEVICE_OPTIMIZATION = 'device_optimization','''
  BIOMETRIC_GUIDANCE = 'biometric_guidance','''
  POWER_OPTIMIZATION = 'power_optimization','''
  MOBILE_UX = 'mobile_ux','''
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
    this.taskProfiles.set(TaskType.CODE_GENERATION, {)
      contextLength: 8192,
      temperature: 0.2,
      topP: 0.9,
      maxTokens: 2048,
      systemPrompt: 'You are an expert software engineer. Write clean, efficient, well-documented code following best practices.','''
      userPromptTemplate: 'Generate {language} code for: {request}\n\nRequirements: \n- Follow best practices and conventions\n- Include appropriate comments\n- Handle edge cases\n- Make code maintainable\n\nCode:','''
      stopSequences: ['```nn', '---'],'''
      presencePenalty: 0.1,
      frequencyPenalty: 0.1,
    });

    this.taskProfiles.set(TaskType.CODE_REVIEW, {)
      contextLength: 16384,
      temperature: 0.1,
      topP: 0.8,
      maxTokens: 1024,
      systemPrompt: 'You are a senior code reviewer. Provide thorough, constructive feedback focusing on security, performance, maintainability, and best practices.','''
      userPromptTemplate: 'Review this code and provide detailed, feedback: n\n```{language}n{code}n```nnFocus on: n- Security vulnerabilities\n- Performance issues\n- Code quality and maintainability\n- Best practices\n- Potential bugs\n\nReview:','''
      presencePenalty: 0.0,
      frequencyPenalty: 0.0,
    });

    this.taskProfiles.set(TaskType.CODE_DEBUGGING, {)
      contextLength: 12288,
      temperature: 0.1,
      topP: 0.8,
      maxTokens: 1536,
      systemPrompt: 'You are a debugging expert. Analyze code systematically to identify and fix issues.','''
      userPromptTemplate: 'Debug this code, issue: \n\n**Code:**\n```{language}n{code}n```nn**Error/Issue: ** {error}n\n**Expected Behavior: ** {expected}\n\nAnalyze the issue step-by-step and provide a fix: ','''
      presencePenalty: 0.0,
      frequencyPenalty: 0.0,
    });

    // Creative Tasks
    this.taskProfiles.set(TaskType.CREATIVE_WRITING, {)
      contextLength: 8192,
      temperature: 0.8,
      topP: 0.95,
      maxTokens: 2048,
      systemPrompt: 'You are a creative writer with expertise in storytelling, character development, and engaging prose.','''
      userPromptTemplate: 'Write creatively, about: {request}\n\nStyle: {style}\nTone: {tone}\nLength: {length}\n\nStory: ','''
      presencePenalty: 0.6,
      frequencyPenalty: 0.3,
    });

    this.taskProfiles.set(TaskType.BRAINSTORMING, {)
      contextLength: 4096,
      temperature: 0.9,
      topP: 0.95,
      maxTokens: 1024,
      systemPrompt: 'You are an innovative thinker who generates diverse, creative ideas. Think outside the box.','''
      userPromptTemplate: 'Generate creative ideas, for: {request}\n\nContext: {context}\nConstraints: {constraints}\n\nBrainstorm diverse, innovative solutions: ','''
      presencePenalty: 0.8,
      frequencyPenalty: 0.4,
    });

    // Analysis Tasks
    this.taskProfiles.set(TaskType.DATA_ANALYSIS, {)
      contextLength: 16384,
      temperature: 0.2,
      topP: 0.9,
      maxTokens: 2048,
      systemPrompt: 'You are a data scientist who provides thorough, accurate analysis with actionable insights.','''
      userPromptTemplate: 'Analyze this, data: \n\n{data}\n\nAnalysis goals: {goals}\n\nProvide: \n- Key insights\n- Patterns and trends\n- Statistical summary\n- Recommendations\n\nAnalysis:','''
      presencePenalty: 0.1,
      frequencyPenalty: 0.1,
    });

    this.taskProfiles.set(TaskType.RESEARCH, {)
      contextLength: 20480,
      temperature: 0.3,
      topP: 0.9,
      maxTokens: 3072,
      systemPrompt: 'You are a research expert who provides comprehensive, well-sourced analysis on complex topics.','''
      userPromptTemplate: 'Research, topic: {topic}\n\nScope: {scope}\nFocus areas: {focus}\n\nProvide a comprehensive research summary with: \n- Key findings\n- Supporting evidence\n- Different perspectives\n- Implications\n\nResearch:','''
      presencePenalty: 0.2,
      frequencyPenalty: 0.1,
    });

    // Question Answering
    this.taskProfiles.set(TaskType.FACTUAL_QA, {)
      contextLength: 8192,
      temperature: 0.1,
      topP: 0.8,
      maxTokens: 512,
      systemPrompt: 'You provide accurate, factual answers. If uncertain, clearly state limitations.','''
      userPromptTemplate: 'Question: {question}\n\nContext: {context}\n\nProvide a clear, accurate answer: ','''
      presencePenalty: 0.0,
      frequencyPenalty: 0.0,
    });

    this.taskProfiles.set(TaskType.REASONING, {)
      contextLength: 12288,
      temperature: 0.2,
      topP: 0.9,
      maxTokens: 1536,
      systemPrompt: 'You reason through problems step-by-step, showing your logical process clearly.','''
      userPromptTemplate: 'Problem: {problem}\n\nGiven information: {given}\n\nSolve this step-by-step, showing your reasoning: ','''
      presencePenalty: 0.1,
      frequencyPenalty: 0.1,
    });

    // Conversation Types
    this.taskProfiles.set(TaskType.CASUAL_CHAT, {)
      contextLength: 4096,
      temperature: 0.7,
      topP: 0.9,
      maxTokens: 512,
      systemPrompt: 'You are a friendly, helpful assistant who engages in natural conversation.','''
      userPromptTemplate: '{message}','''
      presencePenalty: 0.3,
      frequencyPenalty: 0.2,
    });

    this.taskProfiles.set(TaskType.TECHNICAL_SUPPORT, {)
      contextLength: 8192,
      temperature: 0.2,
      topP: 0.9,
      maxTokens: 1024,
      systemPrompt: 'You are a technical support expert who provides clear, step-by-step solutions.','''
      userPromptTemplate: 'Technical, issue: {issue}\n\nSystem: {system}\nError details: {error}\n\nProvide a clear solution with steps: ','''
      presencePenalty: 0.1,
      frequencyPenalty: 0.1,
    });

    // Specialized Tasks
    this.taskProfiles.set(TaskType.SUMMARIZATION, {)
      contextLength: 16384,
      temperature: 0.2,
      topP: 0.9,
      maxTokens: 1024,
      systemPrompt: 'You create clear, comprehensive summaries that capture key information and insights.','''
      userPromptTemplate: 'Summarize this, content: \n\n{content}\n\nSummary length: {length}\nFocus: {focus}\n\nSummary: ','''
      presencePenalty: 0.1,
      frequencyPenalty: 0.2,
    });

    this.taskProfiles.set(TaskType.TRANSLATION, {)
      contextLength: 8192,
      temperature: 0.1,
      topP: 0.8,
      maxTokens: 2048,
      systemPrompt: 'You are an expert translator who preserves meaning, tone, and cultural nuances.','''
      userPromptTemplate: 'Translate from {source_lang} to {target_lang}:\n\n{text}\n\nMaintain tone and cultural context. Translation: ','''
      presencePenalty: 0.0,
      frequencyPenalty: 0.0,
    });

    // Vision Tasks
    this.taskProfiles.set(TaskType.IMAGE_ANALYSIS, {)
      contextLength: 4096,
      temperature: 0.3,
      topP: 0.9,
      maxTokens: 1024,
      systemPrompt: 'You are an expert at analyzing images in detail, identifying objects, scenes, and patterns.','''
      userPromptTemplate: 'Analyze this image in, detail: \n\nFocus, on: {focus}\nContext: {context}\n\nProvide a comprehensive analysis: ','''
      presencePenalty: 0.2,
      frequencyPenalty: 0.1,
    });

    this.taskProfiles.set(TaskType.VISUAL_REASONING, {)
      contextLength: 6144,
      temperature: 0.4,
      topP: 0.9,
      maxTokens: 1536,
      systemPrompt: 'You analyze images and reason about their contents, relationships, and implications.','''
      userPromptTemplate: 'Look at this image and, answer: {question}\n\nReason through your analysis step by step: ','''
      presencePenalty: 0.2,
      frequencyPenalty: 0.1,
    });

    // Fine-tuning Tasks
    this.taskProfiles.set(TaskType.MODEL_TRAINING, {)
      contextLength: 2048,
      temperature: 0.1,
      topP: 0.8,
      maxTokens: 512,
      systemPrompt: 'You are an ML engineer optimizing model training parameters and processes.','''
      userPromptTemplate: 'Training, task: {task}\nDataset: {dataset}\nModel: {model}\n\nOptimize training parameters: ','''
      presencePenalty: 0.0,
      frequencyPenalty: 0.0,
    });

    // iOS-specific tasks
    this.taskProfiles.set(TaskType.IOS_DEVELOPMENT, {)
      contextLength: 8192,
      temperature: 0.2,
      topP: 0.9,
      maxTokens: 1536,
      systemPrompt: 'You are an expert iOS developer with deep knowledge of Swift, SwiftUI, UIKit, and Apple ecosystem integration. Provide production-ready solutions following Apple Human Interface Guidelines.','''
      userPromptTemplate: 'iOS Development, Request: {request}\n\nDevice Context: {deviceType} - {processingCapability} capability\nAuthentication: {authState} (confidence: {confidenceLevel})\nPower Mode: {powerMode}\n\nProvide optimized iOS solution with: \n- Swift/SwiftUI code\n- Performance considerations\n- Apple ecosystem integration\n- Security best practices\n\nSolution:','''
      presencePenalty: 0.1,
      frequencyPenalty: 0.1,
    });

    this.taskProfiles.set(TaskType.SWIFT_CODING, {)
      contextLength: 6144,
      temperature: 0.15,
      topP: 0.85,
      maxTokens: 1024,
      systemPrompt: 'You are a Swift expert who writes clean, efficient, and modern Swift code following Apple conventions.','''
      userPromptTemplate: 'Swift Coding, Task: {request}\n\nTarget: {deviceType}\nSwift Version: Latest\nFrameworks: {frameworks}\n\nWrite Swift code that: \n- Follows Swift best practices\n- Uses modern language features\n- Handles errors appropriately\n- Is performant on mobile devices\n\nCode:','''
      stopSequences: ['```nn', '---'],'''
      presencePenalty: 0.05,
      frequencyPenalty: 0.05,
    });

    this.taskProfiles.set(TaskType.SWIFTUI_DESIGN, {)
      contextLength: 8192,
      temperature: 0.3,
      topP: 0.9,
      maxTokens: 1536,
      systemPrompt: 'You are a SwiftUI expert specializing in modern iOS UI design, animations, and user experience. Create beautiful, accessible interfaces following Apple HIG.','''
      userPromptTemplate: 'SwiftUI Design, Request: {request}n\nDevice: {deviceType} ({screenSize} screen)\nUser Context: {authState}\nPower Constraints: {isLowPowerMode}\n\nCreate SwiftUI interface with: \n- Adaptive design for device\n- Smooth animations\n- Accessibility support\n- Power-efficient rendering\n- Apple HIG compliance\n\nSwiftUI, Code: ','''
      presencePenalty: 0.2,
      frequencyPenalty: 0.1,
    });

    this.taskProfiles.set(TaskType.DEVICE_OPTIMIZATION, {)
      contextLength: 4096,
      temperature: 0.1,
      topP: 0.8,
      maxTokens: 1024,
      systemPrompt: 'You are a mobile performance expert specializing in iOS optimization, memory management, and power efficiency.','''
      userPromptTemplate: 'Optimization, Request: {request}\n\nDevice Specs: \n-, Type: {deviceType}\n- Memory: {availableMemory}MB\n- Battery: {batteryLevel}%\n- Power Mode: {powerMode}\n- Processing: {processingCapability}\n\nProvide optimization strategy focusing on: \n- Memory efficiency\n- Battery life\n- Performance\n- User experience\n\nOptimization, Plan: ','''
      presencePenalty: 0.0,
      frequencyPenalty: 0.0,
    });

    this.taskProfiles.set(TaskType.BIOMETRIC_GUIDANCE, {)
      contextLength: 6144,
      temperature: 0.2,
      topP: 0.9,
      maxTokens: 1024,
      systemPrompt: 'You are a security expert specializing in iOS biometric authentication, privacy, and secure user experience design.','''
      userPromptTemplate: 'Biometric Security, Request: {request}\n\nAuthentication Context: \n-, State: {authState}\n- Confidence: {confidenceLevel}\n- Time Since Auth: {timeSinceAuth} minutes\n- Security Level: {securityLevel}\n- Available: {biometricCapabilities}\n\nProvide secure implementation with: \n- Privacy-first approach\n- Appropriate security measures\n- User-friendly experience\n- Fallback mechanisms\n\nSecurity, Implementation: ','''
      presencePenalty: 0.1,
      frequencyPenalty: 0.1,
    });

    this.taskProfiles.set(TaskType.MOBILE_UX, {)
      contextLength: 6144,
      temperature: 0.4,
      topP: 0.9,
      maxTokens: 1536,
      systemPrompt: 'You are a mobile UX expert specializing in iOS user experience, accessibility, and context-aware design.','''
      userPromptTemplate: 'Mobile UX, Request: {request}\n\nUser Context: \n-, Device: {deviceType} ({screenSize})\n- Connection: {connectionType}\n- Authentication: {authState}\n- Usage Pattern: {usageContext}\n\nDesign mobile experience considering: \n- Touch interactions\n- One-handed usage\n- Accessibility\n- Context awareness\n- Apple HIG principles\n\nUX, Design: ','''
      presencePenalty: 0.3,
      frequencyPenalty: 0.2,
    });
  }

  private initializeContextTemplates(): void {
    // Code-specific templates
    this.contextTemplates.set()
      TaskType.CODE_GENERATION,
      'Programming Language: {language}\nFramework: {framework}\nComplexity: {complexity}\nEnvironment: {environment}''''
    );

    // Analysis templates
    this.contextTemplates.set()
      TaskType.DATA_ANALYSIS,
      'Data Type: {dataType}\nSize: {size}\nObjective: {objective}\nConstraints: {constraints}''''
    );

    // Creative templates
    this.contextTemplates.set()
      TaskType.CREATIVE_WRITING,
      'Genre: {genre}\nAudience: {audience}\nMood: {mood}\nSetting: {setting}''''
    );
  }

  private initializeDomainAdjustments(): void {
    // Academic domain - more formal, thorough
    this.domainAdjustments.set('academic', {')''
      temperature: -0.1,
      maxTokens: 512,
      systemPrompt: 'You are an academic expert. Provide thorough, well-researched responses with proper reasoning.','''
    });

    // Creative domain - more expressive
    this.domainAdjustments.set('creative', {')''
      temperature: 0.2,
      presencePenalty: 0.2,
      frequencyPenalty: 0.1,
    });

    // Technical domain - precise and detailed
    this.domainAdjustments.set('technical', {')''
      temperature: -0.1,
      contextLength: 4096,
      systemPrompt: 'You are a technical expert. Provide precise, detailed, and accurate technical information.','''
    });

    // Business domain - practical and actionable
    this.domainAdjustments.set('business', {')''
      temperature: -0.05,
      maxTokens: 256,
      systemPrompt: 'You are a business consultant. Provide practical, actionable advice with clear ROI considerations.','''
    });
  }

  /**
   * Get optimized parameters for a specific task
   */
  public getTaskParameters(context: TaskContext): TaskParameters {
    const baseParams = this.taskProfiles.get(context.type);
    if (!baseParams) {
      log.warn('Unknown task type, using default parameters', LogContext.AI, {')''
        taskType: context.type,
      });
      return this.getDefaultParameters();
    }

    // Clone base parameters
    let params: TaskParameters = JSON.parse(JSON.stringify(baseParams));

    // Apply complexity adjustments
    params = this.adjustForComplexity(params, context.complexity || 'medium');'''

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

    // Apply iOS-specific optimizations
    if (context.deviceContext) {
      params = this.adjustForIOSDevice(params, context.deviceContext);
    }

    // Apply biometric context adjustments
    if (context.biometricContext) {
      params = this.adjustForBiometricContext(params, context.biometricContext);
    }

    // Apply dynamic template
    params.userPromptTemplate = this.buildDynamicPrompt(params.userPromptTemplate, context);

    log.info('Generated task parameters', LogContext.AI, {')''
      taskType: context.type,
      contextLength: params.contextLength,
      temperature: params.temperature,
      maxTokens: params.maxTokens,
    });

    return params;
  }

  private adjustForComplexity(params: TaskParameters, complexity: string): TaskParameters {
    const adjustments = {
      simple: {, contextLength: 0.7, maxTokens: 0.7, temperature: -0.1 },
      medium: {, contextLength: 1.0, maxTokens: 1.0, temperature: 0.0 },
      complex: {, contextLength: 1.5, maxTokens: 1.3, temperature: 0.1 },
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
    if (!domainAdjustment) return params;

    return {
      ...params,
      ...domainAdjustment,
      contextLength: domainAdjustment.contextLength || params.contextLength,
      temperature: domainAdjustment.temperature !== undefined
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
      adjusted.temperature = Math.max()
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
      adjusted.maxTokens = Math.round()
        adjusted.maxTokens * lengthMultipliers[prefs.preferredLength]
      );
    }

    // Writing style adjustments
    if (prefs.writingStyle === 'formal') {'''
      adjusted.temperature = Math.max(0.1, adjusted.temperature - 0.1);
      adjusted.presencePenalty = (adjusted.presencePenalty || 0) - 0.1;
    } else if (prefs.writingStyle === 'casual') {'''
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
      contextLength: Math.round(params.contextLength * Math.min(multiplier, 1.2)), // Don't increase context as much'''
    };
  }

  /**
   * Adjust parameters based on iOS device capabilities and constraints
   */
  private adjustForIOSDevice(params: TaskParameters, deviceContext: iOSDeviceContext): TaskParameters {
    const adjusted = { ...params };

    // Device-specific optimizations
    switch (deviceContext.deviceType) {
      case 'AppleWatch':'''
        // Ultra-compact responses for watch
        adjusted.maxTokens = Math.min(adjusted.maxTokens, 200);
        adjusted.contextLength = Math.min(adjusted.contextLength, 1024);
        adjusted.temperature = Math.max(0.1, adjusted.temperature - 0.1); // More deterministic
        break;
      case 'iPhone':'''
        // Mobile-optimized parameters
        if (deviceContext.screenSize === 'small') {'''
          adjusted.maxTokens = Math.round(adjusted.maxTokens * 0.8);
        }
        break;
      case 'iPad':'''
        // Can handle longer content
        adjusted.maxTokens = Math.round(adjusted.maxTokens * 1.2);
        adjusted.contextLength = Math.round(adjusted.contextLength * 1.1);
        break;
      case 'Mac':'''
        // Full capabilities
        break;
    }

    // Processing capability adjustments
    switch (deviceContext.processingCapability) {
      case 'low':'''
        adjusted.maxTokens = Math.round(adjusted.maxTokens * 0.7);
        adjusted.contextLength = Math.round(adjusted.contextLength * 0.8);
        break;
      case 'medium':'''
        adjusted.maxTokens = Math.round(adjusted.maxTokens * 0.9);
        break;
      case 'high':'''
        // No reduction needed
        break;
    }

    // Power mode adjustments
    if (deviceContext.isLowPowerMode) {
      adjusted.maxTokens = Math.round(adjusted.maxTokens * 0.6);
      adjusted.contextLength = Math.round(adjusted.contextLength * 0.7);
      adjusted.temperature = Math.max(0.1, adjusted.temperature - 0.1); // More efficient
    }

    // Connection type adjustments
    if (deviceContext.connectionType === 'cellular') {'''
      // Optimize for data usage
      adjusted.maxTokens = Math.round(adjusted.maxTokens * 0.8);
    } else if (deviceContext.connectionType === 'offline') {'''
      // Minimal responses only
      adjusted.maxTokens = Math.min(adjusted.maxTokens, 300);
      adjusted.contextLength = Math.min(adjusted.contextLength, 1024);
    }

    // Memory constraints
    if (deviceContext.availableMemory < 1024) { // Less than 1GB
      adjusted.contextLength = Math.min(adjusted.contextLength, 2048);
      adjusted.maxTokens = Math.min(adjusted.maxTokens, 512);
    }

    return adjusted;
  }

  /**
   * Adjust parameters based on biometric authentication context
   */
  private adjustForBiometricContext(params: TaskParameters, biometricContext: BiometricContext): TaskParameters {
    const adjusted = { ...params };

    // Security level adjustments
    switch (biometricContext.securityLevel) {
      case 'high':'''
        // More conservative parameters for sensitive operations
        adjusted.temperature = Math.max(0.1, adjusted.temperature - 0.1);
        adjusted.topP = Math.max(0.8, (adjusted.topP || 0.9) - 0.1);
        break;
      case 'medium':'''
        // Standard parameters
        break;
      case 'low':'''
        // Could be more creative, but be careful
        adjusted.temperature = Math.min(0.8, adjusted.temperature + 0.05);
        break;
    }

    // Authentication state adjustments
    switch (biometricContext.authenticationState) {
      case 'authenticated':'''
        // Full capabilities based on confidence
        if (biometricContext.confidenceLevel < 0.7) {
          // Lower confidence = more conservative
          adjusted.temperature = Math.max(0.1, adjusted.temperature - 0.05);
        }
        break;
      case 'unauthenticated':'''
        // Limited capabilities
        adjusted.maxTokens = Math.round(adjusted.maxTokens * 0.7);
        adjusted.temperature = Math.max(0.1, adjusted.temperature - 0.1);
        break;
      case 'locked':'''
        // Minimal responses only
        adjusted.maxTokens = Math.min(adjusted.maxTokens, 200);
        adjusted.temperature = 0.1;
        break;
      case 'authenticating':'''
        // Brief, helpful responses
        adjusted.maxTokens = Math.min(adjusted.maxTokens, 300);
        break;
    }

    // Time-based adjustments
    if (biometricContext.timeSinceLastAuth > 60) { // More than 1 hour
      // Slightly more conservative
      adjusted.temperature = Math.max(0.1, adjusted.temperature - 0.05);
    }

    return adjusted;
  }

  private buildDynamicPrompt(template: string, context: TaskContext): string {
    let prompt = template;

    // Replace common placeholders
    const replacements: Record<string, string> = {
      '{request}': context.userInput,'''
      '{user_input}': context.userInput,'''
      '{question}': context.userInput,'''
      '{problem}': context.userInput,'''
      '{message}': context.userInput,'''
      '{topic}': context.userInput,'''
      '{content}': context.userInput,'''
      '{text}': context.userInput,'''
      ...context.additionalContext,
    };

    // Add iOS-specific context replacements
    if (context.deviceContext) {
      replacements['{deviceType}'] = context.deviceContext.deviceType;'''
      replacements['{screenSize}'] = context.deviceContext.screenSize;'''
      replacements['{processingCapability}'] = context.deviceContext.processingCapability;'''
      replacements['{connectionType}'] = context.deviceContext.connectionType;'''
      replacements['{batteryLevel}'] = context.deviceContext.batteryLevel.toString();'''
      replacements['{availableMemory}'] = context.deviceContext.availableMemory.toString();'''
      replacements['{powerMode}'] = context.deviceContext.isLowPowerMode ? 'Low Power Mode' : 'Normal';'''
      replacements['{isLowPowerMode}'] = context.deviceContext.isLowPowerMode.toString();'''
      replacements['{coreMLAvailable}'] = context.deviceContext.coreMLAvailable.toString();'''
      replacements['{neuralEngineAvailable}'] = context.deviceContext.neuralEngineAvailable.toString();'''
    }

    // Add biometric context replacements
    if (context.biometricContext) {
      replacements['{authState}'] = context.biometricContext.authenticationState;'''
      replacements['{confidenceLevel}'] = `${(context.biometricContext.confidenceLevel * 100).toFixed(0)  }%`;'''
      replacements['{timeSinceAuth}'] = context.biometricContext.timeSinceLastAuth.toString();'''
      replacements['{securityLevel}'] = context.biometricContext.securityLevel;'''
      replacements['{biometricCapabilities}'] = context.biometricContext.biometricCapabilities.join(', ');'''
    }

    // Apply replacements
    for (const [placeholder, value] of Object.entries(replacements)) {
      if (value !== undefined) {
        prompt = prompt.replace()
          new RegExp(placeholder.replace(/[.*+?^${}()|[]\]/g, '\$&'), 'g'),'''
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

    // iOS-specific task detection first (more specific)
    if (
      this.containsKeywords(input, [)
        'swiftui','''
        'swift ui','''
        'ui design','''
        'ios interface','''
        'app interface','''
        'mobile ui','''
        'apple hig','''
      ])
    ) {
      return TaskType.SWIFTUI_DESIGN;
    }
    if (
      this.containsKeywords(input, [)
        'swift code','''
        'swift function','''
        'swift class','''
        'swift struct','''
        'ios code','''
        'macos code','''
      ])
    ) {
      return TaskType.SWIFT_CODING;
    }
    if (
      this.containsKeywords(input, [)
        'ios development','''
        'ios app','''
        'apple development','''
        'xcode','''
        'cocoa','''
        'cocoa touch','''
        'apple ecosystem','''
      ])
    ) {
      return TaskType.IOS_DEVELOPMENT;
    }
    if (
      this.containsKeywords(input, [)
        'biometric','''
        'face id','''
        'touch id','''
        'authentication','''
        'secure','''
        'keychain','''
        'privacy','''
      ])
    ) {
      return TaskType.BIOMETRIC_GUIDANCE;
    }
    if (
      this.containsKeywords(input, [)
        'optimize performance','''
        'memory usage','''
        'battery life','''
        'power optimization','''
        'mobile performance','''
        'device constraints','''
      ])
    ) {
      return TaskType.DEVICE_OPTIMIZATION;
    }
    if (
      this.containsKeywords(input, [)
        'mobile ux','''
        'user experience','''
        'accessibility','''
        'one handed','''
        'touch interface','''
        'mobile design patterns','''
      ])
    ) {
      return TaskType.MOBILE_UX;
    }

    // Code-related keywords (general)
    if (
      this.containsKeywords(input, [)
        'write code','''
        'generate code','''
        'create function','''
        'implement','''
        'code for','''
        'program','''
        'script','''
      ])
    ) {
      // Check if it's Swift/iOS specific'''
      if (this.containsKeywords(input, ['swift', 'ios', 'macos', 'apple'])) {'''
        return TaskType.SWIFT_CODING;
      }
      return TaskType.CODE_GENERATION;
    }
    if (
      this.containsKeywords(input, [)
        'review code','''
        'check code','''
        'code review','''
        'improve code','''
        'optimize code','''
      ])
    ) {
      return TaskType.CODE_REVIEW;
    }
    if (
      this.containsKeywords(input, ['debug', 'fix bug', 'error', 'not working', 'troubleshoot'])'''
    ) {
      return TaskType.CODE_DEBUGGING;
    }
    if (
      this.containsKeywords(input, [)
        'explain code','''
        'how does','''
        'what does this code','''
        'understand code','''
      ])
    ) {
      return TaskType.CODE_EXPLANATION;
    }

    // Creative tasks
    if (
      this.containsKeywords(input, [)
        'write story','''
        'creative writing','''
        'story about','''
        'write fiction','''
        'novel','''
      ])
    ) {
      return TaskType.CREATIVE_WRITING;
    }
    if (
      this.containsKeywords(input, [)
        'brainstorm','''
        'ideas for','''
        'creative ideas','''
        'think of ways','''
        'suggestions','''
      ])
    ) {
      return TaskType.BRAINSTORMING;
    }

    // Analysis tasks
    if (
      this.containsKeywords(input, [)
        'analyze data','''
        'data analysis','''
        'statistical','''
        'trends','''
        'patterns','''
      ])
    ) {
      return TaskType.DATA_ANALYSIS;
    }
    if (
      this.containsKeywords(input, [)
        'research','''
        'study','''
        'investigate','''
        'find information','''
        'comprehensive analysis','''
      ])
    ) {
      return TaskType.RESEARCH;
    }

    // Question answering
    if (
      this.containsKeywords(input, [)
        'what is','''
        'who is','''
        'when did','''
        'where is','''
        'how many','''
        'define','''
      ])
    ) {
      return TaskType.FACTUAL_QA;
    }
    if (
      this.containsKeywords(input, ['solve', 'calculate', 'reasoning', 'logic', 'step by step'])'''
    ) {
      return TaskType.REASONING;
    }
    if (this.containsKeywords(input, ['explain', 'how to', 'tutorial', 'guide', 'teach me'])) {'''
      return TaskType.EXPLANATION;
    }

    // Specialized tasks
    if (
      this.containsKeywords(input, [)
        'translate','''
        'translation','''
        'in spanish','''
        'in french','''
        'language','''
      ])
    ) {
      return TaskType.TRANSLATION;
    }
    if (this.containsKeywords(input, ['summarize', 'summary', 'tldr', 'key points', 'brief'])) {'''
      return TaskType.SUMMARIZATION;
    }

    // Vision tasks
    if (
      context?.hasImage ||
      this.containsKeywords(input, ['image', 'picture', 'photo', 'visual', 'analyze image'])'''
    ) {
      if (this.containsKeywords(input, ['what is in', 'describe image', 'what do you see'])) {'''
        return TaskType.IMAGE_DESCRIPTION;
      }
      if (this.containsKeywords(input, ['why', 'how', 'reasoning', 'explain image'])) {'''
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
      systemPrompt: 'You are a helpful AI assistant.','''
      userPromptTemplate: '{user_input}','''
      presencePenalty: 0.1,
      frequencyPenalty: 0.1,
    };
  }

  /**
   * Get parameters optimized for a specific model
   */
  public getModelOptimizedParameters()
    baseParams: TaskParameters,
    modelName: string
  ): TaskParameters {
    const params = { ...baseParams };

    // Model-specific optimizations
    if (modelName.includes('gpt-4')) {'''
      // GPT-4 handles longer contexts well
      params.contextLength = Math.min(params.contextLength * 1.5, 32768);
    } else if (modelName.includes('gpt-3.5')) {'''
      // GPT-3.5 is more limited
      params.contextLength = Math.min(params.contextLength, 4096);
      params.maxTokens = Math.min(params.maxTokens, 2048);
    } else if (modelName.includes('claude')) {'''
      // Claude handles very long contexts
      params.contextLength = Math.min(params.contextLength * TWO, 100000);
    } else if (modelName.includes('llama')) {'''
      // Llama models vary in context length
      if (modelName.includes('70b') || modelName.includes('65b')) {'''
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
  public createTaskContext()
    userInput: string,
    taskType?: TaskType,
    additionalContext?: Record<string, any>,
    userPreferences?: UserPreferences
  ): TaskContext {
    const detectedType = taskType || this.detectTaskType(userInput, additionalContext);

    // Determine complexity based on input length and content
    let complexity: 'simple' | 'medium' | 'complex' = 'medium';';';';
    if (userInput.length < 50) complexity = 'simple';'''
    else if (
      userInput.length > 200 ||
      userInput.includes('complex') ||'''
      userInput.includes('detailed')'''
    )
      complexity = 'complex';'''

    // Determine expected output length
    let expectedOutputLength: 'short' | 'medium' | 'long' = 'medium';';';';
    if (this.containsKeywords(userInput.toLowerCase(), ['brief', 'short', 'quick', 'tldr'])) {'''
      expectedOutputLength = 'short';'''
    } else if (
      this.containsKeywords(userInput.toLowerCase(), [
        'detailed','''
        'comprehensive','''
        'thorough','''
        'complete','''
      ])
    ) {
      expectedOutputLength = 'long';'''
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

  /**
   * Create iOS-optimized task context with device and biometric information
   */
  public createIOSTaskContext()
    userInput: string,
    deviceContext: iOSDeviceContext,
    biometricContext?: BiometricContext,
    taskType?: TaskType,
    additionalContext?: Record<string, any>,
    userPreferences?: UserPreferences
  ): TaskContext {
    const baseContext = this.createTaskContext();
      userInput,
      taskType,
      additionalContext,
      userPreferences
    );

    // Override task type if iOS-specific context suggests it
    let finalTaskType = baseContext.type;
    if (!taskType) {
      // Auto-detect iOS-specific tasks based on device context
      if (deviceContext.deviceType === 'AppleWatch' && baseContext.type === TaskType.CASUAL_CHAT) {'''
        finalTaskType = TaskType.MOBILE_UX; // Watch interactions need special UX considerations
      }
      if (biometricContext?.authenticationState === 'unauthenticated' && '''
          this.containsKeywords(userInput.toLowerCase(), ['secure', 'login', 'authenticate'])) {'''
        finalTaskType = TaskType.BIOMETRIC_GUIDANCE;
      }
      if (deviceContext.isLowPowerMode && 
          this.containsKeywords(userInput.toLowerCase(), ['optimize', 'performance', 'battery'])) {'''
        finalTaskType = TaskType.DEVICE_OPTIMIZATION;
      }
    }

    return {
      ...baseContext,
      type: finalTaskType,
      deviceContext,
      biometricContext,
    };
  }

  /**
   * Get iOS-optimized parameters with device and biometric context
   */
  public getIOSOptimizedParameters()
    userInput: string,
    deviceContext: iOSDeviceContext,
    biometricContext?: BiometricContext,
    taskType?: TaskType,
    userPreferences?: UserPreferences
  ): TaskParameters {
    const context = this.createIOSTaskContext();
      userInput,
      deviceContext,
      biometricContext,
      taskType,
      undefined,
      userPreferences
    );

    const parameters = this.getTaskParameters(context);

    log.info('Generated iOS-optimized parameters', LogContext.AI, {')''
      taskType: context.type,
      deviceType: deviceContext.deviceType,
      authState: biometricContext?.authenticationState,
      powerMode: deviceContext.isLowPowerMode ? 'low' : 'normal','''
      finalMaxTokens: parameters.maxTokens,
      finalTemperature: parameters.temperature,
    });

    return parameters;
  }
}

// Export singleton instance
export const intelligentParameterService = new IntelligentParameterService();
export default intelligentParameterService;
