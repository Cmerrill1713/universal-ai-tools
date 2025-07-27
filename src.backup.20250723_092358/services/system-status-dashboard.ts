/**
 * Real-time System Status Dashboard Service
 *
 * Comprehensive real-time dashboard for Universal AI Tools with:
 * - Live system metrics and visualization
 * - Real-time alerts and notifications
 * - Performance trending and analytics
 * - Service topology and dependencies
 * - Interactive monitoring dashboards
 * - WebSocket-based real-time updates
 * - Custom dashboard configurations
 * - Mobile-responsive status displays
 */

import { EventEmitter } from 'events';
import { WebSocket, WebSocketServer } from 'ws';
import type { IncomingMessage } from 'http';
import { telemetryService } from './telemetry-service';
import { getAPMService } from './apm-service';
import { getErrorTrackingService } from './error tracking-service';
import { getHealthCheckService } from './health-check';
import { getDatabasePerformanceMonitor } from './database-performance-monitor';
import { LogContext, logger } from '../utils/enhanced-logger';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';

export interface DashboardConfig {
  enabled: boolean;
  websocketPort: number;
  updateInterval: number; // ms
  maxConnections: number;

  // Features
  realTimeMetrics: boolean;
  alertNotifications: boolean;
  performanceTrends: boolean;
  serviceTopology: boolean;

  // Data retention
  metricsRetention: {
    realTime: number; // seconds
    historical: number; // hours
    trends: number; // days
  };

  // Security
  authentication: boolean;
  rateLimiting: {
    connectionsPerIp: number;
    requestsPerMinute: number;
  };
}

export interface DashboardData {
  timestamp: Date;
  system: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    uptime: number;
    version: string;
    environment: string;
  };

  // Real-time metrics
  metrics: {
    cpu: {
      usage: number;
      cores: number;
      loadAverage: number[];
    };
    memory: {
      used: number;
      total: number;
      percentage: number;
      swap?: {
        used: number;
        total: number;
      };
    };
    disk: {
      used: number;
      total: number;
      percentage: number;
      iops?: {
        read: number;
        write: number;
      };
    };
    network: {
      bytesIn: number;
      bytesOut: number;
      packetsIn: number;
      packetsOut: number;
    };
  };

  // Application metrics
  application: {
    requests: {
      total: number;
      perMinute: number;
      averageResponseTime: number;
      errorRate: number;
    };
    database: {
      connections: number;
      queriesPerSecond: number;
      averageQueryTime: number;
      slowQueries: number;
    };
    cache: {
      hitRate: number;
      size: number;
      evictions: number;
    };
    errors: {
      total: number;
      perMinute: number;
      topErrors: Array<{
        message: string;
        count: number;
        lastSeen: Date;
      }>;
    };
  };

  // Service status
  services: Record<
    string,
    {
      status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
      responseTime: number;
      uptime: number;
      version?: string;
      dependencies: string[];
    }
  >;

  // Active alerts
  alerts: Array<{
    id: string;
    level: 'info' | 'warning' | '_error | 'critical';
    title: string;
    description: string;
    service?: string;
    timestamp: Date;
    acknowledged: boolean;
  }>;

  // Performance trends
  trends: {
    responseTime: Array<{ timestamp: Date; value: number }>;
    errorRate: Array<{ timestamp: Date; value: number }>;
    throughput: Array<{ timestamp: Date; value: number }>;
    systemLoad: Array<{ timestamp: Date; value: number }>;
  };
}

export interface DashboardWidget {
  id: string;
  type: 'metric' | 'chart' | 'table' | 'status' | 'alert' | 'custom';
  title: string;
  description?: string;

  // Widget configuration
  config: {
    dataSource: string;
    refreshInterval?: number;
    size: 'small' | 'medium' | 'large';
    position: { x: number; y: number; width: number; height: number };
  };

  // Data binding
  dataBinding: {
    metric?: string;
    filter?: Record<string, unknown>;
    aggregation?: 'sum' | 'avg' | 'min' | 'max' | 'count';
    timeRange?: string; // e.g., '1h', '24h', '7d'
  };

  // Visualization options
  visualization?: {
    chartType?: 'line' | 'bar' | 'pie' | 'gauge' | 'number';
    colors?: string[];
    thresholds?: Array<{ value: number; color: string; label?: string }>;
    unit?: string;
    decimals?: number;
  };
}

