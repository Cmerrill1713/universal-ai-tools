import { HfInference } from '@huggingface/inference';
import { CircuitBreaker, CircuitBreakerRegistry } from '../utils/circuit-breaker';
import { log, LogContext } from '../utils/logger';
export class HuggingFaceService {
    hf;
    metrics;
    isInitialized = false;
    circuitBreaker;
    defaultModels = {
        textGeneration: 'microsoft/DialoGPT-medium',
        embedding: 'sentence-transformers/all-MiniLM-L6-v2',
        questionAnswering: 'deepset/roberta-base-squad2',
        summarization: 'facebook/bart-large-cnn',
        sentimentAnalysis: 'cardiffnlp/twitter-roberta-base-sentiment-latest',
    };
    constructor(config) {
        this.hf = new HfInference(config.apiKey);
        this.metrics = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            averageResponseTime: 0,
            modelsUsed: new Set(),
            lastRequestTime: 0,
        };
        this.circuitBreaker = new CircuitBreaker('huggingface', {
            failureThreshold: 5,
            successThreshold: 2,
            timeout: 30000,
            errorThresholdPercentage: 50,
        });
        CircuitBreakerRegistry.register('huggingface', this.circuitBreaker);
        this.initialize();
    }
    async initialize() {
        try {
            log.info('🤗 Initializing HuggingFace service', LogContext.AI);
            await this.testConnection();
            this.isInitialized = true;
            log.info('✅ HuggingFace service initialized successfully', LogContext.AI);
        }
        catch (error) {
            log.error('❌ Failed to initialize HuggingFace service', LogContext.AI, {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    async testConnection() {
        try {
            await this.hf.textGeneration({
                model: this.defaultModels.textGeneration,
                inputs: 'Hello',
                parameters: {
                    max_new_tokens: 1,
                    temperature: 0.1,
                },
            });
            log.info('✅ HuggingFace connection test successful', LogContext.AI);
        }
        catch (error) {
            log.warn('⚠️ HuggingFace connection test failed', LogContext.AI, {
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }
    async generateText(request) {
        return this.circuitBreaker.execute(async () => {
            const startTime = Date.now();
            try {
                const model = request.model || this.defaultModels.textGeneration;
                this.metrics.modelsUsed.add(model);
                log.info('📝 Generating text with HuggingFace', LogContext.AI, {
                    model,
                    inputLength: request.inputs.length,
                });
                const result = await this.hf.textGeneration({
                    model,
                    inputs: request.inputs,
                    parameters: request.parameters || {
                        max_new_tokens: 100,
                        temperature: 0.7,
                        do_sample: true,
                    },
                });
                this.updateMetrics(startTime, true);
                return {
                    success: true,
                    data: result,
                    model,
                    processingTime: Date.now() - startTime,
                };
            }
            catch (error) {
                this.updateMetrics(startTime, false);
                log.error('❌ HuggingFace text generation failed', LogContext.AI, { error });
                return {
                    success: false,
                    error: error instanceof Error ? error.message : String(error),
                    processingTime: Date.now() - startTime,
                };
            }
        });
    }
    async generateEmbeddings(request) {
        return this.circuitBreaker.execute(async () => {
            const startTime = Date.now();
            try {
                const model = request.model || this.defaultModels.embedding;
                this.metrics.modelsUsed.add(model);
                log.info('🔢 Generating embeddings with HuggingFace', LogContext.AI, {
                    model,
                    inputType: Array.isArray(request.inputs) ? 'batch' : 'single',
                });
                const result = await this.hf.featureExtraction({
                    model,
                    inputs: request.inputs,
                });
                this.updateMetrics(startTime, true);
                return {
                    success: true,
                    data: {
                        embeddings: result,
                        model,
                        dimension: Array.isArray(result[0]) ? result[0].length : result.length,
                    },
                    processingTime: Date.now() - startTime,
                };
            }
            catch (error) {
                this.updateMetrics(startTime, false);
                log.error('❌ HuggingFace embedding generation failed', LogContext.AI, { error });
                return {
                    success: false,
                    error: error instanceof Error ? error.message : String(error),
                    processingTime: Date.now() - startTime,
                };
            }
        });
    }
    async answerQuestion(request) {
        return this.circuitBreaker.execute(async () => {
            const startTime = Date.now();
            try {
                const model = request.model || this.defaultModels.questionAnswering;
                this.metrics.modelsUsed.add(model);
                log.info('❓ Answering question with HuggingFace', LogContext.AI, {
                    model,
                    questionLength: request.question.length,
                    contextLength: request.context.length,
                });
                const result = await this.hf.questionAnswering({
                    model,
                    inputs: {
                        question: request.question,
                        context: request.context,
                    },
                });
                this.updateMetrics(startTime, true);
                return {
                    success: true,
                    data: result,
                    model,
                    processingTime: Date.now() - startTime,
                };
            }
            catch (error) {
                this.updateMetrics(startTime, false);
                log.error('❌ HuggingFace question answering failed', LogContext.AI, { error });
                return {
                    success: false,
                    error: error instanceof Error ? error.message : String(error),
                    processingTime: Date.now() - startTime,
                };
            }
        });
    }
    async summarizeText(request) {
        return this.circuitBreaker.execute(async () => {
            const startTime = Date.now();
            try {
                const model = request.model || this.defaultModels.summarization;
                this.metrics.modelsUsed.add(model);
                log.info('📄 Summarizing text with HuggingFace', LogContext.AI, {
                    model,
                    inputLength: request.inputs.length,
                });
                const result = await this.hf.summarization({
                    model,
                    inputs: request.inputs,
                    parameters: request.parameters || {
                        max_length: 150,
                        min_length: 30,
                        do_sample: false,
                    },
                });
                this.updateMetrics(startTime, true);
                return {
                    success: true,
                    data: result,
                    model,
                    processingTime: Date.now() - startTime,
                };
            }
            catch (error) {
                this.updateMetrics(startTime, false);
                log.error('❌ HuggingFace summarization failed', LogContext.AI, { error });
                return {
                    success: false,
                    error: error instanceof Error ? error.message : String(error),
                    processingTime: Date.now() - startTime,
                };
            }
        });
    }
    async analyzeSentiment(text, model) {
        return this.circuitBreaker.execute(async () => {
            const startTime = Date.now();
            try {
                const selectedModel = model || this.defaultModels.sentimentAnalysis;
                this.metrics.modelsUsed.add(selectedModel);
                log.info('😊 Analyzing sentiment with HuggingFace', LogContext.AI, {
                    model: selectedModel,
                    textLength: text.length,
                });
                const result = await this.hf.textClassification({
                    model: selectedModel,
                    inputs: text,
                });
                this.updateMetrics(startTime, true);
                return {
                    success: true,
                    data: result,
                    model: selectedModel,
                    processingTime: Date.now() - startTime,
                };
            }
            catch (error) {
                this.updateMetrics(startTime, false);
                log.error('❌ HuggingFace sentiment analysis failed', LogContext.AI, { error });
                return {
                    success: false,
                    error: error instanceof Error ? error.message : String(error),
                    processingTime: Date.now() - startTime,
                };
            }
        });
    }
    async listModels(task) {
        try {
            log.info('📋 Listing HuggingFace models', LogContext.AI, { task });
            const models = task
                ? { [task]: this.defaultModels[task] }
                : this.defaultModels;
            return {
                success: true,
                data: {
                    models,
                    defaultModels: this.defaultModels,
                    supportedTasks: Object.keys(this.defaultModels),
                },
            };
        }
        catch (error) {
            log.error('❌ Failed to list HuggingFace models', LogContext.AI, { error });
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }
    getMetrics() {
        return {
            ...this.metrics,
            modelsUsed: this.metrics.modelsUsed,
            isInitialized: this.isInitialized,
        };
    }
    updateMetrics(startTime, success) {
        const duration = Date.now() - startTime;
        this.metrics.totalRequests++;
        this.metrics.lastRequestTime = Date.now();
        if (success) {
            this.metrics.successfulRequests++;
        }
        else {
            this.metrics.failedRequests++;
        }
        const alpha = 0.1;
        this.metrics.averageResponseTime =
            alpha * duration + (1 - alpha) * this.metrics.averageResponseTime;
    }
    async healthCheck() {
        try {
            if (!this.isInitialized) {
                return {
                    status: 'initializing',
                    healthy: false,
                    error: 'Service not yet initialized',
                };
            }
            const testResult = await this.generateText({
                inputs: 'Health check',
                parameters: { max_new_tokens: 1 },
            });
            return {
                status: 'healthy',
                healthy: testResult.success,
                metrics: this.getMetrics(),
                timestamp: new Date().toISOString(),
            };
        }
        catch (error) {
            return {
                status: 'unhealthy',
                healthy: false,
                error: error instanceof Error ? error.message : String(error),
                timestamp: new Date().toISOString(),
            };
        }
    }
    async shutdown() {
        log.info('🛑 Shutting down HuggingFace service', LogContext.AI);
        this.isInitialized = false;
    }
}
const huggingFaceConfig = {
    apiKey: process.env.HUGGINGFACE_API_KEY || '',
    timeout: 30000,
};
export const huggingFaceService = process.env.HUGGINGFACE_API_KEY
    ? new HuggingFaceService(huggingFaceConfig)
    : null;
export default huggingFaceService;
//# sourceMappingURL=huggingface-service.js.map