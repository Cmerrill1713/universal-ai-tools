import { z } from 'zod';
import { llmRouter } from '@/services/llm-router-service';
import { mcpIntegrationService } from '@/services/mcp-integration-service';
import { bayesianModelRegistry } from '@/utils/bayesian-model';
import { TWO } from '@/utils/common-constants';
import { log, LogContext } from '@/utils/logger';
import { BetaSampler } from '@/utils/thompson-sampling';
import { createValidatedResponse, validators, } from '@/utils/validation';
export class EnhancedBaseAgent {
    config;
    isInitialized = false;
    conversationHistory = [];
    systemPrompt = '';
    executionHistory = [];
    performanceDistribution = {
        alpha: 1,
        beta: 1,
    };
    dynamicSpawnCount = 0;
    performanceMetrics = {
        totalCalls: 0,
        successRate: 1,
        averageExecutionTime: 0,
        averageConfidence: 0.8,
        lastUsed: null,
    };
    constructor(config) {
        this.config = config;
        this.systemPrompt = this.buildSystemPrompt();
    }
    getName() {
        return this.config.name;
    }
    getDescription() {
        return this.config.description;
    }
    getCapabilities() {
        return this.config.capabilities.map((cap) => cap.name);
    }
    getPriority() {
        return this.config.priority;
    }
    async initialize() {
        if (this.isInitialized) {
            return;
        }
        try {
            await this.onInitialize();
            this.isInitialized = true;
            log.info(`✅ Enhanced agent initialized: ${this.config.name}`, LogContext.AGENT, {
                model: this.getInternalModelName(),
                capabilities: this.getCapabilities(),
            });
        }
        catch (error) {
            log.error(`❌ Failed to initialize enhanced agent: ${this.config.name}`, LogContext.AGENT, {
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }
    async execute(context) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        const startTime = Date.now();
        try {
            log.info(`🧠 Executing enhanced agent: ${this.config.name}`, LogContext.AGENT, {
                requestId: context.requestId,
                userRequest: context.userRequest.substring(0, 100) + (context.userRequest.length > 100 ? '...' : ''),
            });
            this.validateContext(context);
            const messages = this.buildMessages(context);
            const llmResponse = await llmRouter.generateResponse(this.getInternalModelName(), messages, {
                capabilities: this.getCapabilities(),
                temperature: this.getTemperature(),
                maxTokens: this.getMaxTokens(),
                includeContext: true,
                contextTypes: this.getContextTypes(),
                userId: context.userId,
                requestId: context.requestId,
            });
            const agentResponse = await this.processLLMResponse(llmResponse, context);
            try {
                const { checkAndCorrectFactuality } = await import('@/services/factuality-guard');
                const fact = await checkAndCorrectFactuality(agentResponse.data ? String(agentResponse.data) : llmResponse.content || '', context.userRequest, {
                    userId: context.userId,
                    requestId: context.requestId,
                    projectPath: context.workingDirectory,
                });
                if (fact && fact.content && fact.content !== agentResponse.data) {
                    agentResponse.data = fact.content;
                    if (!agentResponse.success) {
                        agentResponse.success = true;
                        agentResponse.confidence = Math.max(agentResponse.confidence, 0.6);
                    }
                }
            }
            catch {
            }
            this.updateConversationHistory(context.userRequest, llmResponse.content);
            await this.saveMCPContext(context, agentResponse, llmResponse);
            const executionTime = Date.now() - startTime;
            log.info(`✅ Enhanced agent execution completed: ${this.config.name}`, LogContext.AGENT, {
                requestId: context.requestId,
                executionTime: `${executionTime}ms`,
                success: agentResponse.success,
                confidence: agentResponse.confidence,
                model: llmResponse.model,
                provider: llmResponse.provider,
                tokens: llmResponse.usage?.total_tokens || 0,
            });
            return {
                ...agentResponse,
                metadata: {
                    ...agentResponse.metadata,
                    executionTime,
                    agentName: this.config.name,
                    model: llmResponse.model,
                    provider: llmResponse.provider,
                    tokens: llmResponse.usage,
                },
            };
        }
        catch (error) {
            const executionTime = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : String(error);
            log.error(`❌ Enhanced agent execution failed: ${this.config.name}`, LogContext.AGENT, {
                requestId: context.requestId,
                error: errorMessage,
                executionTime: `${executionTime}ms`,
            });
            return this.createErrorResponse(`Agent execution failed: ${errorMessage}`, `Error in ${this.config.name}: ${errorMessage}`, {
                executionTime,
                agentName: this.config.name,
                error: errorMessage,
            });
        }
    }
    buildMessages(context) {
        const messages = [
            {
                role: 'system',
                content: this.systemPrompt,
            },
        ];
        const recentHistory = this.conversationHistory.slice(-10);
        messages.push(...recentHistory);
        const contextualRequest = this.buildContextualRequest(context);
        messages.push({
            role: 'user',
            content: contextualRequest,
        });
        return messages;
    }
    buildContextualRequest(context) {
        let request = `User Request: ${context.userRequest}\n\n`;
        if (context.workingDirectory) {
            request += `Working Directory: ${context.workingDirectory}\n`;
        }
        if (context.userId && context.userId !== 'anonymous') {
            request += `User ID: ${context.userId}\n`;
        }
        const additionalContext = this.getAdditionalContext(context);
        if (additionalContext) {
            request += `Additional Context: ${additionalContext}\n`;
        }
        request += `\nPlease provide a helpful, accurate, and contextually appropriate response based on your role and capabilities.`;
        return request;
    }
    getAdditionalContext(_context) {
        return null;
    }
    async processLLMResponse(llmResponse, context) {
        try {
            let data = llmResponse.content;
            let reasoning = llmResponse.content;
            try {
                const parsed = JSON.parse(llmResponse.content);
                if (parsed && typeof parsed === 'object') {
                    data = parsed;
                    reasoning = parsed.reasoning || parsed.explanation || llmResponse.content;
                }
            }
            catch {
            }
            const confidence = this.calculateConfidence(llmResponse, context);
            return this.createSuccessResponse(data, `Response generated by ${this.config.name}`, confidence, reasoning);
        }
        catch (error) {
            return this.createErrorResponse('Failed to process LLM response', `Error processing response: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    calculateConfidence(llmResponse, _context) {
        let confidence = 0.7;
        const response = llmResponse;
        switch (response.provider) {
            case 'anthropic':
                confidence += 0.1;
                break;
            case 'openai':
                confidence += 0.05;
                break;
            case 'ollama':
                confidence -= 0.1;
                break;
        }
        const responseLength = response.content?.length || 0;
        if (responseLength > 500)
            confidence += 0.05;
        if (responseLength < 50)
            confidence -= 0.1;
        if (response.usage) {
            const efficiency = response.usage.completion_tokens / response.usage.prompt_tokens;
            if (efficiency > 0.5 && efficiency < 2.0)
                confidence += 0.05;
        }
        return Math.max(0.1, Math.min(1.0, confidence));
    }
    updateConversationHistory(userMessage, assistantMessage) {
        this.conversationHistory.push({ role: 'user', content: userMessage }, { role: 'assistant', content: assistantMessage });
        if (this.conversationHistory.length > 20) {
            this.conversationHistory = this.conversationHistory.slice(-20);
        }
    }
    getTemperature() {
        return 0.7;
    }
    getMaxTokens() {
        return this.config.maxLatencyMs && this.config.maxLatencyMs < 5000 ? 1000 : 2000;
    }
    async shutdown() {
        try {
            await this.onShutdown();
            this.isInitialized = false;
            this.conversationHistory = [];
            log.info(`🔄 Enhanced agent shutdown: ${this.config.name}`, LogContext.AGENT);
        }
        catch (error) {
            log.error(`❌ Error during enhanced agent shutdown: ${this.config.name}`, LogContext.AGENT, {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    async onInitialize() {
    }
    async onShutdown() {
    }
    validateContext(context) {
        if (!context.userRequest || context.userRequest.trim().length === 0) {
            throw new Error('User request is required and cannot be empty');
        }
        if (!context.requestId) {
            throw new Error('Request ID is required');
        }
    }
    createSuccessResponse(data, message, confidence = 0.8, reasoning, metadata) {
        return {
            success: true,
            data,
            confidence: Math.max(0, Math.min(1, confidence)),
            message,
            reasoning: reasoning || `Processed by ${this.config.name}`,
            metadata: {
                agentName: this.config.name,
                timestamp: new Date().toISOString(),
                ...metadata,
            },
        };
    }
    createErrorResponse(message, reasoning, metadata) {
        return {
            success: false,
            data: null,
            confidence: 0,
            message,
            reasoning: reasoning || `Error in ${this.config.name}: ${message}`,
            metadata: {
                agentName: this.config.name,
                timestamp: new Date().toISOString(),
                ...metadata,
            },
        };
    }
    createValidatedSuccessResponse(data, message, confidence = 0.8, reasoning, dataSchema) {
        return createValidatedResponse(data, message, confidence, reasoning, dataSchema);
    }
    createValidatedErrorResponse(message, reasoning, _metadata) {
        return createValidatedResponse(null, message, 0, reasoning || `Error in ${this.config.name}: ${message}`, z.null());
    }
    async executeValidated(context, dataSchema) {
        try {
            const contextValidator = validators.custom(z.object({
                userRequest: z.string().min(1),
                requestId: z.string().min(1),
                userId: z.string().optional(),
                metadata: z.record(z.unknown()).optional(),
            }));
            const contextValidation = contextValidator.validate(context);
            if (!contextValidation.success) {
                log.warn(`⚠️ Context validation failed for ${this.config.name}`, LogContext.AGENT, {
                    errors: contextValidation.errors,
                });
                return this.createValidatedErrorResponse('Invalid context provided', `Context validation failed: ${contextValidation.errors?.map((e) => e.message).join(', ')}`, { validationErrors: contextValidation.errors });
            }
            const response = await this.execute(context);
            const responseValidator = validators.agentResponse(dataSchema);
            const responseValidation = responseValidator.validate(response);
            if (!responseValidation.success) {
                log.warn(`⚠️ Response validation failed for ${this.config.name}`, LogContext.AGENT, {
                    errors: responseValidation.errors,
                });
                return this.createValidatedErrorResponse('Response validation failed', `Generated response did not meet validation requirements`, {
                    originalResponse: response,
                    validationErrors: responseValidation.errors,
                });
            }
            return this.createValidatedSuccessResponse(response.data, response.message, response.confidence, response.reasoning, dataSchema);
        }
        catch (error) {
            log.error(`❌ Validated execution failed for ${this.config.name}`, LogContext.AGENT, {
                error: error instanceof Error ? error.message : String(error),
            });
            return this.createValidatedErrorResponse('Execution failed with unexpected error', error instanceof Error ? error.message : String(error), { errorType: error instanceof Error ? error.constructor.name : 'Unknown' });
        }
    }
    async executeBatchValidated(contexts, dataSchema) {
        const results = [];
        log.info(`🔄 Starting batch execution for ${this.config.name}`, LogContext.AGENT, {
            batchSize: contexts.length,
        });
        for (let i = 0; i < contexts.length; i++) {
            const context = contexts[i];
            try {
                const result = await this.executeValidated(context, dataSchema);
                results.push(result);
                log.info(`✅ Batch item ${i + 1}/${contexts.length} completed`, LogContext.AGENT, {
                    success: result.success,
                    confidence: result.confidence,
                });
            }
            catch (error) {
                const errorResult = this.createValidatedErrorResponse(`Batch execution failed for item ${i + 1}`, error instanceof Error ? error.message : String(error), { batchIndex: i, batchSize: contexts.length });
                results.push(errorResult);
                log.error(`❌ Batch item ${i + 1}/${contexts.length} failed`, LogContext.AGENT, {
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }
        log.info(`🏁 Batch execution completed for ${this.config.name}`, LogContext.AGENT, {
            totalItems: contexts.length,
            successCount: results.filter((r) => r.success).length,
            failureCount: results.filter((r) => !r.success).length,
        });
        return results;
    }
    getConversationHistory() {
        return [...this.conversationHistory];
    }
    clearConversationHistory() {
        this.conversationHistory = [];
        log.info(`🔄 Conversation history cleared: ${this.config.name}`, LogContext.AGENT);
    }
    getProbabilisticScore(context) {
        const model = bayesianModelRegistry.getModel(this.config.name, this.getTaskType(context));
        const prediction = model.predict(context.metadata || {});
        const thompsonSample = BetaSampler.sample(this.performanceDistribution.alpha, this.performanceDistribution.beta);
        const score = 0.7 * prediction.expectedReward + 0.3 * thompsonSample;
        log.debug(`🎲 Probabilistic score for ${this.config.name}`, LogContext.AGENT, {
            modelPrediction: prediction.expectedReward,
            thompsonSample,
            finalScore: score,
            confidence: prediction.confidence,
        });
        return score;
    }
    updatePerformance(context, response, feedback) {
        this.executionHistory.push({
            context,
            response,
            reward: feedback.reward,
            timestamp: feedback.timestamp,
        });
        if (this.executionHistory.length > 100) {
            this.executionHistory = this.executionHistory.slice(-100);
        }
        if (feedback.reward.value > 0.5) {
            this.performanceDistribution.alpha++;
        }
        else {
            this.performanceDistribution.beta++;
        }
        bayesianModelRegistry.updateModel(this.config.name, this.getTaskType(context), feedback.reward, feedback.reward.metadata.executionTime, context.metadata || {});
        log.info(`📊 Performance updated for ${this.config.name}`, LogContext.AGENT, {
            reward: feedback.reward.value,
            newAlpha: this.performanceDistribution.alpha,
            newBeta: this.performanceDistribution.beta,
            successRate: this.getSuccessRate(),
        });
    }
    getSuccessRate() {
        return (this.performanceDistribution.alpha /
            (this.performanceDistribution.alpha + this.performanceDistribution.beta));
    }
    getConfidenceInterval(confidence = 0.95) {
        return BetaSampler.confidenceInterval({
            alpha: this.performanceDistribution.alpha,
            beta: this.performanceDistribution.beta,
            mean: this.getSuccessRate(),
            variance: 0,
        }, confidence);
    }
    shouldSpawnVariant() {
        const successRate = this.getSuccessRate();
        const sampleSize = this.performanceDistribution.alpha + this.performanceDistribution.beta - TWO;
        if (sampleSize >= 20 && successRate < 0.3) {
            return true;
        }
        const recentPerformance = this.executionHistory.slice(-10);
        if (recentPerformance.length >= 10) {
            const variance = this.calculateVariance(recentPerformance.map((h) => h.reward.value));
            if (variance > 0.2) {
                return true;
            }
        }
        return false;
    }
    async spawnVariant() {
        if (!this.shouldSpawnVariant()) {
            return null;
        }
        this.dynamicSpawnCount++;
        log.info(`🧬 Spawning variant of ${this.config.name}`, LogContext.AGENT, {
            spawnCount: this.dynamicSpawnCount,
            currentSuccessRate: this.getSuccessRate(),
        });
        return null;
    }
    getPerformanceMetrics() {
        if (this.executionHistory.length > 0) {
            const recentExecutions = this.executionHistory.slice(-100);
            const successCount = recentExecutions.filter((e) => e.response.success).length;
            this.performanceMetrics.successRate = successCount / recentExecutions.length;
            const totalTime = recentExecutions.reduce((sum, e) => sum + (e.response.metadata?.executionTime || 0), 0);
            this.performanceMetrics.averageExecutionTime = totalTime / recentExecutions.length;
            const totalConfidence = recentExecutions.reduce((sum, e) => sum + e.response.confidence, 0);
            this.performanceMetrics.averageConfidence = totalConfidence / recentExecutions.length;
            this.performanceMetrics.totalCalls = this.executionHistory.length;
            this.performanceMetrics.lastUsed = new Date();
        }
        return this.performanceMetrics;
    }
    getDetailedPerformanceMetrics() {
        const successRate = this.getSuccessRate();
        const confidenceInterval = this.getConfidenceInterval();
        const executionCount = this.executionHistory.length;
        const averageReward = executionCount > 0
            ? this.executionHistory.reduce((sum, h) => sum + h.reward.value, 0) / executionCount
            : 0;
        const recentTrend = this.calculateTrend();
        return {
            successRate,
            confidenceInterval,
            executionCount,
            averageReward,
            recentTrend,
            spawnCount: this.dynamicSpawnCount,
        };
    }
    calculateReward(response, executionTime, context) {
        const quality = response.success ? response.confidence : 0;
        const targetTime = context.metadata?.targetTime || 5000;
        const speedScore = Math.max(0, 1 - executionTime / targetTime);
        const tokensUsed = response.metadata?.tokens?.total_tokens || 100;
        const costScore = Math.max(0, 1 - tokensUsed / 1000);
        const value = 0.5 * quality + 0.3 * speedScore + 0.2 * costScore;
        return {
            value,
            components: {
                quality,
                speed: speedScore,
                cost: costScore,
                user_satisfaction: response.metadata?.userRating || quality,
            },
            metadata: {
                executionTime,
                tokensUsed,
                memoryUsed: 0,
                errors: response.success ? 0 : 1,
            },
        };
    }
    getTaskType(context) {
        return context.metadata?.taskType || 'general';
    }
    calculateVariance(values) {
        if (values.length === 0)
            return 0;
        const mean = values.reduce((a, b) => a + b) / values.length;
        const squaredDiffs = values.map((v) => Math.pow(v - mean, TWO));
        return squaredDiffs.reduce((a, b) => a + b) / values.length;
    }
    calculateTrend() {
        if (this.executionHistory.length < 10)
            return 'stable';
        const recent = this.executionHistory.slice(-10);
        const older = this.executionHistory.slice(-20, -10);
        if (older.length < 5)
            return 'stable';
        const recentAvg = recent.reduce((sum, h) => sum + h.reward.value, 0) / recent.length;
        const olderAvg = older.reduce((sum, h) => sum + h.reward.value, 0) / older.length;
        const diff = recentAvg - olderAvg;
        if (diff > 0.1)
            return 'improving';
        if (diff < -0.1)
            return 'declining';
        return 'stable';
    }
    async executeWithFeedback(context) {
        const startTime = Date.now();
        const response = await this.execute(context);
        const executionTime = Date.now() - startTime;
        const reward = this.calculateReward(response, executionTime, context);
        const feedback = {
            nodeId: context.metadata?.nodeId || `direct-${Date.now()}`,
            reward,
            errorOccurred: !response.success,
            errorMessage: response.success ? undefined : response.message,
            timestamp: Date.now(),
            context: {
                taskType: this.getTaskType(context),
                userId: context.userId,
                sessionId: context.requestId,
            },
        };
        this.updatePerformance(context, response, feedback);
        return { response, feedback };
    }
    getContextTypes() {
        return ['project_overview', 'code_patterns', 'conversation_history'];
    }
    async saveMCPContext(context, agentResponse, _llmResponse) {
        try {
            const conversationContext = {
                userRequest: context.userRequest,
                agentResponse: agentResponse.data,
                agentName: this.config.name,
                confidence: agentResponse.confidence,
                success: agentResponse.success,
                timestamp: new Date().toISOString(),
                requestId: context.requestId,
                userId: context.userId,
            };
            await mcpIntegrationService.sendMessage('save_context', {
                content: JSON.stringify(conversationContext),
                category: 'conversation_history',
                metadata: {
                    agentName: this.config.name,
                    userId: context.userId,
                    requestId: context.requestId,
                    workingDirectory: context.workingDirectory,
                    success: agentResponse.success,
                    confidence: agentResponse.confidence,
                },
            });
            if (agentResponse.success && this.isCodeRelated(context.userRequest)) {
                await mcpIntegrationService.sendMessage('save_context', {
                    content: `User Request: ${context.userRequest}\n\nAgent Response: ${agentResponse.data}`,
                    category: 'code_patterns',
                    metadata: {
                        agentName: this.config.name,
                        userId: context.userId,
                        requestId: context.requestId,
                        patternType: this.extractPatternType(context.userRequest),
                        success: true,
                    },
                });
            }
            if (!agentResponse.success || (agentResponse.confidence && agentResponse.confidence < 0.7)) {
                await mcpIntegrationService.sendMessage('save_context', {
                    content: `User Request: ${context.userRequest}\n\nError/Issue: ${agentResponse.message || 'Low confidence response'}\n\nAttempted Response: ${agentResponse.data}`,
                    category: 'error_analysis',
                    metadata: {
                        agentName: this.config.name,
                        userId: context.userId,
                        requestId: context.requestId,
                        errorType: agentResponse.success ? 'low_confidence' : 'execution_error',
                        confidence: agentResponse.confidence,
                    },
                });
            }
            log.debug('✅ Context saved to MCP', LogContext.MCP, {
                agentName: this.config.name,
                requestId: context.requestId,
                success: agentResponse.success,
                confidence: agentResponse.confidence,
            });
        }
        catch (error) {
            log.warn('⚠️ Failed to save context to MCP', LogContext.MCP, {
                agentName: this.config.name,
                requestId: context.requestId,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    isCodeRelated(userRequest) {
        const codeKeywords = [
            'code',
            'function',
            'class',
            'method',
            'variable',
            'debug',
            'fix',
            'error',
            'implement',
            'refactor',
            'optimize',
            'bug',
            'syntax',
            'typescript',
            'javascript',
            'react',
            'node',
            'api',
            'database',
            'sql',
            'query',
            'import',
            'export',
        ];
        const lowercaseRequest = userRequest.toLowerCase();
        return codeKeywords.some((keyword) => lowercaseRequest.includes(keyword));
    }
    extractPatternType(userRequest) {
        const request = userRequest.toLowerCase();
        if (request.includes('fix') || request.includes('debug') || request.includes('error')) {
            return 'error_fix';
        }
        else if (request.includes('implement') ||
            request.includes('create') ||
            request.includes('build')) {
            return 'implementation';
        }
        else if (request.includes('refactor') ||
            request.includes('optimize') ||
            request.includes('improve')) {
            return 'optimization';
        }
        else if (request.includes('explain') ||
            request.includes('understand') ||
            request.includes('how')) {
            return 'explanation';
        }
        else {
            return 'general_code';
        }
    }
}
export default EnhancedBaseAgent;
//# sourceMappingURL=enhanced-base-agent.js.map