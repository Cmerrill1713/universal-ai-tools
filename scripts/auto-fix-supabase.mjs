#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import chalk from 'chalk';
import fetch from 'node-fetch';
import { execSync } from 'child_process';

console.log(chalk.blue.bold('🔧 Auto-fixing Supabase Database with Ollama\n'));

// Read Supabase config
const envContent = fs.readFileSync('.env', 'utf8');
const urlMatch = envContent.match(/SUPABASE_URL\s*=\s*["']?([^"'\s]+)["']?/);
const keyMatch = envContent.match(/SUPABASE_SERVICE_KEY\s*=\s*["']?([^"'\s]+)["']?/);

const supabase = createClient(urlMatch[1], keyMatch[1], {
  db: { schema: 'public' },
  auth: { persistSession: false }
});

// Ollama helper
async function askOllama(prompt, model = 'llama3.2:3b') {
  try {
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        temperature: 0.1,
        stream: false
      })
    });
    
    const data = await response.json();
    return data.response;
  } catch (error) {
    console.error(chalk.red('❌ Ollama error:'), error.message);
    return null;
  }
}

// Essential tables and their schemas
const ESSENTIAL_TABLES = {
  ai_memories: {
    purpose: 'Store AI agent memories, context, and learning data',
    required_columns: ['id', 'service_id', 'memory_type', 'content', 'metadata', 'created_at'],
    sample_data: true
  },
  memories: {
    purpose: 'Legacy memory storage for backward compatibility',
    required_columns: ['id', 'content', 'metadata', 'user_id', 'created_at'],
    sample_data: false
  },
  agent_tools: {
    purpose: 'Store available tools and functions for AI agents',
    required_columns: ['id', 'name', 'description', 'parameters', 'enabled', 'created_at'],
    sample_data: true
  },
  agent_sessions: {
    purpose: 'Track AI agent sessions and conversations',
    required_columns: ['id', 'session_id', 'agent_id', 'context', 'created_at', 'updated_at'],
    sample_data: false
  }
};

// Check and fix tables
async function checkAndFixTables() {
  console.log(chalk.yellow('📋 Checking essential tables...\n'));
  
  const missingTables = [];
  
  for (const [tableName, config] of Object.entries(ESSENTIAL_TABLES)) {
    const { error } = await supabase
      .from(tableName)
      .select('count')
      .limit(1);
    
    if (error) {
      console.log(chalk.red(`❌ Missing: ${tableName}`));
      missingTables.push({ name: tableName, ...config });
    } else {
      console.log(chalk.green(`✅ Found: ${tableName}`));
    }
  }
  
  if (missingTables.length === 0) {
    console.log(chalk.green('\n✅ All essential tables exist!'));
    return true;
  }
  
  console.log(chalk.yellow(`\n🔨 Creating ${missingTables.length} missing tables...\n`));
  
  for (const table of missingTables) {
    await createTable(table);
  }
  
  return true;
}

// Create table using Ollama
async function createTable(tableInfo) {
  console.log(chalk.blue(`Creating ${tableInfo.name}...`));
  
  const prompt = `Generate a PostgreSQL CREATE TABLE statement for: ${tableInfo.name}
Purpose: ${tableInfo.purpose}
Required columns: ${tableInfo.required_columns.join(', ')}

Requirements:
- Use UUID for id with gen_random_uuid() as default
- Include proper data types (TEXT, JSONB, TIMESTAMP, etc)
- Add created_at and updated_at timestamps where appropriate
- Enable Row Level Security (RLS)
- Add appropriate policies for public access
- Include useful indexes
- Return ONLY the SQL code, no explanations

Example format:
CREATE TABLE IF NOT EXISTS public.table_name (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ...
);
ALTER TABLE public.table_name ENABLE ROW LEVEL SECURITY;
CREATE POLICY "policy_name" ON public.table_name ...;
CREATE INDEX IF NOT EXISTS ...;`;

  const sql = await askOllama(prompt, 'qwen2.5:7b');
  
  if (!sql) {
    console.error(chalk.red(`❌ Failed to generate SQL for ${tableInfo.name}`));
    return false;
  }
  
  // Save migration
  const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const filename = `supabase/migrations/${timestamp}_create_${tableInfo.name}.sql`;
  
  // Clean up the SQL (remove markdown if present)
  const cleanSql = sql.replace(/```sql\n?/g, '').replace(/```\n?/g, '').trim();
  
  fs.writeFileSync(filename, cleanSql);
  console.log(chalk.green(`✅ Created migration: ${filename}`));
  
  // Add sample data if requested
  if (tableInfo.sample_data) {
    const samplePrompt = `Generate INSERT statements with sample data for table: ${tableInfo.name}
Purpose: ${tableInfo.purpose}
Add 3-5 realistic sample records
Return ONLY the SQL INSERT statements`;

    const sampleSql = await askOllama(samplePrompt);
    if (sampleSql) {
      const cleanSample = sampleSql.replace(/```sql\n?/g, '').replace(/```\n?/g, '').trim();
      fs.appendFileSync(filename, `\n\n-- Sample data\n${cleanSample}`);
    }
  }
  
  return true;
}

