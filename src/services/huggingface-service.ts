/**
 * HuggingFace Service
 * Provides access to HuggingFace models for text generation, embeddings, and more
 */

import { HfInference } from '@huggingface/inference';

import { CircuitBreaker, CircuitBreakerRegistry } from '../utils/circuit-breaker';
import { log,LogContext } from '../utils/logger';

export interface HuggingFaceConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
}

export interface TextGenerationRequest {
  inputs: string;
  parameters?: {
    max_new_tokens?: number;
    temperature?: number;
    top_p?: number;
    top_k?: number;
    repetition_penalty?: number;
    do_sample?: boolean;
    return_full_text?: boolean;
  };
  model?: string;
}

export interface EmbeddingRequest {
  inputs: string | string[];
  model?: string;
}

export interface QuestionAnsweringRequest {
  question: string;
  context: string;
  model?: string;
}

export interface SummarizationRequest {
  inputs: string;
  parameters?: {
    max_length?: number;
    min_length?: number;
    do_sample?: boolean;
    temperature?: number;
  };
  model?: string;
}

export interface HuggingFaceMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  modelsUsed: Set<string>;
  lastRequestTime: number;
}

export class HuggingFaceService {
  private hf: HfInference;
  private metrics: HuggingFaceMetrics;
  private isInitialized = false;
  private circuitBreaker: CircuitBreaker;

  // Default models for different tasks
  private defaultModels = {
    textGeneration: 'microsoft/DialoGPT-medium',
    embedding: 'sentence-transformers/all-MiniLM-L6-v2',
    questionAnswering: 'deepset/roberta-base-squad2',
    summarization: 'facebook/bart-large-cnn',
    sentimentAnalysis: 'cardiffnlp/twitter-roberta-base-sentiment-latest',
  };

  constructor(config: HuggingFaceConfig) {
    this.hf = new HfInference(config.apiKey);
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      modelsUsed: new Set(),
      lastRequestTime: 0,
    };

    // Initialize circuit breaker for HuggingFace service
    this.circuitBreaker = new CircuitBreaker('huggingface', {
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 30000,
      errorThresholdPercentage: 50,
    });
    CircuitBreakerRegistry.register('huggingface', this.circuitBreaker);

    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      log.info('🤗 Initializing HuggingFace service', LogContext.AI);

      // Test connection with a simple request
      await this.testConnection();

      this.isInitialized = true;
      log.info('✅ HuggingFace service initialized successfully', LogContext.AI);
    } catch (error) {
      log.error('❌ Failed to initialize HuggingFace service', LogContext.AI, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async testConnection(): Promise<void> {
    try {
      // Simple test with text generation
      await this.hf.textGeneration({
        model: this.defaultModels.textGeneration,
        inputs: 'Hello',
        parameters: {
          max_new_tokens: 1,
          temperature: 0.1,
        },
      });
      log.info('✅ HuggingFace connection test successful', LogContext.AI);
    } catch (error) {
      log.warn('⚠️ HuggingFace connection test failed', LogContext.AI, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Generate text using HuggingFace models
   */
  public async generateText(request: TextGenerationRequest): Promise<any> {
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
      } catch (error) {
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

  /**
   * Generate embeddings using HuggingFace models
   */
  public async generateEmbeddings(request: EmbeddingRequest): Promise<any> {
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
      } catch (error) {
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

  /**
   * Answer questions using HuggingFace QA models
   */
  public async answerQuestion(request: QuestionAnsweringRequest): Promise<any> {
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
      } catch (error) {
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

  /**
   * Summarize text using HuggingFace models
   */
  public async summarizeText(request: SummarizationRequest): Promise<any> {
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
      } catch (error) {
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

  /**
   * Analyze sentiment using HuggingFace models
   */
  public async analyzeSentiment(text: string, model?: string): Promise<any> {
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
      } catch (error) {
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

  /**
   * List available models for a specific task
   */
  public async listModels(task?: string): Promise<any> {
    try {
      log.info('📋 Listing HuggingFace models', LogContext.AI, { task });

      // Return default models for now - could be extended to use HF Hub API
      const models = task
        ? { [task]: this.defaultModels[task as keyof typeof this.defaultModels] }
        : this.defaultModels;

      return {
        success: true,
        data: {
          models,
          defaultModels: this.defaultModels,
          supportedTasks: Object.keys(this.defaultModels),
        },
      };
    } catch (error) {
      log.error('❌ Failed to list HuggingFace models', LogContext.AI, { error });

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get service metrics
   */
  public getMetrics(): HuggingFaceMetrics & { isInitialized: boolean } {
    return {
      ...this.metrics,
      modelsUsed: this.metrics.modelsUsed,
      isInitialized: this.isInitialized,
    };
  }

  /**
   * Update internal metrics
   */
  private updateMetrics(startTime: number, success: boolean): void {
    const duration = Date.now() - startTime;

    this.metrics.totalRequests++;
    this.metrics.lastRequestTime = Date.now();

    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
    }

    // Update rolling average
    const alpha = 0.1;
    this.metrics.averageResponseTime =
      alpha * duration + (1 - alpha) * this.metrics.averageResponseTime;
  }

  /**
   * Check if the service is healthy
   */
  public async healthCheck(): Promise<any> {
    try {
      if (!this.isInitialized) {
        return {
          status: 'initializing',
          healthy: false,
          error: 'Service not yet initialized',
        };
      }

      // Simple health check
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
    } catch (error) {
      return {
        status: 'unhealthy',
        healthy: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Shutdown the service
   */
  public async shutdown(): Promise<void> {
    log.info('🛑 Shutting down HuggingFace service', LogContext.AI);
    this.isInitialized = false;
  }
}

// Create singleton instance
const huggingFaceConfig: HuggingFaceConfig = {
  apiKey: process.env.HUGGINGFACE_API_KEY || '',
  timeout: 30000,
};

export const huggingFaceService = process.env.HUGGINGFACE_API_KEY
  ? new HuggingFaceService(huggingFaceConfig)
  : null;

export default huggingFaceService;
