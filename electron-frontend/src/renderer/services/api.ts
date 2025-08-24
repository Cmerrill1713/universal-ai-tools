import axios, { AxiosInstance, AxiosError } from 'axios';
import { connectionManager } from './connectionManager';

// Service URLs Configuration with environment variable support
// Use Vite's import.meta.env for environment variables
// NOTE: TypeScript backend is DEPRECATED - using Go/Rust services only
export const SERVICE_URLS = {
  goAPIGateway: import.meta.env?.VITE_GO_API_GATEWAY_URL || 'http://localhost:8082',
  rustLLMRouter: import.meta.env?.VITE_RUST_LLM_ROUTER_URL || 'http://localhost:8001',
  vectorDB: import.meta.env?.VITE_VECTOR_DB_URL || 'http://localhost:6333',
  goWebSocket: import.meta.env?.VITE_GO_WEBSOCKET_URL || 'ws://localhost:8080',
  // typeScript: REMOVED - Use goAPIGateway instead
  lmStudio: import.meta.env?.VITE_LM_STUDIO_URL || 'http://localhost:1234',
  ollama: import.meta.env?.VITE_OLLAMA_URL || 'http://localhost:11434',
} as const;

// API Error Types
export class APIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'APIError';
  }
}

// Response Types
export interface ChatResponse {
  response: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  responseTime?: number;
  metadata?: Record<string, any>;
}

export interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version?: string;
  uptime?: number;
  services?: Record<string, boolean>;
}

export interface Agent {
  id: string;
  name: string;
  type: string;
  capabilities: string[];
  status: 'online' | 'offline' | 'busy';
  description?: string;
}

export interface Library {
  name: string;
  category: string;
  description: string;
  version: string;
  stars?: number;
  url?: string;
  dependencies?: string[];
}

// Main API Service Class
class APIService {
  private static instance: APIService;
  private goApiClient: AxiosInstance;
  private rustClient: AxiosInstance;
  private tsClient: AxiosInstance;
  private isConnected: boolean = false;
  private connectionAttempts: number = 0;
  private maxRetryAttempts: number = 3;
  private websocket: WebSocket | null = null;

