// Demonstration of Personal AI Agents capabilities
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const { execSync } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function demonstrateAgents() {
  console.log('🤖 Personal AI Agents Demonstration\n');
  console.log('='.repeat(50));

  // 1. Demonstrate Calendar functionality
  console.log('\n📅 Calendar Agent Demo');
  console.log('-'.repeat(30));
  await demoCalendarAgent();

  // 2. Demonstrate File Management
  console.log('\n📁 File Manager Agent Demo');
  console.log('-'.repeat(30));
  await demoFileManagerAgent();

  // 3. Demonstrate System Control
  console.log('\n🖥️ System Control Agent Demo');
  console.log('-'.repeat(30));
  await demoSystemControlAgent();

  // 4. Demonstrate Web Scraping
  console.log('\n🌐 Web Scraper Agent Demo');
  console.log('-'.repeat(30));
  await demoWebScraperAgent();

  // 5. Demonstrate Tool Creation
  console.log('\n🔧 Tool Maker Agent Demo');
  console.log('-'.repeat(30));
  await demoToolMakerAgent();

  console.log('\n✅ Demonstration completed!');
}

async function demoCalendarAgent() {
  try {
    // Parse natural language to calendar event
    const request = 'Schedule a team meeting next Monday at 2pm for 1 hour';

    const prompt = `Parse this calendar request: "${request}"

Extract:
- Event title
- Date and time
- Duration
- Any other details

Respond with JSON format.`;

    const response = await axios.post('http://localhost:11434/api/generate', {
      model: 'llama3.2:3b',
      prompt: prompt,
      stream: false,
      format: 'json',
    });

    const eventDetails = JSON.parse(response.data.response);
    console.log('Parsed event:', eventDetails);

    // Store in database
    const { data, error } = await supabase.from('ai_calendar_cache').insert({
      event_id: `demo_${Date.now()}`,
      title: eventDetails.title || 'Team Meeting',
      start_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000).toISOString(),
      description: 'Created by AI Calendar Agent demo',
    });

    if (!error) {
      console.log('✅ Event created and stored in database');
    }
  } catch (error) {
    console.log('Calendar demo error:', error.message);
  }
}

async function demoFileManagerAgent() {
  try {
    // Analyze Downloads folder
    const downloadsPath = process.env.HOME + '/Downloads';
    const files = await fs.readdir(downloadsPath);

    // Get file stats
    const fileStats = await Promise.all(
      files.slice(0, 5).map(async (file) => {
        const stats = await fs.stat(path.join(downloadsPath, file));
        return { name: file, size: stats.size, modified: stats.mtime };
      })
    );

    // Find largest files
    fileStats.sort((a, b) => b.size - a.size);

    console.log('Top 5 files in Downloads:');
    fileStats.forEach((file, i) => {
      console.log(`${i + 1}. ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
    });

    // Store analysis in memory
    await supabase.from('ai_memories').insert({
      service_id: 'file_manager',
      memory_type: 'file_analysis',
      content: `Analyzed Downloads folder: ${files.length} files`,
      metadata: { topFiles: fileStats },
    });

    console.log('✅ File analysis stored in memory');
  } catch (error) {
    console.log('File manager demo error:', error.message);
  }
}

async function demoSystemControlAgent() {
  try {
    // Get system metrics
    const cpuUsage = execSync("ps -A -o %cpu | awk '{s+=$1} END {print s}'", {
      encoding: 'utf8',
    }).trim();
    const memoryInfo = execSync("vm_stat | grep 'Pages free' | awk '{print $3}'", {
      encoding: 'utf8',
    }).trim();
    const uptime = execSync('uptime', { encoding: 'utf8' }).trim();

    console.log('System Status:');
    console.log(`CPU Usage: ${cpuUsage}%`);
    console.log(`Free Memory Pages: ${memoryInfo}`);
    console.log(`Uptime: ${uptime}`);

    // Get running apps
    const apps = execSync(
      'osascript -e \'tell application "System Events" to get name of every process whose background only is false\'',
      { encoding: 'utf8' }
    )
      .trim()
      .split(', ')
      .slice(0, 5);

    console.log('Top running applications:', apps.join(', '));

    // Store metrics
    await supabase.from('ai_memories').insert({
      service_id: 'system_control',
      memory_type: 'system_metrics',
      content: 'System metrics collected',
      metadata: { cpu: cpuUsage, apps: apps },
    });

    console.log('✅ System metrics stored');
  } catch (error) {
    console.log('System control demo error:', error.message);
  }
}

async function demoWebScraperAgent() {
  try {
    // Simple web scraping example
    const url = 'https://example.com';
    const response = await axios.get(url);

    // Extract title
    const titleMatch = response.data.match(/<title>([^<]+)<\/title>/);
    const title = titleMatch ? titleMatch[1] : 'No title';

    // Extract text content (simplified)
    const textContent = response.data
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 200);

    console.log(`Scraped ${url}:`);
    console.log(`Title: ${title}`);
    console.log(`Content preview: ${textContent}...`);

    // Store scraped data
    await supabase.from('ai_memories').insert({
      service_id: 'web_scraper',
      memory_type: 'scraped_data',
      content: `Scraped ${url}: ${title}`,
      metadata: { url, title, preview: textContent },
    });

    console.log('✅ Web data scraped and stored');
  } catch (error) {
    console.log('Web scraper demo error:', error.message);
  }
}

async function demoToolMakerAgent() {
  try {
    // Create a simple temperature converter tool
    const toolCode = `
function convertTemperature(celsius) {
  const fahrenheit = (celsius * 9/5) + 32;
  return {
    celsius: celsius,
    fahrenheit: fahrenheit,
    kelvin: celsius + 273.15
  };
}`;

    const tool = {
      name: 'temperature_converter',
      description: 'Convert temperature between Celsius, Fahrenheit, and Kelvin',
      implementation: toolCode,
      implementation_type: 'function',
      input_schema: {
        type: 'object',
        properties: {
          celsius: { type: 'number' },
        },
        required: ['celsius'],
      },
      output_schema: {
        type: 'object',
        properties: {
          celsius: { type: 'number' },
          fahrenheit: { type: 'number' },
          kelvin: { type: 'number' },
        },
      },
    };

    // Store tool in database
    const { data, error } = await supabase.from('ai_custom_tools').insert({
      tool_name: tool.name,
      description: tool.description,
      implementation_type: tool.implementation_type,
      implementation: tool.implementation,
      input_schema: tool.input_schema,
      output_schema: tool.output_schema,
      created_by: 'tool_maker_demo',
    });

    if (!error) {
      console.log('Created tool:', tool.name);
      console.log('Description:', tool.description);

      // Test the tool
      eval(toolCode);
      const result = convertTemperature(25);
      console.log('Test result:', result);
      console.log('✅ Tool created and tested successfully');
    }
  } catch (error) {
    console.log('Tool maker demo error:', error.message);
  }
}

// Run the demonstration
demonstrateAgents().catch(console.error);
