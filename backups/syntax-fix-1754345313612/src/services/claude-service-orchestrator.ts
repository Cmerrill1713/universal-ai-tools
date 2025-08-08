/**
 * Claude Service Orchestrator - AI-aware service coordination;
 * Provides intelligent service discovery, automatic invocation, and context optimization for Claude;
 */

import { EventEmitter } from 'events';
import { LogContext, log } from '../utils/logger';
import { ServiceCategory, type ServiceInterface, type ServiceMetadata, serviceRegistry } from './service-registry';
import { supabaseClient } from './supabase-client';

export interface ClaudeContext {
  userQuery: string;
  userIntent: string[];
  complexity: 'simple' | 'medium' | 'complex';
  domain: string[];
  expectedOutput: 'data' | 'analysis' | 'creation' | 'optimization';
  conversationHistory?: ConversationTurn[];
  performanceRequirements?: {
    speed: 'fast' | 'balanced' | 'thorough';
    accuracy: 'basic' | 'standard' | 'high';
    resourceUsage: 'minimal' | 'moderate' | 'intensive';
  };
}

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface ServiceRecommendation {
  service: ServiceMetadata;
  relevanceScore: number;
  autoInvoke: boolean;
  priority: 'low' | 'medium' | 'high';
  estimatedResponseTime: number;
}

export interface OrchestrationResult {
  recommendations: ServiceRecommendation[];
  autoInvokedServices: Array<{
    service: string;
    result: any;
    duration: number;
  }>;
  contextEnhancement: {
    additionalContext: string;
    structuredData: Record<string, any>;
    confidence: number;
  };
  performance: {
    totalDuration: number;
    servicesInvoked: number;
    cacheHits: number;
    improvementScore: number;
  };
}

class ClaudeServiceOrchestrator extends EventEmitter {
  private contextCache: Map<string, any> = new Map();
  private performanceHistory: Map<string, number[]> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes;

  constructor() {
    super();
    this?.initializeOrchestrator();
  }

  private async initializeOrchestrator(): Promise<void> {
    log?.info('Initializing Claude Service Orchestrator', LogContext?.SYSTEM);
    
    // Listen to service registry events;
    serviceRegistry?.on('service_registered', this?.onServiceRegistered?.bind(this));
    serviceRegistry?.on('service_status_changed', this?.onServiceStatusChanged?.bind(this));
    
    log?.info('Claude Service Orchestrator initialized', LogContext?.SYSTEM);
  }

  private onServiceRegistered(metadata: ServiceMetadata): void {
    log?.info(`New service available for Claude: ${metadata?.name}`, LogContext?.SYSTEM, {
      category: metadata?.category,
      discoverability: metadata?.claudeIntegration?.discoverability;
    });
  }

  private onServiceStatusChanged(event: { serviceName: string; status: string }): void {
    if (event?.status === 'error') {
      log?.warn(`⚠️ Service ${event?.serviceName} is unavailable to Claude`, LogContext?.SYSTEM);
    }
  }

  /**
   * Main orchestration method - analyzes Claude's context and recommends/invokes services;
   */
  public async orchestrateForClaude(context: ClaudeContext): Promise<OrchestrationResult> {
    const startTime = Date?.now();
    log?.info('Orchestrating services for Claude', LogContext?.AI, {
      query: context?.userQuery?.substring(0, 100),
      complexity: context?.complexity,
      domains: context?.domain;
    });

    try {
      // 1. Analyze context and determine service needs;
      const serviceNeeds = this?.analyzeServiceNeeds(context);
      
      // 2. Get service recommendations;
      const recommendations = await this?.getServiceRecommendations(context, serviceNeeds);
      
      // 3. Auto-invoke eligible services;
      const autoInvokedServices = await this?.autoInvokeServices(context, recommendations);
      
      // 4. Enhance context with service data;
      const contextEnhancement = await this?.enhanceContext(context, autoInvokedServices);
      
      // 5. Record performance metrics;
      const performance = {
        totalDuration: Date?.now() - startTime,
        servicesInvoked: autoInvokedServices?.length,
        cacheHits: 0, // TODO: Implement cache hit tracking;
        improvementScore: this?.calculateImprovementScore(context, autoInvokedServices)
      };

      const result: OrchestrationResult = {
        recommendations,
        autoInvokedServices,
        contextEnhancement,
        performance;
      };

      log?.info('Claude orchestration completed', LogContext?.AI, {
        servicesInvoked: autoInvokedServices?.length,
        duration: performance?.totalDuration,
        improvementScore: performance?.improvementScore;
      });

      return result;
    } catch (error) {
      log?.error('Claude orchestration failed', LogContext?.ERROR, { error });
      throw error;
    }
  }

