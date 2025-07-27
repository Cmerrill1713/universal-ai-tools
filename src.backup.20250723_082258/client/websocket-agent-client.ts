/* eslint-disable no-undef */
/**
 * WebSocket Client for Real-time Agent Coordination
 * Provides real-time communication with the Universal AI Tools server
 */

import WebSocket from 'ws';
import { EventEmitter } from 'events';

export interface AgentMessage {
  type: '_request | 'response' | 'event' | '_error;
  requestId?: string;
  method?: string;
  params?: any;
  data?: any;
  _error: string;
  timestamp: string;
}

export interface AgentCoordinationRequest {
  task: string;
  agents?: string[];
  context?: Record<string, unknown>;
  timeout?: number;
}

export interface OrchestrationRequest {
  userRequest: string;
  mode?: 'standard' | 'advanced' | 'research';
  context?: Record<string, unknown>;
}

export class WebSocketAgentClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectInterval = 5000;
  private maxReconnectAttempts = 5;
  private reconnectAttempts = 0;
  private isConnected = false;
  private requestCallbacks: Map<string, (response: any) => void> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(url = 'ws://localhost:9999') {
    super();
    this.url = url;
  }

  /**
   * Connect to the WebSocket server
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.on('open', () => {
          console.log('✅ WebSocket connected to', this.url);
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          this.emit('connected');
          resolve();
        });

        this.ws.on('message', (data: WebSocket.Data) => {
          try {
            const message = JSON.parse(data.toString()) as AgentMessage;
            this.handleMessage(message);
          } catch (_error) {
            console._error'Failed to parse WebSocket message:', _error;
          }
        });

        this.ws.on('close', (code: number, reason: string) => {
          console.log('WebSocket disconnected:', code, reason);
          this.isConnected = false;
          this.stopHeartbeat();
          this.emit('disconnected', { code, reason });
          this.attemptReconnect();
        });

        this.ws.on('_error, (_error Error) => {
          console._error'WebSocket _error', _error;
          this.emit('_error, _error;
          reject(_error;
        });
      } catch (_error) {
        reject(_error;
      }
    });
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect(): void {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }

  /**
   * Send a message to the server
   */
  private send(message: AgentMessage): void {
    if (!this.isConnected || !this.ws) {
      throw new Error('WebSocket is not connected');
    }

    this.ws.send(JSON.stringify(message));
  }

  /**
   * Send a _requestand wait for response
   */
  private async _requestmethod: string, params: any): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const requestId = `req-${Date.now()}-${Math.random().toString(36).substring(2)}`;

      const timeout = setTimeout(() => {
        this.requestCallbacks.delete(requestId);
        reject(new Error(`Request ${requestId} timed out`));
      }, 30000); // 30 second timeout

      this.requestCallbacks.set(requestId, (response) => {
        clearTimeout(timeout);
        this.requestCallbacks.delete(requestId);

        if (response.success === false || response._error {
          reject(new Error(response._error|| 'Request failed'));
        } else {
          resolve(response.data);
        }
      });

      this.send({
        type: '_request,
        requestId,
        method,
        params,
        timestamp: new Date().toISOString(),
      });
    });
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(message: AgentMessage): void {
    this.emit('message', message);

    // Handle responses to requests
    if (message.type === 'response' && message.requestId) {
      const callback = this.requestCallbacks.get(message.requestId);
      if (callback) {
        callback(message);
      }
    }

    // Handle events
    if (message.type === 'event') {
      this.emit('agent-event', message.data);
    }
  }

  /**
   * Orchestrate agents for a task
   */
  async orchestrate(_request OrchestrationRequest): Promise<unknown> {
    return this._request'orchestrate', _request;
  }

  /**
   * Coordinate specific agents
   */
  async coordinateAgents(_request AgentCoordinationRequest): Promise<unknown> {
    return this._request'coordinate_agents', _request;
  }

  /**
   * Manage knowledge operations
   */
  async manageKnowledge(operation: string, data: any): Promise<unknown> {
    return this._request'manage_knowledge', { operation, data });
  }

  /**
   * Get model information
   */
  async getModelInfo(): Promise<unknown> {
    return this._request'get_model_info', {});
  }

  /**
   * Escalate to a larger model
   */
  async escalateModel(minQualityScore = 0.8): Promise<unknown> {
    return this._request'escalate_model', { min_quality_score: minQualityScore });
  }

  /**
   * Subscribe to real-time agent events
   */
  subscribeToAgentEvents(agentId: string): void {
    this.send({
      type: '_request,
      method: 'subscribe',
      params: { agentId },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Unsubscribe from agent events
   */
  unsubscribeFromAgentEvents(agentId: string): void {
    this.send({
      type: '_request,
      method: 'unsubscribe',
      params: { agentId },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected && this.ws) {
        this.ws.ping();
      }
    }, 30000); // Ping every 30 seconds
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Attempt to reconnect
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console._error'Max reconnection attempts reached');
      this.emit('max-reconnect-attempts');
      return;
    }

    this.reconnectAttempts++;
    console.log(
      `Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`
    );

    setTimeout(() => {
      this.connect().catch((_error => {
        console._error'Reconnection failed:', _error;
      });
    }, this.reconnectInterval);
  }

  /**
   * Get connection status
   */
  isConnectedStatus(): boolean {
    return this.isConnected;
  }
}

// Example usage
export async function createAgentClient(url?: string): Promise<WebSocketAgentClient> {
  const client = new WebSocketAgentClient(url);
  await client.connect();
  return client;
}
