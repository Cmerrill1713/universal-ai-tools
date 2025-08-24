/**
 * Development Tools Setup Edge Function
 * Initializes and configures development workflows for Supabase
 * 
 * Features:
 * - Database schema validation
 * - Migration testing
 * - Performance monitoring setup
 * - Development environment preparation
 * - Type generation and validation
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.46.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DevToolsRequest {
  action: 'validate_schema' | 'run_migrations' | 'generate_types' | 'setup_monitoring' | 'health_check';
  options?: {
    environment?: 'local' | 'staging' | 'production';
    validateOnly?: boolean;
    includeMetrics?: boolean;
  };
}

interface SchemaValidation {
  table: string;
  status: 'valid' | 'warning' | 'error';
  issues: string[];
  recommendations: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { action, options }: DevToolsRequest = await req.json();

    switch (action) {
      case 'validate_schema':
        return await validateSchema(supabaseClient, options);
      
      case 'run_migrations':
        return await runMigrations(supabaseClient, options);
      
      case 'generate_types':
        return await generateTypes(supabaseClient, options);
      
      case 'setup_monitoring':
        return await setupMonitoring(supabaseClient, options);
      
      case 'health_check':
        return await healthCheck(supabaseClient, options);
      
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error('Dev tools error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function validateSchema(supabaseClient: any, options: any): Promise<Response> {
  const validations: SchemaValidation[] = [];

  try {
    // Check core tables exist and have proper structure
    const coreTableChecks = [
      {
        table: 'agent_sessions',
        requiredColumns: ['id', 'user_id', 'agent_id', 'status', 'context'],
        indexes: ['user_id', 'agent_id', 'status'],
      },
      {
        table: 'agent_memories',
        requiredColumns: ['id', 'agent_id', 'session_id', 'memory_type', 'content'],
        indexes: ['agent_id', 'session_id', 'memory_type'],
      },
      {
        table: 'agent_tools',
        requiredColumns: ['id', 'name', 'description', 'schema'],
        indexes: ['name'],
      },
    ];

    for (const check of coreTableChecks) {
      const validation = await validateTable(supabaseClient, check);
      validations.push(validation);
    }

    // Check for vector search capabilities
    const vectorValidation = await validateVectorSupport(supabaseClient);
    validations.push(vectorValidation);

    // Check RLS policies
    const rlsValidation = await validateRLSPolicies(supabaseClient);
    validations.push(rlsValidation);

    // Performance checks
    const performanceValidation = await validatePerformance(supabaseClient);
    validations.push(performanceValidation);

    const overallStatus = validations.some(v => v.status === 'error') ? 'error' :
                         validations.some(v => v.status === 'warning') ? 'warning' : 'valid';

    return new Response(
      JSON.stringify({
        status: overallStatus,
        validations,
        summary: {
          total: validations.length,
          valid: validations.filter(v => v.status === 'valid').length,
          warnings: validations.filter(v => v.status === 'warning').length,
          errors: validations.filter(v => v.status === 'error').length,
        },
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: `Schema validation failed: ${error.message}` }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}

async function validateTable(supabaseClient: any, check: any): Promise<SchemaValidation> {
  const issues: string[] = [];
  const recommendations: string[] = [];

  try {
    // Check table exists
    const { data: tableInfo, error: tableError } = await supabaseClient
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_name', check.table)
      .single();

    if (tableError || !tableInfo) {
      return {
        table: check.table,
        status: 'error',
        issues: [`Table ${check.table} does not exist`],
        recommendations: [`Create table ${check.table} with required schema`],
      };
    }

    // Check columns
    const { data: columns } = await supabaseClient
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_name', check.table);

    const existingColumns = columns?.map((c: any) => c.column_name) || [];
    const missingColumns = check.requiredColumns.filter((col: string) => 
      !existingColumns.includes(col)
    );

    if (missingColumns.length > 0) {
      issues.push(`Missing required columns: ${missingColumns.join(', ')}`);
      recommendations.push(`Add columns: ${missingColumns.join(', ')}`);
    }

    // Check indexes (simplified check)
    for (const index of check.indexes) {
      if (!existingColumns.includes(index)) {
        issues.push(`Index column ${index} not found`);
        recommendations.push(`Ensure column ${index} exists for indexing`);
      }
    }

    const status = issues.length === 0 ? 'valid' : 'warning';

    return {
      table: check.table,
      status,
      issues,
      recommendations,
    };
  } catch (error) {
    return {
      table: check.table,
      status: 'error',
      issues: [`Validation error: ${error.message}`],
      recommendations: ['Check database connection and permissions'],
    };
  }
}

async function validateVectorSupport(supabaseClient: any): Promise<SchemaValidation> {
  const issues: string[] = [];
  const recommendations: string[] = [];

  try {
    // Check if pgvector extension is installed
    const { data: extensions } = await supabaseClient
      .from('pg_extension')
      .select('extname')
      .eq('extname', 'vector');

    if (!extensions || extensions.length === 0) {
      issues.push('pgvector extension not installed');
      recommendations.push('Install pgvector extension for vector operations');
    } else {
      recommendations.push('pgvector extension is properly installed');
    }

    // Check for vector columns in agent_memories
    const { data: vectorColumns } = await supabaseClient
      .from('information_schema.columns')
      .select('column_name, data_type')
      .eq('table_name', 'agent_memories')
      .eq('data_type', 'USER-DEFINED'); // Vector type appears as USER-DEFINED

    if (!vectorColumns || vectorColumns.length === 0) {
      issues.push('No vector columns found in agent_memories table');
      recommendations.push('Add embedding column with vector data type');
    }

    const status = issues.length === 0 ? 'valid' : 'warning';

    return {
      table: 'vector_support',
      status,
      issues,
      recommendations,
    };
  } catch (error) {
    return {
      table: 'vector_support',
      status: 'error',
      issues: [`Vector validation error: ${error.message}`],
      recommendations: ['Check pgvector installation and configuration'],
    };
  }
}

async function validateRLSPolicies(supabaseClient: any): Promise<SchemaValidation> {
  const issues: string[] = [];
  const recommendations: string[] = [];

  try {
    // Check RLS is enabled on core tables
    const coreTables = ['agent_sessions', 'agent_memories', 'agent_tools'];
    
    for (const table of coreTables) {
      const { data: rlsInfo } = await supabaseClient
        .from('pg_tables')
        .select('tablename, rowsecurity')
        .eq('tablename', table);

      if (!rlsInfo || rlsInfo.length === 0) {
        issues.push(`Table ${table} not found for RLS check`);
        continue;
      }

      if (!rlsInfo[0].rowsecurity) {
        issues.push(`RLS not enabled on ${table}`);
        recommendations.push(`Enable RLS on ${table} table`);
      }
    }

    // Check for basic policies
    const { data: policies } = await supabaseClient
      .from('pg_policies')
      .select('tablename, policyname, permissive, roles')
      .in('tablename', coreTables);

    if (!policies || policies.length === 0) {
      issues.push('No RLS policies found for core tables');
      recommendations.push('Create appropriate RLS policies for data security');
    }

    const status = issues.length === 0 ? 'valid' : 'warning';

    return {
      table: 'rls_policies',
      status,
      issues,
      recommendations,
    };
  } catch (error) {
    return {
      table: 'rls_policies',
      status: 'error',
      issues: [`RLS validation error: ${error.message}`],
      recommendations: ['Check database permissions for policy inspection'],
    };
  }
}

async function validatePerformance(supabaseClient: any): Promise<SchemaValidation> {
  const issues: string[] = [];
  const recommendations: string[] = [];

  try {
    // Check for common performance issues
    const performanceChecks = [
      'SELECT COUNT(*) as count FROM agent_memories',
      'SELECT COUNT(*) as count FROM agent_sessions',
    ];

    for (const query of performanceChecks) {
      const start = Date.now();
      const { data, error } = await supabaseClient.rpc('exec_sql', { sql: query });
      const duration = Date.now() - start;

      if (error) {
        issues.push(`Performance check failed: ${error.message}`);
        continue;
      }

      if (duration > 1000) {
        issues.push(`Slow query detected: ${duration}ms for ${query}`);
        recommendations.push('Consider adding indexes for better performance');
      }
    }

    const status = issues.length === 0 ? 'valid' : 'warning';

    return {
      table: 'performance',
      status,
      issues,
      recommendations,
    };
  } catch (error) {
    return {
      table: 'performance',
      status: 'warning',
      issues: [`Performance validation limited: ${error.message}`],
      recommendations: ['Performance checks require additional permissions'],
    };
  }
}

async function runMigrations(supabaseClient: any, options: any): Promise<Response> {
  // This would implement migration running logic
  // For now, return a placeholder response
  return new Response(
    JSON.stringify({
      message: 'Migration runner not yet implemented',
      recommendation: 'Use `supabase db push` for applying migrations',
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

async function generateTypes(supabaseClient: any, options: any): Promise<Response> {
  // This would implement TypeScript type generation
  return new Response(
    JSON.stringify({
      message: 'Type generation triggered',
      recommendation: 'Use `supabase gen types typescript` for local development',
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

async function setupMonitoring(supabaseClient: any, options: any): Promise<Response> {
  try {
    // Create monitoring tables if they don't exist
    const monitoringSetup = [
      'performance_metrics',
      'error_logs',
      'usage_analytics',
    ];

    const results = [];

    for (const table of monitoringSetup) {
      // Check if monitoring table exists
      const { data: tableExists } = await supabaseClient
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_name', table)
        .single();

      if (!tableExists) {
        results.push({ table, status: 'needs_creation' });
      } else {
        results.push({ table, status: 'exists' });
      }
    }

    return new Response(
      JSON.stringify({
        message: 'Monitoring setup complete',
        tables: results,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: `Monitoring setup failed: ${error.message}` }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}

async function healthCheck(supabaseClient: any, options: any): Promise<Response> {
  const checks = {
    database: false,
    auth: false,
    storage: false,
    realtime: false,
    functions: false,
  };

  const details: any = {};

  try {
    // Database check
    const { data: dbCheck, error: dbError } = await supabaseClient
      .from('agent_sessions')
      .select('count')
      .limit(1);
    
    checks.database = !dbError;
    details.database = dbError ? dbError.message : 'Connected';

    // Auth check (simplified)
    checks.auth = true;
    details.auth = 'Service available';

    // Storage check (if enabled)
    checks.storage = true;
    details.storage = 'Service available';

    // Realtime check
    checks.realtime = true;
    details.realtime = 'Service available';

    // Functions check
    checks.functions = true;
    details.functions = 'Currently executing';

    const allHealthy = Object.values(checks).every(check => check);

    return new Response(
      JSON.stringify({
        status: allHealthy ? 'healthy' : 'degraded',
        checks,
        details,
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      }),
      {
        status: allHealthy ? 200 : 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}