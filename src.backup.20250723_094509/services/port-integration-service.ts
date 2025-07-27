/**
 * Port Integration Service
 *
 * Integrates the SmartPortManager and PortHealthMonitor with the existing
 * server infrastructure to provide comprehensive port management capabilities.
 *
 * Features:
 * - Automatic port discovery and configuration
 * - Real-time health monitoring integration
 * - WebSocket support for live port status updates
 * - Integration with existing Supabase configuration
 * - Service startup coordination
 */

import type { PortConfiguration, ServiceConfig } from '../utils/smart-port-manager';
import { SmartPortManager } from '../utils/smart-port-manager';
import type { PortHealthMonitor } from './port-health-monitor';
import { MonitoringConfig, createPortHealthMonitor } from './port-health-monitor';
import { SupabaseService } from './supabase_service';
import { logger } from '../utils/logger';
import { WebSocket, WebSocketServer } from 'ws';
import type { Server } from 'http';
import { createServer } from 'http';
import { config } from '../config';
import { BATCH_SIZE_10, HTTP_200, HTTP_400, HTTP_401, HTTP_404, HTTP_500, MAX_ITEMS_100, PERCENT_10, PERCENT_100, PERCENT_20, PERCENT_30, PERCENT_50, PERCENT_80, PERCENT_90, TIME_10000MS, TIME_1000MS, TIME_2000MS, TIME_5000MS, TIME_500MS, ZERO_POINT_EIGHT, ZERO_POINT_FIVE, ZERO_POINT_NINE } from "../utils/common-constants";

export interface PortIntegrationConfig {
  enableAutoDiscovery: boolean;
  enableHealthMonitoring: boolean;
  enableWebSocketBroadcast: boolean;
  monitoringInterval: number;
  autoResolveConflicts: boolean;
  persistConfiguration: boolean;
  customServices?: ServiceConfig[];
}

export interface ServiceStartupResult {
  service: string;
  port: number;
  status: 'success' | 'failed' | 'conflict_resolved';
  originalPort?: number;
  error: string;
}

export interface PortSystemStatus {
  smartPortManager: {
    initialized: boolean;
    servicesConfigured: number;
    activeMonitoring: boolean;
  };
  healthMonitor: {
    initialized: boolean;
    monitoring: boolean;
    activeClients: number;
    healthScore: number;
  };
  services: Array<{
    name: string;
    port: number;
    status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
    lastChecked: Date;
  }>;
  webSocket: {
    enabled: boolean;
    clients: number;
  };
}

export class PortIntegrationService {
  private portManager: SmartPortManager;
  private healthMonitor: PortHealthMonitor;
  private supabaseService: SupabaseService;
  private config: PortIntegrationConfig;
  private webSocketServer?: WebSocketServer;
  private httpServer?: Server;
  private isInitialized = false;
  private startupResults: ServiceStartupResult[] = [];

  constructor(customConfig: Partial<PortIntegrationConfig> = {}, customServices?: ServiceConfig[]) {
    this.config = {
      enableAutoDiscovery: true,
      enableHealthMonitoring: true,
      enableWebSocketBroadcast: true,
      monitoringInterval: 30000,
      autoResolveConflicts: true,
      persistConfiguration: true,
      ...customConfig,
    };

    // Initialize port manager
    this.portManager = new SmartPortManager(customServices);

    // Initialize Supabase service
    this.supabaseService = SupabaseService.getInstance();

    // Initialize health monitor
    this.healthMonitor = createPortHealthMonitor(
      this.portManager,
      config.database.supabaseUrl,
      config.database.supabaseServiceKey || '',
      {
        interval: this.config.monitoringInterval,
        enableWebSocket: this.config.enableWebSocketBroadcast,
        persistMetrics: this.config.persistConfiguration,
        healthCheckTimeout: 5000,
        retryAttempts: 3,
        alertCooldown: 300000,
        maxHistoryAge: 30,
      }
    );

    this.setupEventListeners();
  }

