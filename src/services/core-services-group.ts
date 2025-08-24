/**
 * Core Services Group - Essential system services
 * Consolidates core infrastructure services for better resource management
 */

import { Express } from 'express';
import { Server } from 'http';
import { logger } from '../utils/enhanced-logger.js';

export interface CoreService {
  name: string;
  status: 'starting' | 'running' | 'stopped' | 'error';
  healthCheck?: () => Promise<boolean>;
  start?: () => Promise<void>;
  stop?: () => Promise<void>;
}

export class CoreServicesGroup {
  private services: Map<string, CoreService> = new Map();
  private isInitialized = false;

  constructor(private app: Express, private server?: Server) {}

  /**
   * Initialize all core services
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Core services already initialized');
      return;
    }

    try {
      logger.info('🚀 Initializing Core Services Group...');

      // Register core services
      await this.registerCoreServices();

      // Start all services
      await this.startAllServices();

      this.isInitialized = true;
      logger.info('✅ Core Services Group initialized successfully');
    } catch (error) {
      logger.error('❌ Failed to initialize Core Services Group:', error);
      throw error;
    }
  }

  /**
   * Register all core services
   */
  private async registerCoreServices(): Promise<void> {
    // Health monitoring service
    this.registerService({
      name: 'health-monitor',
      status: 'stopped',
      healthCheck: async () => true,
      start: async () => {
        logger.info('Starting health monitor service...');
        // Health monitor logic would go here
      },
      stop: async () => {
        logger.info('Stopping health monitor service...');
      }
    });

    // Error tracking service
    this.registerService({
      name: 'error-tracker',
      status: 'stopped',
      healthCheck: async () => true,
      start: async () => {
        logger.info('Starting error tracker service...');
        // Error tracking logic would go here
      },
      stop: async () => {
        logger.info('Stopping error tracker service...');
      }
    });

    // Metrics collection service
    this.registerService({
      name: 'metrics-collector',
      status: 'stopped',
      healthCheck: async () => true,
      start: async () => {
        logger.info('Starting metrics collector service...');
        // Metrics collection logic would go here
      },
      stop: async () => {
        logger.info('Stopping metrics collector service...');
      }
    });

    // Configuration service
    this.registerService({
      name: 'config-manager',
      status: 'stopped',
      healthCheck: async () => true,
      start: async () => {
        logger.info('Starting configuration manager service...');
        // Configuration management logic would go here
      },
      stop: async () => {
        logger.info('Stopping configuration manager service...');
      }
    });

    logger.info(`Registered ${this.services.size} core services`);
  }

  /**
   * Register a new service
   */
  registerService(service: CoreService): void {
    this.services.set(service.name, service);
    logger.info(`Registered core service: ${service.name}`);
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
        logger.info(`✅ Core service started: ${service.name}`);
      } catch (error) {
        service.status = 'error';
        logger.error(`❌ Failed to start core service ${service.name}:`, error);
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
        logger.info(`🛑 Core service stopped: ${service.name}`);
      } catch (error) {
        service.status = 'error';
        logger.error(`❌ Failed to stop core service ${service.name}:`, error);
      }
    });

    await Promise.allSettled(stopPromises);
  }

  /**
   * Get service status
   */
  getServiceStatus(serviceName: string): CoreService | undefined {
    return this.services.get(serviceName);
  }

  /**
   * Get all services status
   */
  getAllServicesStatus(): CoreService[] {
    return Array.from(this.services.values());
  }

  /**
   * Health check for all services
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    services: { name: string; status: string; healthy: boolean }[];
  }> {
    const results = await Promise.allSettled(
      Array.from(this.services.values()).map(async (service) => {
        let healthy = false;
        try {
          healthy = service.healthCheck ? await service.healthCheck() : service.status === 'running';
        } catch (error) {
          logger.error(`Health check failed for ${service.name}:`, error);
        }
        return { name: service.name, status: service.status, healthy };
      })
    );

    const services = results.map(result => 
      result.status === 'fulfilled' ? result.value : { name: 'unknown', status: 'error', healthy: false }
    );

    const healthy = services.every(service => service.healthy);

    return { healthy, services };
  }

  /**
   * Restart a specific service
   */
  async restartService(serviceName: string): Promise<void> {
    const service = this.services.get(serviceName);
    if (!service) {
      throw new Error(`Service not found: ${serviceName}`);
    }

    logger.info(`Restarting core service: ${serviceName}`);
    
    try {
      if (service.stop && service.status === 'running') {
        await service.stop();
      }
      
      service.status = 'starting';
      if (service.start) {
        await service.start();
      }
      service.status = 'running';
      
      logger.info(`✅ Core service restarted: ${serviceName}`);
    } catch (error) {
      service.status = 'error';
      logger.error(`❌ Failed to restart core service ${serviceName}:`, error);
      throw error;
    }
  }

  /**
   * Get service metrics
   */
  getMetrics(): {
    totalServices: number;
    runningServices: number;
    stoppedServices: number;
    errorServices: number;
    uptime: number;
  } {
    const services = Array.from(this.services.values());
    
    return {
      totalServices: services.length,
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
    // Return a stub router for migration compatibility
    const { Router } = require('express');
    const router = Router();
    
    router.all('*', (req: any, res: any) => {
      res.status(503).json({
        error: 'Service Migrated',
        message: 'Core services have been migrated to Go API Gateway',
        migration: true,
        redirect: 'http://localhost:8080'
      });
    });
    
    return router;
  }
}

// Create singleton instance for backward compatibility
export const coreServicesGroup = new CoreServicesGroup(null as any);

export default CoreServicesGroup;