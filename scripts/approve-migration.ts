#!/usr/bin/env tsx
import { writeFileSync } from 'fs';
import { join } from 'path';
import { Client } from 'pg';

const DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

async function main(): Promise<void> {
  const id = process.argv[2];
  if (!id) {
    console.error('Usage: tsx scripts/approve-migration.ts <suggestion-id> [--apply]');
    process.exit(1);
  }
  const shouldApply = process.argv.includes('--apply');

  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    const { rows } = await client.query(
      `SELECT id, sql_text, status FROM public.migration_suggestions WHERE id = $1`,
      [id]
    );
    if (rows.length === 0) {
      console.error('Suggestion not found');
      process.exit(1);
    }
    const { sql_text: sql, status } = rows[0] as { sql_text: string; status: string };
    if (!sql || !sql.trim()) {
      console.error('Suggestion has no SQL');
      process.exit(1);
    }

    const timestamp = new Date()
      .toISOString()
      .replace(/[-:TZ.]/g, '')
      .slice(0, 14);
    const filename = `${timestamp}_llm.sql`;
    const filepath = join('supabase', 'migrations', filename);
    writeFileSync(filepath, sql + '\n');
    console.log(`✅ Wrote ${filepath}`);

    await client.query(
      `UPDATE public.migration_suggestions SET status='approved', updated_at = now() WHERE id = $1`,
      [id]
    );
    console.log('✅ Marked suggestion approved');

    if (shouldApply) {
      console.log('🚀 Applying migration via psql...');
      // We rely on external shell to run psql for simplicity; instruct user next step
      console.log(`Run: psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -f ${filepath}`);
    }
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
