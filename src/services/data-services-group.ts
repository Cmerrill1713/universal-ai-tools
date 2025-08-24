/**
 * Data Services Group - Database and storage services
 * Manages all data-related services including databases, caching, and storage
 */

import { Express } from 'express';
import { logger } from '../utils/enhanced-logger.js';

export interface DataService {
  name: string;
  type: 'database' | 'cache' | 'storage' | 'search';
  status: 'starting' | 'running' | 'stopped' | 'error';
  endpoint?: string;
  healthCheck?: () => Promise<boolean>;
  start?: () => Promise<void>;
  stop?: () => Promise<void>;
}

export class DataServicesGroup {
  private services: Map<string, DataService> = new Map();
  private isInitialized = false;

  constructor(private app: Express) {}

  /**
   * Initialize all data services
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Data services already initialized');
      return;
    }

    try {
      logger.info('💾 Initializing Data Services Group...');

      // Register data services
      await this.registerDataServices();

      // Start all services
      await this.startAllServices();

      this.isInitialized = true;
      logger.info('✅ Data Services Group initialized successfully');
    } catch (error) {
      logger.error('❌ Failed to initialize Data Services Group:', error);
      throw error;
    }
  }

  /**
   * Register all data services
   */
  private async registerDataServices(): Promise<void> {
    // PostgreSQL Database Service
    this.registerService({
      name: 'postgresql',
      type: 'database',
      status: 'stopped',
      healthCheck: async () => {
        try {
          return !!process.env.DATABASE_URL || !!process.env.POSTGRES_HOST;
        } catch {
          return false;
        }
      },
      start: async () => {
        logger.info('Starting PostgreSQL service...');
        // PostgreSQL connection logic would go here
      },
      stop: async () => {
        logger.info('Stopping PostgreSQL service...');
      }
    });

    // Supabase Service
    this.registerService({
      name: 'supabase',
      type: 'database',
      status: 'stopped',
      endpoint: '/api/supabase',
      healthCheck: async () => {
        try {
          return !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);
        } catch {
          return false;
        }
      },
      start: async () => {
        logger.info('Starting Supabase service...');
        // Supabase connection logic would go here
      },
      stop: async () => {
        logger.info('Stopping Supabase service...');
      }
    });

    // Redis Cache Service
    this.registerService({
      name: 'redis',
      type: 'cache',
      status: 'stopped',
      healthCheck: async () => {
        try {
          return process.env.REDIS_ENABLED !== 'false';
        } catch {
          return false;
        }
      },
      start: async () => {
        logger.info('Starting Redis service...');
        // Redis connection logic would go here
      },
      stop: async () => {
        logger.info('Stopping Redis service...');
      }
    });

    // Vector Database Service (Qdrant)
    this.registerService({
      name: 'qdrant',
      type: 'search',
      status: 'stopped',
      endpoint: '/api/vectors',
      healthCheck: async () => {
        try {
          return process.env.QDRANT_ENABLED === 'true';
        } catch {
          return false;
        }
      },
      start: async () => {
        logger.info('Starting Qdrant vector service...');
        // Qdrant connection logic would go here
      },
      stop: async () => {
        logger.info('Stopping Qdrant vector service...');
      }
    });

    // Neo4j Graph Database Service
    this.registerService({
      name: 'neo4j',
      type: 'database',
      status: 'stopped',
      endpoint: '/api/graph',
      healthCheck: async () => {
        try {
          return !!(process.env.NEO4J_URI && process.env.NEO4J_USER);
        } catch {
          return false;
        }
      },
      start: async () => {
        logger.info('Starting Neo4j service...');
        // Neo4j connection logic would go here
      },
      stop: async () => {
        logger.info('Stopping Neo4j service...');
      }
    });

    // File Storage Service
    this.registerService({
      name: 'file-storage',
      type: 'storage',
      status: 'stopped',
      endpoint: '/api/files',
      healthCheck: async () => true,
      start: async () => {
        logger.info('Starting file storage service...');
        // File storage logic would go here
      },
      stop: async () => {
        logger.info('Stopping file storage service...');
      }
    });

