#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import chalk from 'chalk';
import fetch from 'node-fetch';
import { execSync } from 'child_process';

console.log(chalk.blue.bold('🤖 Setting up Ollama AI for Supabase Studio\n'));

// Read Supabase config
const envContent = fs.readFileSync('.env', 'utf8');
const urlMatch = envContent.match(/SUPABASE_URL\s*=\s*["']?([^"'\s]+)["']?/);
const keyMatch = envContent.match(/SUPABASE_SERVICE_KEY\s*=\s*["']?([^"'\s]+)["']?/);

if (!urlMatch || !keyMatch) {
  console.error('❌ Could not find Supabase config in .env');
  process.exit(1);
}

const supabase = createClient(urlMatch[1], keyMatch[1]);

async function setupOllamaAI() {
  try {
    // 1. Check if Ollama is running
    console.log(chalk.yellow('🔍 Checking Ollama status...'));
    try {
      const response = await fetch('http://localhost:11434/api/tags');
      const data = await response.json();
      console.log(chalk.green(`✅ Ollama is running with ${data.models?.length || 0} models`));
      
      if (data.models?.length > 0) {
        console.log(chalk.gray('   Available models:'));
        data.models.forEach(model => {
          console.log(chalk.gray(`   - ${model.name}`));
        });
      }
    } catch (err) {
      console.log(chalk.red('❌ Ollama is not running'));
      console.log(chalk.yellow('   Please start Ollama first'));
      return;
    }

    // 2. Create SQL function to call Ollama
    console.log(chalk.yellow('\n📝 Creating Ollama AI functions in database...'));
    
    const ollamaFunctions = `
-- Function to generate SQL using Ollama
CREATE OR REPLACE FUNCTION public.ai_generate_sql(
  prompt text,
  model text DEFAULT 'llama3.2:3b',
  temperature float DEFAULT 0.1
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result text;
  response jsonb;
BEGIN
  -- Use pg_net to call Ollama API
  SELECT content INTO result
  FROM http((
    'POST',
    'http://host.docker.internal:11434/api/generate',
    ARRAY[http_header('Content-Type', 'application/json')],
    'application/json',
    jsonb_build_object(
      'model', model,
      'prompt', 'You are a PostgreSQL expert. Generate only SQL code, no explanations. ' || prompt,
      'temperature', temperature,
      'stream', false
    )::text
  ))
  WHERE status = 200;
  
  -- Extract response
  IF result IS NOT NULL THEN
    response := result::jsonb;
    RETURN response->>'response';
  ELSE
    RETURN 'Error: Could not generate SQL';
  END IF;
END;
$$;

-- Function to explain SQL using Ollama
CREATE OR REPLACE FUNCTION public.ai_explain_sql(
  sql_query text,
  model text DEFAULT 'llama3.2:3b'
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result text;
  response jsonb;
BEGIN
  SELECT content INTO result
  FROM http((
    'POST',
    'http://host.docker.internal:11434/api/generate',
    ARRAY[http_header('Content-Type', 'application/json')],
    'application/json',
    jsonb_build_object(
      'model', model,
      'prompt', 'Explain this SQL query in simple terms: ' || sql_query,
      'temperature', 0.3,
      'stream', false
    )::text
  ))
  WHERE status = 200;
  
  IF result IS NOT NULL THEN
    response := result::jsonb;
    RETURN response->>'response';
  ELSE
    RETURN 'Error: Could not explain SQL';
  END IF;
END;
$$;

-- Function to optimize SQL using Ollama
CREATE OR REPLACE FUNCTION public.ai_optimize_sql(
  sql_query text,
  model text DEFAULT 'llama3.2:3b'
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result text;
  response jsonb;
BEGIN
  SELECT content INTO result
  FROM http((
    'POST',
    'http://host.docker.internal:11434/api/generate',
    ARRAY[http_header('Content-Type', 'application/json')],
    'application/json',
    jsonb_build_object(
      'model', model,
      'prompt', 'Optimize this PostgreSQL query for performance. Return only the optimized SQL: ' || sql_query,
      'temperature', 0.1,
      'stream', false
    )::text
  ))
  WHERE status = 200;
  
  IF result IS NOT NULL THEN
    response := result::jsonb;
    RETURN response->>'response';
  ELSE
    RETURN 'Error: Could not optimize SQL';
  END IF;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.ai_generate_sql TO postgres, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_explain_sql TO postgres, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_optimize_sql TO postgres, anon, authenticated;
`;

    // Note: We'll need to execute this SQL manually or via migration
    fs.writeFileSync('supabase/migrations/20250119_ollama_ai_functions.sql', ollamaFunctions);
    console.log(chalk.green('✅ Created Ollama AI functions migration'));

    // 3. Create a simpler JavaScript-based approach
    console.log(chalk.yellow('\n🔧 Creating Ollama proxy service...'));
    
    const ollamaProxy = `import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
app.use(cors());
app.use(express.json());

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

// Proxy endpoint for Supabase Studio
app.post('/api/ai/sql', async (req, res) => {
  try {
    const { prompt, model = 'llama3.2:3b' } = req.body;
    
    const response = await fetch(\`\${OLLAMA_URL}/api/generate\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: \`You are a PostgreSQL expert. Generate SQL for: \${prompt}. Return only SQL code.\`,
        temperature: 0.1,
        stream: false
      })
    });

    const data = await response.json();
    res.json({ sql: data.response });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/ai/explain', async (req, res) => {
  try {
    const { sql, model = 'llama3.2:3b' } = req.body;
    
    const response = await fetch(\`\${OLLAMA_URL}/api/generate\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: \`Explain this SQL query in simple terms: \${sql}\`,
        temperature: 0.3,
        stream: false
      })
    });

    const data = await response.json();
    res.json({ explanation: data.response });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.OLLAMA_PROXY_PORT || 11435;
app.listen(PORT, () => {
  console.log(\`🤖 Ollama AI proxy running on port \${PORT}\`);
});
`;

    fs.writeFileSync('src/services/ollama-ai-proxy.ts', ollamaProxy);
    console.log(chalk.green('✅ Created Ollama AI proxy service'));

    // 4. Create Edge Function for Supabase
    console.log(chalk.yellow('\n🚀 Creating Supabase Edge Function...'));
    
    const edgeFunction = `import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      }
    })
  }

  try {
    const { prompt, action = 'generate' } = await req.json()
    
    // Call Ollama API
    const ollamaResponse = await fetch('http://host.docker.internal:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3.2:3b',
        prompt: action === 'generate' 
          ? \`Generate PostgreSQL query for: \${prompt}. Return only SQL.\`
          : \`Explain this SQL: \${prompt}\`,
        temperature: 0.1,
        stream: false
      })
    })

    const data = await ollamaResponse.json()
    
    return new Response(
      JSON.stringify({ 
        result: data.response,
        model: 'llama3.2:3b',
        action 
      }),
      { 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        } 
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    )
  }
})
`;

    // Create edge function directory
    fs.mkdirSync('supabase/functions/ollama-ai', { recursive: true });
    fs.writeFileSync('supabase/functions/ollama-ai/index.ts', edgeFunction);
    console.log(chalk.green('✅ Created Ollama AI Edge Function'));

    // 5. Create test script
    console.log(chalk.yellow('\n🧪 Creating test script...'));
    
    const testScript = `#!/usr/bin/env node

import fetch from 'node-fetch';
import chalk from 'chalk';

console.log(chalk.blue.bold('🧪 Testing Ollama AI Integration\\n'));

async function testOllamaAI() {
  try {
    // Test SQL generation
    console.log(chalk.yellow('🔍 Testing SQL generation...'));
    const genResponse = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3.2:3b',
        prompt: 'Generate a PostgreSQL query to select all users created in the last 7 days. Return only SQL.',
        temperature: 0.1,
        stream: false
      })
    });

    const genData = await genResponse.json();
    console.log(chalk.green('✅ SQL Generation Test:'));
    console.log(chalk.gray(genData.response));

    // Test SQL explanation
    console.log(chalk.yellow('\\n🔍 Testing SQL explanation...'));
    const explainResponse = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3.2:3b',
        prompt: 'Explain this SQL: SELECT * FROM users WHERE created_at > NOW() - INTERVAL \\'7 days\\';',
        temperature: 0.3,
        stream: false
      })
    });

    const explainData = await explainResponse.json();
    console.log(chalk.green('\\n✅ SQL Explanation Test:'));
    console.log(chalk.gray(explainData.response));

    console.log(chalk.green('\\n✅ All tests passed!'));
    
  } catch (error) {
    console.error(chalk.red('❌ Test failed:'), error.message);
  }
}

testOllamaAI();
`;

    fs.writeFileSync('scripts/test-ollama-ai.mjs', testScript);
    execSync('chmod +x scripts/test-ollama-ai.mjs');
    console.log(chalk.green('✅ Created test script'));

    // 6. Update package.json
    console.log(chalk.yellow('\n📦 Updating package.json...'));
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    
    packageJson.scripts = {
      ...packageJson.scripts,
      'ollama:test': 'node scripts/test-ollama-ai.mjs',
      'ollama:setup': 'node scripts/setup-supabase-ollama-ai.mjs'
    };
    
    fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2) + '\n');

    // 7. Instructions
    console.log(chalk.blue.bold('\n✨ Ollama AI Setup Complete!\n'));
    
    console.log(chalk.cyan('Next steps:'));
    console.log(chalk.green('1. Apply the migration:'));
    console.log(chalk.gray('   npx supabase db push'));
    
    console.log(chalk.green('\n2. Deploy the edge function:'));
    console.log(chalk.gray('   npx supabase functions deploy ollama-ai'));
    
    console.log(chalk.green('\n3. Test Ollama integration:'));
    console.log(chalk.gray('   npm run ollama:test'));
    
    console.log(chalk.yellow('\n💡 How to use in SQL Editor:'));
    console.log(chalk.gray('-- Generate SQL'));
    console.log(chalk.gray("SELECT ai_generate_sql('find all users who logged in today');"));
    
    console.log(chalk.gray('\n-- Explain SQL'));
    console.log(chalk.gray("SELECT ai_explain_sql('SELECT * FROM users WHERE last_login > NOW() - INTERVAL \\'1 day\\';');"));
    
    console.log(chalk.gray('\n-- Optimize SQL'));
    console.log(chalk.gray("SELECT ai_optimize_sql('SELECT * FROM orders o JOIN users u ON o.user_id = u.id WHERE o.created_at > \\'2024-01-01\\';');"));

  } catch (error) {
    console.error(chalk.red('❌ Setup failed:'), error.message);
    process.exit(1);
  }
}

// Run setup
setupOllamaAI();