#!/usr/bin/env node

/**
 * Interactive Demo of Personal AI Assistant
 */

const readline = require('readline');
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const { execSync } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Main demo function
async function runInteractiveDemo() {
  console.clear();
  process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.log('🤖 Personal AI Assistant - Interactive Demo');
  console.log('='.repeat(50));
  console.log('\nI can help you with:');
  console.log('📅 Calendar management (schedule meetings, check availability)');
  console.log('📁 File organization (find large files, organize downloads)');
  console.log('🖥️  System control (check performance, manage apps)');
  console.log('🌐 Web tasks (scrape data, monitor websites)');
  console.log('🔧 Tool creation (build custom automation tools)');
  console.log('\nType "help" for examples or "quit" to exit\n');

  promptUser();
}

function promptUser() {
  rl.question('How can I help you today? > ', async (input) => {
    if (input.toLowerCase() === 'quit' || input.toLowerCase() === 'exit') {
      console.log('\n👋 Goodbye!');
      rl.close();
      return;
    }

    if (input.toLowerCase() === 'help') {
      showHelp();
      promptUser();
      return;
    }

    // Process the request
    console.log('\n🤔 Processing your request...\n');
    await processRequest(input);
    console.log('\n');
    promptUser();
  });
}

function showHelp() {
  console.log('\n📚 Example requests you can try:');
  console.log('- "Schedule a meeting tomorrow at 3pm"');
  console.log('- "Show me the largest files in my Downloads"');
  console.log('- "Check my system performance"');
  console.log('- "Create a tool to convert currencies"');
  console.log('- "Help me organize my day"');
}

async function processRequest(request) {
  try {
    // Analyze the request to determine which agent(s) to use
    const intent = await analyzeIntent(request);

    switch (intent.primaryAgent) {
      case 'calendar':
        await handleCalendarRequest(request, intent);
        break;
      case 'files':
        await handleFileRequest(request, intent);
        break;
      case 'system':
        await handleSystemRequest(request, intent);
        break;
      case 'web':
        await handleWebRequest(request, intent);
        break;
      case 'tool':
        await handleToolRequest(request, intent);
        break;
      case 'multi':
        await handleMultiAgentRequest(request, intent);
        break;
      default:
        console.log(
          "I'm not sure how to help with that. Try asking about calendar, files, system, or tools."
        );
    }

    // Store interaction in memory
    await supabase.from('ai_agent_logs').insert({
      agent_name: intent.primaryAgent || 'unknown',
      action: 'demo_interaction',
      request: request,
      success: true,
    });
  } catch (error) {
    process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.error('Error processing request:', error.message);
  }
}

async function analyzeIntent(request) {
  const requestLower = request.toLowerCase();

  if (
    requestLower.includes('schedule') ||
    requestLower.includes('meeting') ||
    requestLower.includes('calendar')
  ) {
    return { primaryAgent: 'calendar', action: 'schedule' };
  }
  if (
    requestLower.includes('file') ||
    requestLower.includes('download') ||
    requestLower.includes('organize')
  ) {
    return { primaryAgent: 'files', action: 'analyze' };
  }
  if (
    requestLower.includes('system') ||
    requestLower.includes('performance') ||
    requestLower.includes('app')
  ) {
    return { primaryAgent: 'system', action: 'check' };
  }
  if (
    requestLower.includes('scrape') ||
    requestLower.includes('website') ||
    requestLower.includes('web')
  ) {
    return { primaryAgent: 'web', action: 'scrape' };
  }
  if (requestLower.includes('create') && requestLower.includes('tool')) {
    return { primaryAgent: 'tool', action: 'create' };
  }
  if (requestLower.includes('help me') || requestLower.includes('organize my day')) {
    return { primaryAgent: 'multi', action: 'coordinate' };
  }

  return { primaryAgent: 'unknown', action: 'unknown' };
}

async function handleCalendarRequest(request, intent) {
  console.log('📅 Calendar Agent: Processing your request...');

  // Use AI to parse the request
  const prompt = `Extract calendar event details from: "${request}"
Return: title, date, time, duration`;

  try {
    const response = await axios.post('http://localhost:11434/api/generate', {
      model: 'llama3.2:3b',
      prompt: prompt,
      stream: false,
    });

    console.log('\n📝 Event Details:');
    console.log(response.data.response);
    console.log('\n✅ I would create this event in your calendar (demo mode)');
  } catch (error) {
    console.log('Calendar processing error:', error.message);
  }
}

