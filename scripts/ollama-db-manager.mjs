#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import chalk from 'chalk';
import fetch from 'node-fetch';
import inquirer from 'inquirer';

console.log(chalk.blue.bold('🤖 Ollama Database Manager for Supabase\n'));

// Read Supabase config
const envContent = fs.readFileSync('.env', 'utf8');
const urlMatch = envContent.match(/SUPABASE_URL\s*=\s*["']?([^"'\s]+)["']?/);
const keyMatch = envContent.match(/SUPABASE_SERVICE_KEY\s*=\s*["']?([^"'\s]+)["']?/);

if (!urlMatch || !keyMatch) {
  console.error('❌ Could not find Supabase config in .env');
  process.exit(1);
}

const supabase = createClient(urlMatch[1], keyMatch[1], {
  db: { schema: 'public' },
  auth: { persistSession: false }
});

// Ollama API helper
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

// Database health check
async function checkDatabaseHealth() {
  console.log(chalk.yellow('🏥 Running database health check...\n'));
  
  const issues = [];
  
  try {
    // Check tables
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public');
    
    if (tablesError) {
      // Try alternative approach
      const { data: altTables, error: altError } = await supabase.rpc('get_tables', {});
      if (altError) {
        issues.push({ type: 'error', message: 'Cannot query tables', details: altError });
      }
    } else {
      console.log(chalk.green(`✅ Found ${tables?.length || 0} tables`));
    }
    
    // Check ai_memories table
    const { error: memError } = await supabase
      .from('ai_memories')
      .select('count')
      .limit(1);
    
    if (memError) {
      issues.push({ 
        type: 'missing_table', 
        message: 'ai_memories table missing',
        table: 'ai_memories',
        purpose: 'Stores AI agent memories and context'
      });
    }
    
    // Check memories table (legacy)
    const { error: legacyError } = await supabase
      .from('memories')
      .select('count')
      .limit(1);
    
    if (legacyError) {
      issues.push({ 
        type: 'missing_table', 
        message: 'memories table missing (legacy)',
        table: 'memories',
        purpose: 'Legacy memory storage'
      });
    }
    
    // Check functions
    const functionChecks = [
      'ai_generate_sql',
      'ai_explain_sql',
      'ai_optimize_sql'
    ];
    
    for (const func of functionChecks) {
      try {
        const { error } = await supabase.rpc(func, { prompt: 'test' });
        if (error) {
          issues.push({
            type: 'missing_function',
            message: `Function ${func} not working`,
            function: func
          });
        }
      } catch (err) {
        issues.push({
          type: 'missing_function',
          message: `Function ${func} missing`,
          function: func
        });
      }
    }
    
  } catch (error) {
    issues.push({ type: 'error', message: 'Health check failed', details: error });
  }
  
  return issues;
}

// Create missing tables using Ollama
async function createMissingTable(tableInfo) {
  console.log(chalk.yellow(`\n🔨 Creating ${tableInfo.table} table...`));
  
  const prompt = `Generate PostgreSQL CREATE TABLE statement for: ${tableInfo.table}
Purpose: ${tableInfo.purpose}
Requirements:
- Include appropriate columns based on the purpose
- Add proper constraints and indexes
- Follow PostgreSQL best practices
- Include RLS policies if needed
- Return ONLY the SQL code, no explanations`;

  const sql = await askOllama(prompt, 'qwen2.5:7b');
  
  if (!sql) {
    console.error(chalk.red('❌ Failed to generate SQL'));
    return false;
  }
  
  console.log(chalk.gray('\nGenerated SQL:'));
  console.log(chalk.cyan(sql));
  
  // Confirm before executing
  const { confirm } = await inquirer.prompt([{
    type: 'confirm',
    name: 'confirm',
    message: 'Execute this SQL?',
    default: true
  }]);
  
  if (!confirm) {
    console.log(chalk.yellow('⏭️  Skipped'));
    return false;
  }
  
  // Save to migration file
  const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const filename = `supabase/migrations/${timestamp}_create_${tableInfo.table}.sql`;
  fs.writeFileSync(filename, sql);
  console.log(chalk.green(`✅ Saved to ${filename}`));
  
  return true;
}

// Fix database issues
async function fixDatabaseIssues(issues) {
  if (issues.length === 0) {
    console.log(chalk.green('\n✅ No issues found! Database is healthy.'));
    return;
  }
  
  console.log(chalk.red(`\n❌ Found ${issues.length} issues:\n`));
  
  issues.forEach((issue, i) => {
    console.log(chalk.yellow(`${i + 1}. ${issue.message}`));
    if (issue.details) {
      console.log(chalk.gray(`   ${JSON.stringify(issue.details)}`));
    }
  });
  
  const { action } = await inquirer.prompt([{
    type: 'list',
    name: 'action',
    message: 'What would you like to do?',
    choices: [
      { name: 'Fix all issues automatically', value: 'fix_all' },
      { name: 'Fix issues one by one', value: 'fix_individual' },
      { name: 'Generate fix scripts only', value: 'generate_only' },
      { name: 'Exit', value: 'exit' }
    ]
  }]);
  
  if (action === 'exit') {
    return;
  }
  
  // Group issues by type
  const missingTables = issues.filter(i => i.type === 'missing_table');
  const missingFunctions = issues.filter(i => i.type === 'missing_function');
  
  if (missingTables.length > 0) {
    console.log(chalk.blue.bold('\n📋 Missing Tables:\n'));
    
    for (const table of missingTables) {
      if (action === 'fix_all' || action === 'generate_only') {
        await createMissingTable(table);
      } else if (action === 'fix_individual') {
        const { fix } = await inquirer.prompt([{
          type: 'confirm',
          name: 'fix',
          message: `Create ${table.table} table?`,
          default: true
        }]);
        
        if (fix) {
          await createMissingTable(table);
        }
      }
    }
  }
  
  if (missingFunctions.length > 0) {
    console.log(chalk.blue.bold('\n⚡ Missing Functions:\n'));
    
    // Generate all functions in one migration
    const prompt = `Generate PostgreSQL functions for Ollama AI integration:
${missingFunctions.map(f => `- ${f.function}: ${f.message}`).join('\n')}

These functions should call Ollama API at http://host.docker.internal:11434
Return ONLY the SQL code with all CREATE FUNCTION statements`;

    const sql = await askOllama(prompt, 'qwen2.5:7b');
    
    if (sql) {
      const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
      const filename = `supabase/migrations/${timestamp}_ollama_functions.sql`;
      fs.writeFileSync(filename, sql);
      console.log(chalk.green(`✅ Generated functions migration: ${filename}`));
    }
  }
}

