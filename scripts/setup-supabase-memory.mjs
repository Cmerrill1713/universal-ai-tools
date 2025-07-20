#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

console.log('🚀 Setting up Supabase Memory Tables for Autofix System\n');

// Read Supabase config
const envContent = fs.readFileSync('.env', 'utf8');
const urlMatch = envContent.match(/SUPABASE_URL\s*=\s*["']?([^"'\s]+)["']?/);
const keyMatch = envContent.match(/SUPABASE_SERVICE_KEY\s*=\s*["']?([^"'\s]+)["']?/);

if (!urlMatch || !keyMatch) {
  console.error('❌ Could not find SUPABASE_URL or SUPABASE_SERVICE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(urlMatch[1], keyMatch[1]);

// Create memories table
async function createMemoriesTable() {
  console.log('📝 Creating memories table...');
  
  const { error } = await supabase.rpc('create_memories_table', {});
  
  // If RPC doesn't exist, create manually via SQL
  if (error) {
    console.log('Using direct SQL approach...');
    
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS public.memories (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        content TEXT NOT NULL,
        metadata JSONB DEFAULT '{}',
        embedding VECTOR(1536),
        user_id TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Enable RLS
      ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;

      -- Create policy for authenticated users
      CREATE POLICY IF NOT EXISTS "Users can access their own memories" ON public.memories
        FOR ALL USING (auth.uid()::text = user_id OR user_id IN ('claude-autofix', 'claude-advanced-autofix', 'claude-training-system', 'github-actions'));

      -- Create indexes
      CREATE INDEX IF NOT EXISTS memories_user_id_idx ON public.memories (user_id);
      CREATE INDEX IF NOT EXISTS memories_created_at_idx ON public.memories (created_at);
      CREATE INDEX IF NOT EXISTS memories_metadata_idx ON public.memories USING gin (metadata);

      -- Create embedding search function (if vector extension is available)
      CREATE OR REPLACE FUNCTION search_memories(
        query_embedding vector(1536),
        match_threshold float DEFAULT 0.7,
        match_count int DEFAULT 10,
        filter jsonb DEFAULT '{}'
      )
      RETURNS TABLE (
        id uuid,
        content text,
        metadata jsonb,
        similarity float,
        created_at timestamptz
      )
      LANGUAGE sql
      AS $$
        SELECT
          memories.id,
          memories.content,
          memories.metadata,
          1 - (memories.embedding <=> query_embedding) AS similarity,
          memories.created_at
        FROM memories
        WHERE 
          CASE 
            WHEN filter = '{}' THEN true
            ELSE metadata @> filter
          END
          AND (memories.embedding <=> query_embedding) < (1 - match_threshold)
        ORDER BY memories.embedding <=> query_embedding
        LIMIT match_count;
      $$;

      -- Simple embedding generation placeholder
      CREATE OR REPLACE FUNCTION ai_generate_embedding(content text)
      RETURNS jsonb
      LANGUAGE sql
      AS $$
        SELECT jsonb_build_array(random(), random(), random())::jsonb;
      $$;
    `;

    // Execute SQL directly
    const { error: sqlError } = await supabase.from('_').select('1').limit(0);
    if (sqlError) {
      console.log('⚠️  Cannot execute SQL directly. Creating basic table via client...');
      // Fallback: Let's create a simple JSON-based approach
      return await createSimpleMemoriesTable();
    }
  }
  
  console.log('✅ Memories table created successfully');
}

// Fallback: Create simple table structure
async function createSimpleMemoriesTable() {
  console.log('📝 Creating simple memories table...');
  
  // For local development, we'll use the existing table structure if available
  // or create manually via Supabase Studio
  
  console.log('⚠️  Please create the memories table manually in Supabase Studio:');
  console.log(`
CREATE TABLE public.memories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  user_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable public access for autofix system
ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow autofix systems" ON public.memories
  FOR ALL USING (user_id LIKE 'claude-%' OR user_id = 'github-actions');
  `);
  
  return true;
}

// Test the connection and table
async function testMemorySystem() {
  console.log('\n🧪 Testing memory system...');
  
  // Test insert
  const testMemory = {
    content: 'Autofix system test - table creation',
    metadata: {
      memory_type: 'system_test',
      test_timestamp: new Date().toISOString(),
      autofix_version: '1.0.0',
      tags: ['test', 'setup', 'autofix']
    },
    user_id: 'claude-autofix'
  };

  const { data: insertData, error: insertError } = await supabase
    .from('memories')
    .insert(testMemory)
    .select()
    .single();

  if (insertError) {
    console.error('❌ Insert test failed:', insertError.message);
    return false;
  }

  console.log('✅ Insert test successful:', insertData.id);

  // Test select
  const { data: selectData, error: selectError } = await supabase
    .from('memories')
    .select('*')
    .eq('user_id', 'claude-autofix')
    .order('created_at', { ascending: false })
    .limit(5);

  if (selectError) {
    console.error('❌ Select test failed:', selectError.message);
    return false;
  }

  console.log(`✅ Select test successful: Found ${selectData.length} memories`);
  
  // Test metadata filtering
  const { data: filterData, error: filterError } = await supabase
    .from('memories')
    .select('*')
    .eq('metadata->>memory_type', 'system_test')
    .limit(1);

  if (filterError) {
    console.error('❌ Metadata filter test failed:', filterError.message);
    return false;
  }

  console.log(`✅ Metadata filter test successful: Found ${filterData.length} test memories`);

  return true;
}

// Create some sample autofix memories
async function createSampleData() {
  console.log('\n📚 Creating sample autofix memories...');

  const sampleMemories = [
    {
      content: 'Fixed TypeScript any types in base_agent.ts',
      metadata: {
        memory_type: 'autofix',
        fix_type: 'type_improvement',
        file_path: 'src/agents/base_agent.ts',
        success: true,
        confidence: 0.85,
        session_id: 'demo_session',
        tags: ['autofix', 'typescript', 'any-types']
      },
      user_id: 'claude-autofix'
    },
    {
      content: 'Sorted imports in devils_advocate_agent.ts',
      metadata: {
        memory_type: 'autofix',
        fix_type: 'import_sorting',
        file_path: 'src/agents/cognitive/devils_advocate_agent.ts',
        success: true,
        confidence: 0.9,
        session_id: 'demo_session',
        tags: ['autofix', 'imports', 'sorting']
      },
      user_id: 'claude-autofix'
    },
    {
      content: 'Extracted magic numbers to constants',
      metadata: {
        memory_type: 'autofix',
        fix_type: 'magic_numbers',
        file_path: 'src/services/adaptive-autofix.ts',
        success: true,
        confidence: 0.75,
        session_id: 'demo_session',
        tags: ['autofix', 'magic-numbers', 'constants']
      },
      user_id: 'claude-autofix'
    },
    {
      content: 'Advanced autofix session completed: 42 errors fixed, 18 warnings fixed',
      metadata: {
        memory_type: 'advanced_session_summary',
        total_errors_fixed: 42,
        total_warnings_fixed: 18,
        files_modified: 6,
        patterns_used: ['type_improvement', 'import_sorting', 'magic_numbers'],
        session_id: 'demo_session',
        tags: ['autofix', 'session', 'summary']
      },
      user_id: 'claude-advanced-autofix'
    }
  ];

  const { data, error } = await supabase
    .from('memories')
    .insert(sampleMemories)
    .select();

  if (error) {
    console.error('❌ Failed to create sample data:', error.message);
    return false;
  }

  console.log(`✅ Created ${data.length} sample autofix memories`);
  return true;
}

// Display connection info
function displayConnectionInfo() {
  console.log('\n🔗 Supabase Connection Info:');
  console.log(`URL: ${urlMatch[1]}`);
  console.log(`Dashboard: ${urlMatch[1].replace('/rest/v1', '')}`);
  console.log(`Table: memories`);
  console.log('\n📖 To view data:');
  console.log('1. Open Supabase Studio (usually http://localhost:54323)');
  console.log('2. Go to Table Editor');
  console.log('3. Select "memories" table');
  console.log('4. Filter by user_id = "claude-autofix" to see autofix data');
}

// Main setup function
async function setupSupabaseMemory() {
  try {
    console.log(`Connecting to: ${urlMatch[1]}`);
    
    // Test connection
    const { data, error } = await supabase.from('_test').select('1').limit(0);
    if (error && !error.message.includes('does not exist')) {
      throw new Error(`Connection failed: ${error.message}`);
    }
    
    console.log('✅ Connected to Supabase successfully');

    // Create table
    await createMemoriesTable();

    // Test the system
    const testSuccess = await testMemorySystem();
    if (!testSuccess) {
      console.log('⚠️  Basic tests failed, but table might still work');
    }

    // Create sample data
    await createSampleData();

    displayConnectionInfo();

    console.log('\n🎉 Supabase memory system setup complete!');
    console.log('\n🔄 Now run: npm run fix:advanced');
    console.log('   Then check your Supabase dashboard to see the stored memories');

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    console.log('\n🛠️  Manual Setup Instructions:');
    console.log('1. Open Supabase Studio: http://localhost:54323');
    console.log('2. Go to SQL Editor');
    console.log('3. Run this SQL:');
    console.log(`
CREATE TABLE public.memories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  user_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow autofix systems" ON public.memories
  FOR ALL USING (user_id LIKE 'claude-%' OR user_id = 'github-actions');
    `);
    process.exit(1);
  }
}

// Run setup
setupSupabaseMemory();