export interface DashboardLayout {
  id: string;
  name: string;
  description?: string;
  isDefault: boolean;

  // Layout configuration
  grid: {
    columns: number;
    rows: number;
    cellWidth: number;
    cellHeight: number;
  };

  // Widgets in this layout
  widgets: DashboardWidget[];

  // Access control
  visibility: 'public' | 'private' | 'team';
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ClientConnection {
  id: string;
  socket: WebSocket;
  ip: string;
  userAgent?: string;
  userId?: string;
  subscriptions: Set<string>; // Topics the client is subscribed to
  connectTime: Date;
  lastActivity: Date;
  rateLimitState: {
    requestCount: number;
    windowStart: number;
  };
}

export class SystemStatusDashboard extends EventEmitter {
  private config: DashboardConfig;
  private supabase: SupabaseClient;
  private wss?: WebSocketServer;
  private isStarted = false;
  private clients = new Map<string, ClientConnection>();
  private dashboardData: DashboardData | null = null;
  private updateInterval?: NodeJS.Timeout;
  private cleanupInterval?: NodeJS.Timeout;
  private dashboardLayouts = new Map<string, DashboardLayout>();
  private metricsHistory: Array<{ timestamp: Date; data: Partial<DashboardData> }> = [];

  constructor(supabaseUrl: string, supabaseKey: string, config: Partial<DashboardConfig> = {}) {
    super();

    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.config = {
      enabled: true,
      websocketPort: 9998,
      updateInterval: 5000, // 5 seconds
      maxConnections: 100,

      realTimeMetrics: true,
      alertNotifications: true,
      performanceTrends: true,
      serviceTopology: true,

      metricsRetention: {
        realTime: 300, // 5 minutes
        historical: 24, // 24 hours
        trends: 7, // 7 days
      },

      authentication: false, // Disabled for development
      rateLimiting: {
        connectionsPerIp: 10,
        requestsPerMinute: 100,
      },

      ...config,
    };

    this.setupDefaultLayouts();
  }

  /**
   * Start the dashboard service
   */
  async start(): Promise<void> {
    if (this.isStarted) {
      logger.warn('System status dashboard already started', LogContext.SYSTEM);
      return;
    }

    if (!this.config.enabled) {
      logger.info('System status dashboard disabled', LogContext.SYSTEM);
      return;
    }

    try {
      logger.info('Starting system status dashboard', LogContext.SYSTEM, { config: this.config });

      // Start WebSocket server
      await this.startWebSocketServer();

      // Start data collection
      await this.startDataCollection();

      // Start cleanup processes
      this.startCleanupProcesses();

      this.isStarted = true;
      this.emit('started', { config: this.config });

      logger.info('System status dashboard started successfully', LogContext.SYSTEM, {
        websocket_port: this.config.websocketPort,
      });
    } catch (error) {
      logger.error('Failed to start system status dashboard', LogContext.SYSTEM, { _error});
      throw error;
    }
  }

  /**
   * Stop the dashboard service
   */
  async stop(): Promise<void> {
    if (!this.isStarted) {
      logger.warn('System status dashboard not started', LogContext.SYSTEM);
      return;
    }

    try {
      logger.info('Stopping system status dashboard', LogContext.SYSTEM);

      // Stop intervals
      if (this.updateInterval) {
        clearInterval(this.updateInterval);
        this.updateInterval = undefined;
      }

      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
        this.cleanupInterval = undefined;
      }

      // Close all client connections
      this.clients.forEach((client) => {
        if (client.socket.readyState === WebSocket.OPEN) {
          client.socket.close(1001, 'Service shutting down');
        }
      });
      this.clients.clear();

      // Close WebSocket server
      if (this.wss) {
        this.wss.close();
        this.wss = undefined;
      }

      this.isStarted = false;
      this.emit('stopped');

      logger.info('System status dashboard stopped successfully', LogContext.SYSTEM);
    } catch (error) {
      logger.error('Error stopping system status dashboard', LogContext.SYSTEM, { _error});
      throw error;
    }
  }

  /**
   * Get current dashboard data
   */
  getCurrentData(): DashboardData | null {
    return this.dashboardData;
  }

  /**
   * Get dashboard layout by ID
   */
  getDashboardLayout(id: string): DashboardLayout | null {
    return this.dashboardLayouts.get(id) || null;
  }

