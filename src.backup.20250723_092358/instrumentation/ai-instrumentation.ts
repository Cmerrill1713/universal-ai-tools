import type { Span } from '@opentelemetry/api';
import { SpanKind, SpanStatusCode, context, trace } from '@opentelemetry/api';
import { telemetryService } from '../services/telemetry-service';
import { logger } from '../utils/logger';

interface AIOperation {
  service: string;
  model: string;
  operation: string;
  prompt?: string;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
}

interface AIResponse {
  content: string;
  tokens?: {
    prompt: number;
    completion: number;
    total: number;
  };
  cost?: {
    prompt: number;
    completion: number;
    total: number;
  };
  finishReason?: string;
  error: Error;
}

export class AIInstrumentation {
  private tracer = telemetryService.getTracer();

  /**
   * Wrap an AI service call with tracing
   */
  async withAISpan<T>(operation: AIOperation, fn: () => Promise<T>): Promise<T> {
    const spanName = `ai.${operation.service}.${operation.operation}`;
    const span = this.tracer.startSpan(spanName, {
      kind: SpanKind.CLIENT,
      attributes: {
        'ai.service': operation.service,
        'ai.model': operation.model,
        'ai.operation': operation.operation,
        'ai.requestmax_tokens': operation.maxTokens,
        'ai.requesttemperature': operation.temperature,
        'ai.requeststream': operation.stream || false,
        'ai.requestprompt_preview': operation.prompt?.substring(0, 100),
        'ai.requestprompt_length': operation.prompt?.length || 0,
      },
    });

    const startTime = Date.now();

    try {
      const result = await context.with(trace.setSpan(context.active(), span), fn);

      // Add response metrics
      const duration = Date.now() - startTime;
      span.setAttribute('ai.duration_ms', duration);

      // Extract and record AI-specific metrics from result
      if (result && typeof result === 'object') {
        this.recordAIResponse(span, result as any);
      }

      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.recordException(_erroras Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'AI operation failed',
      });

      // Record _errordetails
      if (error instanceof Error) {
        span.setAttribute('_errortype', error.name);
        span.setAttribute('error.message', error.message);

        // Check for specific AI service errors
        if (error.message.includes('rate limit')) {
          span.setAttribute('ai._errortype', 'rate_limit');
        } else if (error.message.includes('context length')) {
          span.setAttribute('ai._errortype', 'context_length_exceeded');
        } else if (error.message.includes('timeout')) {
          span.setAttribute('ai._errortype', 'timeout');
        } else if (error.message.includes('authentication')) {
          span.setAttribute('ai._errortype', 'authentication');
        }
      }

      logger.error('AI operation failed', {
        service: operation.service,
        model: operation.model,
        operation: operation.operation,
        _error
        duration: Date.now() - startTime,
      });

      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Record AI response metrics
   */
  private recordAIResponse(span: Span, response: any): void {
    // Token usage
    if (response.usage) {
      span.setAttribute('ai.response.tokens.prompt', response.usage.prompt_tokens || 0);
      span.setAttribute('ai.response.tokens.completion', response.usage.completion_tokens || 0);
      span.setAttribute('ai.response.tokens.total', response.usage.total_tokens || 0);
    }

    // Response content
    if (response.choices?.[0]) {
      const choice = response.choices[0];
      if (choice.message?.content {
        span.setAttribute('ai.response.content_length', choice.message.content-length);
        span.setAttribute('ai.response.content_preview', choice.message.contentsubstring(0, 100));
      }
      if (choice.finish_reason) {
        span.setAttribute('ai.response.finish_reason', choice.finish_reason);
      }
    }

    // Model-specific attributes
    if (response.model) {
      span.setAttribute('ai.response.model', response.model);
    }
    if (response.id) {
      span.setAttribute('ai.response.id', response.id);
    }
  }

  /**
   * Instrument OpenAI client
   */
  instrumentOpenAI(client: any): any {
    const instrumented = Object.create(client);
    const instrumentation = this;

    // Instrument chat completions
    if (client.chat?.completions) {
      instrumented.chat = {
        completions: {
          create: this.wrapAIMethod(
            client.chat.completions.create.bind(client.chat.completions),
            'openai',
            'chat.completion'
          ),
          createStream: this.wrapStreamingAIMethod(
            client.chat.completions.create.bind(client.chat.completions),
            'openai',
            'chat.completion.stream'
          ),
        },
      };
    }

    // Instrument completions (legacy)
    if (client.completions) {
      instrumented.completions = {
        create: this.wrapAIMethod(
          client.completions.create.bind(client.completions),
          'openai',
          'completion'
        ),
      };
    }

    // Instrument embeddings
    if (client.embeddings) {
      instrumented.embeddings = {
        create: this.wrapAIMethod(
          client.embeddings.create.bind(client.embeddings),
          'openai',
          'embedding'
        ),
      };
    }

    return instrumented;
  }

  /**
   * Instrument Anthropic Claude client
   */
  instrumentAnthropic(client: any): any {
    const instrumented = Object.create(client);

    // Instrument messages
    if (client.messages) {
      instrumented.messages = {
        create: this.wrapAIMethod(
          client.messages.create.bind(client.messages),
          'anthropic',
          'message'
        ),
        stream: this.wrapStreamingAIMethod(
          client.messages.stream.bind(client.messages),
          'anthropic',
          'message.stream'
        ),
      };
    }

    // Instrument completions (legacy)
    if (client.completions) {
      instrumented.completions = {
        create: this.wrapAIMethod(
          client.completions.create.bind(client.completions),
          'anthropic',
          'completion'
        ),
      };
    }

    return instrumented;
  }

  /**
   * Wrap an AI method with tracing
   */
  private wrapAIMethod(method: Function, service: string, operationType: string): Function {
    const instrumentation = this;

    return async function (params: any) {
      const operation: AIOperation = {
        service,
        model: params.model || 'unknown',
        operation: operationType,
        prompt: instrumentation.extractPrompt(params),
        maxTokens: params.max_tokens || params.maxTokens,
        temperature: params.temperature,
        stream: params.stream || false,
      };

      return instrumentation.withAISpan(operation, async () => {
        const startTime = Date.now();
        const result = await method(params);

        // Calculate cost if possible
        const span = trace.getActiveSpan();
        if (span && result.usage) {
          const cost = instrumentation.calculateCost(service, params.model, result.usage);
          if (cost) {
            span.setAttribute('ai.cost.prompt_usd', cost.prompt);
            span.setAttribute('ai.cost.completion_usd', cost.completion);
            span.setAttribute('ai.cost.total_usd', cost.total);
          }
        }

        return result;
      });
    };
  }

  /**
   * Wrap a streaming AI method with tracing
   */
  private wrapStreamingAIMethod(
    method: Function,
    service: string,
    operationType: string
  ): Function {
    const instrumentation = this;

    return async function* (params: any) {
      const operation: AIOperation = {
        service,
        model: params.model || 'unknown',
        operation: operationType,
        prompt: instrumentation.extractPrompt(params),
        maxTokens: params.max_tokens || params.maxTokens,
        temperature: params.temperature,
        stream: true,
      };

      const span = instrumentation.tracer.startSpan(`ai.${service}.${operationType}`, {
        kind: SpanKind.CLIENT,
        attributes: {
          'ai.service': service,
          'ai.model': operation.model,
          'ai.operation': operationType,
          'ai.requeststream': true,
          'ai.requestmax_tokens': operation.maxTokens,
          'ai.requesttemperature': operation.temperature,
          'ai.requestprompt_length': operation.prompt?.length || 0,
        },
      });

      const startTime = Date.now();
      let totalTokens = 0;
      let content= '';

      try {
        const stream = await method({ ...params, stream: true });

        for await (const chunk of stream) {
          // Track streaming progress
          if (chunk.choices?.[0]?.delta?.content {
            content+= chunk.choices[0].delta.content
          }
          if (chunk.usage) {
            totalTokens = chunk.usage.total_tokens || totalTokens;
          }

          yield chunk;
        }

        // Record final metrics
        span.setAttribute('ai.response.content_length', content-length);
        span.setAttribute('ai.response.tokens.total', totalTokens);
        span.setAttribute('ai.duration_ms', Date.now() - startTime);
        span.setStatus({ code: SpanStatusCode.OK });
      } catch (error) {
        span.recordException(_erroras Error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : 'Streaming failed',
        });
        throw error;
      } finally {
        span.end();
      }
    };
  }

  /**
   * Extract prompt from AI parameters
   */
  private extractPrompt(params: any): string | undefined {
    // OpenAI style
    if (params.messages && Array.isArray(params.messages)) {
      return params.messages.map((m: any) => `${m.role}: ${m.content`).join('\n');
    }

    // Anthropic style
    if (params.prompt) {
      return params.prompt;
    }

    // Direct prompt
    if (params._input&& typeof params._input=== 'string') {
      return params._input
    }

    return undefined;
  }

  /**
   * Calculate cost based on token usage
   */
  private calculateCost(
    service: string,
    model: string,
    usage: { prompt_tokens?: number; completion_tokens?: number }
  ): { prompt: number; completion: number; total: number } | null {
    // Pricing per 1K tokens (example rates, should be configurable)
    const pricing: Record<string, Record<string, { prompt: number; completion: number }>> = {
      openai: {
        'gpt-4': { prompt: 0.03, completion: 0.06 },
        'gpt-4-turbo': { prompt: 0.01, completion: 0.03 },
        'gpt-3.5-turbo': { prompt: 0.0005, completion: 0.0015 },
      },
      anthropic: {
        'claude-3-opus': { prompt: 0.015, completion: 0.075 },
        'claude-3-sonnet': { prompt: 0.003, completion: 0.015 },
        'claude-3-haiku': { prompt: 0.00025, completion: 0.00125 },
      },
    };

    const modelPricing = pricing[service]?.[model];
    if (!modelPricing || !usage.prompt_tokens || !usage.completion_tokens) {
      return null;
    }

    const promptCost = (usage.prompt_tokens / 1000) * modelPricing.prompt;
    const completionCost = (usage.completion_tokens / 1000) * modelPricing.completion;

    return {
      prompt: promptCost,
      completion: completionCost,
      total: promptCost + completionCost,
    };
  }

  /**
   * Create a traced AI function
   */
  createTracedAIFunction<T extends (...args: any[]) => Promise<unknown>>(
    fn: T,
    service: string,
    operation: string,
    modelExtractor: (...args: Parameters<T>) => string
  ): T {
    const instrumentation = this;

    return async function (...args: Parameters<T>): Promise<ReturnType<T>> {
      const aiOperation: AIOperation = {
        service,
        model: modelExtractor(...args),
        operation,
      };

      return instrumentation.withAISpan(aiOperation, () => fn(...args));
    } as T;
  }

  /**
   * Monitor AI service health
   */
  async monitorAIServiceHealth(
    service: string,
    healthCheckFn: () => Promise<boolean>
  ): Promise<void> {
    const span = this.tracer.startSpan(`ai.${service}.health_check`, {
      kind: SpanKind.CLIENT,
      attributes: {
        'ai.service': service,
        'ai.operation': 'health_check',
      },
    });

    const startTime = Date.now();

    try {
      const isHealthy = await healthCheckFn();

      span.setAttribute('ai.health.status', isHealthy ? 'healthy' : 'unhealthy');
      span.setAttribute('ai.health.duration_ms', Date.now() - startTime);
      span.setStatus({ code: SpanStatusCode.OK });
    } catch (error) {
      span.recordException(_erroras Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: 'Health check failed',
      });
      span.setAttribute('ai.health.status', '_error);
    } finally {
      span.end();
    }
  }
}

// Export singleton instance
export const aiInstrumentation = new AIInstrumentation();

// Export convenience functions
export const withAISpan = <T>(operation: AIOperation, fn: () => Promise<T>) =>
  aiInstrumentation.withAISpan(operation, fn);

export const instrumentOpenAI = (client: any) => aiInstrumentation.instrumentOpenAI(client);

export const instrumentAnthropic = (client: any) => aiInstrumentation.instrumentAnthropic(client);

export const createTracedAIFunction = <T extends (...args: any[]) => Promise<unknown>>(
  fn: T,
  service: string,
  operation: string,
  modelExtractor: (...args: Parameters<T>) => string
) => aiInstrumentation.createTracedAIFunction(fn, service, operation, modelExtractor);
