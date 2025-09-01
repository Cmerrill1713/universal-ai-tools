/**
 * Go Services Integration Layer
 * Connects Node.js backend with Go middleware services
 */

import WebSocket from 'ws';
import axios from 'axios';
import { EventEmitter } from 'events';
import { log, LogContext } from '../utils/logger';

export interface GoServiceConfig {
  messageBrokerUrl: string;
  loadBalancerUrl: string;
  cacheCoordinatorUrl: string;
  streamProcessorUrl: string;
  mlStreamProcessorUrl: string;
  mlGoServiceUrl: string;
  mlRustServiceUrl: string;
  wsReconnectInterval: number;
}

export interface GoMessage {
  id: string;
  type: 'request' | 'response' | 'broadcast' | 'health_check';
  source: string;
  destination?: string;
  timestamp: Date;
  payload: any;
  metadata?: Record<string, any>;
  traceId?: string;
}

export class GoIntegrationService extends EventEmitter {
  private config: GoServiceConfig;
  private wsConnection?: WebSocket;
  private reconnectTimer?: NodeJS.Timeout;
  private messageQueue: GoMessage[] = [];
  private isConnected = false;

  constructor(config?: Partial<GoServiceConfig>) {
    super();
    
    this.config = {
      messageBrokerUrl: config?.messageBrokerUrl || 'ws://localhost:8081/ws/node_backend',
      loadBalancerUrl: config?.loadBalancerUrl || 'http://localhost:8082',
      cacheCoordinatorUrl: config?.cacheCoordinatorUrl || 'http://localhost:8083',
      streamProcessorUrl: config?.streamProcessorUrl || 'http://localhost:8084',
      mlStreamProcessorUrl: config?.mlStreamProcessorUrl || 'http://localhost:8088',
      mlGoServiceUrl: config?.mlGoServiceUrl || 'http://localhost:8086',
      mlRustServiceUrl: config?.mlRustServiceUrl || 'http://localhost:8087',
      wsReconnectInterval: config?.wsReconnectInterval || 5000,
    };
  }

  /**
   * Initialize connection to Go services
   */
  async initialize(): Promise<void> {
    await this.connectToMessageBroker();
    await this.checkServicesHealth();
    
    log.info('Go services integration initialized', LogContext.SYSTEM);
  }

