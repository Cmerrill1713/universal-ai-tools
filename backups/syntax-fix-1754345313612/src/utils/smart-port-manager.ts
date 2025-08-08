/**
 * Smart Port Manager Utility;
 * Intelligent port management with conflict detection, auto-assignment, and health monitoring;
 * Integrates with Universal AI Tools service-oriented architecture;
 */

import net from 'net';
import { EventEmitter } from 'events';
import { LogContext, log } from './logger';

export interface PortRange {
  start: number;
  end: number;
  category: 'system' | 'services' | 'development' | 'dynamic';
}

export interface ServicePortConfig {
  name: string;
  preferredPort: number;
  category: 'critical' | 'high' | 'medium' | 'low';
  healthCheckPath?: string;
  retryAttempts?: number;
  fallbackRange?: PortRange;
}

export interface PortAssignment {
  serviceName: string;
  assignedPort: number;
  preferredPort: number;
  status: 'assigned' | 'conflict_resolved' | 'fallback_used';
  healthStatus: 'healthy' | 'unhealthy' | 'unknown';
  lastHealthCheck?: number;
}

export interface PortManagerConfig {
  enableHealthChecks: boolean;
  healthCheckInterval: number; // milliseconds;
  conflictResolutionStrategy: 'increment' | 'random' | 'priority_based';
  portRanges: PortRange[];
  reservedPorts: number[];
  maxRetries: number;
}

/**
 * Intelligent Port Manager with conflict detection and service health monitoring;
 */
export class SmartPortManager extends EventEmitter {
  private config: PortManagerConfig;
  private assignments: Map<string, PortAssignment> = new Map();
  private portReservations: Set<number> = new Set();
  private healthCheckTimer?: NodeJS?.Timeout;
  private isInitialized = false;

  constructor(config: Partial<PortManagerConfig> = {}) {
    super();

    this?.config = {
      enableHealthChecks: true,
      healthCheckInterval: 30000, // 30 seconds;
      conflictResolutionStrategy: 'priority_based',
      portRanges: [
        { start: 1024, end: 5000, category: 'system' },
        { start: 5001, end: 8000, category: 'services' },
        { start: 8001, end: 9000, category: 'development' },
        { start: 9001, end: 65535, category: 'dynamic' },
      ],
      reservedPorts: [22, 80, 443, 3000, 5432, 6379, 11434], // Common system ports;
      maxRetries: 10,
      ...config,
    };

    // Initialize port reservations;
    this?.config?.reservedPorts?.forEach(port => this?.portReservations?.add(port));
  }

  /**
   * Initialize the port manager;
   */
  async initialize(): Promise<void> {
    if (this?.isInitialized) {
      log?.warn('Smart Port Manager already initialized', LogContext?.SYSTEM);
      return;
    }

    log?.info('🌐 Initializing Smart Port Manager', LogContext?.SYSTEM, {
      healthChecks: this?.config?.enableHealthChecks,
      strategy: this?.config?.conflictResolutionStrategy,
      portRanges: this?.config?.portRanges?.length,
    });

    // Start health monitoring if enabled;
    if (this?.config?.enableHealthChecks) {
      this?.startHealthMonitoring();
    }

    this?.isInitialized = true;
    this?.emit('initialized');
  }

  /**
   * Request a port assignment for a service;
   */
  async requestPort(serviceConfig: ServicePortConfig): Promise<PortAssignment> {
    log?.info('🔍 Requesting port assignment', LogContext?.SYSTEM, {
      service: serviceConfig?.name,
      preferredPort: serviceConfig?.preferredPort,
      category: serviceConfig?.category,
    });

    // Check if service already has an assignment;
    const existingAssignment = this?.assignments?.get(serviceConfig?.name);
    if (existingAssignment && existingAssignment?.status === 'assigned') {
      log?.info('✅ Using existing port assignment', LogContext?.SYSTEM, {
        service: serviceConfig?.name,
        port: existingAssignment?.assignedPort,
      });
      return existingAssignment;
    }

    // Try to assign preferred port first;
    const preferredAvailable = await this?.isPortAvailable(serviceConfig?.preferredPort);
    
    if (preferredAvailable && !this?.portReservations?.has(serviceConfig?.preferredPort)) {
      return this?.assignPort(serviceConfig, serviceConfig?.preferredPort, 'assigned');
    }

    // Preferred port not available, resolve conflict;
    log?.warn('⚠️ Port conflict detected', LogContext?.SYSTEM, {
      service: serviceConfig?.name,
      preferredPort: serviceConfig?.preferredPort,
    });

    const resolvedPort = await this?.resolvePortConflict(serviceConfig);
    return this?.assignPort(serviceConfig, resolvedPort, 'conflict_resolved');
  }

