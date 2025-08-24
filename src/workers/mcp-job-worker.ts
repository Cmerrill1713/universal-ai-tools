import 'dotenv/config';

import { Client } from 'pg';

import { mcpIntegrationService } from '../services/mcp-integration-service.js';
import { log,LogContext } from '../utils/logger.js';

const DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

async function processJob(client: Client, jobId: string): Promise<void> {
  const { rows } = await client.query(
    `UPDATE public.mcp_jobs
     SET status = 'in_progress', updated_at = now()
     WHERE id = $1 AND status = 'queued'
     RETURNING id, tool_name, tool_args`,
    [jobId]
  );

  if (rows.length === 0) {return;} // already taken or not queued

  const job = rows[0] as { id: string; tool_name: string; tool_args: any };

  try {
    // For propose_migration we route through fallback and do not need the MCP server.
    if (job.tool_name !== 'propose_migration') {
      if (!mcpIntegrationService.isRunning()) {
        await mcpIntegrationService.start();
      }
    }

    const result = await mcpIntegrationService.sendMessage(job.tool_name, job.tool_args);

    await client.query(
      `UPDATE public.mcp_jobs SET status='completed', result = $2, updated_at = now() WHERE id = $1`,
      [job.id, JSON.stringify(result ?? null)]
    );
    log.info('✅ MCP job completed', LogContext.MCP, { jobId: job.id, tool: job.tool_name });

    // If migration proposal, persist suggestion
    if (job.tool_name === 'propose_migration') {
      const sql = (result as any)?.sql || '';
      if (sql.trim()) {
        await client.query(
          `INSERT INTO public.migration_suggestions(job_id, request, sql_text) VALUES ($1, $2, $3)`,
          [job.id, String(job.tool_args?.request ?? ''), sql]
        );
      } else {
        log.warn('⚠️ No SQL returned for propose_migration', LogContext.MCP, {
          jobId: job.id,
          resultPreview: JSON.stringify(result)?.slice(0, 200),
        });
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await client.query(
      `UPDATE public.mcp_jobs SET status='failed', error = $2, updated_at = now() WHERE id = $1`,
      [job.id, message]
    );
    log.error('❌ MCP job failed', LogContext.MCP, { jobId: job.id, error: message });
  }
}

async function main(): Promise<void> {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  await client.query('LISTEN mcp_jobs_insert');
  log.info('📡 MCP job worker listening on channel mcp_jobs_insert', LogContext.MCP);

  // Also sweep any existing queued jobs at startup
  const pending = await client.query(
    `SELECT id FROM public.mcp_jobs WHERE status='queued' ORDER BY created_at ASC LIMIT 25`
  );
  for (const row of pending.rows) {
    await processJob(client, String(row.id));
  }

  client.on('notification', async (msg) => {
    if (msg.channel !== 'mcp_jobs_insert' || !msg.payload) {return;}
    await processJob(client, msg.payload);
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('Worker error', err);
    process.exit(1);
  });
}

export { main as runMcpJobWorker };
