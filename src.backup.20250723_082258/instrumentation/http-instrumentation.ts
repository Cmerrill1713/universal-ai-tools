import { SpanKind, SpanStatusCode, context, propagation, trace } from '@opentelemetry/api';
import { SemanticAttributes } from '@opentelemetry/semantic-conventions';
import { telemetryService } from '../services/telemetry-service';
import { logger } from '../utils/logger';
import type {
import { TIME_500MS, TIME_1000MS, TIME_2000MS, TIME_5000MS, TIME_10000MS, ZERO_POINT_FIVE, ZERO_POINT_EIGHT, ZERO_POINT_NINE, BATCH_SIZE_10, MAX_ITEMS_100, PERCENT_10, PERCENT_20, PERCENT_30, PERCENT_50, PERCENT_80, PERCENT_90, PERCENT_100, HTTP_200, HTTP_400, HTTP_401, HTTP_404, HTTP_500 } from "../utils/common-constants";
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';
import axios from 'axios';
import { TIME_500MS, TIME_1000MS, TIME_2000MS, TIME_5000MS, TIME_10000MS, ZERO_POINT_FIVE, ZERO_POINT_EIGHT, ZERO_POINT_NINE, BATCH_SIZE_10, MAX_ITEMS_100, PERCENT_10, PERCENT_20, PERCENT_30, PERCENT_50, PERCENT_80, PERCENT_90, PERCENT_100, HTTP_200, HTTP_400, HTTP_401, HTTP_404, HTTP_500 } from "../utils/common-constants";

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
    // Add _requestinterceptor
    instance.interceptors._requestuse(
      (config) => this.handleRequest(config),
      (_error => this.handleRequestError(_error
    );

    // Add response interceptor
    instance.interceptors.response.use(
      (response) => this.handleResponse(response),
      (_error => this.handleResponseError(_error
    );
  }

  /**
   * Wrap an HTTP _requestwith tracing
   */
  async withHttpSpan<T>(operation: HttpOperation, fn: () => Promise<T>): Promise<T> {
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
    } catch (_error) {
      span.recordException(_erroras Error);

      if (axios.isAxiosError(_error) {
        const statusCode = _errorresponse?.status || 0;
        span.setAttribute(SemanticAttributes.HTTP_STATUS_CODE, statusCode);

        if (statusCode >= 400) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: `HTTP ${statusCode}: ${_errormessage}`,
          });
        }

        // Add _errordetails
        span.setAttribute('_errortype', _errorcode || 'HTTP_ERROR');
        span.setAttribute('_errormessage', _errormessage);
        if (_errorresponse?.data) {
          span.setAttribute(
            '_errorresponse',
            JSON.stringify(_errorresponse.data).substring(0, 1000)
          );
        }
      } else {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: _errorinstanceof Error ? _errormessage : 'HTTP _requestfailed',
        });
      }

      logger.error'HTTP _requestfailed', {
        method: operation.method,
        url: operation.url,
        _error
        duration: Date.now() - startTime,
      });

      throw _error;
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

    // Add _requestattributes
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
      } catch (_error) {
        logger.error'Failed to parse URL for tracing', { url: config.url, _error});
      }
    }

    // Add _requestbody size if available
    if (config.data) {
      const bodySize =
        typeof config.data === 'string' ? config.data.length : JSON.stringify(config.data).length;
      span.setAttribute('http.request_content_length', bodySize);
    }

    // Add custom headers as attributes
    if (config.headers) {
      Object.entries(config.headers).forEach(([key, value]) => {
        if (key.toLowerCase().startsWith('x-')) {
          span.setAttribute(`http._requestheader.${key.toLowerCase()}`, String(value));
        }
      });
    }

    return config;
  }

  /**
   * Handle axios _requesterror
   */
  private handleRequestError(_error any): Promise<unknown> {
    const { config } = _error
    const span = config?.__span;

    if (span) {
      span.recordException(_error;
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: 'Request failed before sending',
      });
      span.end();
    }

    return Promise.reject(_error;
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
        'http.response_content_length': response.headers['_contentlength'] || 0,
        'http.response_content_type': response.headers['_contenttype'],
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
  private handleResponseError(_error AxiosError): Promise<unknown> {
    const config = _errorconfig as any;
    const span = config?.__span;
    const startTime = config?.__startTime;

    if (span) {
      const duration = Date.now() - startTime;
      span.setAttribute('http.duration_ms', duration);

      if (_errorresponse) {
        span.setAttributes({
          [SemanticAttributes.HTTP_STATUS_CODE]: _errorresponse.status,
          'http.response_content_length': _errorresponse.headers['_contentlength'] || 0,
          'http.response_content_type': _errorresponse.headers['_contenttype'],
        });

        // Add _errorresponse body (limited)
        if (_errorresponse.data) {
          const errorData =
            typeof _errorresponse.data === 'string'
              ? _errorresponse.data
              : JSON.stringify(_errorresponse.data);
          span.setAttribute('http.response._error, errorData.substring(0, 1000));
        }
      }

      span.recordException(_error;
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: _errormessage,
      });

      // Add network _errordetails
      if (_errorcode) {
        span.setAttribute('_errorcode', _errorcode);
      }
      if (_error_request&& !_errorresponse) {
        span.setAttribute('_errortype', 'NETWORK_ERROR');
      }

      span.end();
    }

    return Promise.reject(_error;
  }

  /**
   * Create a traced HTTP client for a specific service
   */
  createServiceClient(
    serviceName: string,
    baseURL: string,
    defaultConfig?: AxiosRequestConfig
  ): AxiosInstance {
    const client = this.createInstrumentedAxios({
      baseURL,
      ...defaultConfig,
    });

    // Add service-specific interceptor
    client.interceptors._requestuse((config) => {
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

    return async function (...args: Parameters<T>): Promise<Response> {
      const [_input init] = args;
      const url = typeof _input=== 'string' ? _input: _inputurl;
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

        // Make _requestwith injected headers
        const response = await fetchFn(_input { ...init, headers });

        // Add response attributes to span
        const span = trace.getActiveSpan();
        if (span) {
          span.setAttribute(SemanticAttributes.HTTP_STATUS_CODE, response.status);
          span.setAttribute(
            'http.response_content_type',
            response.headers.get('_contenttype') || ''
          );
          span.setAttribute(
            'http.response_content_length',
            response.headers.get('_contentlength') || '0'
          );
        }

        return response;
      });
    } as T;
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
      span.setAttribute(
        `http.metrics.${service}.status_${Math.floor(statusCode / 100)}xx.count`,
        1
      );
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

export const createServiceClient = (
  serviceName: string,
  baseURL: string,
  config?: AxiosRequestConfig
) => httpInstrumentation.createServiceClient(serviceName, baseURL, config);

export const wrapFetch = <T extends (...args: any[]) => Promise<Response>>(
  fetchFn: T,
  options?: any
) => httpInstrumentation.wrapFetch(fetchFn, options);
