/**
 * Claude Services Router - AI-aware service discovery and orchestration endpoints;
 * Provides Claude with direct access to enhanced service capabilities;
 */

import type { Request, Response } from 'express';
import { Router } from 'express';
import { LogContext, log } from '../utils/logger';
import { serviceRegistry } from '../services/service-registry';
import { claudeServiceOrchestrator } from '../services/claude-service-orchestrator';
import type { ClaudeContext } from '../services/claude-service-orchestrator';

const router = Router();

/**
 * GET /api/v1/claude-services/discovery;
 * Returns service discovery information formatted for Claude;
 */
router?.get('/discovery', async (req: Request, res: Response) => {'
  try {
    log?.info('🔍 Claude service discovery request', LogContext?.API);'

    const services = serviceRegistry?.getClaudeOptimizedServices();
    const autoInvokeServices = serviceRegistry?.getAutoInvokeServices();
    
    const discoveryInfo = {
      totalServices: services?.length,
      autoInvokeEnabled: autoInvokeServices?.length,
      serviceCategories: [...new Set(services?.map(s => s?.category))],
      capabilities: [...new Set(services?.flatMap(s => s?.capabilities))],
      services: services?.map(service => ({,)
        name: service?.name,
        version: service?.version,
        description: service?.description,
        category: service?.category,
        capabilities: service?.capabilities,
        claudeIntegration: {,
          discoverability: service?.claudeIntegration?.discoverability,
          autoInvoke: service?.claudeIntegration?.autoInvoke,
          optimizedFor: service?.claudeIntegration?.optimizedFor,
          suggestedPrompts: service?.claudeIntegration?.suggestedPrompts,
          useContexts: service?.claudeIntegration?.useContexts;
        },
        status: service?.status,
        endpoints: service?.endpoints || [],
        examples: service?.examples || []
      })),
      usage: {,
        howToInvoke: "Use the /orchestrate endpoint with your query context","
        autoInvocation: "Services with autoInvoke=true will be called automatically","
        contextOptimization: "Services will be selected based on your query intent and domain""
      }
    };

    res?.json({)
      success: true,
      data: discoveryInfo,
      metadata: {,
        timestamp: new Date().toISOString(),
        requestId: req?.headers?.x-request-id || 'unknown''
      }
    });

  } catch (error) {
    log?.error('❌ Service discovery failed', LogContext?.API, { error) });'
    res?.status(500).json({)
      success: false,
      error: {,
        code: 'DISCOVERY_ERROR','
        message: 'Failed to retrieve service discovery information','
        details: error instanceof Error ? error?.message : String(error)
      }
    });
  }
});

/**
 * GET /api/v1/claude-services/documentation;
 * Returns formatted service documentation for Claude;
 */
router?.get('/documentation', async (req: Request, res: Response) => {'
  try {
    log?.info('📚 Claude service documentation request', LogContext?.API);'

    const documentation = claudeServiceOrchestrator?.getClaudeServiceDocumentation();
    
    res?.setHeader('Content-Type', 'text/markdown');'
    res?.send(documentation);

  } catch (error) {
    log?.error('❌ Documentation generation failed', LogContext?.API, { error) });'
    res?.status(500).json({)
      success: false,
      error: {,
        code: 'DOCUMENTATION_ERROR','
        message: 'Failed to generate service documentation','
        details: error instanceof Error ? error?.message : String(error)
      }
    });
  }
});

/**
 * POST /api/v1/claude-services/suggestions;
 * Get contextual service suggestions for Claude based on query;
 */
