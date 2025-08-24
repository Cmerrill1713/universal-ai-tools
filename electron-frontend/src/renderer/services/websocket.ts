import { useStore } from '../store/useStore';
import { wsMessageSchema, type WsMessage } from '../utils/validation';

import Logger from '../utils/logger';
export interface WebSocketConfig {
  url: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
  messageQueueSize?: number;
}

export class EnhancedWebSocket {
  private ws: WebSocket | null = null;
  private config: Required<WebSocketConfig>;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private messageQueue: WsMessage[] = [];
  private listeners: Map<string, Set<(data: unknown) => void>> = new Map();
  private isIntentionallyClosed = false;
  private reconnectAttempt = 0;

  constructor(config: WebSocketConfig) {
    this.config = {
      url: config.url,
      reconnectInterval: config.reconnectInterval ?? 3000,
      maxReconnectAttempts: config.maxReconnectAttempts ?? 10,
      heartbeatInterval: config.heartbeatInterval ?? 30000,
      messageQueueSize: config.messageQueueSize ?? 100,
    };
  }

  // Connection management
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      try {
        this.isIntentionallyClosed = false;
        this.ws = new WebSocket(this.config.url);

        this.ws.onopen = () => {
          if (process.env.NODE_ENV === 'development') {
            Logger.debug('✅ WebSocket connected');
          }
          this.reconnectAttempt = 0;

          // Update store
          useStore.getState().updateServiceStatus('websocket', true);
          useStore.getState().resetReconnectAttempts();

          // Start heartbeat
          this.startHeartbeat();

          // Process queued messages
          this.processMessageQueue();

          // Emit connected event
          this.emit('connected', null);

          resolve();
        };

        this.ws.onmessage = event => {
          this.handleMessage(event.data);
        };

        this.ws.onerror = _error => {
          if (process.env.NODE_ENV === 'development') {
            Logger.error('❌ WebSocket _error:', _error);
          }
          this.emit('error', _error);

          // Update store
          useStore.getState().addNotification({
            type: 'error',
            message: 'WebSocket connection error',
          });
        };

        this.ws.onclose = event => {
          Logger.debug('WebSocket closed:', event.code, event.reason);

          // Update store
          useStore.getState().updateServiceStatus('websocket', false);

          // Stop heartbeat
          this.stopHeartbeat();

          // Emit disconnected event
          this.emit('disconnected', { code: event.code, reason: event.reason });

          // Attempt reconnection if not intentionally closed
          if (!this.isIntentionallyClosed && !event.wasClean) {
            this.scheduleReconnect();
          }
        };
      } catch (_error) {
        Logger.error('Failed to create WebSocket:', _error);
        reject(_error);
      }
    });
  }

  disconnect(): void {
    this.isIntentionallyClosed = true;
    this.stopHeartbeat();
    this.clearReconnectTimer();

    if (this.ws) {
      this.ws.close(1000, 'Client disconnecting');
      this.ws = null;
    }

    // Clear message queue
    this.messageQueue = [];
  }

  // Reconnection logic with exponential backoff
  private scheduleReconnect(): void {
    if (this.reconnectAttempt >= this.config.maxReconnectAttempts) {
      Logger.error('Max reconnection attempts reached');
      useStore.getState().addNotification({
        type: 'error',
        message: 'Failed to reconnect to server. Please check your connection.',
      });
      return;
    }

    this.clearReconnectTimer();

    // Exponential backoff: 3s, 6s, 12s, 24s, ...
    const delay = Math.min(
      this.config.reconnectInterval * Math.pow(2, this.reconnectAttempt),
      30000 // Max 30 seconds
    );

    this.reconnectAttempt++;
    useStore.getState().incrementReconnectAttempts();

    Logger.debug(`🔄 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempt})`);

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(_error => {
        Logger.error('Reconnection failed:', _error);
        this.scheduleReconnect();
      });
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  // Heartbeat mechanism
  private startHeartbeat(): void {
    this.stopHeartbeat();

    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({ type: 'ping', timestamp: Date.now() });
      }
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // Message handling
  private handleMessage(data: string): void {
    try {
      const parsed = JSON.parse(data);
      const validated = wsMessageSchema.safeParse(parsed);

      if (!validated.success) {
        if (process.env.NODE_ENV === 'development') {
          Logger.warn('Invalid WebSocket message:', validated._error);
        }
        return;
      }

      const message = validated.data;

      // Handle different message types
      switch (message.type) {
        case 'pong':
          // Heartbeat response received
          break;

        case 'chunk':
          this.emit('chunk', message);
          break;

        case 'complete':
          this.emit('complete', message);
          break;

        case 'error':
          this.emit('error', message);
          useStore.getState().addNotification({
            type: 'error',
            message: message.message,
          });
          break;

        case 'chat':
          this.emit('chat', message);
          break;

        default:
          this.emit('message', message);
      }
    } catch (_error) {
      Logger.error('Failed to parse WebSocket message:', _error);
    }
  }

  // Message sending with queuing
  send(message: WsMessage): boolean {
    if (this.ws?.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(message));
        return true;
      } catch (_error) {
        Logger.error('Failed to send message:', _error);
        this.queueMessage(message);
        return false;
      }
    } else {
      // Queue message for later
      this.queueMessage(message);

      // Attempt to reconnect if not already trying
      if (!this.reconnectTimer && !this.isIntentionallyClosed) {
        this.scheduleReconnect();
      }

      return false;
    }
  }

  private queueMessage(message: WsMessage): void {
    if (this.messageQueue.length >= this.config.messageQueueSize) {
      // Remove oldest message if queue is full
      this.messageQueue.shift();
    }
    this.messageQueue.push(message);
  }

  private processMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.ws?.readyState === WebSocket.OPEN) {
      const message = this.messageQueue.shift();
      if (message) {
        this.send(message);
      }
    }
  }

  // Event emitter pattern
  on(event: string, callback: (data: unknown) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)?.add(callback);
  }

  off(event: string, callback: (data: unknown) => void): void {
    this.listeners.get(event)?.delete(callback);
  }

  private emit(event: string, data: unknown): void {
    this.listeners.get(event)?.forEach(callback => {
      try {
        callback(data);
      } catch (_error) {
        Logger.error(`Error in WebSocket event listener for "${event}":`, _error);
      }
    });
  }

  // Status checks
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  getReadyState(): number {
    return this.ws?.readyState ?? WebSocket.CLOSED;
  }

  getQueueSize(): number {
    return this.messageQueue.length;
  }
}