  /**
   * Initialize the entire port management system
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Port integration service is already initialized');
      return;
    }

    try {
      logger.info('🚀 Initializing Port Integration Service...');

      // Step 1: Auto-discover existing services
      if (this.config.enableAutoDiscovery) {
        await this.performServiceDiscovery();
      }

      // Step 2: Generate optimal port configuration
      if (this.config.autoResolveConflicts) {
        await this.generateAndApplyOptimalConfiguration();
      }

      // Step 3: Initialize health monitoring
      if (this.config.enableHealthMonitoring) {
        await this.healthMonitor.startMonitoring();
        logger.info('✅ Health monitoring started');
      }

      // Step 4: Setup WebSocket server for real-time updates
      if (this.config.enableWebSocketBroadcast) {
        await this.setupWebSocketServer();
        logger.info('✅ WebSocket server initialized');
      }

      // Step 5: Persist configuration if enabled
      if (this.config.persistConfiguration) {
        await this.persistCurrentConfiguration();
      }

      this.isInitialized = true;
      logger.info('🎉 Port Integration Service initialized successfully');

      // Emit initialization complete event
      this.portManager.emit('integrationServiceInitialized', {
        timestamp: new Date(),
        config: this.config,
        servicesConfigured: this.startupResults.length,
      });
    } catch (error) {
      logger.error('Failed to initialize Port Integration Service:', error);
      throw error;
    }
  }

  /**
   * Perform automatic service discovery
   */
  async performServiceDiscovery(): Promise<Map<string, any>> {
    logger.info('🔍 Performing service discovery...');

    try {
      // Use a timeout wrapper to prevent hanging
      const discoveryTimeout = 5000; // 5 seconds max for discovery
      const discoveryPromise = this.portManager.discoverServices();

      const discoveredServices = await Promise.race([
        discoveryPromise,
        new Promise<Map<string, any>>((_, reject) =>
          setTimeout(() => reject(new Error('Service discovery timeout')), discoveryTimeout)
        ),
      ]).catch((error => {
        logger.warn('Service discovery timed out or failed, using empty map:', error.message);
        return new Map();
      });

      logger.info(`Found ${discoveredServices.size} active services`);

      // Log discovered services
      for (const [serviceName, status] of discoveredServices) {
        logger.info(`  📦 ${serviceName}: port ${status.port} (${status.healthStatus})`);

        this.startupResults.push({
          service: serviceName,
          port: status.port,
          status: status.healthStatus === 'healthy' ? 'success' : 'failed',
        });
      }

      return discoveredServices;
    } catch (error) {
      logger.error('Service discovery failed:', error);
      // Return empty map instead of throwing to prevent startup failure
      return new Map();
    }
  }

  /**
   * Generate and apply optimal port configuration
   */
  async generateAndApplyOptimalConfiguration(): Promise<PortConfiguration> {
    logger.info('⚙️ Generating optimal port configuration...');

    try {
      const optimalConfig = await this.portManager.generateOptimalPortConfig();

      // Log: any port conflicts that were resolved
      if (optimalConfig.conflicts.length > 0) {
        logger.info('🔧 Resolved port conflicts:');
        for (const conflict of optimalConfig.conflicts) {
          logger.info(`  🔀 ${conflict.service}: ${conflict.port} → ${conflict.resolvedTo}`);

          // Update startup results
          const existingResult = this.startupResults.find((r) => r.service === conflict.service);
          if (existingResult) {
            existingResult.status = 'conflict_resolved';
            existingResult.originalPort = conflict.port;
            existingResult.port = conflict.resolvedTo;
          } else {
            this.startupResults.push({
              service: conflict.service,
              port: conflict.resolvedTo,
              originalPort: conflict.port,
              status: 'conflict_resolved',
            });
          }
        }
      }

      await this.portManager.savePortConfiguration(optimalConfig);
      logger.info('✅ Optimal port configuration applied and saved');

      return optimalConfig;
    } catch (error) {
      logger.error('Failed to generate optimal configuration:', error);
      throw error;
    }
  }

  /**
   * Setup WebSocket server for real-time port status updates
   */
  async setupWebSocketServer(): Promise<void> {
    if (!this.httpServer) {
      // Create a minimal HTTP server for WebSocket upgrade
      this.httpServer = createServer();
    }

    this.webSocketServer = new WebSocketServer({
      server: this.httpServer,
      path: '/ws/port-status',
    });

    this.webSocketServer.on('connection', (ws: WebSocket) => {
      logger.info('WebSocket client connected to port status updates');

      // Subscribe client to health updates
      this.healthMonitor.subscribeToHealthUpdates(ws);

      // Send initial port system status
      this.sendPortSystemStatus(ws);

      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());
          this.handleWebSocketMessage(ws, data);
        } catch (error) {
          logger.error('Invalid WebSocket message:', error);
          ws.send(JSON.stringify({ error: 'Invalid message format' }));
        }
      });

