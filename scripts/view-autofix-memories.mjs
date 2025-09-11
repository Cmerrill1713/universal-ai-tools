#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import Table from 'cli-table3';
import chalk from 'chalk';

console.log(chalk.blue.bold('🔍 Viewing Autofix Memories in Supabase\n'));

// Read Supabase config
const envContent = fs.readFileSync('.env', 'utf8');
const urlMatch = envContent.match(/SUPABASE_URL\s*=\s*["']?([^"'\s]+)["']?/);
const keyMatch = envContent.match(/SUPABASE_ANON_KEY\s*=\s*["']?([^"'\s]+)["']?/);

if (!urlMatch || !keyMatch) {
  console.error('❌ Could not find Supabase config in .env');
  process.exit(1);
}

const supabase = createClient(urlMatch[1], keyMatch[1]);

async function viewAutofixMemories() {
  try {
    // Query ai_memories table for autofix data
    console.log(chalk.yellow('📊 Querying ai_memories table...\n'));
    
    const { data: memories, error } = await supabase
      .from('ai_memories')
      .select('*')
      .like('service_id', 'claude-%')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error(chalk.red('❌ Error querying memories:'), error.message);
      
      // Try alternative query methods
      console.log(chalk.yellow('\n🔄 Trying alternative query...\n'));
      
      const { data: altMemories, error: altError } = await supabase
        .from('ai_memories')
        .select('id, service_id, memory_type, content, metadata, created_at')
        .limit(20);
        
      if (altError) {
        console.error(chalk.red('❌ Alternative query also failed:'), altError.message);
        return;
      }
      
      displayMemories(altMemories);
      return;
    }

    if (!memories || memories.length === 0) {
      console.log(chalk.yellow('⚠️  No autofix memories found in ai_memories table.'));
      console.log(chalk.cyan('\n💡 Run the following to create some test data:'));
      console.log(chalk.green('   npm run test:ai-memories'));
      return;
    }

    displayMemories(memories);

  } catch (error) {
    console.error(chalk.red('❌ Failed to view memories:'), error.message);
  }
}

function displayMemories(memories) {
  console.log(chalk.green(`✅ Found ${memories.length} memories\n`));

  // Group by service_id
  const grouped = memories.reduce((acc, mem) => {
    const serviceId = mem.service_id || 'unknown';
    if (!acc[serviceId]) acc[serviceId] = [];
    acc[serviceId].push(mem);
    return acc;
  }, {});

  // Display summary
  console.log(chalk.cyan.bold('📊 Memory Summary by Service:\n'));
  Object.entries(grouped).forEach(([serviceId, mems]) => {
    console.log(chalk.yellow(`   ${serviceId}: ${mems.length} memories`));
  });

  // Display detailed table
  console.log(chalk.cyan.bold('\n📋 Recent Autofix Memories:\n'));
  
  const table = new Table({
    head: ['Date', 'Service', 'Type', 'Content', 'Details'],
    colWidths: [12, 20, 15, 40, 30],
    wordWrap: true,
    style: {
      head: ['cyan']
    }
  });

  memories.slice(0, 10).forEach(mem => {
    const date = new Date(mem.created_at).toLocaleDateString();
    const content = mem.content ? mem.content.substring(0, 37) + '...' : 'N/A';
    const memType = mem.memory_type || mem.metadata?.memory_type || 'unknown';
    
    let details = '';
    if (mem.metadata) {
      if (mem.metadata.fix_type) details += `Fix: ${mem.metadata.fix_type}\n`;
      if (mem.metadata.confidence) details += `Conf: ${mem.metadata.confidence}\n`;
      if (mem.metadata.success !== undefined) details += `Success: ${mem.metadata.success}`;
    }

    table.push([
      date,
      mem.service_id || 'unknown',
      memType,
      content,
      details || 'No metadata'
    ]);
  });

  console.log(table.toString());

  // Show fix type statistics
  const fixTypes = memories
    .filter(m => m.metadata?.fix_type)
    .reduce((acc, m) => {
      const type = m.metadata.fix_type;
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

  if (Object.keys(fixTypes).length > 0) {
    console.log(chalk.cyan.bold('\n📈 Fix Type Statistics:\n'));
    Object.entries(fixTypes)
      .sort(([,a], [,b]) => b - a)
      .forEach(([type, count]) => {
        console.log(chalk.green(`   ${type}: ${count} fixes`));
      });
  }

  // Connection info
  console.log(chalk.blue.bold('\n🔗 Connection Info:'));
  console.log(chalk.gray(`   Database: ${urlMatch[1]}`));
  console.log(chalk.gray(`   Table: ai_memories`));
  console.log(chalk.gray(`   Studio: http://localhost:54323`));
  
  console.log(chalk.yellow('\n💡 Tips:'));
  console.log(chalk.gray('   - The "failed to load branches" error in Studio is cosmetic (branches are cloud-only)'));
  console.log(chalk.gray('   - You can still use Table Editor to view and filter data'));
  console.log(chalk.gray('   - Filter by service_id starting with "claude-" to see autofix data'));
}

// Run the viewer
viewAutofixMemories();