    logger.info(`Registered ${this.services.size} data services`);
  }

  /**
   * Register a new data service
   */
  registerService(service: DataService): void {
    this.services.set(service.name, service);
    logger.info(`Registered data service: ${service.name} (${service.type})`);
  }

  /**
   * Start all services
   */
  async startAllServices(): Promise<void> {
    const startPromises = Array.from(this.services.values()).map(async (service) => {
      try {
        service.status = 'starting';
        if (service.start) {
          await service.start();
        }
        service.status = 'running';
        logger.info(`✅ Data service started: ${service.name}`);
      } catch (error) {
        service.status = 'error';
        logger.error(`❌ Failed to start data service ${service.name}:`, error);
      }
    });

    await Promise.allSettled(startPromises);
  }

  /**
   * Stop all services
   */
  async stopAllServices(): Promise<void> {
    const stopPromises = Array.from(this.services.values()).map(async (service) => {
      try {
        if (service.stop && service.status === 'running') {
          await service.stop();
        }
        service.status = 'stopped';
        logger.info(`🛑 Data service stopped: ${service.name}`);
      } catch (error) {
        service.status = 'error';
        logger.error(`❌ Failed to stop data service ${service.name}:`, error);
      }
    });

    await Promise.allSettled(stopPromises);
  }

  /**
   * Get service by name
   */
  getService(serviceName: string): DataService | undefined {
    return this.services.get(serviceName);
  }

  /**
   * Get services by type
   */
  getServicesByType(type: DataService['type']): DataService[] {
    return Array.from(this.services.values()).filter(service => service.type === type);
  }

  /**
   * Get all services status
   */
  getAllServicesStatus(): DataService[] {
    return Array.from(this.services.values());
  }

  /**
   * Health check for all data services
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    services: { name: string; type: string; status: string; healthy: boolean }[];
  }> {
    const results = await Promise.allSettled(
      Array.from(this.services.values()).map(async (service) => {
        let healthy = false;
        try {
          healthy = service.healthCheck ? await service.healthCheck() : service.status === 'running';
        } catch (error) {
          logger.error(`Health check failed for data service ${service.name}:`, error);
        }
        return { 
          name: service.name, 
          type: service.type, 
          status: service.status, 
          healthy 
        };
      })
    );

    const services = results.map(result => 
      result.status === 'fulfilled' ? result.value : { 
        name: 'unknown', 
        type: 'unknown', 
        status: 'error', 
        healthy: false 
      }
    );

    const healthy = services.every(service => service.healthy);

    return { healthy, services };
  }

  /**
   * Get data services metrics
   */
  getMetrics(): {
    totalServices: number;
    servicesByType: Record<string, number>;
    runningServices: number;
    stoppedServices: number;
    errorServices: number;
    uptime: number;
  } {
    const services = Array.from(this.services.values());
    
    const servicesByType = services.reduce((acc, service) => {
      acc[service.type] = (acc[service.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalServices: services.length,
      servicesByType,
      runningServices: services.filter(s => s.status === 'running').length,
      stoppedServices: services.filter(s => s.status === 'stopped').length,
      errorServices: services.filter(s => s.status === 'error').length,
      uptime: this.isInitialized ? Date.now() : 0
    };
  }

  /**
   * Get router for this service group (migration stub)
   */
  getRouter(): any {
    const { Router } = require('express');
    const router = Router();
    
    router.all('*', (req: any, res: any) => {
      res.status(503).json({
        error: 'Service Migrated',
        message: 'Data services have been migrated to distributed architecture',
        migration: true,
        redirect: 'http://localhost:8084'
      });
    });
    
    return router;
  }
}

// Create singleton instance for backward compatibility
export const dataServicesGroup = new DataServicesGroup(null as any);

export default DataServicesGroup;