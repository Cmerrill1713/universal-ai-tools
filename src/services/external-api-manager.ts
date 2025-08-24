/**
 * External API Manager
 * Handles dynamic integration of external APIs for local-first system
 */

import { type CircuitBreaker,createCircuitBreaker } from '../utils/circuit-breaker.js';
import { log, LogContext } from '../utils/logger.js';
const fetchApi = (globalThis as any).fetch?.bind(globalThis) as typeof globalThis.fetch;

interface ExternalAPIConfig {
  id: string;
  name: string;
  baseUrl: string;
  apiKey?: string;
  headers?: Record<string, string>;
  enabled: boolean;
  serviceType: 'llm' | 'vision' | 'speech' | 'custom';
  capabilities: string[];
  rateLimit?: {
    requestsPerMinute: number;
    requestsPerHour: number;
  };
}

interface APIRequest {
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  data?: any;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

interface APIResponse {
  success: boolean;
  data?: any;
  error?: string;
  statusCode: number;
  headers?: Record<string, string>;
}

interface RateLimitInfo {
  requestsThisMinute: number;
  requestsThisHour: number;
  lastReset: Date;
}

class ExternalAPIManager {
  private apis: Map<string, ExternalAPIConfig> = new Map();
  private rateLimits: Map<string, RateLimitInfo> = new Map();
  private requestHistory: Map<string, Date[]> = new Map();
  private breakers: Map<string, CircuitBreaker> = new Map();

  constructor() {
    log.info('External API Manager initialized', LogContext.API);
  }

