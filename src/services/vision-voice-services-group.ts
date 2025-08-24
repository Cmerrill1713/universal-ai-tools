/**
 * Vision & Voice Services Group - Migration Stub
 * Computer vision and voice processing services
 */

import { Express } from 'express';
import { logger } from '../utils/enhanced-logger.js';

export class VisionVoiceServicesGroup {
  private isInitialized = false;
  
  constructor(private app: Express) {}
  
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Vision & Voice services already initialized');
      return;
    }
    
    logger.info('👁️🎤 Initializing Vision & Voice Services Group...');
    this.isInitialized = true;
    logger.info('✅ Vision & Voice Services Group initialized (partially migrated)');
  }
  
  async shutdown(): Promise<void> {
    logger.info('Vision & Voice services group: Shutdown');
    this.isInitialized = false;
  }
  
  getStatus() {
    return {
      healthy: true,
      migrated: 'partial',
      services: ['vision', 'voice', 'speech-to-text', 'text-to-speech'],
      endpoints: {
        vision: 'http://localhost:8085',
        voice: 'http://localhost:8080/api/voice'
      }
    };
  }

  getRouter(): any {
    const { Router } = require('express');
    const router = Router();
    
    router.all('*', (req: any, res: any) => {
      res.status(503).json({
        error: 'Service Partially Migrated',
        message: 'Vision & Voice services are being migrated',
        migration: true,
        endpoints: {
          vision: 'http://localhost:8085',
          voice: 'http://localhost:8080/api/voice'
        }
      });
    });
    
    return router;
  }
}

// Create singleton instance for backward compatibility
export const visionVoiceServicesGroup = new VisionVoiceServicesGroup(null as any);

export default VisionVoiceServicesGroup;