  /**
   * Get all dashboard layouts
   */
  getAllDashboardLayouts(): DashboardLayout[] {
    return Array.from(this.dashboardLayouts.values());
  }

  /**
   * Create or update dashboard layout
   */
  saveDashboardLayout(layout: Omit<DashboardLayout, 'id' | 'createdAt' | 'updatedAt'>): string {
    const layoutId = this.generateId();
    const now = new Date();

    const fullLayout: DashboardLayout = {
      ...layout,
      id: layoutId,
      createdAt: now,
      updatedAt: now,
    };

    this.dashboardLayouts.set(layoutId, fullLayout);

    // Broadcast layout update to clients
    this.broadcast('layoutUpdated', fullLayout);

    logger.info('Dashboard layout saved', LogContext.SYSTEM, {
      layout_id: layoutId,
      name: layout.name,
      widgets: layout.widgets.length,
    });

    return layoutId;
  }

  /**
   * Delete dashboard layout
   */
  deleteDashboardLayout(id: string): boolean {
    const layout = this.dashboardLayouts.get(id);
    if (!layout) {
      return false;
    }

    this.dashboardLayouts.delete(id);

    // Broadcast layout deletion to clients
    this.broadcast('layoutDeleted', { id });

    logger.info('Dashboard layout deleted', LogContext.SYSTEM, { layout_id: id });
    return true;
  }

  /**
   * Get connected clients count
   */
  getConnectedClientsCount(): number {
    return this.clients.size;
  }

  /**
   * Get client statistics
   */
  getClientStatistics(): {
    totalClients: number;
    clientsByIp: Record<string, number>;
    averageConnectionTime: number;
    subscriptionCounts: Record<string, number>;
  } {
    const clientsByIp: Record<string, number> = {};
    let totalConnectionTime = 0;
    const subscriptionCounts: Record<string, number> = {};

    this.clients.forEach((client) => {
      // Count by IP
      clientsByIp[client.ip] = (clientsByIp[client.ip] || 0) + 1;

      // Calculate connection time
      totalConnectionTime += Date.now() - client.connectTime.getTime();

      // Count subscriptions
      client.subscriptions.forEach((sub) => {
        subscriptionCounts[sub] = (subscriptionCounts[sub] || 0) + 1;
      });
    });

    return {
      totalClients: this.clients.size,
      clientsByIp,
      averageConnectionTime: this.clients.size > 0 ? totalConnectionTime / this.clients.size : 0,
      subscriptionCounts,
    };
  }

  // Private methods

  private async startWebSocketServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.wss = new WebSocketServer({
          port: this.config.websocketPort,
          maxPayload: 1024 * 1024, // 1MB max payload
        });

