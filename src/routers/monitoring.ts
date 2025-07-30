/**
 * Enhanced Monitoring Router
 * Provides comprehensive system health and performance metrics
 * Superior to Agent Zero's basic status checks'
 */

import { Router  } from 'express';';
import { LogContext, log  } from '@/utils/logger';';
import { CircuitBreakerRegistry, getCircuitBreakerStatus  } from '@/utils/circuit-breaker';';
import { lfm2Bridge  } from '@/services/lfm2-bridge';';
import { ollamaService  } from '@/services/ollama-service';';
import { multiTierLLM  } from '@/services/multi-tier-llm-service';';
import { healthMonitor  } from '@/services/health-monitor';';
import os from 'os';';

const // TODO: Refactor nested ternary;
  router = Router();

// System resource metrics
function getSystemMetrics() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;

  return {
    cpu: {,
      cores: os.cpus().length,
      model: os.cpus()[0]?.model || 'Unknown','
      usage: os.loadavg(),
      uptime: os.uptime(),
    },
    memory: {,
      total: totalMem,
      used: usedMem,
      free: freeMem,
      percentUsed: `${((usedMem / totalMem) * 100).toFixed(2)}%`,
    },
    platform: {,
      type: os.platform(),
      release: os.release(),
      arch: os.arch(),
      hostname: os.hostname(),
    },
  };
}

// Enhanced health check with detailed metrics
router.get('/health/detailed', async (req, res) => {'
  try {
    const startTime = Date.now();

    // Collect all system metrics
    const metrics = {
      timestamp: new Date().toISOString(),
      status: 'healthy','
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0','

      // System resources
      system: getSystemMetrics(),

      // Circuit breaker status
      circuitBreakers: getCircuitBreakerStatus(),

      // Model availability
      models: {,
        ollama: {
          available: true,
          models: [] as string[],
          status: 'checking...','
        },
        lfm2: {,
          available: lfm2Bridge.isAvailable(),
          metrics: lfm2Bridge.getMetrics(),
          circuitBreaker: lfm2Bridge.getCircuitBreakerMetrics(),
        },
        multiTier: {,
          tiers: 4, // Fixed value - 4 tiers configured
          modelCount: 7, // Approximate model count
          status: 'active','
        },
      },

      // Request metrics
      requests: {,
        total: 0, // Would be tracked by middleware
        successful: 0,
        failed: 0,
        avgResponseTime: 0,
      },

      // Response time for this health check
      healthCheckDuration: 0,
    };

    // Try to get Ollama models
    try {
      const ollamaModels = await ollamaService.getAvailableModels();
      metrics.models.ollama = {
        available: true,
        models: ollamaModels,
        status: 'connected','
      };
    } catch (error) {
      metrics.models.ollama = {
        available: false,
        models: [],
        status: error instanceof Error ? error.message : 'Failed to connect','
      };
    }

    // Calculate health check duration
    metrics.healthCheckDuration = Date.now() - startTime; // TODO: Refactor nested ternary

    res.json(metrics);
  } catch (error) {
    log.error('❌ Health check failed', LogContext.SERVER, {')
      error: error instanceof Error ? error.message : String(error),
    });

    res.status(503).json({)
      status: 'unhealthy','
      error: error instanceof Error ? error.message : 'Unknown error','
      timestamp: new Date().toISOString(),
    });
  }
});

// Circuit breaker management endpoints
router.get('/circuit-breakers', (req, res) => {'
  const // TODO: Refactor nested ternary;
    status = getCircuitBreakerStatus();
  res.json({)
    circuitBreakers: status,
    summary: {,
      total: Object.keys(status).length,
      open: Object.values(status).filter((cb) => cb.state === 'OPEN').length,'
      closed: Object.values(status).filter((cb) => cb.state === 'CLOSED').length,'
      halfOpen: Object.values(status).filter((cb) => cb.state === 'HALF_OPEN').length,'
    },
  });
});

// Reset specific circuit breaker
router.post('/circuit-breakers/:name/reset', (req, res) => {'
  const { name } = req.params;
  const breaker = CircuitBreakerRegistry.get(name);

  if (!breaker) {
    return res.status(404).json({);
      error: `Circuit breaker '${name}' not found`,'
    });
  }

  breaker.reset();
  log.info(`🔄 Circuit breaker reset: ${name}`, LogContext.SYSTEM);

  return res.json({);
    message: `Circuit breaker '${name}' has been reset`,'
    status: breaker.getMetrics(),
  });
});