  /**
   * Resolve port conflicts using configured strategy;
   */
  private async resolvePortConflict(serviceConfig: ServicePortConfig): Promise<number> {
    switch (this?.config?.conflictResolutionStrategy) {
      case 'increment':
        return this?.findPortByIncrement(serviceConfig?.preferredPort);
      
      case 'random':
        return this?.findRandomAvailablePort(serviceConfig);
      
      case 'priority_based':
        return this?.findPortByPriority(serviceConfig);
      
      default:
        throw new Error(`Unknown conflict resolution strategy: ${this?.config?.conflictResolutionStrategy}`);
    }
  }

  /**
   * Find available port by incrementing from preferred;
   */
  private async findPortByIncrement(startPort: number): Promise<number> {
    for (let i = 0; i < this?.config?.maxRetries; i++) {
      const candidatePort = startPort + i;
      
      if (candidatePort > 65535) break; // Port range limit;
      
      if (!this?.portReservations?.has(candidatePort) && await this?.isPortAvailable(candidatePort)) {
        return candidatePort;
      }
    }
    
    throw new Error(`No available port found starting from ${startPort}`);
  }

  /**
   * Find random available port within appropriate range;
   */
  private async findRandomAvailablePort(serviceConfig: ServicePortConfig): Promise<number> {
    const appropriateRange = this?.getAppropriatePortRange(serviceConfig);
    
    for (let attempt = 0; attempt < this?.config?.maxRetries; attempt++) {
      const candidatePort = Math?.floor(
        Math?.random() * (appropriateRange?.end - appropriateRange?.start + 1) + appropriateRange?.start;
      );
      
      if (!this?.portReservations?.has(candidatePort) && await this?.isPortAvailable(candidatePort)) {
        return candidatePort;
      }
    }
    
    throw new Error(`No available port found in range ${appropriateRange?.start}-${appropriateRange?.end}`);
  }

  /**
   * Find port based on service priority and existing assignments;
   */
  private async findPortByPriority(serviceConfig: ServicePortConfig): Promise<number> {
    // High priority services get preference in system/services ranges;
    const priorityRanges = serviceConfig?.category === 'critical' || serviceConfig?.category === 'high'
      ? this?.config?.portRanges?.filter(r => r?.category === 'system' || r?.category === 'services')
      : this?.config?.portRanges?.filter(r => r?.category === 'development' || r?.category === 'dynamic');

    for (const range of priorityRanges) {
      try {
        return await this?.findPortInRange(range);
      } catch {
        continue; // Try next range;
      }
    }

    // Fallback to any available port;
    return this?.findPortByIncrement(serviceConfig?.preferredPort);
  }

  /**
   * Find available port within specific range;
   */
  private async findPortInRange(range: PortRange): Promise<number> {
    for (let port = range?.start; port <= range?.end; port++) {
      if (!this?.portReservations?.has(port) && await this?.isPortAvailable(port)) {
        return port;
      }
    }
    
    throw new Error(`No available port in range ${range?.start}-${range?.end}`);
  }

  /**
   * Get appropriate port range for service;
   */
  private getAppropriatePortRange(serviceConfig: ServicePortConfig): PortRange {
    if (serviceConfig?.fallbackRange) {
      return serviceConfig?.fallbackRange;
    }

    // Default mapping based on service category;
    const categoryToRange: Record<string, string> = {
      critical: 'system',
      high: 'services',
      medium: 'development',
      low: 'dynamic',
    };

    const targetCategory = categoryToRange[serviceConfig?.category] || 'dynamic';
    return this?.config?.portRanges?.find(r => r?.category === targetCategory) || this?.config?.portRanges[0]!;
  }

  /**
   * Assign port to service;
   */
  private assignPort(serviceConfig: ServicePortConfig, port: number, status: PortAssignment['status']): PortAssignment {
    const assignment: PortAssignment = {
      serviceName: serviceConfig?.name,
      assignedPort: port,
      preferredPort: serviceConfig?.preferredPort,
      status,
      healthStatus: 'unknown',
    };

    this?.assignments?.set(serviceConfig?.name, assignment);
    this?.portReservations?.add(port);

    log?.info('✅ Port assigned successfully', LogContext?.SYSTEM, {
      service: serviceConfig?.name,
      assignedPort: port,
      preferredPort: serviceConfig?.preferredPort,
      status,
    });

    this?.emit('portAssigned', assignment);
    return assignment;
  }

  /**
   * Check if port is available;
   */
  async isPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = net?.createServer();
      
      server?.listen(port, () => {
        server?.close();
        resolve(true);
      });

