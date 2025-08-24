/**
 * AI Services Group - Consolidated AI and LLM services
 * Manages all AI-related services including models, agents, and reasoning
 */

import { Express } from 'express';
import { logger } from '../utils/enhanced-logger.js';

export interface AIService {
  name: string;
  type: 'llm' | 'agent' | 'reasoning' | 'vision' | 'voice';
  status: 'starting' | 'running' | 'stopped' | 'error';
  endpoint?: string;
  healthCheck?: () => Promise<boolean>;
  start?: () => Promise<void>;
  stop?: () => Promise<void>;
}

export class AIServicesGroup {
  private services: Map<string, AIService> = new Map();
  private isInitialized = false;

  constructor(private app: Express) {}

  /**
   * Initialize all AI services
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('AI services already initialized');
      return;
    }

    try {
      logger.info('🤖 Initializing AI Services Group...');

      // Register AI services
      await this.registerAIServices();

      // Start all services
      await this.startAllServices();

      this.isInitialized = true;
      logger.info('✅ AI Services Group initialized successfully');
    } catch (error) {
      logger.error('❌ Failed to initialize AI Services Group:', error);
      throw error;
    }
  }

  /**
   * Register all AI services
   */
  private async registerAIServices(): Promise<void> {
    // LLM Router Service
    this.registerService({
      name: 'llm-router',
      type: 'llm',
      status: 'stopped',
      endpoint: '/api/llm',
      healthCheck: async () => true,
      start: async () => {
        logger.info('Starting LLM router service...');
        // LLM router logic would go here
      },
      stop: async () => {
        logger.info('Stopping LLM router service...');
      }
    });

    // Ollama Local LLM Service
    this.registerService({
      name: 'ollama-service',
      type: 'llm',
      status: 'stopped',
      endpoint: '/api/ollama',
      healthCheck: async () => {
        try {
          // Check if Ollama is available
          return process.env.OLLAMA_ENABLED === 'true';
        } catch {
          return false;
        }
      },
      start: async () => {
        logger.info('Starting Ollama service...');
        // Ollama service logic would go here
      },
      stop: async () => {
        logger.info('Stopping Ollama service...');
      }
    });

    // Agent Orchestration Service
    this.registerService({
      name: 'agent-orchestrator',
      type: 'agent',
      status: 'stopped',
      endpoint: '/api/agents',
      healthCheck: async () => true,
      start: async () => {
        logger.info('Starting agent orchestrator service...');
        // Agent orchestration logic would go here
      },
      stop: async () => {
        logger.info('Stopping agent orchestrator service...');
      }
    });

    // Reasoning Engine Service
    this.registerService({
      name: 'reasoning-engine',
      type: 'reasoning',
      status: 'stopped',
      endpoint: '/api/reasoning',
      healthCheck: async () => true,
      start: async () => {
        logger.info('Starting reasoning engine service...');
        // Reasoning engine logic would go here
      },
      stop: async () => {
        logger.info('Stopping reasoning engine service...');
      }
    });

    // Vision Service
    this.registerService({
      name: 'vision-service',
      type: 'vision',
      status: 'stopped',
      endpoint: '/api/vision',
      healthCheck: async () => {
        try {
          return process.env.VISION_ENABLED !== 'false';
        } catch {
          return false;
        }
      },
      start: async () => {
        logger.info('Starting vision service...');
        // Vision service logic would go here
      },
      stop: async () => {
        logger.info('Stopping vision service...');
      }
    });

    // Voice/TTS Service
    this.registerService({
      name: 'voice-service',
      type: 'voice',
      status: 'stopped',
      endpoint: '/api/voice',
      healthCheck: async () => {
        try {
          return process.env.TTS_ENABLED !== 'false';
        } catch {
          return false;
        }
      },
      start: async () => {
        logger.info('Starting voice service...');
        // Voice service logic would go here
      },
      stop: async () => {
        logger.info('Stopping voice service...');
      }
    });

    logger.info(`Registered ${this.services.size} AI services`);
  }

  /**
   * Register a new AI service
   */
  registerService(service: AIService): void {
    this.services.set(service.name, service);
    logger.info(`Registered AI service: ${service.name} (${service.type})`);
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
        logger.info(`✅ AI service started: ${service.name}`);
      } catch (error) {
        service.status = 'error';
        logger.error(`❌ Failed to start AI service ${service.name}:`, error);
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
        logger.info(`🛑 AI service stopped: ${service.name}`);
      } catch (error) {
        service.status = 'error';
        logger.error(`❌ Failed to stop AI service ${service.name}:`, error);
      }
    });

    await Promise.allSettled(stopPromises);
  }

  /**
   * Get service by name
   */
  getService(serviceName: string): AIService | undefined {
    return this.services.get(serviceName);
  }

  /**
   * Get services by type
   */
  getServicesByType(type: AIService['type']): AIService[] {
    return Array.from(this.services.values()).filter(service => service.type === type);
  }

  /**
   * Get all services status
   */
  getAllServicesStatus(): AIService[] {
    return Array.from(this.services.values());
  }

  /**
   * Health check for all AI services
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
          logger.error(`Health check failed for AI service ${service.name}:`, error);
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
   * Restart a specific service
   */
  async restartService(serviceName: string): Promise<void> {
    const service = this.services.get(serviceName);
    if (!service) {
      throw new Error(`AI service not found: ${serviceName}`);
    }

    logger.info(`Restarting AI service: ${serviceName}`);
    
    try {
      if (service.stop && service.status === 'running') {
        await service.stop();
      }
      
      service.status = 'starting';
      if (service.start) {
        await service.start();
      }
      service.status = 'running';
      
      logger.info(`✅ AI service restarted: ${serviceName}`);
    } catch (error) {
      service.status = 'error';
      logger.error(`❌ Failed to restart AI service ${serviceName}:`, error);
      throw error;
    }
  }

  /**
   * Get AI services metrics
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
   * Route AI requests to appropriate service
   */
  async routeRequest(type: AIService['type'], request: any): Promise<any> {
    const availableServices = this.getServicesByType(type).filter(s => s.status === 'running');
    
    if (availableServices.length === 0) {
      throw new Error(`No running services available for type: ${type}`);
    }

    // Simple round-robin routing (can be enhanced with load balancing)
    const service = availableServices[0];
    
    logger.info(`Routing ${type} request to ${service.name}`);
    
    // Return mock response for now
    return {
      service: service.name,
      type: service.type,
      status: 'processed',
      timestamp: new Date().toISOString()
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
        message: 'AI services have been migrated to Rust AI Core',
        migration: true,
        redirect: 'http://localhost:8083'
      });
    });
    
    return router;
  }
}

// Create singleton instance for backward compatibility
export const aiServicesGroup = new AIServicesGroup(null as any);

export default AIServicesGroup;