  /**
   * Register a new external API
   */
  async registerAPI(config: ExternalAPIConfig): Promise<boolean> {
    try {
      // Validate the API configuration
      if (!config.id || !config.name || !config.baseUrl) {
        throw new Error('Missing required API configuration fields');
      }

      // Validate base URL scheme
      try {
        const u = new URL(config.baseUrl);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') {
          throw new Error('Unsupported baseUrl scheme');
        }
      } catch (e) {
        throw new Error(`Invalid baseUrl: ${e instanceof Error ? e.message : String(e)}`);
      }

      // Test the API connection if enabled
      if (config.enabled) {
        const testResponse = await this.testConnection(config);
        if (!testResponse.success) {
          log.warn('API connection test failed', LogContext.API, {
            apiId: config.id,
            error: testResponse.error,
          });
          config.enabled = false;
        }
      }

      this.apis.set(config.id, config);
      this.initializeRateLimit(config.id, config.rateLimit);

      log.info('External API registered', LogContext.API, {
        apiId: config.id,
        name: config.name,
        serviceType: config.serviceType,
        enabled: config.enabled,
      });

      return true;
    } catch (error) {
      log.error('Failed to register external API', LogContext.API, {
        apiId: config.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Make a request to an external API
   */
  async makeRequest(apiId: string, request: APIRequest): Promise<APIResponse> {
    const api = this.apis.get(apiId);
    if (!api) {
      return {
        success: false,
        error: `API with ID '${apiId}' not found`,
        statusCode: 404,
      };
    }

    if (!api.enabled) {
      return {
        success: false,
        error: `API '${apiId}' is disabled`,
        statusCode: 503,
      };
    }

    // Check rate limits
    if (!this.checkRateLimit(apiId, api.rateLimit)) {
      return {
        success: false,
        error: 'Rate limit exceeded',
        statusCode: 429,
      };
    }

    try {
      // Wrap external call with circuit breaker per API
      let breaker = this.breakers.get(apiId);
      if (!breaker) {
        breaker = createCircuitBreaker(`external:${apiId}`, {
          failureThreshold: 5,
          successThreshold: 2,
          timeout: 30000,
          volumeThreshold: 10,
          errorThresholdPercentage: 50,
          rollingWindow: 60000,
        });
        this.breakers.set(apiId, breaker);
      }

      // Build target URL safely using WHATWG URL
      let target: URL;
      try {
        target = new URL(request.endpoint, api.baseUrl);
      } catch {
        return { success: false, error: 'Invalid endpoint URL', statusCode: 400 };
      }
      if (target.protocol !== 'http:' && target.protocol !== 'https:') {
        return { success: false, error: 'Unsupported protocol', statusCode: 400 };
      }
      // Basic SSRF protection: ensure endpoint stays within base URL host
      try {
        const base = new URL(api.baseUrl);
        if (base.hostname !== target.hostname) {
          return { success: false, error: 'Cross-host request blocked', statusCode: 400 };
        }
      } catch {
        return { success: false, error: 'Invalid URL', statusCode: 400 };
      }
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...api.headers,
        ...request.headers,
      };

      if (api.apiKey) {
        headers['Authorization'] = `Bearer ${api.apiKey}`;
      }

      const response = await breaker.execute(
        async () => {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), request.timeoutMs ?? 15000);
          const resp = await fetchApi(target.toString(), {
            method: request.method,
            headers,
            body: request.data ? JSON.stringify(request.data) : undefined,
            redirect: 'follow',
            signal: controller.signal,
          });
          clearTimeout(timeout);
          if (!resp.ok && resp.status >= 500) {
            throw new Error(`Upstream ${resp.status}`);
          }
          return resp;
        },
        async () => {
          // Fallback response when breaker is open
          return new Response(JSON.stringify({ error: 'Service temporarily unavailable' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          }) as unknown as Response;
        }
      );

      // Safely parse response depending on content-type
      const ct = response.headers.get('content-type') || '';
      const responseData = ct.includes('application/json')
        ? await response.json().catch(() => null)
        : await response.text().catch(() => null);

      // Record the request for rate limiting
      this.recordRequest(apiId);

      const result: APIResponse = {
        success: response.ok,
        data: responseData,
        statusCode: response.status,
        headers: Object.fromEntries(Array.from(response.headers as any)),
      };

      if (!response.ok) {
        result.error = responseData?.error || `HTTP ${response.status}`;
      }

      log.info('External API request completed', LogContext.API, {
        apiId,
        endpoint: request.endpoint,
        statusCode: response.status,
        success: response.ok,
      });

      return result;
    } catch (error) {
      log.error('External API request failed', LogContext.API, {
        apiId,
        endpoint: request.endpoint,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        statusCode: 500,
      };
    }
  }

  /**
   * Get all registered APIs
   */
  getAPIs(): ExternalAPIConfig[] {
    return Array.from(this.apis.values());
  }

  /**
   * Get a specific API configuration
   */
  getAPI(apiId: string): ExternalAPIConfig | undefined {
    return this.apis.get(apiId);
  }

  /**
   * Update an existing API configuration
   */
  async updateAPI(apiId: string, updates: Partial<ExternalAPIConfig>): Promise<boolean> {
    const existing = this.apis.get(apiId);
    if (!existing) {
      return false;
    }

    const updated = { ...existing, ...updates };
    return this.registerAPI(updated);
  }

  /**
   * Remove an API
   */
  removeAPI(apiId: string): boolean {
    const removed = this.apis.delete(apiId);
    this.rateLimits.delete(apiId);
    this.requestHistory.delete(apiId);

    if (removed) {
      log.info('External API removed', LogContext.API, {
        apiId,
      });
    }

    return removed;
  }

  /**
   * Enable/disable an API
   */
  async toggleAPI(apiId: string, enabled: boolean): Promise<boolean> {
    const api = this.apis.get(apiId);
    if (!api) {
      return false;
    }

    if (enabled && !api.enabled) {
      // Test connection before enabling
      const testResponse = await this.testConnection(api);
      if (!testResponse.success) {
        log.warn('Cannot enable API - connection test failed', LogContext.API, {
          apiId,
          error: testResponse.error,
        });
        return false;
      }
    }

    api.enabled = enabled;
    log.info('API status changed', LogContext.API, {
      apiId,
      enabled,
    });

    return true;
  }

  /**
   * Get APIs by service type
   */
  getAPIsByType(serviceType: string): ExternalAPIConfig[] {
    return this.getAPIs().filter((api) => api.serviceType === serviceType);
  }

  /**
   * Get APIs with specific capability
   */
  getAPIsWithCapability(capability: string): ExternalAPIConfig[] {
    return this.getAPIs().filter((api) => api.capabilities.includes(capability) && api.enabled);
  }

  /**
   * Test connection to an API
   */
  private async testConnection(config: ExternalAPIConfig): Promise<APIResponse> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...config.headers,
      };

      if (config.apiKey) {
        headers['Authorization'] = `Bearer ${config.apiKey}`;
      }

      const response = await fetchApi(`${config.baseUrl}/health`, {
        method: 'GET',
        headers,
      });

      return {
        success: response.ok,
        statusCode: response.status,
        error: response.ok ? undefined : `HTTP ${response.status}`,
      };
    } catch (error) {
      return {
        success: false,
        statusCode: 500,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Initialize rate limiting for an API
   */
  private initializeRateLimit(apiId: string, rateLimit?: ExternalAPIConfig['rateLimit']): void {
    if (!rateLimit) {
      return;
    }

    this.rateLimits.set(apiId, {
      requestsThisMinute: 0,
      requestsThisHour: 0,
      lastReset: new Date(),
    });
  }

  /**
   * Check if request is within rate limits
   */
  private checkRateLimit(apiId: string, rateLimit?: ExternalAPIConfig['rateLimit']): boolean {
    if (!rateLimit) {
      return true;
    }

    const limit = this.rateLimits.get(apiId);
    if (!limit) {
      return true;
    }

    const now = new Date();
    const minuteAgo = new Date(now.getTime() - 60 * 1000);
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Reset counters if needed
    if (limit.lastReset < minuteAgo) {
      limit.requestsThisMinute = 0;
      limit.lastReset = now;
    }

    if (limit.lastReset < hourAgo) {
      limit.requestsThisHour = 0;
    }

    return (
      limit.requestsThisMinute < rateLimit.requestsPerMinute &&
      limit.requestsThisHour < rateLimit.requestsPerHour
    );
  }

  /**
   * Record a request for rate limiting
   */
  private recordRequest(apiId: string): void {
    const limit = this.rateLimits.get(apiId);
    if (!limit) {
      return;
    }

    limit.requestsThisMinute++;
    limit.requestsThisHour++;

    // Track request history
    const history = this.requestHistory.get(apiId) || [];
    history.push(new Date());

    // Keep only last hour of history
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const filteredHistory = history.filter((time) => time > hourAgo);

    this.requestHistory.set(apiId, filteredHistory);
  }

  /**
   * Get rate limit status for an API
   */
  getRateLimitStatus(apiId: string): RateLimitInfo | null {
    return this.rateLimits.get(apiId) || null;
  }

  /**
   * Get request history for an API
   */
  getRequestHistory(apiId: string): Date[] {
    return this.requestHistory.get(apiId) || [];
  }
}

// Export singleton instance
export const externalAPIManager = new ExternalAPIManager();
export default externalAPIManager;
