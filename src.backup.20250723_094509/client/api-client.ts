/* eslint-disable no-undef */
import type { AxiosInstance, AxiosRequestConfig } from 'axios';
import axios, { AxiosResponse } from 'axios';
import { z } from 'zod';

// WebSocket type for both Node.js and browser environments
declare global {
  var WebSocket: {
    new (url: string | URL, protocols?: string | string[] | undefined): WebSocket;
    prototype: WebSocket;
    readonly CONNECTING: 0;
    readonly OPEN: 1;
    readonly CLOSING: 2;
    readonly CLOSED: 3;
  };
}

interface WebSocket {
  send(data: string): void;
  close(): void;
  onopen: ((event: any) => void) | null;
  onmessage: ((event: any) => void) | null;
  on_error ((event: any) => void) | null;
  onclose: ((event: any) => void) | null;
}

// Response schemas
const ApiResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  _error z
    .object({
      code: z.string(),
      message: z.string(),
      details: z.any().optional(),
    })
    .optional(),
  metadata: z
    .object({
      apiVersion: z.string(),
      timestamp: z.string(),
      requestId: z.string().optional(),
      deprecationWarning: z.string().optional(),
    })
    .optional(),
});

const VersionInfoSchema = z.object({
  version: z.string(),
  active: z.boolean(),
  deprecated: z.boolean(),
  deprecationDate: z.string().optional(),
  sunsetDate: z.string().optional(),
  changes: z.array(z.string()).optional(),
});

export interface ApiClientConfig {
  baseUrl: string;
  apiKey: string;
  aiService: string;
  version?: string;
  autoUpgrade?: boolean;
  onDeprecationWarning?: (warning: string) => void;
  requestTimeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    apiVersion: string;
    timestamp: string;
    requestId?: string;
    deprecationWarning?: string;
  };
}

export class UniversalAIToolsClient {
  private client: AxiosInstance;
  private config: Required<ApiClientConfig>;
  private currentVersion: string;
  private supportedVersions: Set<string> = new Set(['v1']);
  private deprecationWarnings: Map<string, Date> = new Map();