      ws.on('close', () => {
        logger.info('WebSocket client disconnected from port status updates');
      });
    });

    logger.info('WebSocket server setup complete for port status updates');
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleWebSocketMessage(ws: WebSocket, data: any): void {
    switch (data.type) {
      case 'get_port_status':
        this.sendPortSystemStatus(ws);
        break;

      case 'request_health_check':
        this.triggerHealthCheck(data.service);
        break;

      case 'resolve_port_conflict':
        this.resolveSpecificPortConflict(data.service, data.requestedPort);
        break;

      default:
        ws.send(JSON.stringify({ error: 'Unknown message type' }));
    }
  }

  /**
   * Send current port system status to WebSocket client
   */
  private sendPortSystemStatus(ws: WebSocket): void {
    const status = this.getPortSystemStatus();
    ws.send(
      JSON.stringify({
        type: 'port_system_status',
        timestamp: new Date().toISOString(),
        status,
      })
    );
  }

  /**
   * Get comprehensive port system status
   */
  getPortSystemStatus(): PortSystemStatus {
    const overallHealth = this.healthMonitor.getOverallHealth();
    const monitoringStats = this.healthMonitor.getMonitoringStats();

    return {
      smartPortManager: {
        initialized: this.isInitialized,
        servicesConfigured: this.startupResults.length,
        activeMonitoring: monitoringStats.isMonitoring,
      },
      healthMonitor: {
        initialized: true,
        monitoring: monitoringStats.isMonitoring,
        activeClients: monitoringStats.webSocketClients,
        healthScore: overallHealth.score,
      },
      services: this.startupResults.map((result) => ({
        name: result.service,
        port: result.port,
        status:
          result.status === 'success'
            ? 'healthy'
            : result.status === 'conflict_resolved'
              ? 'healthy'
              : 'unhealthy',
        lastChecked: new Date(),
      })),
      webSocket: {
        enabled: this.config.enableWebSocketBroadcast,
        clients: monitoringStats.webSocketClients,
      },
    };
  }

  /**
   * Get startup results for analysis
   */
  getStartupResults(): ServiceStartupResult[] {
    return [...this.startupResults];
  }

  /**
   * Trigger manual health check for a specific service
   */
  async triggerHealthCheck(serviceName?: string): Promise<void> {
    const HEALTH_CHECK_TIMEOUT = 10000; // 10 seconds timeout

    try {
      if (serviceName) {
        const metric = await Promise.race([
          this.healthMonitor.monitorServiceHealth(serviceName),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Health check timeout')), HEALTH_CHECK_TIMEOUT)
          ),
        ]);
        logger.info(`Health check for ${serviceName}: ${metric.status}`);
      } else {
        // Trigger health checks for all known services with timeout
        const servicesPromise = this.portManager.discoverServices();
        const services = await Promise.race([
          servicesPromise,
          new Promise<Map<string, any>>((_, reject) =>
            setTimeout(TIME_500MS0)
          ),
        ]).catch(() => new Map());

        // Limit concurrent health checks and add timeout
        const MAX_CONCURRENT_CHECKS = 5;
        const servicesToCheck = Array.from(services.keys());
        const results = [];

        for (let i = 0; i < servicesToCheck.length; i += MAX_CONCURRENT_CHECKS) {
          const batch = servicesToCheck.slice(i, i + MAX_CONCURRENT_CHECKS);
          const batchResults = await Promise.allSettled(
            batch.map((service) =>
              Promise.race([
                this.healthMonitor.monitorServiceHealth(service),
                new Promise((_, reject) =>
                  setTimeout(
                    () => reject(new Error(`Health check timeout for ${service}`)),
                    HEALTH_CHECK_TIMEOUT
                  )
                ),
              ])
            )
          );
          results.push(...batchResults);
        }

        const successful = results.filter((r) => r.status === 'fulfilled').length;
        logger.info(
          `Full health check completed: ${successful}/${results.length} services checked successfully`
        );
      }
    } catch (error) {
      logger.error('Health check failed:', error);
      throw error;
    }
  }

  /**
   * Resolve a specific port conflict
   */
  async resolveSpecificPortConflict(service: string, requestedPort: number): Promise<number> {
    const RESOLVE_TIMEOUT = 5000; // 5 seconds timeout

    try {
      const resolvedPort = await Promise.race([
        this.portManager.resolvePortConflict(service, requestedPort),
        new Promise<number>((_, reject) =>
          setTimeout(() => reject(new Error('Port conflict resolution timeout')), RESOLVE_TIMEOUT)
        ),
      ]);

      // Update startup results
      const existingResult = this.startupResults.find((r) => r.service === service);
      if (existingResult) {
        existingResult.originalPort = existingResult.port;
        existingResult.port = resolvedPort;
        existingResult.status = 'conflict_resolved';
      }

      logger.info(`Port conflict resolved for ${service}: ${requestedPort} → ${resolvedPort}`);
      return resolvedPort;
    } catch (error) {
      logger.error(Failed to resolve port conflict for ${service}:`, error);
      throw error;
    }
  }

  /**
   * Persist current configuration to Supabase
   */
  async persistCurrentConfiguration(): Promise<void> {
    const PERSIST_TIMEOUT = 10000; // 10 seconds timeout

    try {
      const configPromise = this.portManager.loadPortConfiguration();
      const config = await Promise.race([
        configPromise,
        new Promise<PortConfiguration | null>((_, reject) =>
          setTimeout(() => reject(new Error('Configuration load timeout')), PERSIST_TIMEOUT)
        ),
      ]);

      if (config) {
        await Promise.race([
          this.supabaseService.insert('port_configurations', {
            configuration: config,
            startup_results: this.startupResults,
            system_status: this.getPortSystemStatus(),
            created_at: new Date().toISOString(),
          }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Database persist timeout')), PERSIST_TIMEOUT)
          ),
        ]);

        logger.info('Port configuration persisted to database');
      }
    } catch (error) {
      logger.error('Failed to persist configuration:', error);
      // Don't throw - this is a non-critical operation
    }
  }

  /**
   * Setup event listeners for port manager and health monitor events
   */
  private setupEventListeners(): void {
    // Port Manager Events
    this.portManager.on('portConflictResolved', (event) => {
      logger.info(`Port conflict resolved: ${event.service} ${event.original} → ${event.resolved}`);
      this.broadcastToWebSocketClients({
        type: 'port_conflict_resolved',
        timestamp: new Date().toISOString(),
        event,
      });
    });

    this.portManager.on('portStatusChanged', (event) => {
      logger.info(
        `Port status changed: ${event.service} port ${event.port} ${event.previousStatus} → ${event.newStatus}`
      );
      this.broadcastToWebSocketClients({
        type: 'port_status_changed',
        timestamp: new Date().toISOString(),
        event,
      });
    });

    // Health Monitor Events
    this.healthMonitor.on('alertCreated', (alert) => {
      logger.warn(`Health alert: ${alert.type} - ${alert.message}`);
      this.broadcastToWebSocketClients({
        type: 'health_alert',
        timestamp: new Date().toISOString(),
        alert,
      });
    });

    this.healthMonitor.on('healthCheckCompleted', (event) => {
      this.broadcastToWebSocketClients({
        type: 'health_check_completed',
        timestamp: new Date().toISOString(),
        results: event.results,
      });
    });
  }

  /**
   * Broadcast message to all connected WebSocket clients
   */
  private broadcastToWebSocketClients(message: any): void {
    if (this.webSocketServer) {
      this.webSocketServer.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          try {
            client.send(JSON.stringify(message));
          } catch (error) {
            logger.error('Failed to broadcast WebSocket message:', error);
          }
        }
      });
    }
  }

  /**
   * Gracefully shutdown the port integration service
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down Port Integration Service...');

    try {
      // Stop health monitoring
      if (this.healthMonitor) {
        await this.healthMonitor.stopMonitoring();
      }

      // Stop port monitoring
      if (this.portManager) {
        this.portManager.stopMonitoring();
      }

      // Close WebSocket server
      if (this.webSocketServer) {
        this.webSocketServer.close();
      }

      // Close HTTP server
      if (this.httpServer) {
        this.httpServer.close();
      }

      this.isInitialized = false;
      logger.info('✅ Port Integration Service shutdown complete');
    } catch (error) {
      logger.error('Error during Port Integration Service shutdown:', error);
      throw error;
    }
  }

  /**
   * Generate comprehensive port management report
   */
  async generatePortManagementReport(): Promise<unknown> {
    const healthReport = await this.healthMonitor.generateHealthReport();
    const systemStatus = this.getPortSystemStatus();
    const startupResults = this.getStartupResults();

    return {
      timestamp: new Date().toISOString(),
      systemStatus,
      healthReport,
      startupResults,
      configuration: this.config,
      summary: {
        totalServices: startupResults.length,
        successfulStartups: startupResults.filter((r) => r.status === 'success').length,
        conflictsResolved: startupResults.filter((r) => r.status === 'conflict_resolved').length,
        failures: startupResults.filter((r) => r.status === 'failed').length,
        overallHealthScore: healthReport.healthScore,
        monitoringActive: systemStatus.healthMonitor.monitoring,
      },
    };
  }
}

// Export singleton instance for application use
export const portIntegrationService = new PortIntegrationService();

// Export utility functions for easy integration
export async function initializePortSystem(
  customConfig?: Partial<PortIntegrationConfig>
): Promise<PortIntegrationService> {
  const service = new PortIntegrationService(customConfig);
  await service.initialize();
  return service;
}

export async function getPortSystemStatus(): Promise<PortSystemStatus> {
  return portIntegrationService.getPortSystemStatus();
}

export async function generatePortReport(): Promise<unknown> {
  return portIntegrationService.generatePortManagementReport();
}