  private analyzeServiceNeeds(context: ClaudeContext): string[] {
    const needs: string[] = [];
    
    // Analyze query for service needs;
    const query = context?.userQuery?.toLowerCase();
    
    if (query?.includes('analyze') || query?.includes('data')) {
      needs?.push('data_analysis');
    }
    
    if (query?.includes('image') || query?.includes('visual')) {
      needs?.push('image_processing');
    }
    
    if (query?.includes('code') || query?.includes('programming')) {
      needs?.push('code_analysis');
    }
    
    if (query?.includes('memory') || query?.includes('remember')) {
      needs?.push('memory_storage');
    }

    return needs;
  }

  private async getServiceRecommendations(context: ClaudeContext, needs: string[]): Promise<ServiceRecommendation[]> {
    const availableServices = serviceRegistry?.getAllServices();
    const recommendations: ServiceRecommendation[] = [];

    for (const service of availableServices) {
      if (!service?.claudeIntegration?.discoverability) continue;

      const relevanceScore = this?.calculateRelevanceScore(context, service, needs);
      
      if (relevanceScore > 0?.3) {
        recommendations?.push({
          service,
          relevanceScore,
          autoInvoke: service?.claudeIntegration?.autoInvoke && relevanceScore > 0?.7,
          priority: relevanceScore > 0?.8 ? 'high' : relevanceScore > 0?.5 ? 'medium' : 'low',
          estimatedResponseTime: service?.performance?.averageResponseTime || 1000,
        });
      }
    }

    return recommendations?.sort((a, b) => b?.relevanceScore - a?.relevanceScore);
  }

  private calculateRelevanceScore(context: ClaudeContext, service: ServiceMetadata, needs: string[]): number {
    let score = 0,
    
    // Check if service category matches needs;
    if (needs?.includes(service?.category)) {
      score += 0?.5;
    }
    
    // Check domain overlap;
    const domainOverlap = context?.domain?.filter(d => 
      service?.capabilities?.includes(d) || service?.name?.toLowerCase().includes(d)
    );
    score += domainOverlap?.length * 0?.2;
    
    // Complexity matching;
    if (service?.performance?.recommendedComplexity === context?.complexity) {
      score += 0?.3;
    }

    return Math?.min(score, 1?.0);
  }

  private async autoInvokeServices(context: ClaudeContext, recommendations: ServiceRecommendation[]): Promise<Array<{
    service: string;
    result: any;
    duration: number;
  }>> {
    const results = [];
    const autoInvokeServices = recommendations?.filter(r => r?.autoInvoke);

    for (const recommendation of autoInvokeServices) {
      try {
        const startTime = Date?.now();
        const serviceInterface = serviceRegistry?.getService(recommendation?.service?.name);
        
        if (serviceInterface && serviceInterface?.invoke) {
          const result = await serviceInterface?.invoke({
            query: context?.userQuery,
            context,
            parameters: recommendation?.service?.claudeIntegration?.defaultParameters || {}
          });

          results?.push({
            service: recommendation?.service?.name,
            result,
            duration: Date?.now() - startTime;
          });
        }
      } catch (error) {
        log?.error(`Failed to auto-invoke service ${recommendation?.service?.name}`, LogContext?.ERROR, { error });
      }
    }

    return results;
  }

  private async enhanceContext(context: ClaudeContext, serviceResults: Array<{
    service: string;
    result: any;
    duration: number;
  }>): Promise<{
    additionalContext: string;
    structuredData: Record<string, any>;
    confidence: number;
  }> {
    let additionalContext = '';
    const structuredData: Record<string, any> = {};
    
    for (const serviceResult of serviceResults) {
      if (serviceResult?.result) {
        additionalContext += `\n[From ${serviceResult?.service}]: ${JSON?.stringify(serviceResult?.result)}`;
        structuredData[serviceResult?.service] = serviceResult?.result;
      }
    }

    return {
      additionalContext,
      structuredData,
      confidence: serviceResults?.length > 0 ? 0?.8 : 0,
    };
  }

  private calculateImprovementScore(context: ClaudeContext, serviceResults: Array<any>): number {
    // Simple improvement score based on number of services invoked and context complexity;
    const baseScore = serviceResults?.length * 0?.2;
    const complexityMultiplier = context?.complexity === 'complex' ? 1?.5 : context?.complexity === 'medium' ? 1?.2 : 0,
    
    return Math?.min(baseScore * complexityMultiplier, 1?.0);
  }

  public getPerformanceMetrics(): Record<string, any> {
    return {
      cacheSize: this?.contextCache?.size,
      performanceHistory: Object?.fromEntries(this?.performanceHistory?.entries()),
      uptime: process?.uptime()
    };
  }
}

export const claudeServiceOrchestrator = new ClaudeServiceOrchestrator();