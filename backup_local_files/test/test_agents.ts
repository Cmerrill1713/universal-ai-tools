/**
 * Test suite for Personal AI Agents
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { UniversalAgentRegistry } from '../src/agents/universal_agent_registry';
import { AgentContext } from '../src/agents/base_agent';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';

async function runTests() {
  console.log('🧪 Testing Personal AI Agents System...\n');

  // Initialize Supabase client
  const supabase = createClient(supabaseUrl, supabaseKey);
  console.log('✅ Supabase client initialized');

  // Test database connection
  try {
    const { data, error } = await supabase.from('ai_memories').select('count');
    if (error) throw error;
    console.log('✅ Database connection successful');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return;
  }

  // Initialize agent registry
  const registry = new UniversalAgentRegistry(undefined, supabase);
  console.log('✅ Agent registry initialized\n');

  // Test 1: Calendar Agent
  console.log('📅 Testing CalendarAgent...');
  await testCalendarAgent(registry);

  // Test 2: File Manager Agent
  console.log('\n📁 Testing FileManagerAgent...');
  await testFileManagerAgent(registry);

  // Test 3: System Control Agent
  console.log('\n🖥️ Testing SystemControlAgent...');
  await testSystemControlAgent(registry);

  // Test 4: Web Scraper Agent
  console.log('\n🌐 Testing WebScraperAgent...');
  await testWebScraperAgent(registry);

  // Test 5: Tool Maker Agent
  console.log('\n🔧 Testing ToolMakerAgent...');
  await testToolMakerAgent(registry);

  // Test 6: Personal Assistant Coordination
  console.log('\n🤖 Testing PersonalAssistantAgent coordination...');
  await testPersonalAssistant(registry);

  console.log('\n✅ All tests completed!');
}

async function testCalendarAgent(registry: UniversalAgentRegistry) {
  try {
    const agent = await registry.getAgent('calendar_agent');
    if (!agent) {
      console.log('❌ Failed to load CalendarAgent');
      return;
    }

    const context: AgentContext = {
      requestId: 'test-calendar-1',
      userRequest: 'Schedule a meeting tomorrow at 2pm for 1 hour',
      timestamp: new Date()
    };

    const response = await agent.execute(context);
    console.log('Response:', response.success ? '✅ Success' : '❌ Failed');
    if (response.data) {
      console.log('Event details:', JSON.stringify(response.data, null, 2));
    }
  } catch (error) {
    console.log('❌ CalendarAgent test error:', error.message);
  }
}

async function testFileManagerAgent(registry: UniversalAgentRegistry) {
  try {
    const agent = await registry.getAgent('file_manager');
    if (!agent) {
      console.log('❌ Failed to load FileManagerAgent');
      return;
    }

    const context: AgentContext = {
      requestId: 'test-files-1',
      userRequest: 'Show me the largest files in my Downloads folder',
      timestamp: new Date()
    };

    const response = await agent.execute(context);
    console.log('Response:', response.success ? '✅ Success' : '❌ Failed');
    if (response.data) {
      console.log('Analysis:', response.data.summary || 'No summary available');
    }
  } catch (error) {
    console.log('❌ FileManagerAgent test error:', error.message);
  }
}

async function testSystemControlAgent(registry: UniversalAgentRegistry) {
  try {
    const agent = await registry.getAgent('system_control');
    if (!agent) {
      console.log('❌ Failed to load SystemControlAgent');
      return;
    }

    const context: AgentContext = {
      requestId: 'test-system-1',
      userRequest: 'Show me current system status and memory usage',
      timestamp: new Date()
    };

    const response = await agent.execute(context);
    console.log('Response:', response.success ? '✅ Success' : '❌ Failed');
    if (response.data) {
      console.log('System info:', JSON.stringify(response.data, null, 2));
    }
  } catch (error) {
    console.log('❌ SystemControlAgent test error:', error.message);
  }
}

async function testWebScraperAgent(registry: UniversalAgentRegistry) {
  try {
    const agent = await registry.getAgent('web_scraper');
    if (!agent) {
      console.log('❌ Failed to load WebScraperAgent');
      return;
    }

    const context: AgentContext = {
      requestId: 'test-web-1',
      userRequest: 'Check the weather at weather.com',
      timestamp: new Date()
    };

    const response = await agent.execute(context);
    console.log('Response:', response.success ? '✅ Success' : '❌ Failed');
    if (response.data) {
      console.log('Web data:', response.data.title || 'No title found');
    }
  } catch (error) {
    console.log('❌ WebScraperAgent test error:', error.message);
  }
}

async function testToolMakerAgent(registry: UniversalAgentRegistry) {
  try {
    const agent = await registry.getAgent('tool_maker');
    if (!agent) {
      console.log('❌ Failed to load ToolMakerAgent');
      return;
    }

    const context: AgentContext = {
      requestId: 'test-tool-1',
      userRequest: 'Create a simple tool that converts temperatures from Celsius to Fahrenheit',
      timestamp: new Date()
    };

    const response = await agent.execute(context);
    console.log('Response:', response.success ? '✅ Success' : '❌ Failed');
    if (response.data) {
      console.log('Tool created:', response.data.name || 'Unknown tool');
    }
  } catch (error) {
    console.log('❌ ToolMakerAgent test error:', error.message);
  }
}

async function testPersonalAssistant(registry: UniversalAgentRegistry) {
  try {
    const agent = await registry.getAgent('personal_assistant');
    if (!agent) {
      console.log('❌ Failed to load PersonalAssistantAgent');
      return;
    }

    const context: AgentContext = {
      requestId: 'test-pa-1',
      userRequest: 'Help me organize my day: check my calendar, find large files to clean up, and show system performance',
      timestamp: new Date()
    };

    const response = await agent.execute(context);
    console.log('Response:', response.success ? '✅ Success' : '❌ Failed');
    if (response.data) {
      console.log('Assistant response:', response.data.personalizedResponse || 'No response');
      console.log('Actions taken:', response.data.executionResults?.length || 0);
    }
  } catch (error) {
    console.log('❌ PersonalAssistantAgent test error:', error.message);
  }
}

// Run the tests
runTests().catch(console.error);