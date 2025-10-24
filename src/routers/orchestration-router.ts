export function OrchestrationRouter(supabase: SupabaseClient) {
  const router = Router();

  /**
   * Main orchestration endpoint - replaces enhanced orchestrator
   */
  router.post('/orchestrate', async (req: any, res) => {
    try {
      const data = orchestrationRequestSchema.parse(req.body);

      // Create orchestration request
      const orchestrationRequest: DSPyOrchestrationRequest = {
        requestId: uuidv4(),
        userRequest: data.userRequest,
        userId: req.aiServiceId,
        orchestrationMode: data.orchestrationMode,
        context: {
          ...data.context,
          conversationId: data.conversationId,
          sessionId: data.sessionId,
        },
        timestamp: new Date(),
      };

      // Log the orchestration request
      await supabase.from('ai_orchestration_logs').insert({
        request_id: orchestrationRequest.requestId,
        service_id: req.aiServiceId,
        user__request data.userRequest,
        orchestration_mode: data.orchestrationMode || 'auto',
        status: 'processing',
        created_at: new Date(),
      });

      // Execute orchestration through DSPy service
      const response = await dspyService.orchestrate(orchestrationRequest);

      // Update orchestration log
      await supabase
        .from('ai_orchestration_logs')
        .update({
          status: response.success ? 'completed' : 'failed',
          response_data: response.result,
          execution_time_ms: response.executionTime,
          confidence: response.confidence,
          participating_agents: response.participatingAgents,
          completed_at: new Date(),
        })
        .eq('request_id', orchestrationRequest.requestId);

      res.json({
        success: response.success,
        requestId: response.requestId,
        data: response.result,
        mode: response.mode,
        confidence: response.confidence,
        reasoning: response.reasoning,
        participatingAgents: response.participatingAgents,
        executionTime: response.executionTime,
      });
    } catch (error) {
      logger.error(Orchestration error', error;

      if (errorinstanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error 'Invalid _requestformat',
          details: errorerrors,
        });
      } else {
        res.status(500).json({
          success: false,
          error 'Orchestration failed',
          message: errorinstanceof Error ? errormessage : 'Unknown error,
        });
      }
    }
  });

  /**
   * Agent coordination endpoint
   */
  router.post('/coordinate', async (req: any, res) => {
    try {
      const data = coordinationRequestSchema.parse(req.body);

      const result = await dspyService.coordinateAgents(
        data.task,
        data.availableAgents,
        data.context || {}
      );

      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      logger.error(Coordination error', error;

      if (errorinstanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error 'Invalid _requestformat',
          details: errorerrors,
        });
      } else {
        res.status(500).json({
          success: false,
          error 'Coordination failed',
          message: errorinstanceof Error ? errormessage : 'Unknown error,
        });
      }
    }
  });

  /**
   * Knowledge search endpoint
   */
  router.post('/knowledge/search', async (req: any, res) => {
    try {
      const data = knowledgeSearchSchema.parse(req.body);

      const result = await dspyService.searchKnowledge(data.query, {
        filters: data.filters,
        limit: data.limit,
      });

      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      logger.error(Knowledge search error', error;

      if (errorinstanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error 'Invalid _requestformat',
          details: errorerrors,
        });
      } else {
        res.status(500).json({
          success: false,
          error 'Knowledge search failed',
          message: errorinstanceof Error ? errormessage : 'Unknown error,
        });
      }
    }
  });

  /**
   * Knowledge extraction endpoint
   */
  router.post('/knowledge/extract', async (req: any, res) => {
    try {
      const data = knowledgeExtractSchema.parse(req.body);

      const result = await dspyService.extractKnowledge(data._content data.context || {});

      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      logger.error(Knowledge extraction error', error;

      if (errorinstanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error 'Invalid _requestformat',
          details: errorerrors,
        });
      } else {
        res.status(500).json({
          success: false,
          error 'Knowledge extraction failed',
          message: errorinstanceof Error ? errormessage : 'Unknown error,
        });
      }
    }
  });

  /**
   * Knowledge evolution endpoint
   */
  router.post('/knowledge/evolve', async (req: any, res) => {
    try {
      const data = knowledgeEvolveSchema.parse(req.body);

      const result = await dspyService.evolveKnowledge(data.existingKnowledge, data.newInformation);

      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      logger.error(Knowledge evolution error', error;

      if (errorinstanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error 'Invalid _requestformat',
          details: errorerrors,
        });
      } else {
        res.status(500).json({
          success: false,
          error 'Knowledge evolution failed',
          message: errorinstanceof Error ? errormessage : 'Unknown error,
        });
      }
    }
  });

  /**
   * Prompt optimization endpoint
   */
  router.post('/optimize/prompts', async (req: any, res) => {
    try {
      const data = promptOptimizationSchema.parse(req.body);

      const result = await dspyService.optimizePrompts(data.examples);

      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      logger.error(Prompt optimization error', error;

      if (errorinstanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error 'Invalid _requestformat',
          details: errorerrors,
        });
      } else {
        res.status(500).json({
          success: false,
          error 'Prompt optimization failed',
          message: errorinstanceof Error ? errormessage : 'Unknown error,
        });
      }
    }
  });

  /**
   * Service status endpoint
   */
  router.get('/status', async (req: any, res) => {
    try {
      const status = dspyService.getStatus();

      res.json({
        success: true,
        service: 'dspy-orchestration',
        ...status,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error(Status check error', error;
      res.status(500).json({
        success: false,
        error 'Failed to get service status',
      });
    }
  });

  return router;
}
/**
 * Pydantic AI Router - HTTP endpoints for type-safe AI interactions
 */

import express from 'express';
import { z } from 'zod';
import { type AIRequest, pydanticAI } from '../services/pydantic-ai-service';
import { wrapAsync } from '../utils/async-wrapper';
import { LogContext, logger } from '../utils/enhanced-logger';

const router = express.Router();

/**
 * POST /api/pydantic-ai/request
 * Main AI _requestendpoint with type safety
 */
router.post(
  '/_request,
  wrapAsync(async (req, res) => {
    try {
      const _request Partial<AIRequest> = req.body;
      const response = await pydanticAI._request_request;

      res.json({
        success: true,
        response,
      });
    } catch (error) {
      logger.error(PydanticAI _requestfailed:', LogContext.API, {
        error errorinstanceof Error ? errormessage : String(error,
      });
      res.status(500).json({
        success: false,
        error errorinstanceof Error ? errormessage : 'Request failed',
      });
    }
  })
);

/**
 * POST /api/pydantic-ai/analyze
 * Cognitive _analysisendpoint
 */
router.post(
  '/analyze',
  wrapAsync(async (req, res) => {
    try {
      const { _content context } = req.body;

      if (!_content {
        return res.status(400).json({
          success: false,
          error 'Content is required',
        });
      }

      const _analysis= await pydanticAI.analyzeCognitive(_content context);

      res.json({
        success: true,
        _analysis
      });
    } catch (error) {
      logger.error(Cognitive _analysisfailed:', LogContext.API, {
        error errorinstanceof Error ? errormessage : String(error,
      });
      res.status(500).json({
        success: false,
        error errorinstanceof Error ? errormessage : 'Analysis failed',
      });
    }
  })
);

/**
 * POST /api/pydantic-ai/plan
 * Task planning endpoint
 */
router.post(
  '/plan',
  wrapAsync(async (req, res) => {
    try {
      const { objective, constraints } = req.body;

      if (!objective) {
        return res.status(400).json({
          success: false,
          error 'Objective is required',
        });
      }

      const plan = await pydanticAI.planTask(objective, constraints);

      res.json({
        success: true,
        plan,
      });
    } catch (error) {
      logger.error(Task planning failed:', LogContext.API, {
        error errorinstanceof Error ? errormessage : String(error,
      });
      res.status(500).json({
        success: false,
        error errorinstanceof Error ? errormessage : 'Planning failed',
      });
    }
  })
);

/**
 * POST /api/pydantic-ai/generate-code
 * Code generation endpoint
 */
router.post(
  '/generate-code',
  wrapAsync(async (req, res) => {
    try {
      const { specification, language = 'typescript', options } = req.body;

      if (!specification) {
        return res.status(400).json({
          success: false,
          error 'Specification is required',
        });
      }

      const code = await pydanticAI.generateCode(specification, language, options);

      res.json({
        success: true,
        code,
      });
    } catch (error) {
      logger.error(Code generation failed:', LogContext.API, {
        error errorinstanceof Error ? errormessage : String(error,
      });
      res.status(500).json({
        success: false,
        error errorinstanceof Error ? errormessage : 'Code generation failed',
      });
    }
  })
);

/**
 * POST /api/pydantic-ai/validate
 * Validate data against a schema
 */
router.post(
  '/validate',
  wrapAsync(async (req, res) => {
    try {
      const { data, schemaName, customSchema } = req.body;

      if (!data) {
        return res.status(400).json({
          success: false,
          error 'Data is required',
        });
      }

      // If custom schema provided, register and use it
      if (customSchema) {
        try {
          const zodSchema = z.object(customSchema);
          pydanticAI.registerSchema('custom_validation', zodSchema);
          schemaName = 'custom_validation';
        } catch (error) {
          return res.status(400).json({
            success: false,
            error 'Invalid schema definition',
          });
        }
      }

      if (!schemaName) {
        return res.status(400).json({
          success: false,
          error 'Schema name or custom schema is required',
        });
      }

      // Use the PydanticAI agent for validation
      const response = await pydanticAI._request{
        prompt: `Validate the following data against the ${schemaName} schema`,
        context: {
          metadata: { data, schemaName },
        },
        orchestration: {
          mode: 'simple',
          preferredAgents: ['pydantic_ai'],
        },
      });

      res.json({
        success: true,
        validation: response.structuredData || response._content
      });
    } catch (error) {
      logger.error(Validation failed:', LogContext.API, {
        error errorinstanceof Error ? errormessage : String(error,
      });
      res.status(500).json({
        success: false,
        error errorinstanceof Error ? errormessage : 'Validation failed',
      });
    }
  })
);

/**
 * POST /api/pydantic-ai/register-schema
 * Register a custom validation schema
 */
router.post(
  '/register-schema',
  wrapAsync(async (req, res) => {
    try {
      const { name, schema } = req.body;

      if (!name || !schema) {
        return res.status(400).json({
          success: false,
          error 'Name and schema are required',
        });
      }

      try {
        const zodSchema = z.object(schema);
        pydanticAI.registerSchema(name, zodSchema);

        res.json({
          success: true,
          message: `Schema '${name}' registered successfully`,
        });
      } catch (error) {
        return res.status(400).json({
          success: false,
          error 'Invalid schema definition',
        });
      }
    } catch (error) {
      logger.error(Schema registration failed:', LogContext.API, {
        error errorinstanceof Error ? errormessage : String(error,
      });
      res.status(500).json({
        success: false,
        error errorinstanceof Error ? errormessage : 'Registration failed',
      });
    }
  })
);

/**
 * GET /api/pydantic-ai/stats
 * Get service statistics
 */
router.get(
  '/stats',
  wrapAsync(async (req, res) => {
    try {
      const stats = pydanticAI.getStats();

      res.json({
        success: true,
        stats,
      });
    } catch (error) {
      logger.error(Failed to get stats:', LogContext.API, {
        error errorinstanceof Error ? errormessage : String(error,
      });
      res.status(500).json({
        success: false,
        error errorinstanceof Error ? errormessage : 'Failed to get stats',
      });
    }
  })
);

/**
 * POST /api/pydantic-ai/clear-cache
 * Clear the response cache
 */
router.post(
  '/clear-cache',
  wrapAsync(async (req, res) => {
    try {
      pydanticAI.clearCache();

      res.json({
        success: true,
        message: 'Cache cleared successfully',
      });
    } catch (error) {
      logger.error(Failed to clear cache:', LogContext.API, {
        error errorinstanceof Error ? errormessage : String(error,
      });
      res.status(500).json({
        success: false,
        error errorinstanceof Error ? errormessage : 'Failed to clear cache',
      });
    }
  })
);

/**
 * POST /api/pydantic-ai/structured
 * Request with custom output schema
 */
router.post(
  '/structured',
  wrapAsync(async (req, res) => {
    try {
      const { _request outputSchema } = req.body;

      if (!_request|| !outputSchema) {
        return res.status(400).json({
          success: false,
          error 'Request and outputSchema are required',
        });
      }

      try {
        // Build Zod schema from JSON schema definition
        const zodSchema = buildZodSchema(outputSchema);
        const response = await pydanticAI.requestWithSchema(_request zodSchema);

        res.json({
          success: true,
          response,
        });
      } catch (error) {
        return res.status(400).json({
          success: false,
          error errorinstanceof Error ? errormessage : 'Invalid schema or _request,
        });
      }
    } catch (error) {
      logger.error(Structured _requestfailed:', LogContext.API, {
        error errorinstanceof Error ? errormessage : String(error,
      });
      res.status(500).json({
        success: false,
        error errorinstanceof Error ? errormessage : 'Request failed',
      });
    }
  })
);

/**
 * Helper function to build Zod schema from JSON schema
 */
function buildZodSchema(jsonSchema: any): z.ZodSchema {
  if (jsonSchema.type === 'object' && jsonSchema.properties) {
    const shape: Record<string, z.ZodSchema> = {};

    for (const [key, value] of Object.entries(jsonSchema.properties)) {
      shape[key] = buildZodSchema(value as any);
    }

    let schema = z.object(shape);

    if (jsonSchema.required && Array.isArray(jsonSchema.required)) {
      // Mark non-required fields as optional
      for (const key of Object.keys(shape)) {
        if (!jsonSchema.required.includes(key)) {
          shape[key] = shape[key].optional();
        }
      }
      schema = z.object(shape);
    }

    return schema;
  }

  if (jsonSchema.type === 'array' && jsonSchema.items) {
    return z.array(buildZodSchema(jsonSchema.items));
  }

  if (jsonSchema.type === 'string') {
    return z.string();
  }

  if (jsonSchema.type === 'number') {
    return z.number();
  }

  if (jsonSchema.type === 'boolean') {
    return z.boolean();
  }

  if (jsonSchema.type === 'null') {
    return z.null();
  }

  // Default to unknown for unsupported types
  return z.unknown();
}

export default router;
import type { Request, Response } from 'express';
import { Router } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';
import { LogContext, logger } from '../utils/enhanced-logger';
import { z } from 'zod';

const router = Router();

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

// Request validation schemas
const GetMetricsQuerySchema = z.object({
  agentId: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  metricType: z
    .enum(['execution_time', 'resource_usage', 'success_rate', 'task_complexity'])
    .optional(),
});

const GetTrendsQuerySchema = z.object({
  agentId: z.string(),
  period: z.enum(['minute', 'hour', 'day', 'week', 'month']).default('day'),
  lookback: z.string().transform(Number).default('7'),
});

const GetAlertsQuerySchema = z.object({
  agentId: z.string().optional(),
  severity: z.enum(['info', 'warning', 'critical']).optional(),
  resolved: z
    .string()
    .transform((val) => val === 'true')
    .optional(),
  limit: z.string().transform(Number).default('50'),
});

// Get agent performance summary
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const { data, error} = await supabase
      .from('agent_performance_summary')
      .select('*')
      .order('reliability_score', { ascending: false });

    if (error throw error

    res.json({
      success: true,
      data: data || [],
    });
  } catch (error) {
    logger.error(Failed to fetch agent performance summary', LogContext.API, { error});
    res.status(500).json({
      success: false,
      error 'Failed to fetch performance summary',
    });
  }
});

// Get performance metrics
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const query = GetMetricsQuerySchema.parse(req.query);

    let supabaseQuery = supabase.from('agent_performance_metrics').select('*');

    if (query.agentId) {
      supabaseQuery = supabaseQuery.eq('agent_id', query.agentId);
    }
    if (query.startDate) {
      supabaseQuery = supabaseQuery.gte('timestamp', query.startDate);
    }
    if (query.endDate) {
      supabaseQuery = supabaseQuery.lte('timestamp', query.endDate);
    }
    if (query.metricType) {
      supabaseQuery = supabaseQuery.eq('metric_type', query.metricType);
    }

    const { data, error} = await supabaseQuery
      .order('timestamp', { ascending: false })
      .limit(1000);

    if (error throw error

    res.json({
      success: true,
      data: data || [],
      count: data?.length || 0,
    });
  } catch (error) {
    if (errorinstanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error 'Invalid query parameters',
        details: errorerrors,
      });
    } else {
      logger.error(Failed to fetch performance metrics', LogContext.API, { error});
      res.status(500).json({
        success: false,
        error 'Failed to fetch performance metrics',
      });
    }
  }
});

