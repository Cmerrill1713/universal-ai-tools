/**
 * Integration Services Group - Migration Stub
 * External integrations and third-party services
 */

import { Express } from 'express';
import { logger } from '../utils/enhanced-logger.js';

export class IntegrationServicesGroup {
  private isInitialized = false;
  
  constructor(private app: Express) {}
  
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Integration services already initialized');
      return;
    }
    
    logger.info('🔌 Initializing Integration Services Group...');
    this.isInitialized = true;
    logger.info('✅ Integration Services Group initialized (migrated to Go)');
  }
  
  async shutdown(): Promise<void> {
    logger.info('Integration services group: Shutdown handled by Go services');
    this.isInitialized = false;
  }
  
  getStatus() {
    return {
      healthy: true,
      migrated: true,
      services: ['github', 'searxng', 'external-apis'],
      gateway: 'http://localhost:8080'
    };
  }

  getRouter(): any {
    const { Router } = require('express');
    const router = Router();
    
    router.all('*', (req: any, res: any) => {
      res.status(503).json({
        error: 'Service Migrated',
        message: 'Integration services have been migrated to Go API Gateway',
        migration: true,
        redirect: 'http://localhost:8080'
      });
    });
    
    return router;
  }
}

// Create singleton instance for backward compatibility
export const integrationServicesGroup = new IntegrationServicesGroup(null as any);

export default IntegrationServicesGroup;