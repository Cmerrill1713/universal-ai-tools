import { Router } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { CommonValidators, strictValidation } from '../middleware/comprehensive-validation';
import { fetchJsonWithTimeout } from '../utils/fetch-with-timeout';

export function ToolRouter(supabase: SupabaseClient) {
  const router = Router();

  // Execute a tool - High security validation due to tool execution
  router.post(
    '/execute',
    strictValidation({
      body: z.object({
        tool_name: z
          .string()
          .min(1)
          .max(100)
          .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid tool name format'),
        parameters: z.record(z.any()).optional().default({}),
      }),
    }),
    async (req: any, res: Response) => {
      const startTime = Date.now();
      try {
        const { tool_name, parameters } = req.body;

        // Get tool definition
        const { data: tool, error: toolError, } = await supabase
          .from('ai_custom_tools')
          .select('*')
          .eq('tool_name', tool_name)
          .eq('is_active', true)
          .single();

        if (toolError || !tool) {
          throw new Error(`Tool ${tool_name} not found`);
        }

        // Execute based on implementation type
        let result: any;

        switch (tool.implementation_type) {
          case 'sql':
            // Execute SQL query
            const { data, error } = await supabase.rpc('execute_dynamic_sql', {
              query: tool.implementation,
              params: parameters,
            });
            if (error) throw error;
            result = data;
            break;

          case 'function':
            // Function execution is disabled for security reasons
            // To execute custom logic, use database functions or external APIs
            throw new Error(
              'Direct function execution is disabled for security. Please use database functions or API endpoints instead.'
            );
            break;

          case 'api':
            // Make API call with timeout protection
            try {
              result = await fetchJsonWithTimeout(tool.implementation, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(parameters),
                timeout: 30000, // 30 seconds timeout
                retries: 2, // Retry twice on failure
                retryDelay: 1000,
              });
            } catch (error) {
              logger.error('API tool execution failed:', {
                tool: tool_name,
                error: error.message,
                url: tool.implementation,
              });
              throw new Error(`API call failed: ${error.message}`);
            }
            break;

          default:
            throw new Error(`Unknown implementation type: ${tool.implementation_type}`);
        }

        // Log execution
        const executionTime = Date.now() - startTime;
        await supabase.from('ai_tool_executions').insert({
          service_id: req.aiServiceId,
          tool_name,
          input_params: parameters,
          output_result: result,
          execution_time_ms: executionTime,
          status: 'success',
        });

        res.json({ success: true, result, execution_time_ms: executionTime, });
      } catch (error: any) {
        logger.error('Tool execution error', error);

        // Log failed execution
        await supabase.from('ai_tool_executions').insert({
          service_id: req.aiServiceId,
          tool_name: req.body.tool_name,
          input_params: req.body.parameters,
          status: 'error',
          error_message: error.message,
          execution_time_ms: Date.now() - startTime,
        });

        res.status(400).json({ error: error.message });
      }
    }
  );

  // List available tools
  router.get('/', CommonValidators.pagination, async (req: any, res: Response) => {
    try {
      const { data: tools, error } = await supabase
        .from('ai_custom_tools')
        .select('id, tool_name, description, input_schema, output_schema, rate_limit')
        .eq('is_active', true);

      if (error) throw error;

      res.json({ tools });
    } catch (error: any) {
      logger.error('Li, error', error);
      res.status(500).json({ error: 'Failed to list tools' });
    }
  });

  // Create a new tool
  router.post('/', async (req: any, res: Response) => {
    try {
      const schema = z.object({
        tool_name: z.string(),
        description: z.string(),
        input_schema: z.object({}).passthrough(),
        output_schema: z.object({}).passthrough().optional(),
        implementation_type: z.enum(['sql', 'function', 'api', 'script']),
        implementation: z.string(),
        rate_limit: z.number().optional(),
      });

      const toolData = schema.parse(req.body);

      const { data: tool, error } = await supabase
        .from('ai_custom_tools')
        .insert({
          ...toolData,
          created_by: req.aiServiceId,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      res.json({ success: true, tool });
    } catch (error: any) {
      logger.error('Create tool error', error);
      res.status(400).json({ error: error.message });
    }
  });

  // Built-in universal tools
  router.post(
    '/execute/builtin/:toolName',
    strictValidation({
      params: z.object({
        toolName: z
          .string()
          .min(1)
          .max(100)
          .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid tool name'),
      }),
      body: z.object({
        parameters: z.record(z.any()).optional().default({}),
      }),
    }),
    async (req: any, res: Response) => {
      try {
        const { toolName } = req.params;
        const parameters = req.body;

        let result: any;

        switch (toolName) {
          case 'store_context':
            result = await storeContext(supabase, req.aiServiceId, parameters);
            break;

          case 'retrieve_context':
            result = await retrieveContext(supabase, req.aiServiceId, parameters);
            break;

          case 'search_knowledge':
            result = await searchKnowledge(supabase, parameters;
            break;

          case 'communicate':
            result = await sendCommunication(supabase, req.aiServiceId, parameters;
            break;

          case 'analyze_project':
            result = await analyzeProject(supabase, parameters;
            break;

          default:
            throw new Error(`Unknown built-in tool: ${toolName}`);
        }

        res.json({ success: true, result });
      } catch (error: any) {
        logger.error('Built-in tool error', error);
        res.status(400).json({ error: error.message });
      }
    }
  );

  return router;
}

// Built-in tool implementations
async function storeContext(supabase: SupabaseClient, serviceId: string, params): any {
  const { context_type, context_key, content, metadata } = params;

  const { data, error } = await supabase
    .from('ai_contexts')
    .upsert({
      service_id: serviceId,
      context_type,
      context_key,
      content,
      metadata,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function retrieveContext(supabase: SupabaseClient, serviceId: string, params): any {
  const { context_type, context_key } = params;

  const { data, error } = await supabase
    .from('ai_contexts')
    .select('*')
    .eq('service_id', serviceId)
    .eq('context_type', context_type)
    .eq('context_key', context_key)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

async function searchKnowledge(supabase: SupabaseClient, params): any {
  const { query, knowledge_type, limit = 10 } = params;

  let queryBuilder = supabase.from('ai_knowledge_base').select('*');

  if (knowledge_type) {
    queryBuilder = queryBuilder.eq('knowledge_type', knowledge_type);
  }

  if (query) {
    queryBuilder = queryBuilder.textSearch('content', query);
  }

  const { data, error } = await queryBuilder.limit(limit);

  if (error) throw error;
  return data;
}

async function sendCommunication(supabase: SupabaseClient, fromServiceId: string, params): any {
  const { to_service, message_type, content, thread_id } = params;

  // Find target service
  const { data: targetService, error: serviceError, } = await supabase
    .from('ai_services')
    .select('id')
    .eq('service_name', to_service)
    .single();

  if (serviceError) throw new Error(`Target service ${to_service} not found`);

  const { data, error } = await supabase
    .from('ai_communications')
    .insert({
      from_service_id: fromServiceId,
      to_service_id: targetService.id,
      message_type,
      content,
      thread_id,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function analyzeProject(supabase: SupabaseClient, params): any {
  const { project_path } = params;

  // This would analyze the project structure and store it
  // For now, just retrieve if exists
  const { data, error } = await supabase
    .from('ai_project_contexts')
    .select('*')
    .eq('project_path', project_path)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data || { message: 'Project not analyzed yet' };
}