// Get performance trends
router.get('/trends', async (req: Request, res: Response) => {
  try {
    const query = GetTrendsQuerySchema.parse(req.query);

    const endDate = new Date();
    const startDate = new Date();

    switch (query.period) {
      case 'minute':
        startDate.setMinutes(startDate.getMinutes() - query.lookback);
        break;
      case 'hour':
        startDate.setHours(startDate.getHours() - query.lookback);
        break;
      case 'day':
        startDate.setDate(startDate.getDate() - query.lookback);
        break;
      case 'week':
        startDate.setDate(startDate.getDate() - query.lookback * 7);
        break;
      case 'month':
        startDate.setMonth(startDate.getMonth() - query.lookback);
        break;
    }

    const { data, error} = await supabase
      .from('agent_performance_aggregated')
      .select('*')
      .eq('agent_id', query.agentId)
      .eq('period', query.period)
      .gte('start_time', startDate.toISOString())
      .lte('end_time', endDate.toISOString())
      .order('start_time', { ascending: true });

    if (error throw error

    res.json({
      success: true,
      data: data || [],
      period: query.period,
      lookback: query.lookback,
    });
  } catch (error) {
    if (errorinstanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error 'Invalid query parameters',
        details: errorerrors,
      });
    } else {
      logger.error(Failed to fetch performance trends', LogContext.API, { error});
      res.status(500).json({
        success: false,
        error 'Failed to fetch performance trends',
      });
    }
  }
});

