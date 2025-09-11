import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🔍 Checking Supabase Extension Status...\n');

// Check if embedding column exists
try {
  const { data, error } = await supabase
    .from('ai_memories')
    .select('id, embedding')
    .limit(0);
    
  if (!error) {
    console.log('✅ Vector extension is likely enabled (embedding column exists)');
  } else if (error.message.includes('column "embedding" does not exist')) {
    console.log('❌ Vector extension not enabled or embedding column missing');
    console.log('\n📌 To enable extensions:');
    console.log('1. Go to Supabase Dashboard: ' + supabaseUrl);
    console.log('2. Navigate to Database → Extensions');
    console.log('3. Enable these extensions:');
    console.log('   - vector (for AI embeddings)');
    console.log('   - pg_cron (for scheduled jobs)');
    console.log('   - pg_net (for webhooks)');
    console.log('4. Then run this SQL in the SQL Editor:\n');
    
    console.log(`-- Add embedding columns
ALTER TABLE ai_memories ADD COLUMN IF NOT EXISTS embedding vector(1536);
ALTER TABLE knowledge_sources ADD COLUMN IF NOT EXISTS content_embedding vector(1536);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_memories_embedding ON ai_memories 
USING ivfflat (embedding vector_cosine_ops)
WHERE embedding IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_knowledge_embedding ON knowledge_sources 
USING ivfflat (content_embedding vector_cosine_ops)
WHERE content_embedding IS NOT NULL;`);
  }
} catch (e) {
  console.error('Error:', e.message);
}

// Test other tables
console.log('\n📊 Table Status:');
const tables = [
  'ai_memories',
  'ai_service_keys',
  'agent_performance_metrics',
  'knowledge_sources',
  'mlx_fine_tuning_jobs',
  'intelligent_parameters'
];

for (const table of tables) {
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true });
    
  if (!error) {
    console.log(`✅ ${table}: ${count} records`);
  } else {
    console.log(`❌ ${table}: ${error.message}`);
  }
}

console.log('\n✨ Check complete!');
console.log('\n💡 Next steps:');
console.log('1. Enable extensions in Supabase Dashboard if needed');
console.log('2. Run the migration SQL to add vector columns');
console.log('3. Start using vector search for AI memory!');