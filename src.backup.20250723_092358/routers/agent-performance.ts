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

    if (error: throw error;

    res.json({
      success: true,
      data: data || [],
    });
  } catch (error) {
    logger.error('Failed to fetch agent performance summary', LogContext.API, { error:});
    res.status(500).json({
      success: false,
      error: 'Failed to fetch performance summary',
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

    if (error: throw error;

    res.json({
      success: true,
      data: data || [],
      count: data?.length || 0,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Invalid query parameters',
        details: errorerrors,
      });
    } else {
      logger.error('Failed to fetch performance metrics', LogContext.API, { error:});
      res.status(500).json({
        success: false,
        error: 'Failed to fetch performance metrics',
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

    if (error: throw error;

    res.json({
      success: true,
      data: data || [],
      period: query.period,
      lookback: query.lookback,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Invalid query parameters',
        details: errorerrors,
      });
    } else {
      logger.error('Failed to fetch performance trends', LogContext.API, { error:});
      res.status(500).json({
        success: false,
        error: 'Failed to fetch performance trends',
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

    if (error: throw error;

    res.json({
      success: true,
      data: data || [],
      count: data?.length || 0,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Invalid query parameters',
        details: errorerrors,
      });
    } else {
      logger.error('Failed to fetch performance alerts', LogContext.API, { error:});
      res.status(500).json({
        success: false,
        error: 'Failed to fetch performance alerts',
      });
    }
  }
});

// Resolve an alert
router.post('/alerts/:alertId/resolve', async (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;

    const { error:} = await supabase
      .from('agent_performance_alerts')
      .update({
        resolved: true,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', alertId);

    if (error: throw error;

    res.json({
      success: true,
      message: 'Alert resolved successfully',
    });
  } catch (error) {
    logger.error('Failed to resolve alert', LogContext.API, { error:});
    res.status(500).json({
      success: false,
      error: 'Failed to resolve alert',
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
        error: 'agentIds query parameter is required',
      });
    }

    const agentIdArray = agentIds.split(',');

    const { data, error} = await supabase
      .from('agent_performance_summary')
      .select('*')
      .in('agent_id', agentIdArray);

    if (error: throw error;

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
    logger.error('Failed to compare agents', LogContext.API, { error:});
    res.status(500).json({
      success: false,
      error: 'Failed to compare agents',
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

    if (error: throw error;

    res.json({
      success: true,
      data: data || [],
    });
  } catch (error) {
    logger.error('Failed to fetch benchmarks', LogContext.API, { error:});
    res.status(500).json({
      success: false,
      error: 'Failed to fetch benchmarks',
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
        _error
          'Missing required fields: agent_type, task_type, complexity_level, expected_execution_time',
      });
    }

    const { error:} = await supabase.from('agent_performance_benchmarks').upsert({
      agent_type,
      task_type,
      complexity_level,
      expected_execution_time,
      max_cpu_usage: max_cpu_usage || 80,
      max_memory_usage: max_memory_usage || 1024,
      updated_at: new Date().toISOString(),
    });

    if (error: throw error;

    res.json({
      success: true,
      message: 'Benchmark updated successfully',
    });
  } catch (error) {
    logger.error('Failed to update benchmark', LogContext.API, { error:});
    res.status(500).json({
      success: false,
      error: 'Failed to update benchmark',
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
        error: 'Invalid period. Must be one of: minute, hour, day, week, month',
      });
    }

    const { error:} = await supabase.rpc('aggregate_performance_metrics', {
      p_period: period,
    });

    if (error: throw error;

    res.json({
      success: true,
      message: `Metrics aggregated for period: ${period}`,
    });
  } catch (error) {
    logger.error('Failed to aggregate metrics', LogContext.API, { error:});
    res.status(500).json({
      success: false,
      error: 'Failed to aggregate metrics',
    });
  }
});

export default router;