  private constructor() {
    // Initialize HTTP clients for different services
    this.goApiClient = axios.create({
      baseURL: SERVICE_URLS.goAPIGateway,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.rustClient = axios.create({
      baseURL: SERVICE_URLS.rustLLMRouter,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // TypeScript backend is DEPRECATED - using Go API Gateway instead
    this.tsClient = axios.create({
      baseURL: SERVICE_URLS.goAPIGateway, // Use Go API Gateway
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add response interceptors for _error handling
    [this.goApiClient, this.rustClient, this.tsClient].forEach(client => {
      client.interceptors.response.use(response => response, this.handleAxiosError);
    });

    // Initialize connection
    this.initializeConnection();
  }

  public static getInstance(): APIService {
    if (!APIService.instance) {
      APIService.instance = new APIService();
    }
    return APIService.instance;
  }

  private async initializeConnection() {
    // Initializing API connections
    await this.connectToBackend();
    this.startPeriodicHealthCheck();
  }

  private async connectToBackend() {
    this.connectionAttempts++;

    try {
      // Try Go API Gateway first
      const health = await this.checkHealth();
      if (health.status === 'healthy') {
        this.isConnected = true;
        // Connected to backend services
        this.connectionAttempts = 0;
        return;
      }
    } catch (_error) {
      // Connection attempt failed

      if (this.connectionAttempts < this.maxRetryAttempts) {
        const delay = Math.pow(2, this.connectionAttempts) * 1000;
        // Retrying connection
        setTimeout(() => this.connectToBackend(), delay);
      } else {
        // Max connection attempts reached. Running in offline mode.
        this.isConnected = false;
      }
    }
  }

  private startPeriodicHealthCheck() {
    setInterval(async () => {
      if (this.isConnected) {
        try {
          await this.checkHealth();
        } catch (_error) {
          // Health check failed
          this.isConnected = false;
          await this.connectToBackend();
        }
      }
    }, 30000); // Check every 30 seconds
  }

  private handleAxiosError = (_error: AxiosError) => {
    const status = _error.response?.status;
    const message = (_error.response?.data as any)?.error?.message || _error.message;

    throw new APIError(message, status, _error.response?.data);
  };

  // ===== Public API Methods =====

  // Health Check
  public async checkHealth(): Promise<ServiceHealth> {
    try {
      const response = await connectionManager.safeFetch(
        `${SERVICE_URLS.goAPIGateway}/api/health`,
        { method: 'GET' }
      );

      if (!response.ok) {
        return { status: 'unhealthy' };
      }

      const data = await response.json();
      return data;
    } catch (_error) {
      // Return degraded status on connection issues
      return { status: 'degraded' };
    }
  }

  // Chat API
  public async sendMessage(
    message: string,
    model: string = 'lm-studio',
    options: {
      temperature?: number;
      includeCodeContext?: boolean;
      forceRealAI?: boolean;
    } = {}
  ): Promise<ChatResponse> {
    if (!message.trim()) {
      throw new APIError('Message cannot be empty');
    }

    const payload = {
      message,
      agentName: model,
      includeCodeContext: options.includeCodeContext ?? false,
      forceRealAI: options.forceRealAI ?? true,
      temperature: options.temperature ?? 0.7,
    };

    const response = await this.goApiClient.post('/api/v1/chat/', payload);

    // Handle Go API Gateway response format
    if (response.data.success && response.data.data) {
      const data = response.data.data;
      return {
        response: data.message || data.response || '',
        model: response.data.metadata?.agentName || model,
        usage: data.usage,
        responseTime: data.responseTime,
        metadata: response.data.metadata,
      };
    }

    throw new APIError('Invalid response format');
  }

  // Streaming Chat API with WebSocket
  public streamChat(
    message: string,
    onMessage: (chunk: string) => void,
    onComplete?: () => void,
    onError?: (_error: Error) => void
  ) {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
      this.websocket = connectionManager.createSafeWebSocket(SERVICE_URLS.goWebSocket);

      if (!this.websocket) {
        onError?.(new Error('WebSocket connection unavailable'));
        return;
      }

      this.websocket.onopen = () => {
        // WebSocket connected
        this.websocket?.send(
          JSON.stringify({
            type: 'chat',
            message,
          })
        );
      };

      this.websocket.onmessage = event => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'chunk') {
            onMessage(data.content);
          } else if (data.type === 'complete') {
            onComplete?.();
          } else if (data.type === 'error') {
            onError?.(new Error(data.message));
          }
        } catch (_e) {
          // Handle plain text responses
          onMessage(event.data);
        }
      };

      this.websocket.onerror = _error => {
        // WebSocket error
        onError?.(new Error('WebSocket connection failed'));
      };

      this.websocket.onclose = () => {
        // WebSocket disconnected
        this.websocket = null;
      };
    } else {
      this.websocket.send(
        JSON.stringify({
          type: 'chat',
          message,
        })
      );
    }
  }

  // Agent Management
  public async getAgents(): Promise<Agent[]> {
    const response = await this.goApiClient.get('/api/v1/agents/');
    return response.data?.data?.agents || response.data?.agents || [];
  }

  public async getAgentStatus(agentId: string): Promise<Agent> {
    const response = await this.goApiClient.get(`/api/v1/agents/${agentId}`);
    return response.data?.data || response.data;
  }

  // Library Management with fallback
  public async getLibraries(category?: string): Promise<Library[]> {
    try {
      const endpoint = category
        ? `/api/libraries/swift?category=${category}`
        : '/api/libraries/swift';

      const response = await this.tsClient.get(endpoint);
      return response.data;
    } catch (error) {
      // Fallback to mock data if TypeScript service is unavailable
      console.warn('TypeScript service unavailable, using fallback library data');
      return this.getMockLibraries(category);
    }
  }

  public async searchLibraries(query: string, category?: string): Promise<Library[]> {
    try {
      const params = new URLSearchParams({ q: query });
      if (category) params.append('category', category);

      const response = await this.tsClient.get(`/api/libraries/search?${params}`);
      return response.data;
    } catch (error) {
      // Fallback to filtered mock data
      console.warn('TypeScript service unavailable, using fallback search');
      const allLibraries = this.getMockLibraries(category);
      return allLibraries.filter(
        lib =>
          lib.name.toLowerCase().includes(query.toLowerCase()) ||
          lib.description.toLowerCase().includes(query.toLowerCase())
      );
    }
  }

  private getMockLibraries(category?: string): Library[] {
    const mockLibraries: Library[] = [
      {
        name: 'SwiftUI',
        category: 'ui',
        description: "Apple's declarative UI framework for Swift",
        version: '5.0',
        stars: 50000,
        url: 'https://developer.apple.com/xcode/swiftui/',
      },
      {
        name: 'Combine',
        category: 'reactive',
        description: "Apple's reactive programming framework",
        version: '5.0',
        stars: 30000,
        url: 'https://developer.apple.com/documentation/combine',
      },
      {
        name: 'Alamofire',
        category: 'networking',
        description: 'Swift HTTP networking library',
        version: '5.8.1',
        stars: 40000,
        url: 'https://github.com/Alamofire/Alamofire',
        dependencies: ['Foundation'],
      },
      {
        name: 'RxSwift',
        category: 'reactive',
        description: 'Reactive Extensions for Swift',
        version: '6.7.1',
        stars: 24000,
        url: 'https://github.com/ReactiveX/RxSwift',
      },
    ];

    if (category) {
      return mockLibraries.filter(lib => lib.category === category);
    }
    return mockLibraries;
  }

  // Voice/Speech APIs
  public async synthesizeSpeech(text: string, voice: string = 'default'): Promise<ArrayBuffer> {
    try {
      const response = await this.goApiClient.post(
        '/api/v1/voice/tts',
        {
          text,
          voice,
          format: 'mp3',
        },
        {
          responseType: 'arraybuffer',
        }
      );

      return response.data;
    } catch (error) {
      console.warn('Voice synthesis unavailable:', error);
      throw new APIError('Voice synthesis service unavailable');
    }
  }

  // Image Generation
  public async generateImage(
    prompt: string,
    options: {
      model?: string;
      size?: string;
      quality?: string;
      n?: number;
    } = {}
  ): Promise<string[]> {
    try {
      const response = await this.goApiClient.post('/api/v1/images/generate', {
        prompt,
        ...options,
      });

      return response.data.images || [];
    } catch (error) {
      console.warn('Image generation unavailable:', error);
      return [];
    }
  }

  // News API (from Go API Gateway)
  public async getNews(source: string = 'hackernews', limit: number = 10): Promise<any[]> {
    try {
      const response = await this.goApiClient.get(`/api/v1/news/?limit=${limit}`);
      return response.data.articles || response.data || [];
    } catch (error) {
      console.warn('News service unavailable:', error);
      return [];
    }
  }

  // Service Discovery
  public async discoverServices(): Promise<Record<string, any>> {
    try {
      const response = await this.goApiClient.get('/api/v1/discovery/services');
      return response.data;
    } catch (error) {
      console.warn('Service discovery unavailable:', error);
      return {};
    }
  }

  // Get connection status
  public getConnectionStatus(): boolean {
    return this.isConnected;
  }

  // Close WebSocket connection
  public closeWebSocket() {
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
  }
}

// Export singleton instance
export const apiService = APIService.getInstance();
