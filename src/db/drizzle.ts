// Drizzle scaffolding (lazy until dependency added)
import type { Pool } from 'pg';

export async function getDrizzleClient(pool: Pool) {
  try {
    const { drizzle } = await import('drizzle-orm/node-postgres');
    return drizzle(pool);
  } catch {
    return null;
  }
}