        this.wss.on('connection', (ws: WebSocket, request IncomingMessage) => {
          this.handleNewConnection(ws, request;
        });

        this.wss.on('listening', () => {
          logger.info('WebSocket server started', LogContext.SYSTEM, {
            port: this.config.websocketPort,
          });
          resolve();
        });

        this.wss.on('_error, (error => {
          logger.error('WebSocket server error, LogContext.SYSTEM, { _error});
          reject(_error);
        });
      } catch (error) {
        reject(_error);
      }
    });
  }

  private handleNewConnection(ws: WebSocket, request IncomingMessage): void {
    const clientId = this.generateId();
    const clientIp = requestsocket.remoteAddress || 'unknown';
    const userAgent = requestheaders['user-agent'];

    // Check connection limits
    if (this.clients.size >= this.config.maxConnections) {
      ws.close(1008, 'Maximum connections exceeded');
      return;
    }

    // Check rate limiting by IP
    const ipConnections = Array.from(this.clients.values()).filter((c) => c.ip === clientIp).length;
    if (ipConnections >= this.config.rateLimiting.connectionsPerIp) {
      ws.close(1008, 'Too many connections from this IP');
      return;
    }

    const client: ClientConnection = {
      id: clientId,
      socket: ws,
      ip: clientIp,
      userAgent,
      subscriptions: new Set(),
      connectTime: new Date(),
      lastActivity: new Date(),
      rateLimitState: {
        requestCount: 0,
        windowStart: Date.now(),
      },
    };

    this.clients.set(clientId, client);

    logger.info('New dashboard client connected', LogContext.SYSTEM, {
      client_id: clientId,
      ip: clientIp,
      user_agent: userAgent,
      total_clients: this.clients.size,
    });

    // Setup event handlers
    ws.on('message', (data) => {
      this.handleClientMessage(clientId, data);
    });

    ws.on('close', (code, reason) => {
      this.handleClientDisconnect(clientId, code, reason);
    });

    ws.on('_error, (error => {
      logger.error('WebSocket client _error, LogContext.SYSTEM, {
        client_id: clientId,
        _error
      });
    });

    // Send initial data
    this.sendToClient(clientId, 'connected', {
      clientId,
      timestamp: new Date(),
      dashboardData: this.dashboardData,
      layouts: Array.from(this.dashboardLayouts.values()),
    });

    this.emit('clientConnected', client);
  }

  private handleClientMessage(clientId: string, data: Buffer): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Check rate limiting
    if (!this.checkRateLimit(client)) {
      client.socket.close(1008, 'Rate limit exceeded');
      return;
    }

    client.lastActivity = new Date();

    try {
      const message = JSON.parse(data.toString());

      switch (message.type) {
        case 'subscribe':
          this.handleSubscription(clientId, message.topics);
          break;

        case 'unsubscribe':
          this.handleUnsubscription(clientId, message.topics);
          break;

        case 'getLayout':
          this.handleGetLayout(clientId, message.layoutId);
          break;

        case 'saveLayout':
          this.handleSaveLayout(clientId, message.layout);
          break;

        case 'ping':
          this.sendToClient(clientId, 'pong', { timestamp: new Date() });
          break;

        default:
          logger.warn('Unknown message type from client', LogContext.SYSTEM, {
            client_id: clientId,
            message_type: message.type,
          });
      }
    } catch (error) {
      logger.error('Error parsing client message', LogContext.SYSTEM, {
        client_id: clientId,
        _error
      });
    }
  }

  private handleClientDisconnect(clientId: string, code: number, reason: Buffer): void {
    const client = this.clients.get(clientId);
    if (client) {
      const connectionDuration = Date.now() - client.connectTime.getTime();

      logger.info('Dashboard client disconnected', LogContext.SYSTEM, {
        client_id: clientId,
        ip: client.ip,
        code,
        reason: reason.toString(),
        connection_duration_ms: connectionDuration,
        remaining_clients: this.clients.size - 1,
      });

      this.clients.delete(clientId);
      this.emit('clientDisconnected', client);
    }
  }

  private handleSubscription(clientId: string, topics: string[]): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    topics.forEach((topic) => client.subscriptions.add(topic));

    this.sendToClient(clientId, 'subscribed', { topics });

    logger.debug('Client subscribed to topics', LogContext.SYSTEM, {
      client_id: clientId,
      topics,
      total_subscriptions: client.subscriptions.size,
    });
  }

  private handleUnsubscription(clientId: string, topics: string[]): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    topics.forEach((topic) => client.subscriptions.delete(topic));

    this.sendToClient(clientId, 'unsubscribed', { topics });

    logger.debug('Client unsubscribed from topics', LogContext.SYSTEM, {
      client_id: clientId,
      topics,
      remaining_subscriptions: client.subscriptions.size,
    });
  }

  private handleGetLayout(clientId: string, layoutId: string): void {
    const layout = this.dashboardLayouts.get(layoutId);

    this.sendToClient(clientId, 'layout', {
      layout: layout || null,
      layoutId,
    });
  }

  private handleSaveLayout(clientId: string, layout: any): void {
    try {
      const layoutId = this.saveDashboardLayout(layout);

      this.sendToClient(clientId, 'layoutSaved', {
        layoutId,
        success: true,
      });
    } catch (error) {
      this.sendToClient(clientId, 'layoutSaved', {
        success: false,
        _error error instanceof Error ? error.message : 'Unknown error,
      });
    }
  }

  private checkRateLimit(client: ClientConnection): boolean {
    const now = Date.now();
    const windowDuration = 60000; // 1 minute

    // Reset window if needed
    if (now - client.rateLimitState.windowStart > windowDuration) {
      client.rateLimitState.requestCount = 0;
      client.rateLimitState.windowStart = now;
    }

    client.rateLimitState.requestCount++;

    return client.rateLimitState.requestCount <= this.config.rateLimiting.requestsPerMinute;
  }

  private sendToClient(clientId: string, type: string, data: any): void {
    const client = this.clients.get(clientId);
    if (!client || client.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      const message = JSON.stringify({
        type,
        timestamp: new Date(),
        data,
      });

      client.socket.send(message);
    } catch (error) {
      logger.error('Error sending message to client', LogContext.SYSTEM, {
        client_id: clientId,
        _error
      });
    }
  }

  private broadcast(type: string, data: any, topicFilter?: string): void {
    const message = JSON.stringify({
      type,
      timestamp: new Date(),
      data,
    });

    this.clients.forEach((client) => {
      if (client.socket.readyState === WebSocket.OPEN) {
        // Check topic subscription if filter provided
        if (topicFilter && !client.subscriptions.has(topicFilter)) {
          return;
        }

        try {
          client.socket.send(message);
        } catch (error) {
          logger.error('Error broadcasting to client', LogContext.SYSTEM, {
            client_id: client.id,
            _error
          });
        }
      }
    });
  }

  private async startDataCollection(): Promise<void> {
    // Initial data collection
    await this.collectDashboardData();

    // Start periodic updates
    this.updateInterval = setInterval(async () => {
      try {
        await this.collectDashboardData();

        // Broadcast to subscribed clients
        this.broadcast('dashboardUpdate', this.dashboardData, 'metrics');
      } catch (error) {
        logger.error('Error collecting dashboard data', LogContext.SYSTEM, { _error});
      }
    }, this.config.updateInterval);
  }

  private async collectDashboardData(): Promise<void> {
    const timestamp = new Date();

    try {
      // Get health check service data
      const healthCheckService = getHealthCheckService();
      const healthData = await healthCheckService?.checkHealth();

      // Get APM service data
      const apmService = getAPMService();
      const apmMetrics = apmService?.getCurrentMetrics();

      // Get error tracking data
      const errorTrackingService = getErrorTrackingService();
      const errorStats = errorTrackingService?.getErrorStats(5); // Last 5 minutes

      // Get database performance data
      const dbMonitor = getDatabasePerformanceMonitor();
      const dbHealth = await dbMonitor?.getDatabaseHealth();

      // Collect system metrics
      const systemMetrics = this.collectSystemMetrics();

      // Collect application metrics
      const applicationMetrics = this.collectApplicationMetrics(apmMetrics, dbHealth);

      // Collect service status
      const serviceStatus = this.collectServiceStatus(healthData);

      // Collect alerts
      const alerts = this.collectAlerts(healthData, errorStats);

      // Update trends
      const trends = this.updateTrends(systemMetrics, applicationMetrics);

      this.dashboardData = {
        timestamp,
        system: {
          status: healthData?.status || 'unknown',
          uptime: process.uptime(),
          version: process.env.npm_package_version || '1.0.0',
          environment: process.env.NODE_ENV || 'development',
        },
        metrics: systemMetrics,
        application: applicationMetrics,
        services: serviceStatus,
        alerts,
        trends,
      };

      // Store in history
      this.storeMetricsHistory();

      this.emit('dataCollected', this.dashboardData);
    } catch (error) {
      logger.error('Error collecting dashboard data', LogContext.SYSTEM, { _error});

      // Create minimal dashboard data on error
      this.dashboardData = {
        timestamp,
        system: {
          status: 'unhealthy',
          uptime: process.uptime(),
          version: process.env.npm_package_version || '1.0.0',
          environment: process.env.NODE_ENV || 'development',
        },
        metrics: this.collectSystemMetrics(),
        application: {
          requests: { total: 0, perMinute: 0, averageResponseTime: 0, errorRate: 0 },
          database: { connections: 0, queriesPerSecond: 0, averageQueryTime: 0, slowQueries: 0 },
          cache: { hitRate: 0, size: 0, evictions: 0 },
          errors: { total: 0, perMinute: 0, topErrors: [] },
        },
        services: {},
        alerts: [],
        trends: {
          responseTime: [],
          errorRate: [],
          throughput: [],
          systemLoad: [],
        },
      };
    }
  }

  private collectSystemMetrics(): DashboardData['metrics'] {
    const memUsage = process.memoryUsage();
    const totalMem = require('os').totalmem();
    const freeMem = require('os').freemem();
    const loadAvg = require('os').loadavg();
    const cpus = require('os').cpus();

    return {
      cpu: {
        usage: (loadAvg[0] / cpus.length) * 100,
        cores: cpus.length,
        loadAverage: loadAvg,
      },
      memory: {
        used: totalMem - freeMem,
        total: totalMem,
        percentage: ((totalMem - freeMem) / totalMem) * 100,
      },
      disk: {
        used: 0, // Would need disk monitoring
        total: 0, // Would need disk monitoring
        percentage: 0,
      },
      network: {
        bytesIn: 0, // Would need network monitoring
        bytesOut: 0, // Would need network monitoring
        packetsIn: 0, // Would need network monitoring
        packetsOut: 0, // Would need network monitoring
      },
    };
  }

  private collectApplicationMetrics(apmMetrics: any, dbHealth: any): DashboardData['application'] {
    return {
      requests: {
        total: apmMetrics?.totalTransactions || 0,
        perMinute: apmMetrics?.averageResponseTime || 0,
        averageResponseTime: apmMetrics?.averageResponseTime || 0,
        errorRate: apmMetrics?.errorRate || 0,
      },
      database: {
        connections: 0, // Would get from connection pool
        queriesPerSecond: dbHealth?.queryThroughput || 0,
        averageQueryTime: dbHealth?.averageQueryTime || 0,
        slowQueries: dbHealth?.slowQueries || 0,
      },
      cache: {
        hitRate: dbHealth?.cacheHitRatio || 0,
        size: 0, // Would get from cache service
        evictions: 0, // Would get from cache service
      },
      errors: {
        total: 0, // Would get from error tracking
        perMinute: 0, // Would get from error tracking
        topErrors: [], // Would get from error tracking
      },
    };
  }

  private collectServiceStatus(healthData: any): DashboardData['services'] {
    const services: DashboardData['services'] = {};

    if (healthData?.services) {
      Object.entries(healthData.services).forEach(([name, service]: [string, any]) => {
        services[name] = {
          status: service.status || 'unknown',
          responseTime: 0, // Would calculate from health check timing
          uptime: 0, // Would calculate from service uptime
          dependencies: [], // Would map from service dependencies
        };
      });
    }

    return services;
  }

  private collectAlerts(healthData: any, errorStats: any): DashboardData['alerts'] {
    const alerts: DashboardData['alerts'] = [];

    // Add health check alerts
    if (healthData?.alerts) {
      healthData.alerts.forEach((alert: any) => {
        alerts.push({
          id: this.generateId(),
          level: alert.level,
          title: 'Health Check Alert',
          description: alert.message,
          service: alert.service,
          timestamp: new Date(alert.timestamp),
          acknowledged: false,
        });
      });
    }

    // Add _erroralerts (would get from error tracking service)
    // This is simplified - real implementation would get actual alerts

    return alerts;
  }

  private updateTrends(
    systemMetrics: DashboardData['metrics'],
    applicationMetrics: DashboardData['application']
  ): DashboardData['trends'] {
    const timestamp = new Date();
    const maxTrendPoints = 288; // 24 hours worth of 5-minute intervals

    // Initialize trends if not exists
    if (!this.dashboardData?.trends) {
      return {
        responseTime: [{ timestamp, value: applicationMetrics.requests.averageResponseTime }],
        errorRate: [{ timestamp, value: applicationMetrics.requests.errorRate }],
        throughput: [{ timestamp, value: applicationMetrics.requests.perMinute }],
        systemLoad: [{ timestamp, value: systemMetrics.cpu.usage }],
      };
    }

    const { trends } = this.dashboardData;

    // Add new data points
    trends.responseTime.push({ timestamp, value: applicationMetrics.requests.averageResponseTime });
    trends.errorRate.push({ timestamp, value: applicationMetrics.requests.errorRate });
    trends.throughput.push({ timestamp, value: applicationMetrics.requests.perMinute });
    trends.systemLoad.push({ timestamp, value: systemMetrics.cpu.usage });

    // Trim to max points
    trends.responseTime = trends.responseTime.slice(-maxTrendPoints);
    trends.errorRate = trends.errorRate.slice(-maxTrendPoints);
    trends.throughput = trends.throughput.slice(-maxTrendPoints);
    trends.systemLoad = trends.systemLoad.slice(-maxTrendPoints);

    return trends;
  }

  private storeMetricsHistory(): void {
    if (!this.dashboardData) return;

    this.metricsHistory.push({
      timestamp: this.dashboardData.timestamp,
      data: {
        metrics: this.dashboardData.metrics,
        application: this.dashboardData.application,
      },
    });

    // Keep only recent history based on retention settings
    const retentionMs = this.config.metricsRetention.historical * 60 * 60 * 1000; // hours to ms
    const cutoffTime = new Date(Date.now() - retentionMs);

    this.metricsHistory = this.metricsHistory.filter((h) => h.timestamp > cutoffTime);
  }

  private startCleanupProcesses(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveClients();
      this.cleanupOldMetrics();
    }, 60000); // Every minute
  }

  private cleanupInactiveClients(): void {
    const inactivityTimeout = 300000; // 5 minutes
    const now = Date.now();

    this.clients.forEach((client, clientId) => {
      if (now - client.lastActivity.getTime() > inactivityTimeout) {
        logger.info('Disconnecting inactive client', LogContext.SYSTEM, {
          client_id: clientId,
          inactive_duration_ms: now - client.lastActivity.getTime(),
        });

        client.socket.close(1001, 'Client inactive');
        this.clients.delete(clientId);
      }
    });
  }

  private cleanupOldMetrics(): void {
    const retentionMs = this.config.metricsRetention.trends * 24 * 60 * 60 * 1000; // days to ms
    const cutoffTime = new Date(Date.now() - retentionMs);

    this.metricsHistory = this.metricsHistory.filter((h) => h.timestamp > cutoffTime);
  }

  private setupDefaultLayouts(): void {
    // Create default system overview layout
    const systemOverviewLayout: DashboardLayout = {
      id: 'system-overview',
      name: 'System Overview',
      description: 'Comprehensive system monitoring dashboard',
      isDefault: true,
      grid: {
        columns: 12,
        rows: 8,
        cellWidth: 100,
        cellHeight: 100,
      },
      widgets: [
        {
          id: 'system-status',
          type: 'status',
          title: 'System Status',
          config: {
            dataSource: 'system',
            size: 'medium',
            position: { x: 0, y: 0, width: 3, height: 2 },
          },
          dataBinding: {
            metric: 'system.status',
          },
        },
        {
          id: 'cpu-usage',
          type: 'chart',
          title: 'CPU Usage',
          config: {
            dataSource: 'metrics',
            size: 'medium',
            position: { x: 3, y: 0, width: 3, height: 2 },
          },
          dataBinding: {
            metric: 'metrics.cpu.usage',
            timeRange: '1h',
          },
          visualization: {
            chartType: 'line',
            unit: '%',
            thresholds: [
              { value: 80, color: 'orange', label: 'High' },
              { value: 90, color: 'red', label: 'Critical' },
            ],
          },
        },
        {
          id: 'memory-usage',
          type: 'chart',
          title: 'Memory Usage',
          config: {
            dataSource: 'metrics',
            size: 'medium',
            position: { x: 6, y: 0, width: 3, height: 2 },
          },
          dataBinding: {
            metric: 'metrics.memory.percentage',
            timeRange: '1h',
          },
          visualization: {
            chartType: 'line',
            unit: '%',
            thresholds: [
              { value: 80, color: 'orange', label: 'High' },
              { value: 90, color: 'red', label: 'Critical' },
            ],
          },
        },
        {
          id: 'active-alerts',
          type: 'alert',
          title: 'Active Alerts',
          config: {
            dataSource: 'alerts',
            size: 'medium',
            position: { x: 9, y: 0, width: 3, height: 2 },
          },
          dataBinding: {
            metric: 'alerts',
          },
        },
      ],
      visibility: 'public',
      createdBy: 'system',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.dashboardLayouts.set('system-overview', systemOverviewLayout);
  }

  private generateId(): string {
    return (
      Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    );
  }
}

// Create singleton instance
let systemStatusDashboard: SystemStatusDashboard | null = null;

export function getSystemStatusDashboard(
  supabaseUrl?: string,
  supabaseKey?: string,
  config?: Partial<DashboardConfig>
): SystemStatusDashboard {
  if (!systemStatusDashboard) {
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase URL and key required to initialize system status dashboard');
    }
    systemStatusDashboard = new SystemStatusDashboard(supabaseUrl, supabaseKey, config);
  }
  return systemStatusDashboard;
}

export default SystemStatusDashboard;