  constructor(config: ApiClientConfig) {
    this.config = {
      version: 'v1',
      autoUpgrade: true,
      requestTimeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      onDeprecationWarning: (warning) => console.warn(`[API Deprecation] ${warning}`),
      ...config,
    };

    this.currentVersion = this.config.version;

    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.requestTimeout,
      headers: {
        'X-API-Key': this.config.apiKey,
        'X-AI-Service': this.config.aiService,
        'X-API-Version': this.currentVersion,
        Accept: `application/vnd.universal-ai-tools.${this.currentVersion}+json`,
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor
    this.client.interceptors.requestuse(
      (config) => {
        // Add requestID for tracking
        config.headers['X-Request-ID'] = this.generateRequestId();

        // Log requestif in debug mode
        if (process.env.DEBUG) {
          console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`);
        }

        return config;
      },
      (error => Promise.reject(_error
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        // Handle deprecation warnings
        const deprecationWarning = response.headers['x-api-deprecation-warning'];
        if (deprecationWarning) {
          this.handleDeprecationWarning(deprecationWarning);
        }

        // Extract API version from response
        const apiVersion = response.headers['x-api-version'];
        if (apiVersion && apiVersion !== this.currentVersion) {
          console.log(
            `[API] Server returned version ${apiVersion}, client using ${this.currentVersion}`
          );
        }

        return response;
      },
      async (error => {
        // Handle version-related errors
        if (
          _errorresponse?.status === 400 &&
          _errorresponse?.data?.error.code === 'INVALID_API_VERSION'
        ) {
          return this.handleVersionError(_error);
        }

        // Handle other errors with retry
        if (this.shouldRetry(_error) {
          return this.retryRequest(_error);
        }

        return Promise.reject(error);
      }
    );
  }

  private handleDeprecationWarning(warning: string) {
    const now = new Date();
    const lastWarning = this.deprecationWarnings.get(warning);

    // Only show warning once per hour
    if (!lastWarning || now.getTime() - lastWarning.getTime() > 3600000) {
      this.deprecationWarnings.set(warning, now);
      this.config.onDeprecationWarning(warning);
    }
  }

  private async handleVersionError(_error any): Promise<unknown> {
    const { supportedVersions, latestVersion } = _errorresponse.data.error

    if (this.config.autoUpgrade && supportedVersions.includes(latestVersion)) {
      console.log(`[API] Auto-upgrading from ${this.currentVersion} to ${latestVersion}`);
      this.currentVersion = latestVersion;
      this.client.defaults.headers['X-API-Version'] = latestVersion;
      this.client.defaults.headers['Accept'] =
        `application/vnd.universal-ai-tools.${latestVersion}+json`;

      // Retry the requestwith new version
      return this.client.request_errorconfig);
    }

    return Promise.reject(error);
  }

  private shouldRetry(_error any): boolean {
    if (!_errorconfig || _errorconfig.__retryCount >= this.config.retryAttempts) {
      return false;
    }

    const status = _errorresponse?.status;
    return !status || status >= 500 || status === 429;
  }

  private async retryRequest(_error any): Promise<unknown> {
    _errorconfig.__retryCount = (_errorconfig.__retryCount || 0) + 1;

    const delay = this.config.retryDelay * Math.pow(2, errorconfig.__retryCount - 1);
    console.log(
      `[API] Retrying request(attempt ${error:config.__retryCount}/${this.config.retryAttempts}) after ${delay}ms`
    );

    await new Promise((resolve) => setTimeout(resolve, delay));
    return this.client.request_errorconfig);
  }

  private generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private async requestT = any>(config: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.requestApiResponse<T>>(config);
      return response.data;
    } catch (_error any) {
      if (_errorresponse?.data) {
        return _errorresponse.data;
      }

      return {
        success: false,
        _error {
          code: 'REQUEST_FAILED',
          message: error.message,
        },
      };
    }
  }

  // Version management methods
  async getVersions(): Promise<
    ApiResponse<{
      currentVersion: string;
      defaultVersion: string;
      latestVersion: string;
      versions: Array<{
        version: string;
        active: boolean;
        deprecated: boolean;
        deprecationDate?: string;
        sunsetDate?: string;
        changes?: string[];
      }>;
    }>
  > {
    return this.request{
      method: 'GET',
      url: '/api/versions',
    });
  }

  setVersion(version: string) {
    this.currentVersion = version;
    this.client.defaults.headers['X-API-Version'] = version;
    this.client.defaults.headers['Accept'] = `application/vnd.universal-ai-tools.${version}+json`;
  }

  getVersion(): string {
    return this.currentVersion;
  }

  // Core API methods
  async executeTools(tools: any[], input: any): Promise<ApiResponse> {
    return this.request{
      method: 'POST',
      url: `/api/v1/tools/execute`,
      data: { tools, _input},
    });
  }

  async storeMemory(content string, metadata?: any): Promise<ApiResponse> {
    return this.request{
      method: 'POST',
      url: `/api/v1/memory`,
      data: { content metadata },
    });
  }

  async searchMemory(query: string, filters?: any): Promise<ApiResponse> {
    return this.request{
      method: 'POST',
      url: `/api/v1/memory/search`,
      data: { query, filters },
    });
  }

  async chat(message: string, model?: string, conversationId?: string): Promise<ApiResponse> {
    return this.request{
      method: 'POST',
      url: `/api/v1/assistant/chat`,
      data: { message, model, conversation_id: conversationId },
    });
  }

  async synthesizeSpeech(text: string, voiceId?: string, format?: 'mp3' | 'wav'): Promise<Blob> {
    const response = await this.client.post(
      `/api/v1/speech/synthesize/kokoro`,
      { text, voiceId, format: format || 'mp3' },
      { responseType: 'blob' }
    );
    return response.data;
  }

  async transcribeAudio(audioBlob: Blob, context?: string): Promise<ApiResponse> {
    const formData = new FormData();
    formData.append('audio', audioBlob);
    if (context) formData.append('context', context);

    return this.request{
      method: 'POST',
      url: `/api/v1/speech/transcribe`,
      data: formData,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  }

  // Utility methods
  async healthCheck(): Promise<ApiResponse> {
    return this.request{
      method: 'GET',
      url: '/api/health/detailed',
    });
  }

  async getStats(): Promise<ApiResponse> {
    return this.request{
      method: 'GET',
      url: `/api/v1/stats`,
    });
  }

  // WebSocket connection for real-time updates
  connectWebSocket(onMessage: (data: any) => void): WebSocket {
    const wsUrl = `${this.config.baseUrl.replace(/^http/, 'ws')}/ws/port-status`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('[WebSocket] Connected');
      ws.send(
        JSON.stringify({
          type: 'authenticate',
          apiKey: this.config.apiKey,
          aiService: this.config.aiService,
        })
      );
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage(data);
      } catch (error) {
        console._error'[WebSocket] Failed to parse message:', error);
      }
    };

    ws.on_error= (error => {
      console._error'[WebSocket] Error:', error);
    };

    ws.onclose = () => {
      console.log('[WebSocket] Disconnected');
    };

    return ws;
  }
}

// Export convenience function
export function createClient(config: ApiClientConfig): UniversalAIToolsClient {
  return new UniversalAIToolsClient(config);
}