      server?.on('error', () => {
        resolve(false);
      });
    });
  }

  /**
   * Release port assignment;
   */
  releasePort(serviceName: string): boolean {
    const assignment = this?.assignments?.get(serviceName);
    
    if (!assignment) {
      log?.warn('⚠️ Attempted to release unknown service port', LogContext?.SYSTEM, { serviceName });
      return false;
    }

    this?.assignments?.delete(serviceName);
    this?.portReservations?.delete(assignment?.assignedPort);

    log?.info('🔓 Port released', LogContext?.SYSTEM, {
      service: serviceName,
      port: assignment?.assignedPort,
    });

    this?.emit('portReleased', assignment);
    return true;
  }

  /**
   * Start health monitoring for assigned services;
   */
  private startHealthMonitoring(): void {
    if (this?.healthCheckTimer) {
      clearInterval(this?.healthCheckTimer);
    }

    this?.healthCheckTimer = setInterval(() => {
      this?.performHealthChecks();
    }, this?.config?.healthCheckInterval);

    log?.info('🏥 Health monitoring started', LogContext?.SYSTEM, {
      interval: this?.config?.healthCheckInterval,
    });
  }

  /**
   * Perform health checks on all assigned services;
   */
  private async performHealthChecks(): Promise<void> {
    const assignments = Array?.from(this?.assignments?.values());
    
    if (assignments?.length === 0) return;

    log?.debug('🔍 Performing health checks', LogContext?.SYSTEM, {
      services: assignments?.length,
    });

    const healthChecks = assignments?.map(async (assignment) => {
      try {
        const isHealthy = await this?.checkServiceHealth(assignment);
        assignment?.healthStatus = isHealthy ? 'healthy' : 'unhealthy';
        assignment?.lastHealthCheck = Date?.now();

        if (!isHealthy) {
          this?.emit('serviceUnhealthy', assignment);
        }
      } catch (error) {
        assignment?.healthStatus = 'unhealthy';
        assignment?.lastHealthCheck = Date?.now();
        
        log?.error('❌ Health check failed', LogContext?.SYSTEM, {
          service: assignment?.serviceName,
          port: assignment?.assignedPort,
          error,
        });
      }
    });

    await Promise?.allSettled(healthChecks);
  }

  /**
   * Check health of individual service;
   */
  private async checkServiceHealth(assignment: PortAssignment): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new net?.Socket();
      
      const timeout = setTimeout(() => {
        socket?.destroy();
        resolve(false);
      }, 5000); // 5 second timeout;

      socket?.connect(assignment?.assignedPort, 'localhost', () => {
        clearTimeout(timeout);
        socket?.destroy();
        resolve(true);
      });

      socket?.on('error', () => {
        clearTimeout(timeout);
        resolve(false);
      });
    });
  }

  /**
   * Get all current port assignments;
   */
  getAssignments(): PortAssignment[] {
    return Array?.from(this?.assignments?.values());
  }

  /**
   * Get port assignment for specific service;
   */
  getAssignment(serviceName: string): PortAssignment | undefined {
    return this?.assignments?.get(serviceName);
  }

  /**
   * Get available ports in range;
   */
  async getAvailablePorts(range: PortRange, limit = 10): Promise<number[]> {
    const availablePorts: number[] = [];
    
    for (let port = range?.start; port <= range?.end && availablePorts?.length < limit; port++) {
      if (!this?.portReservations?.has(port) && await this?.isPortAvailable(port)) {
        availablePorts?.push(port);
      }
    }
    
    return availablePorts;
  }

  /**
   * Get system status;
   */
  getStatus(): {
    initialized: boolean;
    totalAssignments: number;
    healthyServices: number;
    unhealthyServices: number;
    reservedPorts: number;
    availableRanges: PortRange[];
  } {
    const assignments = Array?.from(this?.assignments?.values());
    
    return {
      initialized: this?.isInitialized,
      totalAssignments: assignments?.length,
      healthyServices: assignments?.filter(a => a?.healthStatus === 'healthy').length,
      unhealthyServices: assignments?.filter(a => a?.healthStatus === 'unhealthy').length,
      reservedPorts: this?.portReservations?.size,
      availableRanges: this?.config?.portRanges,
    };
  }

  /**
   * Shutdown port manager;
   */
  async shutdown(): Promise<void> {
    log?.info('🛑 Shutting down Smart Port Manager', LogContext?.SYSTEM);

    if (this?.healthCheckTimer) {
      clearInterval(this?.healthCheckTimer);
      this?.healthCheckTimer = undefined;
    }

    this?.emit('shutdown');
  }
}

// Export utility functions for backward compatibility;
export function smartPortManagerHelper(input: ServicePortConfig): Promise<PortAssignment> {
  return smartPortManager?.requestPort(input);
}

// Export singleton instance;
export const smartPortManager = new SmartPortManager();

export default SmartPortManager;
