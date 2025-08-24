/**
 * Service Orchestrator - Coordinates between Rust AI Core, Go WebSocket, and TypeScript services
 * Provides unified interface for multi-service communication and real-time AI processing
 */

import { hybridAIService } from './hybrid-ai-service';
import { aiCoreClient } from './ai-core-client';
import axios, { AxiosInstance } from 'axios';
import { EventSource } from 'eventsource';
import { WebSocket } from 'ws';

interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  lastCheck: Date;
  details?: any;
  responseTime?: number;
}

interface ServiceEndpoints {
  aiCore: string;
  websocket: string;
  mainBackend: string;
}

interface RealTimeAIRequest {
  sessionId: string;
  userId: string;
  message: string;
  model?: string;
  provider?: string;
  temperature?: number;
  maxTokens?: number;
  streaming?: boolean;
}

interface ServiceMetrics {
  timestamp: Date;
  services: {
    aiCore: {
      available: boolean;
      memoryUsageMB: number;
      modelsLoaded: number;
      providersActive: number;
    };
    websocket: {
      available: boolean;
      connectedClients: number;
      messagesTotal: number;
    };
    backend: {
      available: boolean;
      uptime: number;
    };
  };
  performance: {
    averageResponseTime: number;
    throughput: number;
    errorRate: number;
  };
}

export class ServiceOrchestrator {
  private services: ServiceEndpoints;
  private healthStatus: Map<string, ServiceHealth> = new Map();
  private httpClient: AxiosInstance;
  private websocketClient?: WebSocket;
  private healthCheckInterval: NodeJS.Timeout;
  private readonly HEALTH_CHECK_INTERVAL = 30000; // 30 seconds

