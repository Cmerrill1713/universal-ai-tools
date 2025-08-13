import { TaskType } from '@/types';
import { intelligentParameterService } from '../services/intelligent-parameter-service';
import { log, LogContext } from '../utils/logger';
export function intelligentParametersMiddleware(overrides = {}) {
    return (req, res, next) => {
        try {
            if (req.body?.manualParameters === true) {
                log.info('Skipping intelligent parameters (manual mode)', LogContext.AI);
                return next();
            }
            req.originalBody = { ...req.body };
            const userInput = req.body.prompt ||
                req.body.message ||
                req.body.userRequest ||
                req.body.query ||
                req.body.text ||
                req.body.content ||
                '';
            if (!userInput) {
                log.warn('No user input found for intelligent parameters', LogContext.AI);
                return next();
            }
            const additionalContext = {
                hasImage: !!(req.file || req.body.imagePath || req.body.imageBase64),
                language: req.body.language || 'javascript',
                framework: req.body.framework,
                domain: req.body.domain,
                endpoint: req.path,
                method: req.method,
                ...req.body.context,
            };
            const userPreferences = {
                preferredTemperature: req.body.preferredTemperature,
                preferredLength: req.body.preferredLength,
                writingStyle: req.body.writingStyle,
                creativity: req.body.creativity,
                ...req.body.userPreferences,
            };
            const taskContext = intelligentParameterService.createTaskContext(userInput, overrides.taskType || req.body.taskType, additionalContext, userPreferences);
            let optimizedParams = intelligentParameterService.getTaskParameters(taskContext);
            if (req.body.model) {
                optimizedParams = intelligentParameterService.getModelOptimizedParameters(optimizedParams, req.body.model);
            }
            if (overrides.temperature !== undefined)
                optimizedParams.temperature = overrides.temperature;
            if (overrides.maxTokens !== undefined)
                optimizedParams.maxTokens = overrides.maxTokens;
            if (overrides.contextLength !== undefined) {
                optimizedParams.contextLength = overrides.contextLength;
            }
            if (overrides.systemPrompt !== undefined) {
                optimizedParams.systemPrompt = overrides.systemPrompt;
            }
            if (req.body.temperature !== undefined)
                optimizedParams.temperature = req.body.temperature;
            if (req.body.maxTokens !== undefined)
                optimizedParams.maxTokens = req.body.maxTokens;
            if (req.body.max_tokens !== undefined)
                optimizedParams.maxTokens = req.body.max_tokens;
            if (req.body.contextLength !== undefined) {
                optimizedParams.contextLength = req.body.contextLength;
            }
            req.body = {
                ...req.body,
                temperature: optimizedParams.temperature,
                maxTokens: optimizedParams.maxTokens,
                max_tokens: optimizedParams.maxTokens,
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
            if (optimizedParams.userPromptTemplate !== '{user_input}') {
                req.body.prompt = optimizedParams.userPromptTemplate;
                req.body.enhancedPrompt = true;
            }
            req.taskContext = taskContext;
            req.optimizedParameters = optimizedParams;
            log.info('Applied intelligent parameters', LogContext.AI, {
                taskType: taskContext.type,
                complexity: taskContext.complexity,
                temperature: optimizedParams.temperature,
                maxTokens: optimizedParams.maxTokens,
                contextLength: optimizedParams.contextLength,
                endpoint: req.path,
            });
            next();
        }
        catch (error) {
            log.error('Error in intelligent parameters middleware', LogContext.AI, { error });
            next();
        }
    };
}
export function chatParametersMiddleware() {
    return intelligentParametersMiddleware({
        taskType: TaskType.CASUAL_CHAT,
        temperature: 0.7,
    });
}
export function codeParametersMiddleware() {
    return intelligentParametersMiddleware({
        taskType: TaskType.CODE_GENERATION,
        temperature: 0.2,
    });
}
export function analysisParametersMiddleware() {
    return intelligentParametersMiddleware({
        taskType: TaskType.DATA_ANALYSIS,
        temperature: 0.3,
    });
}
export function creativeParametersMiddleware() {
    return intelligentParametersMiddleware({
        taskType: TaskType.CREATIVE_WRITING,
        temperature: 0.8,
    });
}
export function visionParametersMiddleware() {
    return intelligentParametersMiddleware({
        taskType: TaskType.IMAGE_ANALYSIS,
        temperature: 0.4,
    });
}
export function parameterEffectivenessLogger() {
    return (req, res, next) => {
        const originalSend = res.send;
        res.send = function (data) {
            try {
                if (req.taskContext && req.optimizedParameters) {
                    const responseData = typeof data === 'string' ? JSON.parse(data) : data;
                    log.info('Parameter effectiveness metrics', LogContext.AI, {
                        taskType: req.taskContext.type,
                        temperature: req.optimizedParameters?.temperature,
                        maxTokens: req.optimizedParameters?.maxTokens,
                        responseSuccess: responseData.success !== false,
                        responseLength: responseData.data?.length || 0,
                        processingTime: responseData.processingTime,
                        endpoint: req.path,
                    });
                }
            }
            catch (error) {
            }
            return originalSend.call(this, data);
        };
        next();
    };
}
export function optimizeParameters(userInput, options = {}) {
    const taskContext = intelligentParameterService.createTaskContext(userInput, options.taskType, { domain: options.domain }, options.userPreferences || {});
    if (options.complexity) {
        taskContext.complexity = options.complexity;
    }
    let optimizedParams = intelligentParameterService.getTaskParameters(taskContext);
    if (options.model) {
        optimizedParams = intelligentParameterService.getModelOptimizedParameters(optimizedParams, options.model);
    }
    if (options.overrides) {
        if (options.overrides.temperature !== undefined) {
            optimizedParams.temperature = options.overrides.temperature;
        }
        if (options.overrides.maxTokens !== undefined) {
            optimizedParams.maxTokens = options.overrides.maxTokens;
        }
        if (options.overrides.contextLength !== undefined) {
            optimizedParams.contextLength = options.overrides.contextLength;
        }
        if (options.overrides.systemPrompt !== undefined) {
            optimizedParams.systemPrompt = options.overrides.systemPrompt;
        }
    }
    const result = {
        temperature: optimizedParams.temperature,
        maxTokens: optimizedParams.maxTokens,
        contextLength: optimizedParams.contextLength,
        topP: optimizedParams.topP,
        presencePenalty: optimizedParams.presencePenalty,
        frequencyPenalty: optimizedParams.frequencyPenalty,
        stopSequences: optimizedParams.stopSequences,
        systemPrompt: optimizedParams.systemPrompt,
    };
    result.stop = optimizedParams.stopSequences;
    result.system = optimizedParams.systemPrompt;
    result.userPromptTemplate = optimizedParams.userPromptTemplate;
    result.taskType = taskContext.type;
    result.complexity = taskContext.complexity;
    return result;
}
export default intelligentParametersMiddleware;
//# sourceMappingURL=intelligent-parameters.js.map