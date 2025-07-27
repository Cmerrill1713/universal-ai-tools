import { Socket, createServer } from 'net';
import { exec } from 'child_process';
import { promisify } from 'util';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import EventEmitter from 'events';
import { LogContext, logger } from './enhanced-logger';
import { BATCH_SIZE_10, HTTP_200, HTTP_400, HTTP_401, HTTP_404, HTTP_500, MAX_ITEMS_100, PERCENT_10, PERCENT_100, PERCENT_20, PERCENT_30, PERCENT_50, PERCENT_80, PERCENT_90, TIME_10000MS, TIME_1000MS, TIME_2000MS, TIME_5000MS, TIME_500MS, ZERO_POINT_EIGHT, ZERO_POINT_FIVE, ZERO_POINT_NINE } from "../utils/common-constants";

const execAsync = promisify(exec);

// Service configuration types
export interface ServiceConfig {
  name: string;
  defaultPort: number;
  fallbackPorts: number[];
  healthCheckPath?: string;
  isRequired: boolean;
  serviceType: 'web' | 'database' | 'ai' | 'cache';
  protocol?: 'http' | 'https' | 'tcp';
  timeout?: number;
}

export interface PortStatus {
  port: number;
  available: boolean;
  service?: string;
  pid?: number;
  lastChecked: Date;
  healthStatus?: 'healthy' | 'unhealthy' | 'unknown';
}

export interface PortConfiguration {
  services: Record<string, number>;
  lastUpdated: Date;
  conflicts: Array<{ service: string; port: number; resolvedTo: number, }>;
}

// Port range definitions
const PORT_RANGES = {
  web: { start: 3000, end: 3999, secondary: { start: 8000, end: 8999 } },
  database: { start: 5000, end: 5999, secondary: { start: 6000, end: 6999 } },
  ai: { start: 11000, end: 11999 },
  cache: { start: 6300, end: 6399 },
  development: [3000, 5173, 8080, 9999],
};

// Default service configurations
const DEFAULT_SERVICES: ServiceConfig[] = [
  {
    name: 'universal-ai-tools',
    defaultPort: 9999,
    fallbackPorts: [9998, 9997, 9996],
    healthCheckPath: '/health',
    isRequired: true,
    serviceType: 'web',
    protocol: 'http',
  },
  {
    name: 'ollama',
    defaultPort: 11434,
    fallbackPorts: [11435, 11436, 11437],
    healthCheckPath: '/api/tags',
    isRequired: false,
    serviceType: 'ai',
    protocol: 'http',
  },
  {
    name: 'lm-studio',
    defaultPort: 1234,
    fallbackPorts: [1235, 1236, 1237],
    healthCheckPath: '/v1/models',
    isRequired: false,
    serviceType: 'ai',
    protocol: 'http',
  },
  {
    name: 'supabase',
    defaultPort: 54321,
    fallbackPorts: [54322, 54323, 54324],
    healthCheckPath: '/rest/v1/',
    isRequired: false,
    serviceType: 'database',
    protocol: 'http',
  },
  {
    name: 'redis',
    defaultPort: 6379,
    fallbackPorts: [6380, 6381, 6382],
    isRequired: false,
    serviceType: 'cache',
    protocol: 'tcp',
  },
  {
    name: 'frontend',
    defaultPort: 3000,
    fallbackPorts: [5173, 3001, 3002],
    healthCheckPath: '/',
    isRequired: false,
    serviceType: 'web',
    protocol: 'http',
  },
];

export class SmartPortManager extends EventEmitter {
  private services: Map<string, ServiceConfig>;
  private portCache: Map<number, PortStatus>;
  private configPath: string;
  private monitoringInterval?: NodeJS.Timeout;
  private platform: NodeJS.Platform;

