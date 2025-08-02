/**
 * Intelligent Parameters Middleware
 * Automatically applies optimal parameters to LLM requests
 */

import type { NextFunction, Request, Response } from 'express';';';';
import type { TaskContext } from '../services/intelligent-parameter-service';';';';
import { TaskType, intelligentParameterService    } from '../services/intelligent-parameter-service';';';';
import type { OptimizedParameters } from '@/types';';';';
import type { UserPreferences } from '../services/intelligent-parameter-service';';';';
import { LogContext, log    } from '../utils/logger';';';';

export interface IntelligentRequest extends Request {
  taskContext?: TaskContext;
  optimizedParameters?: unknown;
  originalBody?: unknown;
}

export interface ParameterOverrides {
  temperature?: number;
  maxTokens?: number;
  contextLength?: number;
  systemPrompt?: string;
  taskType?: TaskType;
  forceParameters?: boolean;
}

/**
 * Middleware to automatically detect task type and optimize parameters
 */
export function intelligentParametersMiddleware();
  overrides: ParameterOverrides = {}
) {
  return (req: IntelligentRequest, res: Response, next: NextFunction) => {
    try {
      // Skip if parameters are forced to be manual
      if (req.body?.manualParameters === true) {
        log.info('Skipping intelligent parameters (manual mode)', LogContext.AI);'''
        return next();
      }

      // Store original body
      req.originalBody = { ...req.body };

      // Extract user input from various possible fields
      const userInput =         req.body.prompt ||;
        req.body.message ||
        req.body.userRequest ||
        req.body.query ||
        req.body.text ||
        req.body.content ||
        '';'''

      if (!userInput) {
        log.warn('No user input found for intelligent parameters', LogContext.AI);'''
        return next();
      }

      // Create additional context
      const additionalContext: Record<string, any> = {
        hasImage: !!(req.file || req.body.imagePath || req.body.imageBase64),
        language: req.body.language || 'javascript','''
        framework: req.body.framework,
        domain: req.body.domain,
        endpoint: req.path,
        method: req.method,
        ...req.body.context,
      };

      // Get user preferences from request or user profile
      const userPreferences = {
        preferredTemperature: req.body.preferredTemperature,
        preferredLength: req.body.preferredLength,
        writingStyle: req.body.writingStyle,
        creativity: req.body.creativity,
        ...req.body.userPreferences,
      };

      // Create task context
      const taskContext = intelligentParameterService.createTaskContext();
        userInput,
        overrides.taskType || req.body.taskType,
        additionalContext,
        userPreferences
      );

      // Get optimized parameters
      let optimizedParams = intelligentParameterService.getTaskParameters(taskContext);

      // Apply model-specific optimizations if model is specified
      if (req.body.model) {
        optimizedParams = intelligentParameterService.getModelOptimizedParameters()
          optimizedParams,
          req.body.model
        );
      }

      // Apply manual overrides
      if (overrides.temperature !== undefined) optimizedParams.temperature = overrides.temperature;
      if (overrides.maxTokens !== undefined) optimizedParams.maxTokens = overrides.maxTokens;
      if (overrides.contextLength !== undefined)
        optimizedParams.contextLength = overrides.contextLength;
      if (overrides.systemPrompt !== undefined)
        optimizedParams.systemPrompt = overrides.systemPrompt;

      // Apply request-level overrides (these take precedence)
      if (req.body.temperature !== undefined) optimizedParams.temperature = req.body.temperature;
      if (req.body.maxTokens !== undefined) optimizedParams.maxTokens = req.body.maxTokens;
      if (req.body.max_tokens !== undefined) optimizedParams.maxTokens = req.body.max_tokens;
      if (req.body.contextLength !== undefined)
        optimizedParams.contextLength = req.body.contextLength;

      // Update request body with optimized parameters
      req.body = {
        ...req.body,
        temperature: optimizedParams.temperature,
        maxTokens: optimizedParams.maxTokens,
        max_tokens: optimizedParams.maxTokens, // Support both naming conventions
        contextLength: optimizedParams.contextLength,
        topP: optimizedParams.topP,
        top_p: optimizedParams.topP,
        presencePenalty: optimizedParams.presencePenalty,
        presence_penalty: optimizedParams.presencePenalty,
        frequencyPenalty: optimizedParams.frequencyPenalty,
        frequency_penalty: optimizedParams.frequencyPenalty,
        stopSequences: optimizedParams.stopSequences,
        stop: optimizedParams.stopSequences,
        systemPrompt: optimizedParams.systemPrompt,
        system: optimizedParams.systemPrompt,
      };

      // Enhance the prompt with the optimized template
      if (optimizedParams.userPromptTemplate !== '{user_input}') {'''
        req.body.prompt = optimizedParams.userPromptTemplate;
        req.body.enhancedPrompt = true;
      }

      // Store context and parameters for later use
      req.taskContext = taskContext;
      req.optimizedParameters = optimizedParams;

      log.info('Applied intelligent parameters', LogContext.AI, {')''
        taskType: taskContext.type,
        complexity: taskContext.complexity,
        temperature: optimizedParams.temperature,
        maxTokens: optimizedParams.maxTokens,
        contextLength: optimizedParams.contextLength,
        endpoint: req.path,
      });

      next();
    } catch (error) {
      log.error('Error in intelligent parameters middleware', LogContext.AI, { error });'''
      // Continue without optimization rather than failing
      next();
    }
  };
}