// Singleton instance
let wsInstance: EnhancedWebSocket | null = null;

export const getWebSocket = (config?: WebSocketConfig): EnhancedWebSocket => {
  if (!wsInstance && config) {
    wsInstance = new EnhancedWebSocket(config);
  }

  if (!wsInstance) {
    throw new Error('WebSocket not initialized. Please provide config on first call.');
  }

  return wsInstance;
};

// React hook for WebSocket
import { useEffect, useCallback, useState } from 'react';

export const useWebSocket = (config?: WebSocketConfig) => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WsMessage | null>(null);

  useEffect(() => {
    const ws = getWebSocket(config || { url: 'ws://localhost:8080' });

    const handleConnected = () => setIsConnected(true);
    const handleDisconnected = () => setIsConnected(false);
    const handleMessage = (msg: WsMessage) => setLastMessage(msg);

    ws.on('connected', handleConnected);
    ws.on('disconnected', handleDisconnected);
    ws.on('message', handleMessage);

    // Auto-connect
    ws.connect().catch(console._error);

    return () => {
      ws.off('connected', handleConnected);
      ws.off('disconnected', handleDisconnected);
      ws.off('message', handleMessage);
    };
  }, []);

  const sendMessage = useCallback((message: WsMessage) => {
    const ws = getWebSocket();
    return ws.send(message);
  }, []);

  const connect = useCallback(() => {
    const ws = getWebSocket();
    return ws.connect();
  }, []);

  const disconnect = useCallback(() => {
    const ws = getWebSocket();
    ws.disconnect();
  }, []);

  return {
    isConnected,
    lastMessage,
    sendMessage,
    connect,
    disconnect,
  };
};