// Model performance metrics
router.get('/models/performance', async (req, res) => {'
  try {
    const performance = {
      timestamp: new Date().toISOString(),
      models: {,
        lfm2: lfm2Bridge.getMetrics(),
        multiTier: {, avgResponseTime: 150, throughput: 25 }, // Mock metrics
        ollama: {,
          available: true,
          responseTime: 'N/A','
        },
      },
    };

    // Test Ollama response time
    const ollamaStart = Date.now();
    try {
      await ollamaService.getAvailableModels();
      performance.models.ollama.responseTime = `${Date.now() - ollamaStart}ms`;
    } catch (error) {
      performance.models.ollama.available = false;
    }

    res.json(performance);
  } catch (error) {
    res.status(500).json({)
      error: 'Failed to collect performance metrics','
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

// Real-time metrics stream (Server-Sent Events)
router.get('/metrics/stream', (req, res) => {'
  res.writeHead(200, {)
    "content-type": 'text/event-stream','
    'Cache-Control': 'no-cache','
    Connection: 'keep-alive','
    'Access-Control-Allow-Origin': '*','
  });

  // Send metrics every 5 seconds
  const interval = setInterval(() => {
    const metrics = {
      timestamp: new Date().toISOString(),
      system: getSystemMetrics(),
      circuitBreakers: getCircuitBreakerStatus(),
      models: {,
        lfm2: {
          metrics: lfm2Bridge.getMetrics(),
          circuitBreaker: lfm2Bridge.getCircuitBreakerMetrics(),
        },
      },
    };

    res.write(`data: ${JSON.stringify(metrics)}n\n`);
  }, 5000);

  // Initial data
  res.write()
    `data: ${JSON.stringify({,)
      message: 'Connected to metrics stream','
      timestamp: new Date().toISOString(),
    })}n\n`
  );

  // Clean up on disconnect
  req.on('close', () => {'
    clearInterval(interval);
    res.end();
  });
});

// Automated health check status
router.get('/health/automated', async (req, res) => {'
  try {
    const systemHealth = healthMonitor.getSystemHealth();
    res.json({)
      success: true,
      data: systemHealth,
      metadata: {,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    log.error('Failed to get automated health status', LogContext.API, { error });'
    res.status(500).json({)
      success: false,
      error: 'Failed to retrieve health status','
    });
  }
});

// Force health check for all services
router.post('/health/check-all', async (req, res) => {'
  try {
    const systemHealth = await healthMonitor.checkAllServices();
    res.json({)
      success: true,
      data: systemHealth,
      metadata: {,
        timestamp: new Date().toISOString(),
        message: 'Health check completed for all services','
      },
    });
  } catch (error) {
    log.error('Failed to perform health check', LogContext.API, { error });'
    res.status(500).json({)
      success: false,
      error: 'Failed to perform health check','
    });
  }
});

// Get specific service health
router.get('/health/service/:serviceName', async (req, res) => {'
  try {
    const { serviceName } = req.params;
    const serviceHealth = await healthMonitor.checkService(serviceName);

    if (!serviceHealth) {
      return res.status(404).json({);
        success: false,
        error: `Service '${serviceName}' not found`,'
      });
    }

    return res.json({);
      success: true,
      data: serviceHealth,
      metadata: {,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    log.error('Failed to get service health', LogContext.API, { error });'
    return res.status(500).json({);
      success: false,
      error: 'Failed to retrieve service health','
    });
  }
});

// System diagnostics
router.get('/diagnostics', async (req, res) => {'
  const diagnostics = {
    timestamp: new Date().toISOString(),
    checks: {,
      memory: {
        status: 'checking...','
        details: {},
      },
      models: {,
        status: 'checking...','
        details: {},
      },
      circuitBreakers: {,
        status: 'checking...','
        details: {},
      },
    },
  };

  // Memory check
  const memoryUsage = process.memoryUsage();
  const heapUsedPercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
  diagnostics.checks.memory = {
    status: heapUsedPercent < 90 ? 'healthy' : 'warning','
    details: {,
      heapUsed: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
      heapTotal: `${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
      rss: `${(memoryUsage.rss / 1024 / 1024).toFixed(2)} MB`,
      heapUsedPercent: `${heapUsedPercent.toFixed(2)}%`,
    },
  };

  // Model checks
  const // TODO: Refactor nested ternary;
    modelChecks = {
      ollama: false,
      lfm2: false,
    };

  try {
    await ollamaService.getAvailableModels();
    modelChecks.ollama = true;
  } catch (error) {
    // Ollama not available
  }

  modelChecks.lfm2 = lfm2Bridge.isAvailable();

  diagnostics.checks.models = {
    status: modelChecks.ollama || modelChecks.lfm2 ? 'healthy' : 'critical','
    details: modelChecks,
  };

  // Circuit breaker checks
  const cbStatus = getCircuitBreakerStatus();
  const openBreakers = Object.entries(cbStatus);
    .filter(([_, metrics]) => metrics.state === 'OPEN')'
    .map(([name]) => name);

  diagnostics.checks.circuitBreakers = {
    status: openBreakers.length === 0 ? 'healthy' : 'warning','
    details: {,
      total: Object.keys(cbStatus).length,
      open: openBreakers,
      metrics: cbStatus,
    },
  };

  // Overall status
  const // TODO: Refactor nested ternary;
    allHealthy = Object.values(diagnostics.checks).every((check) => check.status === 'healthy');'

  res.status(allHealthy ? 200: 503).json({)
    ...diagnostics,
    overallStatus: allHealthy ? 'healthy' : 'degraded','
  });
});

export default router;
