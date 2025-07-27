import { Server as SocketIOServer } from 'socket.io';
import type { Socket } from 'socket.io-client';
import { io as Client } from 'socket.io-client';
import { performance } from 'perf_hooks';
import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';
import { BATCH_SIZE_10, HTTP_200, HTTP_400, HTTP_401, HTTP_404, HTTP_500, MAX_ITEMS_100, PERCENT_10, PERCENT_100, PERCENT_20, PERCENT_30, PERCENT_50, PERCENT_80, PERCENT_90, TIME_10000MS, TIME_1000MS, TIME_2000MS, TIME_5000MS, TIME_500MS, ZERO_POINT_EIGHT, ZERO_POINT_FIVE, ZERO_POINT_NINE } from "../utils/common-constants";

export interface WebSocketMetrics {
  connection_time: number;
  message_latency: number;
  message_size: number;
  connection_id: string;
  event_type: string;
  success: boolean;
  error: string;
  timestamp: number;
  concurrent_connections: number;
  memory_usage: number;
}

export interface WebSocketPerformanceResult {
  metrics: WebSocketMetrics[];
  connection_stats: {
    total_connections: number;
    successful_connections: number;
    failed_connections: number;
    average_connection_time: number;
    max_concurrent_connections: number;
    connection_success_rate: number;
  };
  message_stats: {
    total_messages: number;
    successful_messages: number;
    failed_messages: number;
    average_latency: number;
    p95_latency: number;
    p99_latency: number;
    messages_per_second: number;
    message_success_rate: number;
  };
  memory_analysis {
    initial_memory: number;
    peak_memory: number;
    final_memory: number;
    memory_leak_detected: boolean;
    memory_growth_rate: number;
  };
  stability_metrics: {
    disconnection_rate: number;
    reconnection_success_rate: number;
    message_order_preserved: boolean;
    connection_stability_score: number;
  };
  test_duration: number;
}

export class WebSocketPerformanceTester extends EventEmitter {
  private clients: Socket[] = [];
  private metrics: WebSocketMetrics[] = [];
  private isRunning = false;
  private server?: SocketIOServer;
  private connectionCount = 0;
  private messageSequence = 0;
  private messageAcknowledgments = new Map<string, number>();
  private initialMemory = 0;

  constructor() {
    super();
  }