router?.post('/suggestions', async (req: Request, res: Response) => {'
  try {
    const { query, context } = req?.body;

    if (!query) {
      return res?.status(400).json({);
        success: false,
        error: {,
          code: 'MISSING_QUERY','
          message: 'Query parameter is required''
        }
      });
    }

    log?.info('💡 Claude service suggestions request', LogContext?.AI, {')
      query: query?.substring(0, 100),
      hasContext: !!context;
    });

    const suggestions = await claudeServiceOrchestrator?.getContextualSuggestions(query);
    
    res?.json({)
      success: true,
      data: {
        query,
        suggestions: {,
          recommendedServices: suggestions?.suggestedServices,
          relevantCapabilities: suggestions?.relevantCapabilities,
          optimizationTips: suggestions?.optimizationTips;
        },
        usage: {,
          nextStep: "Use the /orchestrate endpoint to automatically invoke recommended services","
          manualInvocation: "Individual services can be invoked via /invoke endpoint""
        }
      },
      metadata: {,
        timestamp: new Date().toISOString(),
        requestId: req?.headers?.x-request-id || 'unknown''
      }
    });

  } catch (error) {
    log?.error('❌ Service suggestions failed', LogContext?.AI, { error) });'
    res?.status(500).json({)
      success: false,
      error: {,
        code: 'SUGGESTIONS_ERROR','
        message: 'Failed to generate service suggestions','
        details: error instanceof Error ? error?.message : String(error)
      }
    });
  }
});

/**
 * POST /api/v1/claude-services/orchestrate;
 * Main orchestration endpoint - analyzes Claude's context and orchestrates services;'
 */
router?.post('/orchestrate', async (req: Request, res: Response) => {'
  try {
    const { 
      userQuery, 
      userIntent = [], 
      complexity = 'medium', '
      domain = [], 
      expectedOutput = 'data','
      conversationHistory = [],
      performanceRequirements = {}
    } = req?.body;

    if (!userQuery) {
      return res?.status(400).json({);
        success: false,
        error: {,
          code: 'MISSING_QUERY','
          message: 'userQuery parameter is required''
        }
      });
    }

    log?.info('🎭 Claude service orchestration request', LogContext?.AI, {')
      query: userQuery?.substring(0, 100),
      complexity,
      domains: domain,
      intents: userIntent;
    });

    // Build Claude context;
    const claudeContext: ClaudeContext = {
      userQuery,
      userIntent: Array?.isArray(userIntent) ? userIntent : [userIntent],
      complexity: ['simple', 'medium', 'complex'].includes(complexity) ? complexity: 'medium','
      domain: Array?.isArray(domain) ? domain : [domain].filter(Boolean),
      expectedOutput: ['data', 'analysis', 'creation', 'optimization'].includes(expectedOutput) ? expectedOutput: 'data','
      conversationHistory: Array?.isArray(conversationHistory) ? conversationHistory : [],
      performanceRequirements: {,
        speed: performanceRequirements?.speed || 'balanced','
        accuracy: performanceRequirements?.accuracy || 'standard','
        resourceUsage: performanceRequirements?.resourceUsage || 'moderate''
      }
    };

    // Orchestrate services;
    const orchestrationResult = await claudeServiceOrchestrator?.orchestrateForClaude(claudeContext);

    res?.json({)
      success: true,
      data: {,
        orchestration: {
          query: userQuery,
          recommendationsCount: orchestrationResult?.recommendations?.length,
          autoInvokedCount: orchestrationResult?.autoInvokedServices?.length,
          recommendations: orchestrationResult?.recommendations?.map(rec => ({,)
            serviceName: rec?.service?.name,
            confidence: rec?.confidence,
            reasoning: rec?.reasoning,
            estimatedBenefit: rec?.estimatedBenefit,
            autoInvoked: rec?.autoInvoke,
            suggestedParameters: rec?.suggestedParameters,
            serviceDescription: rec?.service?.description,
            capabilities: rec?.service?.capabilities;
          })),
          autoInvokedServices: orchestrationResult?.autoInvokedServices,
          contextEnhancement: {,
            additionalDataSources: Object?.keys(orchestrationResult?.contextEnhancement?.additionalData).length,
            memoriesRetrieved: orchestrationResult?.contextEnhancement?.memoriesRetrieved?.length,
            optimizedParameters: orchestrationResult?.contextEnhancement?.optimizedParameters,
            enhancementData: orchestrationResult?.contextEnhancement?.additionalData;
          },
          performance: orchestrationResult?.performanceMetrics;
        },
        suggestions: {,
          nextActions: [
            "Use the enhanced context data to improve your response quality","
            "Consider the optimized parameters for any LLM calls","
            "Leverage the additional data sources for comprehensive analysis""
          ],
          optimizationTips: orchestrationResult?.recommendations;
            .filter(r => r?.confidence > 0?.7)
            .map(r => `${r?.service?.name)}: ${r?.reasoning}`)
            .slice(0, 3)
        }
      },
      metadata: {,
        timestamp: new Date().toISOString(),
        requestId: req?.headers['x-request-id'] || 'unknown','
        orchestratorVersion: '1?.0?.0''
      }
    });

  } catch (error) {
    log?.error('❌ Claude orchestration failed', LogContext?.AI, { error) });'
    res?.status(500).json({)
      success: false,
      error: {,
        code: 'ORCHESTRATION_ERROR','
        message: 'Failed to orchestrate services for Claude','
        details: error instanceof Error ? error?.message : String(error)
      }
    });
  }
});