  /**
   * Connect to Go Message Broker via WebSocket
   */
  private async connectToMessageBroker(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.wsConnection = new WebSocket(this.config.messageBrokerUrl);

        this.wsConnection.on('open', () => {
          this.isConnected = true;
          this.flushMessageQueue();
          log.info('Connected to Go Message Broker', LogContext.SYSTEM);
          this.emit('connected');
          resolve();
        });

        this.wsConnection.on('message', (data) => {
          try {
            const message: GoMessage = JSON.parse(data.toString());
            this.handleIncomingMessage(message);
          } catch (error) {
            log.error('Failed to parse message from Go broker', LogContext.SYSTEM, { error });
          }
        });

        this.wsConnection.on('close', () => {
          this.isConnected = false;
          log.warn('Disconnected from Go Message Broker', LogContext.SYSTEM);
          this.emit('disconnected');
          this.scheduleReconnect();
        });

        this.wsConnection.on('error', (error) => {
          log.error('WebSocket error', LogContext.SYSTEM, { error });
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Schedule reconnection to message broker
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectTimer = setTimeout(() => {
      log.info('Attempting to reconnect to Go Message Broker', LogContext.SYSTEM);
      this.connectToMessageBroker().catch(err => {
        log.error('Reconnection failed', LogContext.SYSTEM, { error: err });
      });
    }, this.config.wsReconnectInterval);
  }

  /**
   * Handle incoming messages from Go services
   */
  private handleIncomingMessage(message: GoMessage): void {
    log.debug('Received message from Go service', LogContext.SYSTEM, {
      type: message.type,
      source: message.source,
      id: message.id,
    });

    // Emit specific events based on message type
    this.emit('message', message);
    this.emit(`message:${message.type}`, message);

    // Handle specific message types
    switch (message.type) {
      case 'request':
        this.handleServiceRequest(message);
        break;
      case 'response':
        this.handleServiceResponse(message);
        break;
      case 'broadcast':
        this.handleBroadcast(message);
        break;
      case 'health_check':
        this.respondToHealthCheck(message);
        break;
    }
  }

  /**
   * Send message to Go services
   */
  async sendMessage(message: Partial<GoMessage>): Promise<void> {
    const fullMessage: GoMessage = {
      id: message.id || `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: message.type || 'request',
      source: 'node_backend',
      timestamp: new Date(),
      ...message,
    };

    if (this.isConnected && this.wsConnection) {
      this.wsConnection.send(JSON.stringify(fullMessage));
    } else {
      // Queue message for later delivery
      this.messageQueue.push(fullMessage);
      log.warn('Message queued (not connected)', LogContext.SYSTEM, { messageId: fullMessage.id });
    }
  }

  /**
   * Flush queued messages
   */
  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.isConnected) {
      const message = this.messageQueue.shift();
      if (message && this.wsConnection) {
        this.wsConnection.send(JSON.stringify(message));
      }
    }
  }

  /**
   * Route request to Rust service via Go Load Balancer
   */
  async routeToRustService(
    service: 'vision' | 'ai' | 'analytics',
    path: string,
    data?: any
  ): Promise<any> {
    try {
      const response = await axios.post(
        `${this.config.loadBalancerUrl}/${service}${path}`,
        data,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Source': 'node_backend',
          },
        }
      );

      return response.data;
    } catch (error) {
      log.error('Failed to route to Rust service', LogContext.SYSTEM, {
        service,
        path,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Cache operations via Go Cache Coordinator
   */
  async cacheGet(key: string, service?: string): Promise<any> {
    try {
      const response = await axios.get(
        `${this.config.cacheCoordinatorUrl}/cache/${key}`,
        {
          headers: {
            'X-Service-Type': service || 'node_backend',
          },
        }
      );

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async cacheSet(key: string, value: any, ttl = 3600, service?: string): Promise<void> {
    await axios.post(
      `${this.config.cacheCoordinatorUrl}/cache/${key}`,
      {
        value,
        ttl,
      },
      {
        headers: {
          'X-Service-Type': service || 'node_backend',
        },
      }
    );
  }

  async cacheDelete(key: string, service?: string): Promise<void> {
    await axios.delete(
      `${this.config.cacheCoordinatorUrl}/cache/${key}`,
      {
        headers: {
          'X-Service-Type': service || 'node_backend',
        },
      }
    );
  }

  /**
   * Stream operations via Go Stream Processor
   */
  async createStream(config: {
    type: string;
    source?: string;
    bufferSize?: number;
    maxLatency?: number;
  }): Promise<string> {
    const response = await axios.post(
      `${this.config.streamProcessorUrl}/stream/create`,
      {
        stream_id: `node_${Date.now()}`,
        source: 'node_backend',
        ...config,
      }
    );

    return response.data.stream_id;
  }

  async sendStreamChunk(
    streamId: string,
    data: Buffer | string,
    isLast = false
  ): Promise<void> {
    await axios.post(
      `${this.config.streamProcessorUrl}/stream/${streamId}/chunk`,
      data,
      {
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-Stream-Last': isLast ? 'true' : 'false',
        },
      }
    );
  }

  /**
   * Subscribe to stream updates
   */
  subscribeToStream(streamId: string): WebSocket {
    const ws = new WebSocket(
      `${this.config.streamProcessorUrl.replace('http', 'ws')}/stream/${streamId}/subscribe`
    );

    ws.on('message', (data) => {
      try {
        const chunk = JSON.parse(data.toString());
        this.emit(`stream:${streamId}`, chunk);
      } catch (error) {
        log.error('Failed to parse stream chunk', LogContext.SYSTEM, { error });
      }
    });

    return ws;
  }

  /**
   * Check health of all Go services
   */
  async checkServicesHealth(): Promise<Record<string, any>> {
    const health: Record<string, any> = {};

    // Check Message Broker
    try {
      const brokerHealth = await axios.get(`${this.config.messageBrokerUrl.replace('ws:', 'http:').replace('/ws/node_backend', '/health')}`);
      health.messageBroker = brokerHealth.data;
    } catch (error) {
      health.messageBroker = { status: 'unhealthy', error: String(error) };
    }

    // Check Load Balancer
    try {
      const lbHealth = await axios.get(`${this.config.loadBalancerUrl}/health`);
      health.loadBalancer = lbHealth.data;
    } catch (error) {
      health.loadBalancer = { status: 'unhealthy', error: String(error) };
    }

    // Check Cache Coordinator
    try {
      const cacheHealth = await axios.get(`${this.config.cacheCoordinatorUrl}/health`);
      health.cacheCoordinator = cacheHealth.data;
    } catch (error) {
      health.cacheCoordinator = { status: 'unhealthy', error: String(error) };
    }

    // Check Stream Processor
    try {
      const streamHealth = await axios.get(`${this.config.streamProcessorUrl}/health`);
      health.streamProcessor = streamHealth.data;
    } catch (error) {
      health.streamProcessor = { status: 'unhealthy', error: String(error) };
    }

    // Check ML Stream Processor
    try {
      const mlStreamHealth = await axios.get(`${this.config.mlStreamProcessorUrl}/health`);
      health.mlStreamProcessor = mlStreamHealth.data;
    } catch (error) {
      health.mlStreamProcessor = { status: 'unhealthy', error: String(error) };
    }

    // Check ML Go Service
    try {
      const mlGoHealth = await axios.get(`${this.config.mlGoServiceUrl}/health`);
      health.mlGoService = mlGoHealth.data;
    } catch (error) {
      health.mlGoService = { status: 'unhealthy', error: String(error) };
    }

    // Check ML Rust Service
    try {
      const mlRustHealth = await axios.get(`${this.config.mlRustServiceUrl}/health`);
      health.mlRustService = mlRustHealth.data;
    } catch (error) {
      health.mlRustService = { status: 'unhealthy', error: String(error) };
    }

    return health;
  }

  /**
   * ML Inference through Go or Rust service
   */
  async mlInference(framework: 'go' | 'rust', request: {
    modelId: string;
    input: any;
    parameters?: any;
  }): Promise<any> {
    const serviceUrl = framework === 'go' ? this.config.mlGoServiceUrl : this.config.mlRustServiceUrl;
    
    try {
      const response = await axios.post(`${serviceUrl}/infer`, request);
      return response.data;
    } catch (error) {
      log.error(`ML inference failed on ${framework} service`, LogContext.SYSTEM, { error });
      throw error;
    }
  }

  /**
   * Create ML stream for real-time processing
   */
  async createMLStream(type: 'inference' | 'training' | 'embedding' | 'generation', config: {
    modelId: string;
    framework: 'go' | 'rust';
    parameters?: any;
  }): Promise<string> {
    try {
      const response = await axios.post(`${this.config.mlStreamProcessorUrl}/api/v1/ml-stream/create`, {
        type,
        model_id: config.modelId,
        framework: config.framework,
        parameters: config.parameters || {}
      });
      
      return response.data.id;
    } catch (error) {
      log.error('Failed to create ML stream', LogContext.SYSTEM, { error });
      throw error;
    }
  }

  /**
   * Subscribe to ML stream updates
   */
  subscribeToMLStream(streamId: string): WebSocket {
    const ws = new WebSocket(
      `${this.config.mlStreamProcessorUrl.replace('http', 'ws')}/api/v1/ml-stream/ws/${streamId}`
    );

    ws.on('message', (data) => {
      try {
        const streamData = JSON.parse(data.toString());
        this.emit(`ml-stream:${streamId}`, streamData);
      } catch (error) {
        log.error('Failed to parse ML stream data', LogContext.SYSTEM, { error });
      }
    });

    return ws;
  }

  /**
   * Handle service request from Go services
   */
  private handleServiceRequest(message: GoMessage): void {
    // Implement request handling based on your needs
    // This would typically route to appropriate Node.js service handlers
    this.emit('service:request', message);
  }

  /**
   * Handle service response from Go services
   */
  private handleServiceResponse(message: GoMessage): void {
    // Handle responses from Go services
    this.emit('service:response', message);
  }

  /**
   * Handle broadcast messages
   */
  private handleBroadcast(message: GoMessage): void {
    // Handle broadcast messages from Go services
    this.emit('broadcast', message);
  }

  /**
   * Respond to health check request
   */
  private respondToHealthCheck(message: GoMessage): void {
    const response: GoMessage = {
      id: `health_${Date.now()}`,
      type: 'response',
      source: 'node_backend',
      destination: message.source,
      timestamp: new Date(),
      payload: {
        status: 'healthy',
        service: 'node_backend',
        timestamp: new Date().toISOString(),
      },
    };

    this.sendMessage(response);
  }

  /**
   * Cleanup and disconnect
   */
  async shutdown(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    if (this.wsConnection) {
      this.wsConnection.close();
    }

    this.removeAllListeners();
    log.info('Go services integration shut down', LogContext.SYSTEM);
  }
}

// Export singleton instance
export const goIntegration = new GoIntegrationService();