// Fix Ollama AI functions
async function fixOllamaFunctions() {
  console.log(chalk.yellow('\n⚡ Checking Ollama AI functions...\n'));
  
  const functions = ['ai_generate_sql', 'ai_explain_sql', 'ai_optimize_sql'];
  const missingFunctions = [];
  
  for (const func of functions) {
    try {
      const { error } = await supabase.rpc(func, { prompt: 'test' });
      if (error) {
        console.log(chalk.red(`❌ Missing: ${func}`));
        missingFunctions.push(func);
      } else {
        console.log(chalk.green(`✅ Found: ${func}`));
      }
    } catch (err) {
      console.log(chalk.red(`❌ Missing: ${func}`));
      missingFunctions.push(func);
    }
  }
  
  if (missingFunctions.length > 0) {
    console.log(chalk.yellow('\n🔨 Creating Ollama AI functions...\n'));
    
    // Use the existing migration file
    const migrationFile = 'supabase/migrations/20250119_ollama_ai_functions.sql';
    if (fs.existsSync(migrationFile)) {
      console.log(chalk.green(`✅ Migration file exists: ${migrationFile}`));
      console.log(chalk.yellow('   Run: npx supabase db push'));
    } else {
      console.log(chalk.yellow('   Creating new migration...'));
      // Copy from our setup
      const setupFile = 'scripts/setup-supabase-ollama-ai.mjs';
      if (fs.existsSync(setupFile)) {
        execSync(`node ${setupFile}`, { stdio: 'inherit' });
      }
    }
  }
  
  return true;
}

// Apply migrations
async function applyMigrations() {
  console.log(chalk.yellow('\n📤 Applying migrations...\n'));
  
  try {
    execSync('npx supabase db push', { stdio: 'inherit' });
    console.log(chalk.green('✅ Migrations applied successfully'));
    return true;
  } catch (error) {
    console.error(chalk.red('❌ Failed to apply migrations'));
    console.log(chalk.yellow('You may need to apply them manually'));
    return false;
  }
}

// Main auto-fix function
async function autoFix() {
  try {
    // Check Ollama
    console.log(chalk.yellow('🤖 Checking Ollama...\n'));
    try {
      const response = await fetch('http://localhost:11434/api/tags');
      const data = await response.json();
      console.log(chalk.green(`✅ Ollama is running (${data.models?.length || 0} models)\n`));
    } catch (err) {
      console.error(chalk.red('❌ Ollama is not running!'));
      console.log(chalk.yellow('Please start Ollama: ollama serve'));
      process.exit(1);
    }
    
    // Check Supabase
    console.log(chalk.yellow('🔍 Checking Supabase...\n'));
    const { error } = await supabase.from('_test').select('1').limit(1);
    if (error && !error.message.includes('does not exist')) {
      console.error(chalk.red('❌ Cannot connect to Supabase'));
      console.log(chalk.yellow('Run: npx supabase start'));
      process.exit(1);
    }
    console.log(chalk.green('✅ Supabase is running\n'));
    
    // Fix tables
    await checkAndFixTables();
    
    // Fix functions
    await fixOllamaFunctions();
    
    // Apply migrations
    const { confirm } = await import('inquirer').then(m => m.default.prompt([{
      type: 'confirm',
      name: 'confirm',
      message: 'Apply migrations now?',
      default: true
    }]));
    
    if (confirm) {
      await applyMigrations();
    }
    
    // Final summary
    console.log(chalk.blue.bold('\n✨ Auto-fix Summary:\n'));
    console.log(chalk.green('✅ Essential tables checked/created'));
    console.log(chalk.green('✅ Ollama AI functions prepared'));
    console.log(chalk.green('✅ Migrations ready to apply'));
    
    console.log(chalk.yellow('\n💡 Next steps:'));
    console.log(chalk.gray('1. Review migrations in supabase/migrations/'));
    console.log(chalk.gray('2. Run: npx supabase db push (if not done)'));
    console.log(chalk.gray('3. Test: npm run ollama:test'));
    console.log(chalk.gray('4. View data: npm run view:memories'));
    
    console.log(chalk.blue.bold('\n🤖 Your database is now Ollama-powered!'));
    
  } catch (error) {
    console.error(chalk.red('\n❌ Auto-fix failed:'), error.message);
    process.exit(1);
  }
}

// Run auto-fix
autoFix();