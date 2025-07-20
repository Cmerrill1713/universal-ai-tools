import { SpanKind, SpanStatusCode, context, propagation, trace } from '@opentelemetry/api';
import { SemanticAttributes } from '@opentelemetry/semantic-conventions';
import { telemetryService } from '../services/telemetry-service';
import { logger } from '../utils/logger';
import type { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import axios from 'axios';

interface HttpOperation {
  method: string;
  url: string;
  service?: string;
  timeout?: number;
}

export class HttpInstrumentation {
  private tracer = telemetryService.getTracer();

  /**
   * Create an instrumented axios instance
   */
  createInstrumentedAxios(config?: AxiosRequestConfig): AxiosInstance {
    const instance = axios.create(config);
    this.instrumentAxiosInstance(instance);
    return instance;
  }

  /**
   * Instrument an existing axios instance
   */
  instrumentAxiosInstance(instance: AxiosInstance): void {
    // Add request interceptor
    instance.interceptors.request.use(
      (config) => this.handleRequest(config),
      (error) => this.handleRequestError(error)
    );

    // Add response interceptor
    instance.interceptors.response.use(
      (response) => this.handleResponse(response),
      (error) => this.handleResponseError(error)
    );
  }

  /**
   * Wrap an HTTP request with tracing
   */
  async withHttpSpan<T>(
    operation: HttpOperation,
    fn: () => Promise<T>
  ): Promise<T> {
    const url = new URL(operation.url);
    const spanName = `HTTP ${operation.method} ${url.hostname}${url.pathname}`;
    
    const span = this.tracer.startSpan(spanName, {
      kind: SpanKind.CLIENT,
      attributes: {
        [SemanticAttributes.HTTP_METHOD]: operation.method,
        [SemanticAttributes.HTTP_URL]: operation.url,
        [SemanticAttributes.HTTP_SCHEME]: url.protocol.replace(':', ''),
        [SemanticAttributes.HTTP_HOST]: url.hostname,
        [SemanticAttributes.HTTP_TARGET]: url.pathname + url.search,
        [SemanticAttributes.NET_PEER_NAME]: url.hostname,
        [SemanticAttributes.NET_PEER_PORT]: url.port || (url.protocol === 'https:' ? 443 : 80),
        'http.service': operation.service || 'external',
        'http.timeout': operation.timeout,
      },
    });

    const startTime = Date.now();

    try {
      const result = await context.with(trace.setSpan(context.active(), span), fn);
      
      span.setAttribute('http.duration_ms', Date.now() - startTime);
      span.setStatus({ code: SpanStatusCode.OK });
      
      return result;
    } catch (error) {
      span.recordException(error as Error);
      
      if (axios.isAxiosError(error)) {
        const statusCode = error.response?.status || 0;
        span.setAttribute(SemanticAttributes.HTTP_STATUS_CODE, statusCode);
        
        if (statusCode >= 400) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: `HTTP ${statusCode}: ${error.message}`,
          });
        }
        
        // Add error details
        span.setAttribute('error.type', error.code || 'HTTP_ERROR');
        span.setAttribute('error.message', error.message);
        if (error.response?.data) {
          span.setAttribute('error.response', JSON.stringify(error.response.data).substring(0, 1000));
        }
      } else {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : 'HTTP request failed',
        });
      }

      logger.error('HTTP request failed', {
        method: operation.method,
        url: operation.url,
        error,
        duration: Date.now() - startTime,
      });

      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Handle axios request
   */
  private handleRequest(config: InternalAxiosRequestConfig): InternalAxiosRequestConfig {
    const span = this.tracer.startSpan(`HTTP ${config.method?.toUpperCase()} ${config.url}`, {
      kind: SpanKind.CLIENT,
    });

    // Add trace context to headers
    const headers = config.headers || {};
    propagation.inject(context.active(), headers);
    config.headers = headers;

    // Store span in config for later use
    (config as any).__span = span;
    (config as any).__startTime = Date.now();

    // Add request attributes
    if (config.url) {
      try {
        const url = new URL(config.url, config.baseURL);
        span.setAttributes({
          [SemanticAttributes.HTTP_METHOD]: config.method?.toUpperCase() || 'GET',
          [SemanticAttributes.HTTP_URL]: url.href,
          [SemanticAttributes.HTTP_SCHEME]: url.protocol.replace(':', ''),
          [SemanticAttributes.HTTP_HOST]: url.hostname,
          [SemanticAttributes.HTTP_TARGET]: url.pathname + url.search,
          [SemanticAttributes.NET_PEER_NAME]: url.hostname,
          [SemanticAttributes.NET_PEER_PORT]: url.port || (url.protocol === 'https:' ? 443 : 80),
        });
      } catch (error) {
        logger.error('Failed to parse URL for tracing', { url: config.url, error });
      }
    }

    // Add request body size if available
    if (config.data) {
      const bodySize = typeof config.data === 'string' 
        ? config.data.length 
        : JSON.stringify(config.data).length;
      span.setAttribute('http.request_content_length', bodySize);
    }

    // Add custom headers as attributes
    if (config.headers) {
      Object.entries(config.headers).forEach(([key, value]) => {
        if (key.toLowerCase().startsWith('x-')) {
          span.setAttribute(`http.request.header.${key.toLowerCase()}`, String(value));
        }
      });
    }

    return config;
  }

  /**
   * Handle axios request error
   */
  private handleRequestError(error: any): Promise<any> {
    const {config} = error;
    const span = config?.__span;
    
    if (span) {
      span.recordException(error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: 'Request failed before sending',
      });
      span.end();
    }

    return Promise.reject(error);
  }

  /**
   * Handle axios response
   */
  private handleResponse(response: AxiosResponse): AxiosResponse {
    const config = response.config as any;
    const span = config.__span;
    const startTime = config.__startTime;

    if (span) {
      const duration = Date.now() - startTime;
      
      span.setAttributes({
        [SemanticAttributes.HTTP_STATUS_CODE]: response.status,
        'http.response_content_length': response.headers['content-length'] || 0,
        'http.response_content_type': response.headers['content-type'],
        'http.duration_ms': duration,
      });

      // Add response headers as attributes
      Object.entries(response.headers).forEach(([key, value]) => {
        if (key.toLowerCase().startsWith('x-')) {
          span.setAttribute(`http.response.header.${key.toLowerCase()}`, String(value));
        }
      });

      // Set status based on HTTP status code
      if (response.status >= 400) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: `HTTP ${response.status}`,
        });
      } else {
        span.setStatus({ code: SpanStatusCode.OK });
      }

      span.end();
    }

    return response;
  }

  /**
   * Handle axios response error
   */
  private handleResponseError(error: AxiosError): Promise<any> {
    const config = error.config as any;
    const span = config?.__span;
    const startTime = config?.__startTime;

    if (span) {
      const duration = Date.now() - startTime;
      span.setAttribute('http.duration_ms', duration);

      if (error.response) {
        span.setAttributes({
          [SemanticAttributes.HTTP_STATUS_CODE]: error.response.status,
          'http.response_content_length': error.response.headers['content-length'] || 0,
          'http.response_content_type': error.response.headers['content-type'],
        });

        // Add error response body (limited)
        if (error.response.data) {
          const errorData = typeof error.response.data === 'string'
            ? error.response.data
            : JSON.stringify(error.response.data);
          span.setAttribute('http.response.error', errorData.substring(0, 1000));
        }
      }

      span.recordException(error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
      
      // Add network error details
      if (error.code) {
        span.setAttribute('error.code', error.code);
      }
      if (error.request && !error.response) {
        span.setAttribute('error.type', 'NETWORK_ERROR');
      }

      span.end();
    }

    return Promise.reject(error);
  }

  /**
   * Create a traced HTTP client for a specific service
   */
  createServiceClient(serviceName: string, baseURL: string, defaultConfig?: AxiosRequestConfig): AxiosInstance {
    const client = this.createInstrumentedAxios({
      baseURL,
      ...defaultConfig,
    });

    // Add service-specific interceptor
    client.interceptors.request.use((config) => {
      const span = trace.getActiveSpan();
      if (span) {
        span.setAttribute('http.service', serviceName);
        span.setAttribute('peer.service', serviceName);
      }
      return config;
    });

    return client;
  }

  /**
   * Wrap a fetch-style function with tracing
   */
  wrapFetch<T extends (...args: any[]) => Promise<Response>>(
    fetchFn: T,
    options?: { serviceName?: string }
  ): T {
    const instrumentation = this;

    return (async function(...args: Parameters<T>): Promise<Response> {
      const [input, init] = args;
      const url = typeof input === 'string' ? input : input.url;
      const method = init?.method || 'GET';

      const operation: HttpOperation = {
        method,
        url,
        service: options?.serviceName,
      };

      return instrumentation.withHttpSpan(operation, async () => {
        // Inject trace headers
        const headers = new Headers(init?.headers);
        const headerObj: Record<string, string> = {};
        propagation.inject(context.active(), headerObj);
        Object.entries(headerObj).forEach(([key, value]) => {
          headers.set(key, value);
        });

        // Make request with injected headers
        const response = await fetchFn(input, { ...init, headers });

        // Add response attributes to span
        const span = trace.getActiveSpan();
        if (span) {
          span.setAttribute(SemanticAttributes.HTTP_STATUS_CODE, response.status);
          span.setAttribute('http.response_content_type', response.headers.get('content-type') || '');
          span.setAttribute('http.response_content_length', response.headers.get('content-length') || '0');
        }

        return response;
      });
    }) as T;
  }

  /**
   * Record HTTP metrics
   */
  recordHttpMetrics(
    method: string,
    statusCode: number,
    duration: number,
    service = 'external'
  ): void {
    const span = trace.getActiveSpan();
    if (span) {
      span.setAttribute(`http.metrics.${service}.${method.toLowerCase()}.count`, 1);
      span.setAttribute(`http.metrics.${service}.${method.toLowerCase()}.duration_ms`, duration);
      span.setAttribute(`http.metrics.${service}.status_${Math.floor(statusCode / 100)}xx.count`, 1);
    }
  }
}

// Export singleton instance
export const httpInstrumentation = new HttpInstrumentation();

// Export convenience functions
export const createInstrumentedAxios = (config?: AxiosRequestConfig) =>
  httpInstrumentation.createInstrumentedAxios(config);

export const instrumentAxios = (instance: AxiosInstance) =>
  httpInstrumentation.instrumentAxiosInstance(instance);

export const withHttpSpan = <T>(operation: HttpOperation, fn: () => Promise<T>) =>
  httpInstrumentation.withHttpSpan(operation, fn);

export const createServiceClient = (serviceName: string, baseURL: string, config?: AxiosRequestConfig) =>
  httpInstrumentation.createServiceClient(serviceName, baseURL, config);

export const wrapFetch = <T extends (...args: any[]) => Promise<Response>>(fetchFn: T, options?: any) =>
  httpInstrumentation.wrapFetch(fetchFn, options);