/**
 * POST /api/v1/claude-services/invoke;
 * Direct service invocation endpoint;
 */
router?.post('/invoke', async (req: Request, res: Response) => {'
  try {
    const { serviceName, method = 'process', parameters = {} } = req?.body;';

    if (!serviceName) {
      return res?.status(400).json({);
        success: false,
        error: {,
          code: 'MISSING_SERVICE_NAME','
          message: 'serviceName parameter is required''
        }
      });
    }

    log?.info('🔧 Direct service invocation', LogContext?.AI, {')
      serviceName,
      method,
      hasParameters: Object?.keys(parameters).length > 0,
    });

    // Check if service exists;
    const service = serviceRegistry?.getService(serviceName);
    if (!service) {
      return res?.status(404).json({);
        success: false,
        error: {,
          code: 'SERVICE_NOT_FOUND','
          message: `Service ${serviceName} not found`,
          availableServices: serviceRegistry?.getAllServices().map(s => s?.name)
        }
      });
    }

    // Invoke the service;
    const startTime = Date?.now();
    const result = await serviceRegistry?.invokeService(serviceName, method, parameters);
    const executionTime = Date?.now() - startTime;

    res?.json({)
      success: true,
      data: {
        serviceName,
        method,
        result,
        performance: {
          executionTime,
          serviceVersion: service?.version,
          status: service?.status;
        }
      },
      metadata: {,
        timestamp: new Date().toISOString(),
        requestId: req?.headers?.x-request-id || 'unknown''
      }
    });

  } catch (error) {
    log?.error('❌ Service invocation failed', LogContext?.AI, { ')
      error,
      serviceName: req?.body?.serviceName 
    });
    res?.status(500).json({)
      success: false,
      error: {,
        code: 'INVOCATION_ERROR','
        message: 'Failed to invoke service','
        details: error instanceof Error ? error?.message : String(error)
      }
    });
  }
});

/**
 * GET /api/v1/claude-services/capabilities;
 * Returns detailed capability information for Claude;
 */