  constructor(endpoints: Partial<ServiceEndpoints> = {}) {
    this.services = {
      aiCore: endpoints.aiCore || 'http://localhost:8003',
      websocket: endpoints.websocket || 'http://localhost:8080',
      mainBackend: endpoints.mainBackend || 'http://localhost:9999',
    };

    this.httpClient = axios.create({
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Start health monitoring
    this.startHealthMonitoring();
  }

  /**
   * Initialize all services and connections
   */
  async initialize(): Promise<void> {
    console.log('[Service Orchestrator] Initializing service connections...');

    try {
      // Check all services
      await this.performHealthChecks();

      // Initialize WebSocket connection for real-time updates
      await this.initializeWebSocketConnection();

      console.log('[Service Orchestrator] All services initialized successfully');
    } catch (error) {
      console.error('[Service Orchestrator] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Process real-time AI request with WebSocket integration
   */
  async processRealTimeAI(
    request: RealTimeAIRequest,
    onChunk?: (chunk: string) => void,
    onComplete?: (response: any) => void,
    onError?: (error: Error) => void
  ): Promise<void> {
    const startTime = Date.now();
    
    try {
      console.log(`[Service Orchestrator] Processing real-time AI request for session ${request.sessionId}`);

      // Send initial status to WebSocket
      await this.sendWebSocketMessage({
        type: 'ai_request_started',
        sessionId: request.sessionId,
        userId: request.userId,
        timestamp: new Date().toISOString(),
      });

      if (request.streaming) {
        // Use streaming AI completion
        await hybridAIService.streamCompletion(
          {
            messages: [{ role: 'user', content: request.message }],
            model: request.model,
            provider: request.provider,
            temperature: request.temperature,
            maxTokens: request.maxTokens,
          },
          (chunk) => {
            // Forward chunk to callback
            if (onChunk) {
              onChunk(chunk);
            }

            // Send chunk via WebSocket
            this.sendWebSocketMessage({
              type: 'ai_chunk',
              sessionId: request.sessionId,
              userId: request.userId,
              content: chunk,
              timestamp: new Date().toISOString(),
            });
          },
          (response) => {
            const processingTime = Date.now() - startTime;
            
            // Send completion status
            this.sendWebSocketMessage({
              type: 'ai_request_completed',
              sessionId: request.sessionId,
              userId: request.userId,
              response: {
                content: response.content,
                model: response.model,
                provider: response.provider,
                processingTimeMs: processingTime,
                source: response.source,
              },
              timestamp: new Date().toISOString(),
            });

            if (onComplete) {
              onComplete(response);
            }
          },
          onError
        );
      } else {
        // Use regular completion
        const response = await hybridAIService.completion({
          messages: [{ role: 'user', content: request.message }],
          model: request.model,
          provider: request.provider,
          temperature: request.temperature,
          maxTokens: request.maxTokens,
        });

        const processingTime = Date.now() - startTime;

        // Send complete response via WebSocket
        await this.sendWebSocketMessage({
          type: 'ai_response',
          sessionId: request.sessionId,
          userId: request.userId,
          response: {
            content: response.content,
            model: response.model,
            provider: response.provider,
            processingTimeMs: processingTime,
            source: response.source,
          },
          timestamp: new Date().toISOString(),
        });

        if (onComplete) {
          onComplete(response);
        }
      }

    } catch (error) {
      console.error('[Service Orchestrator] Real-time AI processing failed:', error);
      
      // Send error via WebSocket
      await this.sendWebSocketMessage({
        type: 'ai_error',
        sessionId: request.sessionId,
        userId: request.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });

      if (onError) {
        onError(error instanceof Error ? error : new Error('Unknown error'));
      }
    }
  }

  /**
   * Get comprehensive service status
   */
  async getServiceStatus(): Promise<{
    overall: 'healthy' | 'degraded' | 'unhealthy';
    services: ServiceHealth[];
    metrics: ServiceMetrics;
  }> {
    await this.performHealthChecks();

    const services = Array.from(this.healthStatus.values());
    const healthyCount = services.filter(s => s.status === 'healthy').length;
    const totalCount = services.length;

    let overall: 'healthy' | 'degraded' | 'unhealthy';
    if (healthyCount === totalCount) {
      overall = 'healthy';
    } else if (healthyCount > 0) {
      overall = 'degraded';
    } else {
      overall = 'unhealthy';
    }

    // Collect metrics
    const metrics = await this.collectServiceMetrics();

    return {
      overall,
      services,
      metrics,
    };
  }

  /**
   * Optimize resources across all services
   */
  async optimizeAllServices(): Promise<{
    results: Array<{
      service: string;
      result: any;
      error?: string;
    }>;
    totalMemoryFreedMB: number;
  }> {
    const results: Array<{
      service: string;
      result: any;
      error?: string;
    }> = [];
    let totalMemoryFreedMB = 0;

    // Optimize AI Core memory
    try {
      const aiCoreResult = await aiCoreClient.optimizeMemory();
      results.push({
        service: 'ai-core',
        result: aiCoreResult,
      });
      totalMemoryFreedMB += aiCoreResult.memory_freed_mb;
    } catch (error) {
      results.push({
        service: 'ai-core',
        result: null,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Optimize Hybrid AI Service
    try {
      const hybridResult = await hybridAIService.optimizeMemory();
      results.push({
        service: 'hybrid-ai',
        result: hybridResult,
      });
      totalMemoryFreedMB += hybridResult.totalFreedMB;
    } catch (error) {
      results.push({
        service: 'hybrid-ai',
        result: null,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Trigger garbage collection if Node.js allows it
    try {
      if (global.gc) {
        global.gc();
        results.push({
          service: 'nodejs-gc',
          result: { message: 'Garbage collection triggered' },
        });
      }
    } catch (error) {
      results.push({
        service: 'nodejs-gc',
        result: null,
        error: 'Garbage collection not available',
      });
    }

    return {
      results,
      totalMemoryFreedMB,
    };
  }

  /**
   * Broadcast message to all connected WebSocket clients
   */
  async broadcastMessage(message: {
    type: string;
    content: any;
    targetUsers?: string[];
  }): Promise<void> {
    try {
      await this.httpClient.post(`${this.services.websocket}/broadcast`, {
        type: message.type,
        content: message.content,
        metadata: {
          timestamp: new Date().toISOString(),
          source: 'service-orchestrator',
          targetUsers: message.targetUsers,
        },
      });
    } catch (error) {
      console.error('[Service Orchestrator] Broadcast failed:', error);
      throw error;
    }
  }

  /**
   * Get real-time metrics from all services
   */
  async getRealtimeMetrics(): Promise<{
    aiCore: any;
    websocket: any;
    backend: any;
  }> {
    const [aiCoreMetrics, websocketMetrics, backendMetrics] = await Promise.allSettled([
      this.getAICoreMetrics(),
      this.getWebSocketMetrics(),
      this.getBackendMetrics(),
    ]);

    return {
      aiCore: aiCoreMetrics.status === 'fulfilled' ? aiCoreMetrics.value : null,
      websocket: websocketMetrics.status === 'fulfilled' ? websocketMetrics.value : null,
      backend: backendMetrics.status === 'fulfilled' ? backendMetrics.value : null,
    };
  }

  /**
   * Graceful shutdown of all connections
   */
  async shutdown(): Promise<void> {
    console.log('[Service Orchestrator] Shutting down...');

    // Clear health check interval
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Close WebSocket connection
    if (this.websocketClient) {
      this.websocketClient.close();
    }

    console.log('[Service Orchestrator] Shutdown complete');
  }

  /**
   * Private methods
   */

  private async performHealthChecks(): Promise<void> {
    const services = [
      { name: 'ai-core', url: `${this.services.aiCore}/health` },
      { name: 'websocket', url: `${this.services.websocket}/health` },
      { name: 'backend', url: `${this.services.mainBackend}/api/health` },
    ];

    await Promise.allSettled(
      services.map(async (service) => {
        try {
          const startTime = Date.now();
          const response = await this.httpClient.get(service.url);
          const responseTime = Date.now() - startTime;

          this.healthStatus.set(service.name, {
            name: service.name,
            status: response.status === 200 ? 'healthy' : 'degraded',
            lastCheck: new Date(),
            details: response.data,
            responseTime,
          });
        } catch (error) {
          this.healthStatus.set(service.name, {
            name: service.name,
            status: 'unhealthy',
            lastCheck: new Date(),
            details: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      })
    );
  }

  private async initializeWebSocketConnection(): Promise<void> {
    const wsUrl = this.services.websocket.replace('http', 'ws') + '/ws?user_id=orchestrator';
    
    try {
      this.websocketClient = new WebSocket(wsUrl);
      
      this.websocketClient.on('open', () => {
        console.log('[Service Orchestrator] WebSocket connection established');
      });

      this.websocketClient.on('error', (error) => {
        console.error('[Service Orchestrator] WebSocket error:', error);
      });

      this.websocketClient.on('close', () => {
        console.log('[Service Orchestrator] WebSocket connection closed');
      });

    } catch (error) {
      console.warn('[Service Orchestrator] Failed to initialize WebSocket:', error);
    }
  }

  private async sendWebSocketMessage(message: any): Promise<void> {
    if (this.websocketClient && this.websocketClient.readyState === WebSocket.OPEN) {
      try {
        this.websocketClient.send(JSON.stringify(message));
      } catch (error) {
        console.error('[Service Orchestrator] Failed to send WebSocket message:', error);
      }
    }
  }

  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.performHealthChecks();
      } catch (error) {
        console.error('[Service Orchestrator] Health check failed:', error);
      }
    }, this.HEALTH_CHECK_INTERVAL);
  }

  private async collectServiceMetrics(): Promise<ServiceMetrics> {
    const aiCoreHealth = this.healthStatus.get('ai-core');
    const websocketHealth = this.healthStatus.get('websocket');
    const backendHealth = this.healthStatus.get('backend');

    return {
      timestamp: new Date(),
      services: {
        aiCore: {
          available: aiCoreHealth?.status === 'healthy',
          memoryUsageMB: aiCoreHealth?.details?.memory_usage_mb || 0,
          modelsLoaded: aiCoreHealth?.details?.models_loaded || 0,
          providersActive: aiCoreHealth?.details?.providers_active || 0,
        },
        websocket: {
          available: websocketHealth?.status === 'healthy',
          connectedClients: websocketHealth?.details?.connected_clients || 0,
          messagesTotal: websocketHealth?.details?.messages_total || 0,
        },
        backend: {
          available: backendHealth?.status === 'healthy',
          uptime: backendHealth?.details?.uptime || 0,
        },
      },
      performance: {
        averageResponseTime: this.calculateAverageResponseTime(),
        throughput: 0, // Would calculate from actual metrics
        errorRate: 0, // Would calculate from actual metrics
      },
    };
  }

  private calculateAverageResponseTime(): number {
    const responseTimes = Array.from(this.healthStatus.values())
      .map(s => s.responseTime)
      .filter(t => t !== undefined);
    
    return responseTimes.length > 0 
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
      : 0;
  }

  private async getAICoreMetrics(): Promise<any> {
    try {
      return await aiCoreClient.getMetrics();
    } catch (error) {
      console.warn('[Service Orchestrator] Failed to get AI Core metrics:', error);
      return null;
    }
  }

  private async getWebSocketMetrics(): Promise<any> {
    try {
      const response = await this.httpClient.get(`${this.services.websocket}/metrics`);
      return response.data;
    } catch (error) {
      console.warn('[Service Orchestrator] Failed to get WebSocket metrics:', error);
      return null;
    }
  }

  private async getBackendMetrics(): Promise<any> {
    try {
      const response = await this.httpClient.get(`${this.services.mainBackend}/api/metrics`);
      return response.data;
    } catch (error) {
      console.warn('[Service Orchestrator] Failed to get backend metrics:', error);
      return null;
    }
  }
}

// Singleton instance
export const serviceOrchestrator = new ServiceOrchestrator();

// Type exports
export type {
  ServiceHealth,
  ServiceEndpoints,
  RealTimeAIRequest,
  ServiceMetrics,
};