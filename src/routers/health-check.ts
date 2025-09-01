import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { config } from '@/config/environment';
import { logger } from '@/utils/logger';
import { createClient as createRedisClient } from 'redis';

const router = Router();

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: {
    database: {
      status: 'up' | 'down';
      responseTime: number;
      error?: string;
    };
    redis?: {
      status: 'up' | 'down';
      responseTime: number;
      error?: string;
    };
    llm: {
      ollama: {
        status: 'up' | 'down';
        responseTime: number;
        error?: string;
      };
      lmStudio: {
        status: 'up' | 'down';
        responseTime: number;
        error?: string;
      };
    };
  };
}

async function checkDatabase(): Promise<HealthStatus['services']['database']> {
  const startTime = Date.now();
  
  try {
    const supabase = createClient(config.supabase.url, config.supabase.anonKey);
    const { data, error } = await supabase.from('ai_memories').select('count', { count: 'exact' });
    
    const responseTime = Date.now() - startTime;
    
    if (error) {
      return {
        status: 'down',
        responseTime,
        error: error.message
      };
    }
    
    return {
      status: 'up',
      responseTime
    };
  } catch (error) {
    return {
      status: 'down',
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function checkRedis(): Promise<HealthStatus['services']['redis']> {
  if (!config.redis) {
    return {
      status: 'down',
      responseTime: 0,
      error: 'Redis not configured'
    };
  }
  
  const startTime = Date.now();
  
  try {
    const redis = createRedisClient({ url: config.redis.url });
    await redis.connect();
    await redis.ping();
    await redis.disconnect();
    
    return {
      status: 'up',
      responseTime: Date.now() - startTime
    };
  } catch (error) {
    return {
      status: 'down',
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function checkLLMService(url: string): Promise<{ status: 'up' | 'down'; responseTime: number; error?: string }> {
  const startTime = Date.now();
  
  try {
    const response = await fetch(`${url}/api/tags`, { 
      method: 'GET',
      signal: AbortSignal.timeout(5000)
    });
    
    const responseTime = Date.now() - startTime;
    
    if (response.ok) {
      return {
        status: 'up',
        responseTime
      };
    } else {
      return {
        status: 'down',
        responseTime,
        error: `HTTP ${response.status}`
      };
    }
  } catch (error) {
    return {
      status: 'down',
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Connection failed'
    };
  }
}

// Basic health endpoint
router.get('/health', async (req: Request, res: Response) => {
  try {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'Universal AI Tools API'
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Comprehensive health endpoint
router.get('/health/detailed', async (req: Request, res: Response) => {
  try {
    const [database, redis, ollama, lmStudio] = await Promise.all([
      checkDatabase(),
      checkRedis(),
      checkLLMService(config.llm.ollamaUrl),
      checkLLMService(config.llm.lmStudioUrl)
    ]);

    const healthStatus: HealthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database,
        redis,
        llm: {
          ollama,
          lmStudio
        }
      }
    };

    // Determine overall status
    const allServices = [database, redis, ollama, lmStudio].filter(Boolean);
    const downServices = allServices.filter(service => service.status === 'down');
    
    if (downServices.length === 0) {
      healthStatus.status = 'healthy';
    } else if (downServices.length < allServices.length / 2) {
      healthStatus.status = 'degraded';
    } else {
      healthStatus.status = 'unhealthy';
    }

    const statusCode = healthStatus.status === 'healthy' ? 200 : 
                      healthStatus.status === 'degraded' ? 206 : 503;

    res.status(statusCode).json(healthStatus);
    
  } catch (error) {
    logger.error('Detailed health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Database-specific health check
router.get('/health/database', async (req: Request, res: Response) => {
  try {
    const database = await checkDatabase();
    
    if (database.status === 'up') {
      res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database
      });
    } else {
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        database
      });
    }
  } catch (error) {
    logger.error('Database health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;