// Database optimization
async function optimizeDatabase() {
  console.log(chalk.yellow('\n🚀 Analyzing database for optimization...\n'));
  
  // Get all tables
  const { data: tables } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public');
  
  if (!tables || tables.length === 0) {
    console.log(chalk.yellow('No tables found to optimize'));
    return;
  }
  
  const prompt = `Analyze these PostgreSQL tables and suggest optimizations:
Tables: ${tables.map(t => t.table_name).join(', ')}

Provide:
1. Missing indexes that would improve performance
2. Suggested table modifications
3. Query optimization tips
Format as SQL statements where applicable`;

  const suggestions = await askOllama(prompt, 'deepseek-r1:14b');
  
  if (suggestions) {
    console.log(chalk.blue.bold('\n💡 Optimization Suggestions:\n'));
    console.log(chalk.cyan(suggestions));
    
    const { save } = await inquirer.prompt([{
      type: 'confirm',
      name: 'save',
      message: 'Save optimization script?',
      default: true
    }]);
    
    if (save) {
      const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
      const filename = `supabase/migrations/${timestamp}_optimizations.sql`;
      fs.writeFileSync(filename, `-- Database Optimizations\n-- Generated by Ollama\n\n${suggestions}`);
      console.log(chalk.green(`✅ Saved to ${filename}`));
    }
  }
}

// Main menu
async function mainMenu() {
  const { action } = await inquirer.prompt([{
    type: 'list',
    name: 'action',
    message: 'What would you like to do?',
    choices: [
      { name: '🏥 Check database health', value: 'health' },
      { name: '🔧 Fix database issues', value: 'fix' },
      { name: '🚀 Optimize database', value: 'optimize' },
      { name: '📋 Create custom table', value: 'create' },
      { name: '🧹 Clean up data', value: 'cleanup' },
      { name: '📊 Generate reports', value: 'reports' },
      { name: '❌ Exit', value: 'exit' }
    ]
  }]);
  
  switch (action) {
    case 'health':
      const issues = await checkDatabaseHealth();
      await fixDatabaseIssues(issues);
      break;
      
    case 'fix':
      const fixIssues = await checkDatabaseHealth();
      await fixDatabaseIssues(fixIssues);
      break;
      
    case 'optimize':
      await optimizeDatabase();
      break;
      
    case 'create':
      const { tableName, purpose } = await inquirer.prompt([
        {
          type: 'input',
          name: 'tableName',
          message: 'Table name:',
          validate: input => /^[a-z_]+$/.test(input) || 'Use lowercase and underscores only'
        },
        {
          type: 'input',
          name: 'purpose',
          message: 'Table purpose/description:'
        }
      ]);
      
      await createMissingTable({ table: tableName, purpose });
      break;
      
    case 'cleanup':
      console.log(chalk.yellow('\n🧹 Data cleanup feature coming soon!'));
      break;
      
    case 'reports':
      console.log(chalk.yellow('\n📊 Report generation feature coming soon!'));
      break;
      
    case 'exit':
      console.log(chalk.green('\n👋 Goodbye!'));
      process.exit(0);
  }
  
  // Return to menu
  const { again } = await inquirer.prompt([{
    type: 'confirm',
    name: 'again',
    message: '\nReturn to main menu?',
    default: true
  }]);
  
  if (again) {
    console.clear();
    console.log(chalk.blue.bold('🤖 Ollama Database Manager for Supabase\n'));
    await mainMenu();
  }
}

// Check Ollama connection
async function checkOllama() {
  try {
    const response = await fetch('http://localhost:11434/api/tags');
    const data = await response.json();
    console.log(chalk.green(`✅ Ollama connected (${data.models?.length || 0} models available)\n`));
    return true;
  } catch (error) {
    console.error(chalk.red('❌ Ollama is not running!'));
    console.log(chalk.yellow('Please start Ollama first: ollama serve'));
    return false;
  }
}

// Main
async function main() {
  // Check Ollama
  const ollamaOk = await checkOllama();
  if (!ollamaOk) {
    process.exit(1);
  }
  
  // Check Supabase
  const { error } = await supabase.from('_test').select('1').limit(1);
  if (error && !error.message.includes('does not exist')) {
    console.error(chalk.red('❌ Cannot connect to Supabase'));
    console.log(chalk.yellow('Run: npx supabase start'));
    process.exit(1);
  }
  
  console.log(chalk.green('✅ Supabase connected\n'));
  
  // Start menu
  await mainMenu();
}

// Install inquirer if needed
import { execSync } from 'child_process';
try {
  await import('inquirer');
} catch {
  console.log(chalk.yellow('📦 Installing inquirer...'));
  execSync('npm install inquirer', { stdio: 'inherit' });
}

// Run
main().catch(console.error);