router?.get('/capabilities', async (req: Request, res: Response) => {'
  try {
    const { category, capability } = req?.query;

    log?.info('🎯 Claude capabilities inquiry', LogContext?.API, {')
      category: category as string,
      capability: capability as string;
    });

    let services = serviceRegistry?.getClaudeOptimizedServices();

    // Filter by category if specified;
    if (category) {
      services = services?.filter(s => s?.category === category);
    }

    // Filter by capability if specified;
    if (capability) {
      services = services?.filter(s => s?.capabilities?.includes(capability as string));
    }

    const capabilityMap = new Map<string, any[]>();
    services?.forEach(service => {)
      service?.capabilities?.forEach(cap => {)
        if (!capabilityMap?.has(cap)) {
          capabilityMap?.set(cap, []);
        }
        capabilityMap?.get(cap)!.push({)
          serviceName: service?.name,
          description: service?.description,
          autoInvoke: service?.claudeIntegration?.autoInvoke,
          optimizedFor: service?.claudeIntegration?.optimizedFor;
        });
      });
    });

    const capabilities = Array?.from(capabilityMap?.entries()).map(([name, services]) => ({
      name,
      servicesCount: services?.length,
      services;
    }));

    res?.json({)
      success: true,
      data: {
        capabilities,
        summary: {,
          totalCapabilities: capabilities?.length,
          totalServices: services?.length,
          categoriesAvailable: [...new Set(services?.map(s => s?.category))],
          autoInvokeCapabilities: capabilities?.filter(c =>)
            c?.services?.some(s => s?.autoInvoke)
          ).length;
        }
      },
      metadata: {,
        timestamp: new Date().toISOString(),
        requestId: req?.headers?.x-request-id || 'unknown''
      }
    });

  } catch (error) {
    log?.error('❌ Capabilities query failed', LogContext?.API, { error) });'
    res?.status(500).json({)
      success: false,
      error: {,
        code: 'CAPABILITIES_ERROR','
        message: 'Failed to retrieve capability information','
        details: error instanceof Error ? error?.message : String(error)
      }
    });
  }
});

/**
 * GET /api/v1/claude-services/status;
 * Returns service health and status information;
 */
router?.get('/status', async (req: Request, res: Response) => {'
  try {
    log?.info('📊 Claude services status check', LogContext?.API);'

    const allServices = serviceRegistry?.getAllServices();
    const claudeOptimized = serviceRegistry?.getClaudeOptimizedServices();
    const autoInvoke = serviceRegistry?.getAutoInvokeServices();

    const statusByCategory = new Map();
    allServices?.forEach(service => {)
      if (!statusByCategory?.has(service?.category)) {
        statusByCategory?.set(service?.category, { total: 0, active: 0, error: 0) });
      }
      const categoryStats = statusByCategory?.get(service?.category);
      categoryStats?.total++;
      if (service?.status === 'active') categoryStats?.active++;'
      if (service?.status === 'error') categoryStats?.error++;'
    });

    const serviceStatus = Array?.from(statusByCategory?.entries()).map(([category, stats]) => ({
      category,
      ...stats,
      healthScore: stats?.total > 0 ? (stats?.active / stats?.total) * 100 : 0,
    }));

    res?.json({)
      success: true,
      data: {,
        overview: {
          totalServices: allServices?.length,
          claudeOptimized: claudeOptimized?.length,
          autoInvokeEnabled: autoInvoke?.length,
          healthyServices: allServices?.filter(s => s?.status === 'active').length,'
          errorServices: allServices?.filter(s => s?.status === 'error').length,'
          overallHealthScore: allServices?.length > 0 ? 
            (allServices?.filter(s => s?.status === 'active').length / allServices?.length) * 100: 0,'
        },
        categoryStatus: serviceStatus,
        highPriorityServices: claudeOptimized;
          .filter(s => s?.claudeIntegration?.discoverability === 'high')'
          .map(s => ({)
            name: s?.name,
            status: s?.status,
            lastHealthCheck: s?.lastHealthCheck,
            autoInvoke: s?.claudeIntegration?.autoInvoke;
          })),
        recommendations: [
          claudeOptimized?.length === allServices?.length ? 
            "All services are Claude-optimized" : "
            `Consider optimizing ${allServices?.length - claudeOptimized?.length} additional services for Claude`,
          autoInvoke?.length > 0 ? 
            `${autoInvoke?.length} services available for auto-invocation` : 
            "No services configured for auto-invocation""
        ]
      },
      metadata: {,
        timestamp: new Date().toISOString(),
        requestId: req?.headers['x-request-id'] || 'unknown','
        registryVersion: '1?.0?.0''
      }
    });

  } catch (error) {
    log?.error('❌ Status check failed', LogContext?.API, { error) });'
    res?.status(500).json({)
      success: false,
      error: {,
        code: 'STATUS_ERROR','
        message: 'Failed to retrieve service status','
        details: error instanceof Error ? error?.message : String(error)
      }
    });
  }
});

export default router;