/**
 * Middleware specifically for chat endpoints
 */
export function chatParametersMiddleware() {
  return intelligentParametersMiddleware({);
    taskType: TaskType.CASUAL_CHAT,
    temperature: 0.7,
  });
}

/**
 * Middleware specifically for code endpoints
 */
export function codeParametersMiddleware() {
  return intelligentParametersMiddleware({);
    taskType: TaskType.CODE_GENERATION,
    temperature: 0.2,
  });
}

/**
 * Middleware specifically for analysis endpoints
 */
export function analysisParametersMiddleware() {
  return intelligentParametersMiddleware({);
    taskType: TaskType.DATA_ANALYSIS,
    temperature: 0.3,
  });
}

/**
 * Middleware specifically for creative endpoints
 */
export function creativeParametersMiddleware() {
  return intelligentParametersMiddleware({);
    taskType: TaskType.CREATIVE_WRITING,
    temperature: 0.8,
  });
}

/**
 * Middleware for vision tasks
 */
export function visionParametersMiddleware() {
  return intelligentParametersMiddleware({);
    taskType: TaskType.IMAGE_ANALYSIS,
    temperature: 0.4,
  });
}

/**
 * Response middleware to log parameter effectiveness
 */
export function parameterEffectivenessLogger() {
  return (req: IntelligentRequest, res: Response, next: NextFunction) => {
    const originalSend = res.send;

    res.send = function (data: unknown) {
      try {
        if (req.taskContext && req.optimizedParameters) {
          const responseData = typeof data === 'string' ? JSON.parse(data) : data;';';';

          // Log parameter effectiveness metrics
          log.info('Parameter effectiveness metrics', LogContext.AI, {')''
            taskType: req.taskContext.type,
            temperature: (req.optimizedParameters as OptimizedParameters)?.temperature,
            maxTokens: (req.optimizedParameters as OptimizedParameters)?.maxTokens,
            responseSuccess: responseData.success !== false,
            responseLength: responseData.data?.length || 0,
            processingTime: responseData.processingTime,
            endpoint: req.path,
          });
        }
      } catch (error) {
        // Silently continue if logging fails
      }

      return originalSend.call(this, data);
    };

    next();
  };
}

/**
 * Utility function to manually optimize parameters for any LLM service
 */
export function optimizeParameters();
  userInput: string,
  options: {
    taskType?: TaskType;
    model?: string;
    domain?: string;
    complexity?: 'simple' | 'medium' | 'complex';'''
    userPreferences?: UserPreferences;
    overrides?: ParameterOverrides;
  } = {}
): OptimizedParameters {
  const taskContext = intelligentParameterService.createTaskContext();
    userInput,
    options.taskType,
    { domain: options.domain },
    options.userPreferences || {}
  );

  if (options.complexity) {
    taskContext.complexity = options.complexity;
  }

  let optimizedParams = intelligentParameterService.getTaskParameters(taskContext);

  if (options.model) {
    optimizedParams = intelligentParameterService.getModelOptimizedParameters()
      optimizedParams,
      options.model
    );
  }

  // Apply overrides
  if (options.overrides) {
    if (options.overrides.temperature !== undefined)
      optimizedParams.temperature = options.overrides.temperature;
    if (options.overrides.maxTokens !== undefined)
      optimizedParams.maxTokens = options.overrides.maxTokens;
    if (options.overrides.contextLength !== undefined)
      optimizedParams.contextLength = options.overrides.contextLength;
    if (options.overrides.systemPrompt !== undefined)
      optimizedParams.systemPrompt = options.overrides.systemPrompt;
  }

  const result: OptimizedParameters & { 
    stop?: string[];
    system?: string;
    userPromptTemplate?: string;
    taskType?: string;
    complexity?: string;
  } = {
    temperature: optimizedParams.temperature,
    maxTokens: optimizedParams.maxTokens,
    contextLength: optimizedParams.contextLength,
    topP: optimizedParams.topP,
    presencePenalty: optimizedParams.presencePenalty,
    frequencyPenalty: optimizedParams.frequencyPenalty,
    stopSequences: optimizedParams.stopSequences,
    systemPrompt: optimizedParams.systemPrompt,
  };

  // Add extended properties for compatibility
  (result as any).stop = optimizedParams.stopSequences;
  (result as any).system = optimizedParams.systemPrompt;
  (result as any).userPromptTemplate = optimizedParams.userPromptTemplate;
  (result as any).taskType = taskContext.type;
  (result as any).complexity = taskContext.complexity;

  return result as any;
}

export default intelligentParametersMiddleware;