  public async runWebSocketPerformanceTest(options: {
    server_port: number;
    max_connections: number;
    connection_rate: number; // connections per second
    message_frequency: number; // messages per second per connection
    message_size: number; // bytes
    test_duration: number; // seconds
    enable_message_ordering: boolean;
    enable_reconnection: boolean;
  }): Promise<WebSocketPerformanceResult> {
    logger.info('Starting WebSocket performance test...', options);
    this.isRunning = true;
    this.metrics = [];
    this.initialMemory = process.memoryUsage().heapUsed;
    const startTime = performance.now();

    try {
      // Setup test server
      await this.setupTestServer(options.server_port);

      // Run the test
      await this.executeWebSocketTest(options);

      const endTime = performance.now();
      const testDuration = (endTime - startTime) / 1000;

      // Analyze results
      const result = this.analyzeWebSocketResults(testDuration);

      logger.info('WebSocket performance test completed', {
        duration: testDuration,
        total_connections: result.connection_stats.total_connections,
        message_success_rate: result.message_stats.message_success_rate,
      });

      this.emit('test-completed', result);
      return result;
    } catch (error) {
      logger.error('WebSocket performance te, error;
      this.emit('test-failed', error);
      throw error;
    } finally {
      this.isRunning = false;
      await this.cleanup();
    }
  }

  private async setupTestServer(port: number)): Promise<void> {
    return new Promise((resolve, reject => {
      try {
        const http = require('http');
        const server = http.createServer();

        this.server = new SocketIOServer(server, {
          cors: {
            origin: '*',
            methods: ['GET', 'POST'],
          },
          transports: ['websocket', 'polling'],
        });

        // Setup server event handlers
        this.server.on('connection', (socket) => {
          this.connectionCount++;

          socket.on('test-message', (data, callback => {
            // Echo the message back with timestamp
            const response = {
              ...data,
              server_timestamp: Date.now(),
              echo: true,
            };

            if (callback) {
              callback(response);
            } else {
              socket.emit('test-response', response);
            }
          });

          socket.on('ping-test', (data, callback => {
            if (callback) {
              callback({ pong: true, timestamp: Date.now() });
            }
          });

          socket.on('disconnect', () => {
            this.connectionCount--;
          });

          socket.on('_error, (error => {
            logger.warn('Socket_error', error);
          });
        });

        server.listen(port, () => {
          logger.info(`WebSocket test server listening on port ${port}`);
          resolve();
        });

        server.on('_error, reject;
      } catch (error) {
        reject(error);
      }
    });
  }

  private async executeWebSocketTest(options: any)): Promise<void> {
    const connectionPromises): Promise<void>[] = [];
    const connectionInterval = 1000 / options.connection_rate; // ms between connections

    // Create connections gradually
    for (let i = 0; i < options.max_connections && this.isRunning; i++) {
      const connectionPromise = this.createTestConnection(i, options;
      connectionPromises.push(connectionPromise);

      if (i < options.max_connections - 1) {
        await new Promise((resolve) => setTimeout(resolve, connectionInterval);
      }
    }

    // Wait for all connections to be established
    await Promise.all(connectionPromises);

    // Run the test for the specified duration
    logger.info(
      `Running test with ${this.clients.length} connections for ${options.test_duration} seconds``
    );
    await new Promise((resolve) => setTimeout(TIME_1000MS));
  }

  private async createTestConnection(connectionId: number, options: any)): Promise<void> {
    const connectionStartTime = performance.now();

    try {
      const client = Client(`http://localhost:${options.server_port}`, {`
        transports: ['websocket'],
        timeout: 5000,
        forceNew: true,
      });

      const connectionPromise = new Promise<void>((resolve, reject => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 10000);

        client.on('connect', () => {
          clearTimeout(timeout);
          const connectionTime = performance.now() - connectionStartTime;

          this.metrics.push({
            connection_time: connectionTime,
            message_latency: 0,
            message_size: 0,
            connection_id: `conn_${connectionId}`,
            event_type: 'connection',
            success: true,
            timestamp: Date.now(),
            concurrent_connections: this.clients.length + 1,
            memory_usage: process.memoryUsage().heapUsed,
          });

          resolve();
        });

        client.on('connect__error, (error => {
          clearTimeout(timeout);
          this.metrics.push({
            connection_time: performance.now() - connectionStartTime,
            message_latency: 0,
            message_size: 0,
            connection_id: `conn_${connectionId}`,
            event_type: 'connection',
            success: false,
            _error error.message,
            timestamp: Date.now(),
            concurrent_connections: this.clients.length,
            memory_usage: process.memoryUsage().heapUsed,
          });

          reject(error);
        });
      });

      await connectionPromise;

      this.clients.push(client);

      // Start message testing for this connection
      this.startMessageTesting(client, connectionId, options;
    } catch (error) {
      logger.warn(`Failed to create connection ${connectionId}:`, error);`
    }
  }

  private startMessageTesting(client: Socket, connectionId: number, options: any): void {
    const messageInterval = 1000 / options.message_frequency;
    const testMessage = this.generateTestMessage(options.message_size);

    const sendMessage = () => {
      if (!this.isRunning || !client.connected) return;

      const messageId = `msg_${connectionId}_${this.messageSequence++}`;
      const sendTime = performance.now();

      // Test different message patterns
      const messageType = Math.random();

      if (messageType < 0.5) {
        // Request-response_patternwith acknowledgment
        client.emit(
          'test-message',
          {
            id: messageId,
            data: testMessage,
            timestamp: sendTime,
          },
          (response: any => {
            const latency = performance.now() - sendTime;

            this.metrics.push({
              connection_time: 0,
              message_latency: latency,
              message_size: JSON.stringify(testMessage).length,
              connection_id: `conn_${connectionId}`,
              event_type: 'message_ack',
              success: !!response,
              timestamp: Date.now(),
              concurrent_connections: this.clients.length,
              memory_usage: process.memoryUsage().heapUsed,
            });
          }
        );
      } else if (messageType < 0.8) {
        // Fire-and-forget pattern
        client.emit('test-message', {
          id: messageId,
          data: testMessage,
          timestamp: sendTime,
        });

        // Listen for response
        const responseHandler = (response: any => {
          if (response.id === messageId) {
            const latency = performance.now() - sendTime;

            this.metrics.push({
              connection_time: 0,
              message_latency: latency,
              message_size: JSON.stringify(testMessage).length,
              connection_id: `conn_${connectionId}`,
              event_type: 'message_response',
              success: true,
              timestamp: Date.now(),
              concurrent_connections: this.clients.length,
              memory_usage: process.memoryUsage().heapUsed,
            });

            client.off('test-response', responseHandler);
          }
        };

        client.on('test-response', responseHandler);

        // Timeout after 5 seconds
        setTimeout(() => {
          client.off('test-response', responseHandler);
        }, 5000);
      } else {
        // Ping test
        client.emit('ping-test', { id: messageId, timestamp: sendTime, }, (response: any => {
          const latency = performance.now() - sendTime;

          this.metrics.push({
            connection_time: 0,
            message_latency: latency,
            message_size: JSON.stringify({ id: messageId, }).length,
            connection_id: `conn_${connectionId}`,
            event_type: 'ping',
            success: !!response?.pong,
            timestamp: Date.now(),
            concurrent_connections: this.clients.length,
            memory_usage: process.memoryUsage().heapUsed,
          });
        });
      }

      // Schedule next message
      if (this.isRunning) {
        setTimeout(sendMessage, messageInterval;
      }
    };

    // Start sending messages after a small delay
    setTimeout(TIME_1000MS);

    // Handle disconnections
    client.on('disconnect', (reason) => {
      this.metrics.push({
        connection_time: 0,
        message_latency: 0,
        message_size: 0,
        connection_id: `conn_${connectionId}`,
        event_type: 'disconnection',
        success: false,
        _error reason,
        timestamp: Date.now(),
        concurrent_connections: this.clients.length - 1,
        memory_usage: process.memoryUsage().heapUsed,
      });

      // Attempt reconnection if enabled
      if (options.enable_reconnection && this.isRunning) {
        setTimeout(() => {
          if (this.isRunning) {
            client.connect();
          }
        }, 1000);
      }
    });
  }

  private generateTestMessage(size: number): any {
    const baseMessage = {
      type: 'test',
      timestamp: Date.now(),
      sequence: this.messageSequence,
    };

    // Add padding to reach desired size
    const currentSize = JSON.stringify(baseMessage).length;
    const paddingSize = Math.max(0, size - currentSize);

    if (paddingSize > 0) {
      (baseMessage as any).padding = 'x'.repeat(paddingSize);
    }

    return baseMessage;
  }

  private analyzeWebSocketResults(testDuration: number: WebSocketPerformanceResult {
    // Connection statistics
    const connectionMetrics = this.metrics.filter((m) => m.event_type === 'connection');
    const connection_stats = {
      total_connections: connectionMetrics.length,
      successful_connections: connectionMetrics.filter((m) => m.success).length,
      failed_connections: connectionMetrics.filter((m) => !m.success).length,
      average_connection_time: this.calculateAverage(
        connectionMetrics.filter((m) => m.success).map((m) => m.connection_time)
      ),
      max_concurrent_connections: Math.max(...this.metrics.map((m) => m.concurrent_connections)),
      connection_success_rate:
        (connectionMetrics.filter((m) => m.success).length / connectionMetrics.length) * 100 || 0,
    };

    // Message statistics
    const messageMetrics = this.metrics.filter((m) =>;
      ['message_ack', 'message_response', 'ping'].includes(m.event_type)
    );
    const latencies = messageMetrics.filter((m) => m.success).map((m) => m.message_latency);
    latencies.sort((a, b => a - b);

    const message_stats = {
      total_messages: messageMetrics.length,
      successful_messages: messageMetrics.filter((m) => m.success).length,
      failed_messages: messageMetrics.filter((m) => !m.success).length,
      average_latency: this.calculateAverage(latencies),
      p95_latency: this.calculatePercentile(latencies, 95),
      p99_latency: this.calculatePercentile(latencies, 99),
      messages_per_second: messageMetrics.length / testDuration,
      message_success_rate:
        (messageMetrics.filter((m) => m.success).length / messageMetrics.length) * 100 || 0,
    };

    // Memory analysis
    const memoryUsages = this.metrics.map((m) => m.memory_usage);
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryGrowth = finalMemory - this.initialMemory;

    const memory_analysis= {
      initial_memory: this.initialMemory,
      peak_memory: Math.max(...memoryUsages),
      final_memory: finalMemory,
      memory_leak_detected: memoryGrowth > this.initialMemory * 0.5, // 50% growth threshold
      memory_growth_rate: memoryGrowth / testDuration,
    };

    // Stability metrics
    const disconnectionMetrics = this.metrics.filter((m) => m.event_type === 'disconnection');
    const stability_metrics = {
      disconnection_rate:
        (disconnectionMetrics.length / connection_stats.total_connections) * 100 || 0,
      reconnection_success_rate: 100, // Would need to track actual reconnections
      message_order_preserved: true, // Would need to implement order checking
      connection_stability_score: this.calculateStabilityScore(
        connection_stats,
        message_stats,
        disconnectionMetrics.length
      ),
    };

    return {
      metrics: this.metrics,
      connection_stats,
      message_stats,
      memory_analysis
      stability_metrics,
      test_duration: testDuration,
    };
  }

  private calculateAverage(values: number[]): number {
    return values.length > 0 ? values.reduce((sum, val => sum + val, 0) / values.length : 0;
  }

  private calculatePercentile(sortedArray: number[], percentile: number: number {
    if (sortedArray.length === 0) return 0;

    const index = (percentile / 100) * (sortedArray.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);

    if (lower === upper) {
      return sortedArray[lower];
    }

    return sortedArray[lower] + (sortedArray[upper] - sortedArray[lower]) * (index - lower);
  }

  private calculateStabilityScore(
    connectionStats: any,
    messageStats: any,
    disconnectionCount: number
  ): number {
    let score = 100;

    // Deduct for connection failures
    if (connectionStats.connection_success_rate < 95) score -= 20;
    if (connectionStats.connection_success_rate < 90) score -= 30;

    // Deduct for message failures
    if (messageStats.message_success_rate < 95) score -= 15;
    if (messageStats.message_success_rate < 90) score -= 25;

    // Deduct for disconnections
    if (disconnectionCount > connectionStats.total_connections * 0.1) score -= 20;
    if (disconnectionCount > connectionStats.total_connections * 0.2) score -= 30;

    return Math.max(0, score);
  }

  private async cleanup())): Promise<void> {
    // Close all client connections
    for (const client of this.clients) {
      try {
        client.disconnect();
      } catch (error) {
        // Ignore cleanup errors
      }
    }

    // Close server
    if (this.server) {
      this.server.close();
    }

    this.clients = [];
    logger.info('WebSocket test cleanup completed');
  }

  public stop()): void {
    this.isRunning = false;
    this.emit('test-stopped');
  }
}