// Get performance alerts
router.get('/alerts', async (req: Request, res: Response) => {
  try {
    const query = GetAlertsQuerySchema.parse(req.query);

    let supabaseQuery = supabase.from('agent_performance_alerts').select('*');

    if (query.agentId) {
      supabaseQuery = supabaseQuery.eq('agent_id', query.agentId);
    }
    if (query.severity) {
      supabaseQuery = supabaseQuery.eq('severity', query.severity);
    }
    if (query.resolved !== undefined) {
      supabaseQuery = supabaseQuery.eq('resolved', query.resolved);
    }

    const { data, error} = await supabaseQuery
      .order('created_at', { ascending: false })
      .limit(query.limit);

    if (error throw error

    res.json({
      success: true,
      data: data || [],
      count: data?.length || 0,
    });
  } catch (error) {
    if (errorinstanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error 'Invalid query parameters',
        details: errorerrors,
      });
    } else {
      logger.error(Failed to fetch performance alerts', LogContext.API, { error});
      res.status(500).json({
        success: false,
        error 'Failed to fetch performance alerts',
      });
    }
  }
});

// Resolve an alert
router.post('/alerts/:alertId/resolve', async (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;

    const { error} = await supabase
      .from('agent_performance_alerts')
      .update({
        resolved: true,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', alertId);

    if (error throw error

    res.json({
      success: true,
      message: 'Alert resolved successfully',
    });
  } catch (error) {
    logger.error(Failed to resolve alert', LogContext.API, { error});
    res.status(500).json({
      success: false,
      error 'Failed to resolve alert',
    });
  }
});

// Get agent comparison
router.get('/compare', async (req: Request, res: Response) => {
  try {
    const agentIds = req.query.agentIds as string;
    if (!agentIds) {
      return res.status(400).json({
        success: false,
        error 'agentIds query parameter is required',
      });
    }

    const agentIdArray = agentIds.split(',');

    const { data, error} = await supabase
      .from('agent_performance_summary')
      .select('*')
      .in('agent_id', agentIdArray);

    if (error throw error

    // Calculate comparison metrics
    const comparison = (data || []).map((agent) => ({
      agentId: agent.agent_id,
      agentName: agent.agent_name,
      agentType: agent.agent_type,
      reliability: agent.reliability_score,
      tasksLast24h: agent.tasks_last_24h,
      avgExecutionTime: agent.avg_execution_time_24h,
      activeAlerts: agent.active_alerts,
      rank: 0, // Will be calculated below
    }));

    // Rank agents by reliability
    comparison.sort((a, b) => b.reliability - a.reliability);
    comparison.forEach((agent, index) => {
      agent.rank = index + 1;
    });

    res.json({
      success: true,
      data: comparison,
    });
  } catch (error) {
    logger.error(Failed to compare agents', LogContext.API, { error});
    res.status(500).json({
      success: false,
      error 'Failed to compare agents',
    });
  }
});

// Get benchmarks
router.get('/benchmarks', async (req: Request, res: Response) => {
  try {
    const { agentType, taskType } = req.query;

    let query = supabase.from('agent_performance_benchmarks').select('*');

    if (agentType) {
      query = query.eq('agent_type', agentType);
    }
    if (taskType) {
      query = query.eq('task_type', taskType);
    }

    const { data, error} = await query.order('complexity_level', { ascending: true });

    if (error throw error

    res.json({
      success: true,
      data: data || [],
    });
  } catch (error) {
    logger.error(Failed to fetch benchmarks', LogContext.API, { error});
    res.status(500).json({
      success: false,
      error 'Failed to fetch benchmarks',
    });
  }
});

// Update benchmark
router.put('/benchmarks', async (req: Request, res: Response) => {
  try {
    const {
      agent_type,
      task_type,
      complexity_level,
      expected_execution_time,
      max_cpu_usage,
      max_memory_usage,
    } = req.body;

    if (!agent_type || !task_type || complexity_level === undefined || !expected_execution_time) {
      return res.status(400).json({
        success: false,
        error
          'Missing required fields: agent_type, task_type, complexity_level, expected_execution_time',
      });
    }

    const { error} = await supabase.from('agent_performance_benchmarks').upsert({
      agent_type,
      task_type,
      complexity_level,
      expected_execution_time,
      max_cpu_usage: max_cpu_usage || 80,
      max_memory_usage: max_memory_usage || 1024,
      updated_at: new Date().toISOString(),
    });

    if (error throw error

    res.json({
      success: true,
      message: 'Benchmark updated successfully',
    });
  } catch (error) {
    logger.error(Failed to update benchmark', LogContext.API, { error});
    res.status(500).json({
      success: false,
      error 'Failed to update benchmark',
    });
  }
});

// Trigger metrics aggregation
router.post('/aggregate', async (req: Request, res: Response) => {
  try {
    const { period } = req.body;

    if (!period || !['minute', 'hour', 'day', 'week', 'month'].includes(period)) {
      return res.status(400).json({
        success: false,
        error 'Invalid period. Must be one of: minute, hour, day, week, month',
      });
    }

    const { error} = await supabase.rpc('aggregate_performance_metrics', {
      p_period: period,
    });

    if (error throw error

    res.json({
      success: true,
      message: `Metrics aggregated for period: ${period}`,
    });
  } catch (error) {
    logger.error(Failed to aggregate metrics', LogContext.API, { error});
    res.status(500).json({
      success: false,
      error 'Failed to aggregate metrics',
    });
  }
});

export default router;
/**
 * Widget Creation Router
 *
 * API endpoints for natural language widget creation
 */

import type { Request, Response } from 'express';
import { Router } from 'express';
import { authenticate, validateInput } from '../middleware';
import { body, param } from 'express-validator';
import { AthenaWidgetCreationService } from '../services/athena-widget-creation-service';
import { supabase } from '../services/supabase_service';
import { logger } from '../utils/logger';
import { promises as fs } from 'fs';
import * as path from 'path';

const router = Router();

// Initialize the widget creation service
const widgetService = new AthenaWidgetCreationService(supabase, logger);

/**
 * POST /api/widgets/create
 * Create a new widget from natural language description
 */
router.post(
  '/create',
  authenticate,
  [
    body('description')
      .isString()
      .trim()
      .notEmpty()
      .withMessage('Widget description is required')
      .isLength({ min: 10, max: 1000 })
      .withMessage('Description must be between 10 and 1000 characters'),
    body('requirements').optional().isObject().withMessage('Requirements must be an object'),
    body('requirements.style')
      .optional()
      .isIn(['material-ui', 'styled-components', 'tailwind', 'custom'])
      .withMessage('Invalid style framework'),
    body('requirements.features').optional().isArray().withMessage('Features must be an array'),
    body('requirements.dataSource')
      .optional()
      .isIn(['static', 'api', 'props'])
      .withMessage('Invalid data source'),
    body('requirements.responsive')
      .optional()
      .isBoolean()
      .withMessage('Responsive must be a boolean'),
    body('requirements.theme')
      .optional()
      .isIn(['light', 'dark', 'auto'])
      .withMessage('Invalid theme'),
    body('examples').optional().isArray().withMessage('Examples must be an array'),
  ],
  validateInput,
  async (req: Request, res: Response) => {
    try {
      const { description, requirements, examples } = req.body;
      const userId = (req as any).user.id;

      logger.info(`Creating widget for user ${userId}: ${description}`);

      const result = await widgetService.createWidget({
        description,
        userId,
        requirements,
        examples,
      });

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error result.error
          warnings: result.warnings,
          suggestions: result.suggestions,
        });
      }

      res.json({
        success: true,
        widget: {
          id: result.widget!.id,
          name: result.widget!.name,
          description: result.widget!.description,
          dependencies: result.widget!.dependencies,
          exportReady: result.widget!.exportReady,
          previewUrl: `/api/widgets/preview/${result.widget!.id}`,
          exportUrl: `/api/widgets/export/${result.widget!.id}`,
        },
        suggestions: result.suggestions,
      });
    } catch (error) {
      logger.error(Widget creation error', error;
      res.status(500).json({
        success: false,
        error 'Failed to create widget',
        details: (erroras Error).message,
      });
    }
  }
);

/**
 * GET /api/widgets/preview/:id
 * Generate live preview of a widget
 */
router.get(
  '/preview/:id',
  [param('id').isUUID().withMessage('Invalid widget ID')],
  validateInput,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const preview = await widgetService.generatePreview(id);

      if (!preview) {
        return res.status(404).json({
          success: false,
          error 'Widget not found',
        });
      }

      // Set _contenttype to HTML
      res.setHeader('Content-Type', 'text/html');
      res.send(preview);
    } catch (error) {
      logger.error(Preview generation error', error;
      res.status(500).json({
        success: false,
        error 'Failed to generate preview',
        details: (erroras Error).message,
      });
    }
  }
);

/**
 * POST /api/widgets/export/:id
 * Export widget as zip file
 */
router.post(
  '/export/:id',
  authenticate,
  [param('id').isUUID().withMessage('Invalid widget ID')],
  validateInput,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = (req as any).user.id;

      // Verify the user owns this widget or has access
      const { data: widget, error} = await supabase
        .from('ai_widgets')
        .select('created_by')
        .eq('id', id)
        .single();

      if (error|| !widget) {
        return res.status(404).json({
          success: false,
          error 'Widget not found',
        });
      }

      if (widget.created_by !== userId) {
        return res.status(403).json({
          success: false,
          error 'You do not have permission to export this widget',
        });
      }

      const zipPath = await widgetService.exportWidget(id);

      if (!zipPath) {
        return res.status(404).json({
          success: false,
          error 'Failed to export widget',
        });
      }

      // Send the zip file
      res.download(zipPath, async (err) => {
        if (err) {
          logger.error(Error sending zip file:', err);
        }

        // Clean up the zip file after sending
        try {
          await fs.unlink(zipPath);
        } catch (cleanupError) {
          logger.error(Error cleaning up zip file:', cleanupError);
        }
      });
    } catch (error) {
      logger.error(Export error', error;
      res.status(500).json({
        success: false,
        error 'Failed to export widget',
        details: (erroras Error).message,
      });
    }
  }
);

/**
 * GET /api/widgets/:id
 * Get widget details
 */
router.get(
  '/:id',
  authenticate,
  [param('id').isUUID().withMessage('Invalid widget ID')],
  validateInput,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = (req as any).user.id;

      const widget = await widgetService.getWidget(id);

      if (!widget) {
        return res.status(404).json({
          success: false,
          error 'Widget not found',
        });
      }

      // Get widget metadata from database
      const { data: metadata, error} = await supabase
        .from('ai_widgets')
        .select('created_by, created_at')
        .eq('id', id)
        .single();

      if (error|| !metadata) {
        return res.status(404).json({
          success: false,
          error 'Widget metadata not found',
        });
      }

      // Check if user has access
      if (metadata.created_by !== userId) {
        return res.status(403).json({
          success: false,
          error 'You do not have permission to view this widget',
        });
      }

      res.json({
        success: true,
        widget: {
          ...widget,
          createdAt: metadata.created_at,
          previewUrl: `/api/widgets/preview/${id}`,
          exportUrl: `/api/widgets/export/${id}`,
        },
      });
    } catch (error) {
      logger.error(Get widget error', error;
      res.status(500).json({
        success: false,
        error 'Failed to get widget',
        details: (erroras Error).message,
      });
    }
  }
);

/**
 * GET /api/widgets
 * List user's widgets
 */
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { page = 1, limit = 10 } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;

    // Get total count
    const { count } = await supabase
      .from('ai_widgets')
      .select('*', { count: 'exact', head: true })
      .eq('created_by', userId);

    // Get widgets
    const { data: widgets, error} = await supabase
      .from('ai_widgets')
      .select('id, name, description, created_at, dependencies')
      .eq('created_by', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limitNum - 1);

    if (error {
      throw error
    }

    res.json({
      success: true,
      widgets:
        widgets?.map((w) => ({
          ...w,
          previewUrl: `/api/widgets/preview/${w.id}`,
          exportUrl: `/api/widgets/export/${w.id}`,
        })) || [],
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limitNum),
      },
    });
  } catch (error) {
    logger.error(List widgets error', error;
    res.status(500).json({
      success: false,
      error 'Failed to list widgets',
      details: (erroras Error).message,
    });
  }
});

/**
 * DELETE /api/widgets/:id
 * Delete a widget
 */
router.delete(
  '/:id',
  authenticate,
  [param('id').isUUID().withMessage('Invalid widget ID')],
  validateInput,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = (req as any).user.id;

      // Verify ownership
      const { data: widget, error fetchError } = await supabase
        .from('ai_widgets')
        .select('created_by')
        .eq('id', id)
        .single();

      if (fetchError || !widget) {
        return res.status(404).json({
          success: false,
          error 'Widget not found',
        });
      }

      if (widget.created_by !== userId) {
        return res.status(403).json({
          success: false,
          error 'You do not have permission to delete this widget',
        });
      }

      // Delete the widget
      const { error deleteError } = await supabase.from('ai_widgets').delete().eq('id', id);

      if (deleteError) {
        throw deleteError;
      }

      res.json({
        success: true,
        message: 'Widget deleted successfully',
      });
    } catch (error) {
      logger.error(Delete widget error', error;
      res.status(500).json({
        success: false,
        error 'Failed to delete widget',
        details: (erroras Error).message,
      });
    }
  }
);

/**
 * POST /api/widgets/:id/update
 * Update widget code or details
 */
router.post(
  '/:id/update',
  authenticate,
  [
    param('id').isUUID().withMessage('Invalid widget ID'),
    body('code').optional().isString().withMessage('Code must be a string'),
    body('description')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 10, max: 1000 })
      .withMessage('Description must be between 10 and 1000 characters'),
    body('documentation').optional().isString().withMessage('Documentation must be a string'),
  ],
  validateInput,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = (req as any).user.id;
      const updates = req.body;

      // Verify ownership
      const { data: widget, error fetchError } = await supabase
        .from('ai_widgets')
        .select('created_by')
        .eq('id', id)
        .single();

      if (fetchError || !widget) {
        return res.status(404).json({
          success: false,
          error 'Widget not found',
        });
      }

      if (widget.created_by !== userId) {
        return res.status(403).json({
          success: false,
          error 'You do not have permission to update this widget',
        });
      }

      // Update the widget
      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      if (updates.code) updateData.component_code = updates.code;
      if (updates.description) updateData.description = updates.description;
      if (updates.documentation) updateData.documentation = updates.documentation;

      const { error updateError } = await supabase
        .from('ai_widgets')
        .update(updateData)
        .eq('id', id);

      if (updateError) {
        throw updateError;
      }

      res.json({
        success: true,
        message: 'Widget updated successfully',
      });
    } catch (error) {
      logger.error(Update widget error', error;
      res.status(500).json({
        success: false,
        error 'Failed to update widget',
        details: (erroras Error).message,
      });
    }
  }
);

export default router;
/**
 * Secure File System API Router
 *
 * Provides RESTful endpoints for file system operations with comprehensive security measures:
 * - Path sanitization and validation
 * - Authentication and authorization
 * - Rate limiting
 * - Input validation
 * - Activity logging
 * - WebSocket support for real-time events
 */

import type { Request, Response } from 'express';
import { NextFunction, Router } from 'express';
import path from 'path';
import fs from 'fs/promises';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import crypto from 'crypto';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { JWTAuthService } from '../middleware/auth-jwt';
import { RateLimiter } from '../middleware/rate-limiter';
import { CommonValidators, strictValidation } from '../middleware/comprehensive-validation';
import type { SupabaseClient } from '@supabase/supabase-js';
import { exec } from 'child_process';
import { promisify } from 'util';
import mime from 'mime-types';
import chokidar from 'chokidar';
import WebSocket from 'ws';

const execAsync = promisify(exec);

// Request/Response schemas
const BrowseRequestSchema = z.object({
  path: z.string().optional(),
  showHidden: z.boolean().optional().default(false),
  recursive: z.boolean().optional().default(false),
  maxDepth: z.number().int().min(1).max(5).optional().default(1),
  filter: z
    .object({
      type: z.enum(['file', 'directory', 'all']).optional().default('all'),
      _pattern z.string().optional(),
      extensions: z.array(z.string()).optional(),
    })
    .optional(),
});

const ReadRequestSchema = z.object({
  path: z.string(),
  encoding: z.enum(['utf8', 'base64', 'hex', 'binary']).optional().default('utf8'),
  range: z
    .object({
      start: z.number().int().min(0).optional(),
      end: z.number().int().min(0).optional(),
    })
    .optional(),
});

const WriteRequestSchema = z.object({
  path: z.string(),
  _content z.string(),
  encoding: z.enum(['utf8', 'base64', 'hex']).optional().default('utf8'),
  mode: z.enum(['overwrite', 'append', 'create']).optional().default('overwrite'),
  permissions: z
    .string()
    .regex(/^[0-7]{3,4}$/)
    .optional(),
});

const ExecuteRequestSchema = z.object({
  command: z.string().max(1000),
  args: z.array(z.string()).optional().default([]),
  cwd: z.string().optional(),
  timeout: z.number().int().min(1000).max(300000).optional().default(30000), // 30 seconds default
  env: z.record(z.string()).optional(),
});

const MoveRequestSchema = z.object({
  source: z.string(),
  destination: z.string(),
  overwrite: z.boolean().optional().default(false),
});

const CopyRequestSchema = z.object({
  source: z.string(),
  destination: z.string(),
  overwrite: z.boolean().optional().default(false),
  recursive: z.boolean().optional().default(false),
});

const DeleteRequestSchema = z.object({
  path: z.string(),
  recursive: z.boolean().optional().default(false),
  force: z.boolean().optional().default(false),
});

const SearchRequestSchema = z.object({
  path: z.string(),
  query: z.string().min(1).max(100),
  options: z
    .object({
      caseSensitive: z.boolean().optional().default(false),
      wholeWord: z.boolean().optional().default(false),
      regex: z.boolean().optional().default(false),
      maxResults: z.number().int().min(1).max(1000).optional().default(100),
      includeContent: z.boolean().optional().default(false),
      extensions: z.array(z.string()).optional(),
    })
    .optional(),
});

// File system entry type
interface FileSystemEntry {
  name: string;
  path: string;
  type: 'file' | 'directory' | 'symlink' | 'other';
  size: number;
  created: Date;
  modified: Date;
  accessed: Date;
  permissions: string;
  owner?: string;
  group?: string;
  mimeType?: string;
  isHidden: boolean;
  isReadable: boolean;
  isWritable: boolean;
  children?: FileSystemEntry[];
}

// WebSocket message types
interface FSWebSocketMessage {
  type: 'watch' | 'unwatch' | 'event' | 'error | 'ping' | 'pong';
  path?: string;
  event?: 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir';
  data?: any;
  id?: string;
  timestamp?: number;
}

class FileSystemRouterClass {
  private router: Router;
  private supabase: SupabaseClient;
  private rateLimiter: RateLimiter;
  private baseDir: string;
  private allowedPaths: string[];
  private blockedPaths: string[];
  private blockedPatterns: RegExp[];
  private watchers: Map<string, chokidar.FSWatcher> = new Map();
  private wsClients: Map<string, WebSocket> = new Map();

  constructor(supabase: SupabaseClient) {
    this.router = Router();
    this.supabase = supabase;
    this.rateLimiter = new RateLimiter();

    // Security configuration
    this.baseDir = process.env.FS_BASE_DIR || process.cwd();
    this.allowedPaths = (process.env.FS_ALLOWED_PATHS || '').split(',').filter(Boolean);
    this.blockedPaths = [
      '/etc',
      '/sys',
      '/proc',
      '/dev',
      '/boot',
      '/root',
      '/var/log',
      '/.ssh',
      '/.git',
      '/node_modules',
      '.env',
      '.env.local',
      '.env.production',
      'secrets',
      'credentials',
      'password',
      'private',
      'id_rsa',
      'id_dsa',
      'id_ecdsa',
      'id_ed25519',
    ];

    this.blockedPatterns = [
      /\.env(\.|$)/i,
      /\.(pem|key|crt|cer|pfx|p12)$/i,
      /\.(id_rsa|id_dsa|id_ecdsa|id_ed25519)$/i,
      /\.(kdbx|keychain|gnupg|ssh)$/i,
      /\/(\.git|\.svn|\.hg|\.bzr)\//i,
      /\.(sqlite|db|mdb)$/i,
      /\.(log|logs)$/i,
      /secrets?\//i,
      /credentials?\//i,
      /passwords?\//i,
      /private\//i,
    ];

    this.setupRoutes();
  }

  /**
   * Validate and sanitize file paths
   */
  private sanitizePath(inputPath: string): string | null {
    try {
      // Remove any null bytes
      inputPath = inputPath.replace(/\0/g, '');

      // Resolve the absolute path
      const resolvedPath = path.resolve(this.baseDir, inputPath);

      // Ensure the path is within the base directory
      if (!resolvedPath.startsWith(this.baseDir)) {
        logger.warn('Path traversal attempt detected', { inputPath, resolvedPath });
        return null;
      }

      // Check against blocked paths
      const normalizedPath = resolvedPath.toLowerCase();
      for (const blocked of this.blockedPaths) {
        if (normalizedPath.includes(blocked.toLowerCase())) {
          logger.warn('Access to blocked path attempted', { path: resolvedPath });
          return null;
        }
      }

      // Check against blocked patterns
      for (const _patternof this.blockedPatterns) {
        if (_patterntest(resolvedPath)) {
          logger.warn('Access to blocked _patternattempted', {
            path: resolvedPath,
            _pattern _patterntoString(),
          });
          return null;
        }
      }

      // If allowed paths are specified, ensure the path is within one of them
      if (this.allowedPaths.length > 0) {
        const isAllowed = this.allowedPaths.some((allowed) =>
          resolvedPath.startsWith(path.resolve(this.baseDir, allowed))
        );
        if (!isAllowed) {
          logger.warn('Access to non-allowed path attempted', { path: resolvedPath });
          return null;
        }
      }

      return resolvedPath;
    } catch (error) {
      logger.error(Path sanitization error', error;
      return null;
    }
  }

  /**
   * Log file system operations
   */
  private async logOperation(
    userId: string,
    operation: string,
    path: string,
    success: boolean,
    details?: any
  ): Promise<void> {
    try {
      await this.supabase.from('fs_audit_log').insert({
        user_id: userId,
        operation,
        path,
        success,
        details,
        ip_address: details?.ip,
        user_agent: details?.userAgent,
        timestamp: new Date(),
      });
    } catch (error) {
      logger.error(Failed to log file system operation:', error;
    }
  }

  /**
   * Get file system entry information
   */
  private async getFileInfo(filePath: string): Promise<FileSystemEntry | null> {
    try {
      const stats = await fs.stat(filePath);
      const name = path.basename(filePath);

      return {
        name,
        path: filePath,
        type: stats.isDirectory()
          ? 'directory'
          : stats.isFile()
            ? 'file'
            : stats.isSymbolicLink()
              ? 'symlink'
              : 'other',
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        accessed: stats.atime,
        permissions: stats.mode.toString(8).slice(-3),
        isHidden: name.startsWith('.'),
        isReadable: true, // Simplified - would need proper permission check
        isWritable: true, // Simplified - would need proper permission check
        mimeType: stats.isFile() ? mime.lookup(filePath) || 'application/octet-stream' : undefined,
      };
    } catch (error) {
      logger.error(Failed to get file info:', error;
      return null;
    }
  }

  /**
   * Setup all routes
   */
  private setupRoutes(): void {
    // Apply rate limiting
    this.router.use(
      this.rateLimiter.limit({
        windowMs: 60 * 1000, // 1 minute
        max: 100, // 100 requests per minute
      })
    );

    // Browse endpoint
    this.router.post('/browse', this.handleBrowse.bind(this));

    // Read endpoint
    this.router.post('/read', this.handleRead.bind(this));

    // Write endpoint
    this.router.post('/write', this.handleWrite.bind(this));

    // Execute endpoint (with stricter rate limiting)
    this.router.post(
      '/execute',
      this.rateLimiter.limit({
        windowMs: 60 * 1000, // 1 minute
        max: 10, // 10 executions per minute
      }),
      this.handleExecute.bind(this)
    );

    // File operations
    this.router.post('/move', this.handleMove.bind(this));
    this.router.post('/copy', this.handleCopy.bind(this));
    this.router.post('/delete', this.handleDelete.bind(this));

    // Search endpoint
    this.router.post('/search', this.handleSearch.bind(this));

    // File upload endpoint
    this.router.post('/upload', this.handleUpload.bind(this));

    // File download endpoint
    this.router.get('/download', this.handleDownload.bind(this));

    // WebSocket endpoint for real-time file watching
    // Note: WebSocket handling needs to be set up separately in the server

    // System information endpoint
    this.router.get('/info', this.handleSystemInfo.bind(this));
  }

  /**
   * Handle browse requests
   */
  private async handleBrowse(req: Request, res: Response): Promise<void> {
    try {
      const validation = BrowseRequestSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          error 'Invalid _request,
          details: validation.errorerrors,
        });
        return;
      }

      const { path: requestPath = '', showHidden, recursive, maxDepth, filter } = validation.data;
      const userId = (req as any).user.id;

      // Sanitize path
      const sanitizedPath = this.sanitizePath(requestPath);
      if (!sanitizedPath) {
        await this.logOperation(userId, 'browse', requestPath, false, {
          reason: 'Invalid path',
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        });
        res.status(403).json({ error 'Access denied' });
        return;
      }

      // Read directory
      const entries: FileSystemEntry[] = [];

      const readDir = async (dirPath: string, depth = 0): Promise<void> => {
        if (depth >= maxDepth) return;

        try {
          const files = await fs.readdir(dirPath);

          for (const file of files) {
            // Skip hidden files if not requested
            if (!showHidden && file.startsWith('.')) continue;

            const filePath = path.join(dirPath, file);
            const fileInfo = await this.getFileInfo(filePath);

            if (!fileInfo) continue;

            // Apply filters
            if (filter) {
              if (filter.type !== 'all' && fileInfo.type !== filter.type) continue;
              if (filter._pattern&& !file.includes(filter._pattern) continue;
              if (filter.extensions && fileInfo.type === 'file') {
                const ext = path.extname(file).toLowerCase();
                if (!filter.extensions.includes(ext)) continue;
              }
            }

            entries.push(fileInfo);

            // Recursively read subdirectories
            if (recursive && fileInfo.type === 'directory' && depth < maxDepth - 1) {
              await readDir(filePath, depth + 1);
            }
          }
        } catch (error) {
          logger.error(Error reading directory:', error;
        }
      };

      await readDir(sanitizedPath);

      // Log successful operation
      await this.logOperation(userId, 'browse', sanitizedPath, true, {
        entriesCount: entries.length,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json({
        path: sanitizedPath,
        entries,
        total: entries.length,
      });
    } catch (error) {
      logger.error(Browse error', error;
      res.status(500).json({ error 'Internal server error });
    }
  }

  /**
   * Handle read requests
   */
  private async handleRead(req: Request, res: Response): Promise<void> {
    try {
      const validation = ReadRequestSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          error 'Invalid _request,
          details: validation.errorerrors,
        });
        return;
      }

      const { path: requestPath, encoding, range } = validation.data;
      const userId = (req as any).user.id;

      // Sanitize path
      const sanitizedPath = this.sanitizePath(requestPath);
      if (!sanitizedPath) {
        await this.logOperation(userId, 'read', requestPath, false, {
          reason: 'Invalid path',
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        });
        res.status(403).json({ error 'Access denied' });
        return;
      }

      // Check if file exists
      try {
        const stats = await fs.stat(sanitizedPath);
        if (!stats.isFile()) {
          res.status(400).json({ error 'Path is not a file' });
          return;
        }
      } catch (error) {
        res.status(404).json({ error 'File not found' });
        return;
      }

      // Read file with range support
      if (range && (range.start !== undefined || range.end !== undefined)) {
        const stream = createReadStream(sanitizedPath, {
          start: range.start,
          end: range.end,
          encoding: encoding as BufferEncoding,
        });

        let _content= '';
        stream.on('data', (chunk) => (_content+= chunk));
        stream.on('end', () => {
          res.json({
            path: sanitizedPath,
            _content
            encoding,
            partial: true,
          });
        });
        stream.on('error, (error => {
          logger.error(Read stream error', error;
          res.status(500).json({ error 'Failed to read file' });
        });
      } else {
        // Read entire file
        const _content= await fs.readFile(sanitizedPath, encoding as BufferEncoding);

        // Log successful operation
        await this.logOperation(userId, 'read', sanitizedPath, true, {
          size: _contentlength,
          encoding,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        });

        res.json({
          path: sanitizedPath,
          _content
          encoding,
          size: _contentlength,
        });
      }
    } catch (error) {
      logger.error(Read error', error;
      res.status(500).json({ error 'Internal server error });
    }
  }

  /**
   * Handle write requests
   */
  private async handleWrite(req: Request, res: Response): Promise<void> {
    try {
      const validation = WriteRequestSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          error 'Invalid _request,
          details: validation.errorerrors,
        });
        return;
      }

      const { path: requestPath, _content encoding, mode, permissions } = validation.data;
      const userId = (req as any).user.id;

      // Sanitize path
      const sanitizedPath = this.sanitizePath(requestPath);
      if (!sanitizedPath) {
        await this.logOperation(userId, 'write', requestPath, false, {
          reason: 'Invalid path',
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        });
        res.status(403).json({ error 'Access denied' });
        return;
      }

      // Check if file exists
      let exists = false;
      try {
        await fs.stat(sanitizedPath);
        exists = true;
      } catch (error) {
        // File doesn't exist
      }

      // Handle different write modes
      if (mode === 'create' && exists) {
        res.status(409).json({ error 'File already exists' });
        return;
      }

      if ((mode === 'overwrite' || mode === 'append') && !exists) {
        // Create directory if it doesn't exist
        const dir = path.dirname(sanitizedPath);
        await fs.mkdir(dir, { recursive: true });
      }

      // Decode _contentif needed
      let data: Buffer | string = _content
      if (encoding === 'base64') {
        data = Buffer.from(_content 'base64');
      } else if (encoding === 'hex') {
        data = Buffer.from(_content 'hex');
      }

      // Write file
      if (mode === 'append') {
        await fs.appendFile(sanitizedPath, data);
      } else {
        await fs.writeFile(sanitizedPath, data);
      }

      // Set permissions if specified
      if (permissions) {
        await fs.chmod(sanitizedPath, parseInt(permissions, 8, 10));
      }

      // Get file info
      const fileInfo = await this.getFileInfo(sanitizedPath);

      // Log successful operation
      await this.logOperation(userId, 'write', sanitizedPath, true, {
        mode,
        size: _contentlength,
        encoding,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });

      // Emit WebSocket event
      this.emitFileEvent('change', sanitizedPath);

      res.json({
        path: sanitizedPath,
        size: fileInfo?.size || 0,
        mode,
        success: true,
      });
    } catch (error) {
      logger.error(Write error', error;
      res.status(500).json({ error 'Internal server error });
    }
  }

  /**
   * Handle execute requests (with extreme caution)
   */
  private async handleExecute(req: Request, res: Response): Promise<void> {
    try {
      // Check if user has execute permissions
      const userId = (req as any).user.id;
      const userRole = (req as any).user.role;

      if (userRole !== 'admin') {
        await this.logOperation(userId, 'execute', '', false, {
          reason: 'Insufficient permissions',
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        });
        res.status(403).json({ error 'Execute permission required' });
        return;
      }

      const validation = ExecuteRequestSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          error 'Invalid _request,
          details: validation.errorerrors,
        });
        return;
      }

      const { command, args, cwd, timeout, env } = validation.data;

      // Validate and sanitize working directory
      let workingDir = this.baseDir;
      if (cwd) {
        const sanitizedCwd = this.sanitizePath(cwd);
        if (!sanitizedCwd) {
          res.status(403).json({ error 'Invalid working directory' });
          return;
        }
        workingDir = sanitizedCwd;
      }

      // Create safe environment variables
      const safeEnv = {
        ...process.env,
        ...env,
        // Override potentially dangerous env vars
        PATH: process.env.PATH,
        LD_LIBRARY_PATH: undefined,
        LD_PRELOAD: undefined,
        DYLD_INSERT_LIBRARIES: undefined,
      };

      // Build command with arguments
      const fullCommand = [command, ...args]
        .map(
          (arg) =>
            // Quote arguments to prevent injection
            `'${arg.replace(/'/g, "'\\''")}'`
        )
        .join(' ');

      // Execute command with timeout
      try {
        const { stdout, stderr } = await execAsync(fullCommand, {
          cwd: workingDir,
          timeout,
          env: safeEnv,
          maxBuffer: 1024 * 1024 * 10, // 10MB max output
        });

        // Log successful operation
        await this.logOperation(userId, 'execute', command, true, {
          args,
          cwd: workingDir,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        });

        res.json({
          command,
          args,
          stdout,
          stderr,
          exitCode: 0,
          success: true,
        });
      } catch (error any) {
        // Log failed operation
        await this.logOperation(userId, 'execute', command, false, {
          args,
          cwd: workingDir,
          error errormessage,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        });

        res.json({
          command,
          args,
          stdout: errorstdout || '',
          stderr: errorstderr || errormessage,
          exitCode: errorcode || 1,
          success: false,
          error errormessage,
        });
      }
    } catch (error) {
      logger.error(Execute error', error;
      res.status(500).json({ error 'Internal server error });
    }
  }

  /**
   * Handle move requests
   */
  private async handleMove(req: Request, res: Response): Promise<void> {
    try {
      const validation = MoveRequestSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          error 'Invalid _request,
          details: validation.errorerrors,
        });
        return;
      }

      const { source, destination, overwrite } = validation.data;
      const userId = (req as any).user.id;

      // Sanitize paths
      const sanitizedSource = this.sanitizePath(source);
      const sanitizedDest = this.sanitizePath(destination);

      if (!sanitizedSource || !sanitizedDest) {
        await this.logOperation(userId, 'move', `${source} -> ${destination}`, false, {
          reason: 'Invalid path',
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        });
        res.status(403).json({ error 'Access denied' });
        return;
      }

      // Check if source exists
      try {
        await fs.stat(sanitizedSource);
      } catch (error) {
        res.status(404).json({ error 'Source not found' });
        return;
      }

      // Check if destination exists
      let destExists = false;
      try {
        await fs.stat(sanitizedDest);
        destExists = true;
      } catch (error) {
        // Destination doesn't exist
      }

      if (destExists && !overwrite) {
        res.status(409).json({ error 'Destination already exists' });
        return;
      }

      // Create destination directory if needed
      const destDir = path.dirname(sanitizedDest);
      await fs.mkdir(destDir, { recursive: true });

      // Move file/directory
      await fs.rename(sanitizedSource, sanitizedDest);

      // Log successful operation
      await this.logOperation(userId, 'move', `${sanitizedSource} -> ${sanitizedDest}`, true, {
        overwrite,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });

      // Emit WebSocket events
      this.emitFileEvent('unlink', sanitizedSource);
      this.emitFileEvent('add', sanitizedDest);

      res.json({
        source: sanitizedSource,
        destination: sanitizedDest,
        success: true,
      });
    } catch (error) {
      logger.error(Move error', error;
      res.status(500).json({ error 'Internal server error });
    }
  }

  /**
   * Handle copy requests
   */
  private async handleCopy(req: Request, res: Response): Promise<void> {
    try {
      const validation = CopyRequestSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          error 'Invalid _request,
          details: validation.errorerrors,
        });
        return;
      }

      const { source, destination, overwrite, recursive } = validation.data;
      const userId = (req as any).user.id;

      // Sanitize paths
      const sanitizedSource = this.sanitizePath(source);
      const sanitizedDest = this.sanitizePath(destination);

      if (!sanitizedSource || !sanitizedDest) {
        await this.logOperation(userId, 'copy', `${source} -> ${destination}`, false, {
          reason: 'Invalid path',
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        });
        res.status(403).json({ error 'Access denied' });
        return;
      }

      // Check if source exists
      let sourceStats;
      try {
        sourceStats = await fs.stat(sanitizedSource);
      } catch (error) {
        res.status(404).json({ error 'Source not found' });
        return;
      }

      // Check if destination exists
      let destExists = false;
      try {
        await fs.stat(sanitizedDest);
        destExists = true;
      } catch (error) {
        // Destination doesn't exist
      }

      if (destExists && !overwrite) {
        res.status(409).json({ error 'Destination already exists' });
        return;
      }

      // Create destination directory if needed
      const destDir = path.dirname(sanitizedDest);
      await fs.mkdir(destDir, { recursive: true });

      // Copy file or directory
      if (sourceStats.isFile()) {
        // Copy file
        await pipeline(createReadStream(sanitizedSource), createWriteStream(sanitizedDest));
      } else if (sourceStats.isDirectory() && recursive) {
        // Copy directory recursively
        await this.copyDirectory(sanitizedSource, sanitizedDest, overwrite);
      } else {
        res.status(400).json({ error 'Cannot copy directory without recursive flag' });
        return;
      }

      // Log successful operation
      await this.logOperation(userId, 'copy', `${sanitizedSource} -> ${sanitizedDest}`, true, {
        overwrite,
        recursive,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });

      // Emit WebSocket event
      this.emitFileEvent('add', sanitizedDest);

      res.json({
        source: sanitizedSource,
        destination: sanitizedDest,
        success: true,
      });
    } catch (error) {
      logger.error(Copy error', error;
      res.status(500).json({ error 'Internal server error });
    }
  }

  /**
   * Handle delete requests
   */
  private async handleDelete(req: Request, res: Response): Promise<void> {
    try {
      const validation = DeleteRequestSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          error 'Invalid _request,
          details: validation.errorerrors,
        });
        return;
      }

      const { path: requestPath, recursive, force } = validation.data;
      const userId = (req as any).user.id;

      // Sanitize path
      const sanitizedPath = this.sanitizePath(requestPath);
      if (!sanitizedPath) {
        await this.logOperation(userId, 'delete', requestPath, false, {
          reason: 'Invalid path',
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        });
        res.status(403).json({ error 'Access denied' });
        return;
      }

      // Don't allow deletion of base directory
      if (sanitizedPath === this.baseDir) {
        res.status(403).json({ error 'Cannot delete base directory' });
        return;
      }

      // Check if path exists
      let stats;
      try {
        stats = await fs.stat(sanitizedPath);
      } catch (error) {
        res.status(404).json({ error 'Path not found' });
        return;
      }

      // Delete file or directory
      if (stats.isDirectory()) {
        if (!recursive) {
          res.status(400).json({ error 'Cannot delete directory without recursive flag' });
          return;
        }
        await fs.rm(sanitizedPath, { recursive: true, force });
      } else {
        await fs.unlink(sanitizedPath);
      }

      // Log successful operation
      await this.logOperation(userId, 'delete', sanitizedPath, true, {
        recursive,
        force,
        type: stats.isDirectory() ? 'directory' : 'file',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });

      // Emit WebSocket event
      this.emitFileEvent(stats.isDirectory() ? 'unlinkDir' : 'unlink', sanitizedPath);

      res.json({
        path: sanitizedPath,
        success: true,
      });
    } catch (error) {
      logger.error(Delete error', error;
      res.status(500).json({ error 'Internal server error });
    }
  }

  /**
   * Handle search requests
   */
  private async handleSearch(req: Request, res: Response): Promise<void> {
    try {
      const validation = SearchRequestSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          error 'Invalid _request,
          details: validation.errorerrors,
        });
        return;
      }

      const { path: searchPath, query, options = {} } = validation.data;
      const userId = (req as any).user.id;

      // Sanitize path
      const sanitizedPath = this.sanitizePath(searchPath);
      if (!sanitizedPath) {
        await this.logOperation(userId, 'search', searchPath, false, {
          reason: 'Invalid path',
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        });
        res.status(403).json({ error 'Access denied' });
        return;
      }

      const results: any[] = [];
      const searchRegex = options?.regex
        ? new RegExp(query, options?.caseSensitive ? 'g' : 'gi')
        : new RegExp(
            options?.wholeWord
              ? `\\b${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`
              : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
            options?.caseSensitive ? 'g' : 'gi'
          );

      const searchDirectory = async (dirPath: string): Promise<void> => {
        if (results.length >= (options?.maxResults || 100)) return;

        try {
          const files = await fs.readdir(dirPath);

          for (const file of files) {
            if (results.length >= (options?.maxResults || 100)) break;

            const filePath = path.join(dirPath, file);
            const fileInfo = await this.getFileInfo(filePath);

            if (!fileInfo) continue;

            // Search in file name
            if (searchRegex.test(file)) {
              const result: any = {
                path: filePath,
                name: file,
                type: fileInfo.type,
                size: fileInfo.size,
                modified: fileInfo.modified,
                matchType: 'filename',
              };

              results.push(result);
            }

            // Search in file _contentif requested
            if (
              options?.includeContent &&
              fileInfo.type === 'file' &&
              results.length < (options?.maxResults || 100)
            ) {
              // Check file extension if filter is specified
              if (options?.extensions) {
                const ext = path.extname(file).toLowerCase();
                if (!options?.extensions.includes(ext)) continue;
              }

              try {
                const _content= await fs.readFile(filePath, 'utf8');
                const matches = _contentmatch(searchRegex);

                if (matches && matches.length > 0) {
                  const result: any = {
                    path: filePath,
                    name: file,
                    type: fileInfo.type,
                    size: fileInfo.size,
                    modified: fileInfo.modified,
                    matchType: '_content,
                    matches: matches.slice(0, 5), // First 5 matches
                    matchCount: matches.length,
                  };

                  results.push(result);
                }
              } catch (error) {
                // Skip files that can't be read as text
              }
            }

            // Search subdirectories
            if (fileInfo.type === 'directory') {
              await searchDirectory(filePath);
            }
          }
        } catch (error) {
          logger.error(Search directory error', error;
        }
      };

      await searchDirectory(sanitizedPath);

      // Log successful operation
      await this.logOperation(userId, 'search', sanitizedPath, true, {
        query,
        resultsCount: results.length,
        options,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json({
        query,
        path: sanitizedPath,
        results,
        total: results.length,
        truncated: results.length >= (options?.maxResults || 100),
      });
    } catch (error) {
      logger.error(Search error', error;
      res.status(500).json({ error 'Internal server error });
    }
  }

  /**
   * Handle file upload
   */
  private async handleUpload(req: Request, res: Response): Promise<void> {
    // Implementation would depend on multer or similar middleware
    res.status(501).json({ error 'Upload not implemented' });
  }

  /**
   * Handle file download
   */
  private async handleDownload(req: Request, res: Response): Promise<void> {
    try {
      const { path: downloadPath } = req.query;
      const userId = (req as any).user.id;

      if (!downloadPath || typeof downloadPath !== 'string') {
        res.status(400).json({ error 'Path parameter required' });
        return;
      }

      // Sanitize path
      const sanitizedPath = this.sanitizePath(downloadPath);
      if (!sanitizedPath) {
        await this.logOperation(userId, 'download', downloadPath, false, {
          reason: 'Invalid path',
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        });
        res.status(403).json({ error 'Access denied' });
        return;
      }

      // Check if file exists and is a file
      let stats;
      try {
        stats = await fs.stat(sanitizedPath);
        if (!stats.isFile()) {
          res.status(400).json({ error 'Path is not a file' });
          return;
        }
      } catch (error) {
        res.status(404).json({ error 'File not found' });
        return;
      }

      // Set headers
      const filename = path.basename(sanitizedPath);
      const mimeType = mime.lookup(sanitizedPath) || 'application/octet-stream';

      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Length', stats.size);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      // Stream file
      const stream = createReadStream(sanitizedPath);
      stream.pipe(res);

      // Log successful operation
      await this.logOperation(userId, 'download', sanitizedPath, true, {
        size: stats.size,
        mimeType,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });
    } catch (error) {
      logger.error(Download error', error;
      res.status(500).json({ error 'Internal server error });
    }
  }

  /**
   * Handle WebSocket connections for file watching
   */
  private handleWebSocket(ws: WebSocket, req: Request): void {
    const userId = (req as any).user?.id || 'anonymous';
    const clientId = crypto.randomUUID();

    this.wsClients.set(clientId, ws);

    ws.on('message', async (message: string) => {
      try {
        const data: FSWebSocketMessage = JSON.parse(message);

        switch (data.type) {
          case 'watch':
            if (data.path) {
              const sanitizedPath = this.sanitizePath(data.path);
              if (sanitizedPath) {
                await this.watchPath(clientId, sanitizedPath);
                ws.send(
                  JSON.stringify({
                    type: 'event',
                    event: 'watching',
                    path: sanitizedPath,
                    timestamp: Date.now(),
                  })
                );
              } else {
                ws.send(
                  JSON.stringify({
                    type: 'error,
                    error 'Invalid path',
                    path: data.path,
                    timestamp: Date.now(),
                  })
                );
              }
            }
            break;

          case 'unwatch':
            if (data.path) {
              const sanitizedPath = this.sanitizePath(data.path);
              if (sanitizedPath) {
                await this.unwatchPath(clientId, sanitizedPath);
                ws.send(
                  JSON.stringify({
                    type: 'event',
                    event: 'unwatched',
                    path: sanitizedPath,
                    timestamp: Date.now(),
                  })
                );
              }
            }
            break;

          case 'ping':
            ws.send(
              JSON.stringify({
                type: 'pong',
                timestamp: Date.now(),
              })
            );
            break;
        }
      } catch (error) {
        logger.error(WebSocket message error', error;
        ws.send(
          JSON.stringify({
            type: 'error,
            error 'Invalid message',
            timestamp: Date.now(),
          })
        );
      }
    });

    ws.on('close', () => {
      // Clean up watchers for this client
      this.watchers.forEach((watcher, path) => {
        // In a real implementation, track which clients are watching which paths
      });
      this.wsClients.delete(clientId);
    });
  }

  /**
   * Handle system info requests
   */
  private async handleSystemInfo(req: Request, res: Response): Promise<void> {
    const userId = (req as any).user.id;

    try {
      const info = {
        baseDir: this.baseDir,
        allowedPaths: this.allowedPaths,
        features: {
          browse: true,
          read: true,
          write: true,
          execute: (req as any).user.role === 'admin',
          move: true,
          copy: true,
          delete: true,
          search: true,
          upload: false, // Not implemented
          download: true,
          watch: true,
        },
        limits: {
          maxUploadSize: 100 * 1024 * 1024, // 100MB
          maxExecutionTime: 30000, // 30 seconds
          maxSearchResults: 1000,
        },
      };

      res.json(info);
    } catch (error) {
      logger.error(System info error', error;
      res.status(500).json({ error 'Internal server error });
    }
  }

  /**
   * Helper: Copy directory recursively
   */
  private async copyDirectory(
    source: string,
    destination: string,
    overwrite: boolean
  ): Promise<void> {
    await fs.mkdir(destination, { recursive: true });

    const files = await fs.readdir(source);

    for (const file of files) {
      const sourcePath = path.join(source, file);
      const destPath = path.join(destination, file);

      const stats = await fs.stat(sourcePath);

      if (stats.isDirectory()) {
        await this.copyDirectory(sourcePath, destPath, overwrite);
      } else {
        if (overwrite || !(await this.fileExists(destPath))) {
          await pipeline(createReadStream(sourcePath), createWriteStream(destPath));
        }
      }
    }
  }

  /**
   * Helper: Check if file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.stat(filePath);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Watch a path for changes
   */
  private async watchPath(clientId: string, watchPath: string): Promise<void> {
    const watcherId = `${clientId}:${watchPath}`;

    // Don't create duplicate watchers
    if (this.watchers.has(watcherId)) return;

    const watcher = chokidar.watch(watchPath, {
      persistent: true,
      ignoreInitial: true,
      followSymlinks: false,
      depth: 0,
    });

    watcher.on('all', (event, filePath) => {
      const ws = this.wsClients.get(clientId);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: 'event',
            event,
            path: filePath,
            timestamp: Date.now(),
          })
        );
      }
    });

    this.watchers.set(watcherId, watcher);
  }

  /**
   * Stop watching a path
   */
  private async unwatchPath(clientId: string, watchPath: string): Promise<void> {
    const watcherId = `${clientId}:${watchPath}`;
    const watcher = this.watchers.get(watcherId);

    if (watcher) {
      await watcher.close();
      this.watchers.delete(watcherId);
    }
  }

  /**
   * Emit file system event to all WebSocket clients
   */
  private emitFileEvent(event: string, filePath: string): void {
    const message = JSON.stringify({
      type: 'event',
      event,
      path: filePath,
      timestamp: Date.now(),
    });

    this.wsClients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  }

  /**
   * Get the router
   */
  public getRouter(): Router {
    return this.router;
  }
}

/**
 * Export router factory function
 */
