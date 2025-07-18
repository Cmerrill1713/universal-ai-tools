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

import { SmartPortManager, ServiceConfig, PortConfiguration } from '../utils/smart-port-manager';
import { PortHealthMonitor, createPortHealthMonitor, MonitoringConfig } from './port-health-monitor';
import { SupabaseService } from './supabase_service';
import { logger } from '../utils/logger';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer, Server } from 'http';
import { config } from '../config';

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
  error?: string;
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
  private isInitialized: boolean = false;
  private startupResults: ServiceStartupResult[] = [];

  constructor(
    customConfig: Partial<PortIntegrationConfig> = {},
    customServices?: ServiceConfig[]
  ) {
    this.config = {
      enableAutoDiscovery: true,
      enableHealthMonitoring: true,
      enableWebSocketBroadcast: true,
      monitoringInterval: 30000,
      autoResolveConflicts: true,
      persistConfiguration: true,
      ...customConfig
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
        maxHistoryAge: 30
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
        servicesConfigured: this.startupResults.length
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
      const discoveredServices = await this.portManager.discoverServices();
      logger.info(`Found ${discoveredServices.size} active services`);
      
      // Log discovered services
      for (const [serviceName, status] of discoveredServices) {
        logger.info(`  📦 ${serviceName}: port ${status.port} (${status.healthStatus})`);
        
        this.startupResults.push({
          service: serviceName,
          port: status.port,
          status: status.healthStatus === 'healthy' ? 'success' : 'failed'
        });
      }

      return discoveredServices;
    } catch (error) {
      logger.error('Service discovery failed:', error);
      throw error;
    }
  }

  /**
   * Generate and apply optimal port configuration
   */
  async generateAndApplyOptimalConfiguration(): Promise<PortConfiguration> {
    logger.info('⚙️ Generating optimal port configuration...');
    
    try {
      const optimalConfig = await this.portManager.generateOptimalPortConfig();
      
      // Log any port conflicts that were resolved
      if (optimalConfig.conflicts.length > 0) {
        logger.info('🔧 Resolved port conflicts:');
        for (const conflict of optimalConfig.conflicts) {
          logger.info(`  🔀 ${conflict.service}: ${conflict.port} → ${conflict.resolvedTo}`);
          
          // Update startup results
          const existingResult = this.startupResults.find(r => r.service === conflict.service);
          if (existingResult) {
            existingResult.status = 'conflict_resolved';
            existingResult.originalPort = conflict.port;
            existingResult.port = conflict.resolvedTo;
          } else {
            this.startupResults.push({
              service: conflict.service,
              port: conflict.resolvedTo,
              originalPort: conflict.port,
              status: 'conflict_resolved'
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
      path: '/ws/port-status'
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
    ws.send(JSON.stringify({
      type: 'port_system_status',
      timestamp: new Date().toISOString(),
      status
    }));
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
        activeMonitoring: monitoringStats.isMonitoring
      },
      healthMonitor: {
        initialized: true,
        monitoring: monitoringStats.isMonitoring,
        activeClients: monitoringStats.webSocketClients,
        healthScore: overallHealth.score
      },
      services: this.startupResults.map(result => ({
        name: result.service,
        port: result.port,
        status: result.status === 'success' ? 'healthy' : 
                result.status === 'conflict_resolved' ? 'healthy' : 'unhealthy',
        lastChecked: new Date()
      })),
      webSocket: {
        enabled: this.config.enableWebSocketBroadcast,
        clients: monitoringStats.webSocketClients
      }
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
    if (serviceName) {
      const metric = await this.healthMonitor.monitorServiceHealth(serviceName);
      logger.info(`Health check for ${serviceName}: ${metric.status}`);
    } else {
      await this.healthMonitor.performFullHealthCheck();
      logger.info('Full health check completed');
    }
  }

  /**
   * Resolve a specific port conflict
   */
  async resolveSpecificPortConflict(service: string, requestedPort: number): Promise<number> {
    const resolvedPort = await this.portManager.resolvePortConflict(service, requestedPort);
    
    // Update startup results
    const existingResult = this.startupResults.find(r => r.service === service);
    if (existingResult) {
      existingResult.originalPort = existingResult.port;
      existingResult.port = resolvedPort;
      existingResult.status = 'conflict_resolved';
    }
    
    logger.info(`Port conflict resolved for ${service}: ${requestedPort} → ${resolvedPort}`);
    return resolvedPort;
  }

  /**
   * Persist current configuration to Supabase
   */
  async persistCurrentConfiguration(): Promise<void> {
    try {
      const config = await this.portManager.loadPortConfiguration();
      if (config) {
        await this.supabaseService.insert('port_configurations', {
          configuration: config,
          startup_results: this.startupResults,
          system_status: this.getPortSystemStatus(),
          created_at: new Date().toISOString()
        });
        
        logger.info('Port configuration persisted to database');
      }
    } catch (error) {
      logger.error('Failed to persist configuration:', error);
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
        event
      });
    });

    this.portManager.on('portStatusChanged', (event) => {
      logger.info(`Port status changed: ${event.service} port ${event.port} ${event.previousStatus} → ${event.newStatus}`);
      this.broadcastToWebSocketClients({
        type: 'port_status_changed',
        timestamp: new Date().toISOString(),
        event
      });
    });

    // Health Monitor Events
    this.healthMonitor.on('alertCreated', (alert) => {
      logger.warn(`Health alert: ${alert.type} - ${alert.message}`);
      this.broadcastToWebSocketClients({
        type: 'health_alert',
        timestamp: new Date().toISOString(),
        alert
      });
    });

    this.healthMonitor.on('healthCheckCompleted', (event) => {
      this.broadcastToWebSocketClients({
        type: 'health_check_completed',
        timestamp: new Date().toISOString(),
        results: event.results
      });
    });
  }

  /**
   * Broadcast message to all connected WebSocket clients
   */
  private broadcastToWebSocketClients(message: any): void {
    if (this.webSocketServer) {
      this.webSocketServer.clients.forEach(client => {
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
  async generatePortManagementReport(): Promise<any> {
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
        successfulStartups: startupResults.filter(r => r.status === 'success').length,
        conflictsResolved: startupResults.filter(r => r.status === 'conflict_resolved').length,
        failures: startupResults.filter(r => r.status === 'failed').length,
        overallHealthScore: healthReport.healthScore,
        monitoringActive: systemStatus.healthMonitor.monitoring
      }
    };
  }
}

// Export singleton instance for application use
export const portIntegrationService = new PortIntegrationService();

// Export utility functions for easy integration
export async function initializePortSystem(customConfig?: Partial<PortIntegrationConfig>): Promise<PortIntegrationService> {
  const service = new PortIntegrationService(customConfig);
  await service.initialize();
  return service;
}

export async function getPortSystemStatus(): Promise<PortSystemStatus> {
  return portIntegrationService.getPortSystemStatus();
}

export async function generatePortReport(): Promise<any> {
  return portIntegrationService.generatePortManagementReport();
}