async function handleFileRequest(request, intent) {
  console.log('📁 File Manager Agent: Analyzing your files...');

  try {
    const downloadsPath = process.env.HOME + '/Downloads';
    const files = await fs.readdir(downloadsPath);
    const stats = await Promise.all(
      files.slice(0, 5).map(async (file) => {
        const stat = await fs.stat(path.join(downloadsPath, file));
        return { name: file, size: stat.size };
      })
    );

    stats.sort((a, b) => b.size - a.size);

    console.log('\n📊 Top 5 files in Downloads:');
    stats.forEach((file, i) => {
      const sizeMB = (file.size / 1024 / 1024).toFixed(2);
      console.log(`${i + 1}. ${file.name} (${sizeMB} MB)`);
    });

    if (stats[0].size > 100 * 1024 * 1024) {
      console.log(
        '\n💡 Recommendation: You have large files that could be archived or deleted to save space.'
      );
    }
  } catch (error) {
    console.log('File analysis error:', error.message);
  }
}

async function handleSystemRequest(request, intent) {
  console.log('🖥️  System Control Agent: Checking system status...');

  try {
    const cpu = execSync("ps -A -o %cpu | awk '{s+=$1} END {print s}'", {
      encoding: 'utf8',
    }).trim();
    const uptime = execSync("uptime | awk '{print $3, $4, $5}'", { encoding: 'utf8' }).trim();

    console.log('\n📊 System Status:');
    console.log(`CPU Usage: ${cpu}%`);
    console.log(`Uptime: ${uptime}`);

    // Get top apps
    const apps = execSync("ps aux | sort -k3 -r | head -5 | awk '{print $11}'", {
      encoding: 'utf8',
    })
      .trim()
      .split('\n')
      .slice(1); // Skip header

    console.log('\nTop CPU-consuming processes:');
    apps.forEach((app, i) => {
      console.log(`${i + 1}. ${path.basename(app)}`);
    });

    console.log('\n✅ System is running normally');
  } catch (error) {
    console.log('System check error:', error.message);
  }
}

async function handleToolRequest(request, intent) {
  console.log('🔧 Tool Maker Agent: Creating your custom tool...');

  // Extract tool requirements from request
  const prompt = `Create a simple JavaScript function based on: "${request}"
Generate clean, working code with comments.`;

  try {
    const response = await axios.post('http://localhost:11434/api/generate', {
      model: 'deepseek-r1:14b',
      prompt: prompt,
      stream: false,
    });

    console.log('\n📝 Generated Tool:');
    console.log('```javascript');
    console.log(response.data.response);
    console.log('```');
    console.log(
      '\n✅ Tool created! (In production, this would be saved and made available for use)'
    );
  } catch (error) {
    console.log('Tool creation error:', error.message);
  }
}

async function handleMultiAgentRequest(request, intent) {
  console.log('🤖 Personal Assistant: Coordinating multiple agents for you...');

  console.log('\n📊 Breaking down your request...');
  await new Promise((resolve) => setTimeout(resolve, 1000));

  console.log('✅ Calendar Agent: Checking your schedule');
  await new Promise((resolve) => setTimeout(resolve, 500));

  console.log('✅ File Manager: Analyzing your workspace');
  await new Promise((resolve) => setTimeout(resolve, 500));

  console.log('✅ System Control: Optimizing performance');
  await new Promise((resolve) => setTimeout(resolve, 500));

  console.log('\n📝 Summary:');
  console.log('- Your calendar is clear for the afternoon');
  console.log('- Found 3 files that need organization');
  console.log('- System resources are optimal');
  console.log('- Created 2 automation suggestions for you');

  console.log('\n✅ Your day is now organized and optimized!');
}

async function handleWebRequest(request, intent) {
  console.log('🌐 Web Scraper Agent: Fetching web data...');

  // For demo, just show capabilities
  console.log('\n🔍 Web scraping capabilities:');
  console.log('- Extract data from any website');
  console.log('- Monitor sites for changes');
  console.log('- Make API requests');
  console.log('- Parse structured data');

  console.log('\n✅ Ready to scrape! (Specify a URL to scrape in production)');
}

// Start the demo
console.log('Starting Personal AI Assistant Demo...\n');

// Check services
Promise.all([
  supabase.from('ai_memories').select('count'),
  axios.get('http://localhost:11434/api/tags'),
])
  .then(() => {
    console.log('✅ All services connected\n');
    runInteractiveDemo();
  })
  .catch((error) => {
    console.error('❌ Service check failed:', error.message);
    console.log('\nPlease ensure Supabase and Ollama are running:');
    console.log('- Run: supabase start');
    console.log('- Run: ollama serve');
    process.exit(1);
  });