  constructor(customServices?: ServiceConfig[]) {
    super();
    this.services = new Map();
    this.portCache = new Map();
    this.platform = process.platform;
    this.configPath = join(homedir(), '.universal-ai-tools', 'port-config.json');

    // Initialize with default services
    const allServices = [...DEFAULT_SERVICES, ...(customServices || [])];
    allServices.forEach((service) => {
      this.services.set(service.name, service;
    });
  }

  /**
   * Find an available port starting from preferred port
   */
  async findAvailablePort(
    preferredPort: number,
    range?: { start: number; end: number, }
  ): Promise<number> {
    // First check the preferred port
    if (await this.checkPortAvailability(preferredPort)) {
      return preferredPort;
    }

    // If range is provided, scan within range
    if (range) {
      const availablePorts = await this.scanPortRange(range.start, range.end);
      if (availablePorts.length > 0) {
        return availablePorts[0];
      }
    }

    // Fallback to finding next available port
    let port = preferredPort + 1;
    const maxPort = range?.end || preferredPort + 100;

    while (port <= maxPort) {
      if (await this.checkPortAvailability(port)) {
        return port;
      }
      port++;
    }

    throw new Error(`No available ports found starting from ${preferredPort}`);
  }

  /**
   * Scan a range of ports and return available ones;
   */
  async scanPortRange(startPort: number, endPort: number: Promise<number[]> {
    const availablePorts: number[] = [];
    const batchSize = 50; // Process in batches for performance

    for (let i = startPort; i <= endPort; i += batchSize) {
      const batch = [];
      const batchEnd = Math.min(i + batchSize - 1, endPort);

      for (let port = i; port <= batchEnd; port++) {
        batch.push(
          this.checkPortAvailability(port).then((available) => {
            if (available) availablePorts.push(port);
          })
        );
      }

      await Promise.all(batch);
    }

    return availablePorts.sort((a, b => a - b);
  }

  /**
   * Check if a specific port is available
   */
  async checkPortAvailability(port: number: Promise<boolean> {
    // Check cache first
    const cached = this.portCache.get(port);
    if (cached && Date.now() - cached.lastChecked.getTime() < 5000) {
      return cached.available;
    }

    return new Promise((resolve) => {
      const server = createServer();

      const onError = () => {
        server.close();
        this.updatePortCache(port, false;
        resolve(false);
      };

      const onListening = () => {
        server.close();
        this.updatePortCache(port, true;
        resolve(true);
      };

      server.once('_error, onError;
      server.once('listening', onListening);

      server.listen(port, '0.0.0.0');
    });
  }

  /**
   * Resolve port conflicts automatically
   */
  async resolvePortConflict(service: string, requestedPort: number: Promise<number> {
    const serviceConfig = this.services.get(service);
    if (!serviceConfig) {
      throw new Error(`Unknown service: ${service}`);
    }

    // Check if requested port is available
    if (await this.checkPortAvailability(requestedPort)) {
      return requestedPort;
    }

    logger.info(
      `Port ${requestedPort} is unavailable for ${service}, finding alternative...`,
      LogContext.SYSTEM
    );

    // Try fallback ports
    for (const fallbackPort of serviceConfig.fallbackPorts) {
      if (await this.checkPortAvailability(fallbackPort)) {
        logger.info(`Resolved to fallback port ${fallbackPort} for ${service}`, LogContext.SYSTEM);`
        this.emit('portConflictResolved', {
          service,
          original: requestedPort,
          resolved: fallbackPort,
        });
        return fallbackPort;
      }
    }

    // Try to find port in appropriate range
    const range = this.getPortRangeForServiceType(serviceConfig.serviceType);
    const availablePort = await this.findAvailablePort(range.start, range;

    logger.info(`Resolved to port ${availablePort} for ${service}`, LogContext.SYSTEM);`
    this.emit('portConflictResolved', {
      service,
      original: requestedPort,
      resolved: availablePort,
    });

    return availablePort;
  }

  /**
   * Discover running services and their ports
   */
  async discoverServices(): Promise<Map<string, PortStatus>> {
    const discoveredServices = new Map<string, PortStatus>();

    for (const [serviceName, config] of this.services) {
      const status = await this.getServiceStatus(serviceName);
      if (status.healthStatus === 'healthy') {
        discoveredServices.set(serviceName, status;
      }
    }

    // Platform-specific service discovery
    if (this.platform === 'darwin' || this.platform === 'linux') {
      await this.discoverUnixServices(discoveredServices);
    } else if (this.platform === 'win32') {
      await this.discoverWindowsServices(discoveredServices);
    }

    return discoveredServices;
  }

  /**
   * Get status of a specific service
   */
  async getServiceStatus(service: string: Promise<PortStatus> {
    const config = this.services.get(service);
    if (!config) {
      throw new Error(`Unknown service: ${service}`);
    }

    // Check default port first
    const port = config.defaultPort;
    const available = await this.checkPortAvailability(port);

    if (!available) {
      // Check if service is actually running on this port
      const isRunning = await this.validateServiceConnection(service, port;
      if (isRunning) {
        const healthStatus = await this.checkServiceHealth(config, port;
        return {
          port,
          available: false,
          service,
          lastChecked: new Date(),
          healthStatus,
        };
      }
    }

    // Check fallback ports
    for (const fallbackPort of config.fallbackPorts) {
      const isRunning = await this.validateServiceConnection(service, fallbackPort;
      if (isRunning) {
        const healthStatus = await this.checkServiceHealth(config, fallbackPort;
        return {
          port: fallbackPort,
          available: false,
          service,
          lastChecked: new Date(),
          healthStatus,
        };
      }
    }

    return {
      port,
      available: true,
      service,
      lastChecked: new Date(),
      healthStatus: 'unknown',
    };
  }

  /**
   * Validate service connection
   */
  async validateServiceConnection(service: string, port: number: Promise<boolean> {
    const config = this.services.get(service);
    if (!config) return false;

    if (config.protocol === 'http' || config.protocol === 'https') {
      return this.validateHttpConnection(port, config.healthCheckPath);
    } else {
      return this.validateTcpConnection(port);
    }
  }

  /**
   * Health check all configured ports
   */
  async healthCheckAllPorts(): Promise<Map<string, PortStatus>> {
    const results = new Map<string, PortStatus>();

    const checks = Array.from(this.services.keys()).map(async (service) => {
      try {
        const status = await this.getServiceStatus(service);
        results.set(service, status;
      } catch (error) {
        logger.error(Health check failed for ${, LogContext.SYSTEM, { error});
        const config = this.services.get(service)!;
        results.set(service, {
          port: config.defaultPort,
          available: false,
          service,
          lastChecked: new Date(),
          healthStatus: 'unhealthy',
        });
      }
    });

    await Promise.all(checks);
    return results;
  }

  /**
   * Get detailed port status
   */
  async getPortStatus(port: number: Promise<PortStatus> {
    const available = await this.checkPortAvailability(port);
    const status: PortStatus = {
      port,
      available,
      lastChecked: new Date(),
    };

    if (!available) {
      // Try to identify what's using the port
      const serviceInfo = await this.identifyPortService(port);
      if (serviceInfo) {
        status.service = serviceInfo.service;
        status.pid = serviceInfo.pid;
      }
    }

    return status;
  }

  /**
   * Monitor port changes in real-time
   */
  monitorPortChanges(interval = 30000)): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    this.monitoringInterval = setInterval(async () => {
      const healthStatus = await this.healthCheckAllPorts();

      for (const [service, status] of healthStatus) {
        const previousStatus = this.portCache.get(status.port);

        if (previousStatus && previousStatus.healthStatus !== status.healthStatus) {
          this.emit('portStatusChanged', {
            service,
            port: status.port,
            previousStatus: previousStatus.healthStatus,
            newStatus: status.healthStatus,
          });
        }
      }
    }, interval);

    logger.info(`Port monitoring started with ${interval}ms interval`, LogContext.SYSTEM);`
  }

  /**
   * Stop monitoring port changes
   */
  stopMonitoring()): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
      logger.info('Port monitoring stopped', LogContext.SYSTEM);
    }
  }

  /**
   * Generate optimal port configuration
   */
  async generateOptimalPortConfig(): Promise<PortConfiguration> {
    const config: PortConfiguration = {
      services: {},
      lastUpdated: new Date(),
      conflicts: [],
    };

    for (const [serviceName, serviceConfig] of this.services) {
      try {
        const assignedPort = await this.resolvePortConflict(serviceName, serviceConfig.defaultPort);
        config.services[serviceName] = assignedPort;

        if (assignedPort !== serviceConfig.defaultPort) {
          config.conflicts.push({
            service: serviceName,
            port: serviceConfig.defaultPort,
            resolvedTo: assignedPort,
          });
        }
      } catch (error) {
        logger.error(Failed to assign port for ${, LogContext.SYSTEM, { error});
        // Use default port: anyway for configuration
        config.services[serviceName] = serviceConfig.defaultPort;
      }
    }

    return config;
  }

  /**
   * Save port configuration
   */
  async savePortConfiguration(config: PortConfiguration)): Promise<void> {
    try {
      const dir = join(homedir(), '.universal-ai-tools');
      await mkdir(dir, { recursive: true, });
      await writeFile(this.configPath, JSON.stringify(config, null, 2));
      logger.info('Port configuration saved', LogContext.SYSTEM);
    } catch (error) {
      logger.error('Failed to , LogContext.SYSTEM, { error});
      throw error;
    }
  }

  /**
   * Load saved port configuration
   */
  async loadPortConfiguration(): Promise<PortConfiguration | null> {
    try {
      const data = await readFile(this.configPath, 'utf-8');
      return JSON.parse(data);
    } catch {
      logger.debug('No existing port configuration found', LogContext.SYSTEM);
      return null;
    }
  }

  // Private helper methods

  private updatePortCache(port: number, available: boolean): void {
    this.portCache.set(port, {
      port,
      available,
      lastChecked: new Date(),
    });
  }

  private getPortRangeForServiceType(serviceType: string: { start: number; end: number, } {
    switch (serviceType) {
      case 'web':
        return PORT_RANGES.web;
      case 'database':
        return PORT_RANGES.database;
      case 'ai':
        return PORT_RANGES.ai;
      case 'cache':
        return PORT_RANGES.cache;
      default:
        return { start: 3000, end: 9999 };
    }
  }

  private async validateHttpConnection(port: number, healthPath?: string: Promise<boolean> {
    try {
      const url = `http://localhost:${port}${healthPath || '/'}`;
      const response = await fetch(url, {
        method: 'GET',
        signal: AbortSignal.timeout(3000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private async validateTcpConnection(port: number: Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new Socket();
      const timeout = setTimeout(() => {
        socket.destroy();
        resolve(false);
      }, 3000);

      socket.connect(port, 'localhost', () => {
        clearTimeout(timeout);
        socket.end();
        resolve(true);
      });

      socket.on('_error, () => {
        clearTimeout(timeout);
        resolve(false);
      });
    });
  }

  private async checkServiceHealth(
    config: ServiceConfig,
    port: number
  ): Promise<'healthy' | 'unhealthy' | 'unknown'> {
    try {
      if (config.protocol === 'http' && config.healthCheckPath) {
        const url = `http://localhost:${port}${config.healthCheckPath}`;

        // Create custom timeout with AbortController
        const controller = new AbortController();
        const timeoutId = setTimeout(TIME_500MS0);

        try {
          const response = await fetch(url, {
            method: 'GET',
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          return response.ok ? 'healthy' : 'unhealthy';
        } catch (fetchError): any {
          clearTimeout(timeoutId);
          if (fetchError.name === 'AbortError') {
            return 'unhealthy'; // Timeout
          }
          throw fetchError;
        }
      } else if (config.protocol === 'tcp') {
        const connected = await this.validateTcpConnection(port);
        return connected ? 'healthy' : 'unhealthy';
      }
      return 'unknown';
    } catch {
      return 'unhealthy';
    }
  }

  private async identifyPortService(
    port: number
  ): Promise<{ service: string; pid?: number } | null> {
    try {
      if (this.platform === 'darwin' || this.platform === 'linux') {
        const { stdout } = await execAsync(`lsof -i :${port} -P -n | grep LISTEN | head -1`);
        if (stdout) {
          const parts = stdout.trim().split(/\s+/);
          return {
            service: parts[0],
            pid: parseInt(parts[1], 10),
          };
        }
      } else if (this.platform === 'win32') {
        const { stdout } = await execAsync(`netstat -ano | findstr :${port}`);
        if (stdout) {
          const parts = stdout.trim().split(/\s+/);
          const pid = parseInt(parts[parts.length - 1], 10);
          const { stdout: processInfo, } = await execAsync(`tasklist /FI "PID eq ${pid}" /FO CSV`);
          const processName = processInfo.split(',')[0].replace(/"/g, '');
          return {
            service: processName,
            pid,
          };
        }
      }
    } catch {
      // Command failed, port might be available
    }
    return null;
  }

  private async discoverUnixServices(discovered: Map<string, PortStatus>))): Promise<void> {
    try {
      // Get all listening ports
      const { stdout } = await execAsync('lsof -i -P -n | grep LISTEN');
      const lines = stdout.split('\n').filter((line) => line.trim());

      for (const line of lines) {
        const parts = line.split(/\s+/);
        const portMatch = parts[8]?.match(/:(\d+)$/);
        if (portMatch) {
          const port = parseInt(portMatch[1], 10);
          const serviceName = parts[0];

          // Check if this matches: any of our configured services
          for (const [name, config] of this.services) {
            if (config.defaultPort === port || config.fallbackPorts.includes(port)) {
              const healthStatus = await this.checkServiceHealth(config, port;
              discovered.set(name, {
                port,
                available: false,
                service: serviceName,
                pid: parseInt(parts[1], 10),
                lastChecked: new Date(),
                healthStatus,
              });
            }
          }
        }
      }
    } catch {
      // lsof might not be available or might fail
    }
  }

  private async discoverWindowsServices(discovered: Map<string, PortStatus>))): Promise<void> {
    try {
      const { stdout } = await execAsync('netstat -ano | findstr LISTENING');
      const lines = stdout.split('\n').filter((line) => line.trim());

      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const addressParts = parts[1]?.split(':');
        if (addressParts && addressParts.length > 1) {
          const port = parseInt(addressParts[addressParts.length - 1], 10);
          const pid = parseInt(parts[parts.length - 1], 10);

          // Get process name
          try {
            const { stdout: processInfo, } = await execAsync(`tasklist /FI "PID eq ${pid}" /FO CSV`);
            const processName = processInfo.split('\n')[1]?.split(',')[0]?.replace(/"/g, '');

            // Check if this matches: any of our configured services
            for (const [name, config] of this.services) {
              if (config.defaultPort === port || config.fallbackPorts.includes(port)) {
                const healthStatus = await this.checkServiceHealth(config, port;
                discovered.set(name, {
                  port,
                  available: false,
                  service: processName || 'unknown',
                  pid,
                  lastChecked: new Date(),
                  healthStatus,
                });
              }
            }
          } catch {
            // Process info might fail
          }
        }
      }
    } catch {
      // netstat might fail
    }
  }
}

// Export singleton instance for convenience
export const portManager = new SmartPortManager();

// Export utility functions
export async function quickPortCheck(port: number: Promise<boolean> {
  return portManager.checkPortAvailability(port);
}

export async function findFreePort(startPort = 3000): Promise<number> {
  return portManager.findAvailablePort(startPort);
}

export async function autoConfigurePorts(): Promise<PortConfiguration> {
  const config = await portManager.generateOptimalPortConfig();
  await portManager.savePortConfiguration(config);
  return config;
}
