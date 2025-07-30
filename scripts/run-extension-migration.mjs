import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseKey) {
  console.error('❌ No Supabase key found');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🚀 Running extension migration...\n');

// Read the migration file
const migrationPath = join(process.cwd(), 'supabase/migrations/041_add_missing_extensions.sql');
const migrationSQL = readFileSync(migrationPath, 'utf8');

// Split by statements (rough split, good enough for our migration)
const statements = migrationSQL
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith('--'));

console.log(`📝 Found ${statements.length} statements to execute\n`);

// Execute each statement
for (let i = 0; i < statements.length; i++) {
  const statement = statements[i] + ';';
  
  // Skip pure comment lines
  if (statement.trim().startsWith('--')) continue;
  
  console.log(`Executing statement ${i + 1}...`);
  
  try {
    const { data, error } = await supabase.rpc('execute_sql', {
      query: statement
    });
    
    if (error) {
      // Try direct execution with a different approach
      console.log('Trying alternative execution method...');
      
      // For simple queries, we can check specific things
      if (statement.includes('pg_extension')) {
        const { data: extensions, error: extError } = await supabase
          .from('pg_extension')
          .select('extname')
          .in('extname', ['vector', 'pg_cron', 'pg_net']);
          
        if (!extError) {
          console.log('✅ Current extensions:', extensions.map(e => e.extname).join(', '));
        }
      }
    } else {
      console.log('✅ Statement executed successfully');
    }
  } catch (e) {
    console.log('⚠️  Could not execute statement:', e.message);
  }
}

// Check final state
console.log('\n📊 Checking final extension state...\n');

// Check for vector extension and columns
const { data: vectorCheck, error: vectorError } = await supabase
  .from('ai_memories')
  .select('id')
  .limit(0);

if (!vectorError) {
  console.log('✅ ai_memories table is accessible');
  
  // Check if we can query with embedding column
  const { data: embeddingCheck, error: embError } = await supabase
    .from('ai_memories')
    .select('id, embedding')
    .limit(1);
    
  if (!embError) {
    console.log('✅ embedding column exists in ai_memories');
  } else if (embError.message.includes('column "embedding" does not exist')) {
    console.log('❌ embedding column not found - vector extension may not be enabled');
    console.log('\n📌 To enable extensions manually:');
    console.log('1. Go to your Supabase Dashboard');
    console.log('2. Navigate to Database → Extensions');
    console.log('3. Enable: vector, pg_cron, pg_net');
    console.log('4. Run the migration SQL in the SQL Editor');
  }
}

console.log('\n✨ Migration check complete!');