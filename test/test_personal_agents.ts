/**
 * Comprehensive Test Suite for Personal AI Agents
 * Tests all personal agents and their coordination
 */

import { createClient } from '@supabase/supabase-js';
import { UniversalAgentRegistry } from '../src/agents/universal_agent_registry';
import { AgentCategory } from '../src/agents/base_agent';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs/promises';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';

async function testCalendarAgent(registry: UniversalAgentRegistry) {
  console.log('\n📅 Testing CalendarAgent...');
  
  const tests = [
    {
      name: 'Create simple event',
      request: 'Schedule a meeting with John tomorrow at 3pm',
      expectedCapabilities: ['create_event', 'check_conflicts']
    },
    {
      name: 'Complex scheduling',
      request: 'Find time for a 2-hour workshop next week when I\'m free',
      expectedCapabilities: ['find_free_time', 'suggest_times']
    },
    {
      name: 'Conflict detection',
      request: 'I need to reschedule my 2pm meeting to 3pm',
      expectedCapabilities: ['check_conflicts', 'reschedule_event']
    }
  ];

  for (const test of tests) {
    try {
      console.log(`  Testing: ${test.name}`);
      const response = await registry.processRequest({
        userRequest: test.request,
        primaryAgent: 'calendar_agent',
        userId: 'test-user',
        conversationId: 'test-calendar-' + Date.now()
      });
      
      console.log(`    ✓ Success: ${response.reasoning}`);
      console.log(`    Confidence: ${response.confidence}`);
    } catch (error) {
      console.log(`    ✗ Failed: ${(error as Error).message}`);
    }
  }
}

async function testPhotoOrganizerAgent(registry: UniversalAgentRegistry) {
  console.log('\n📸 Testing PhotoOrganizerAgent...');
  
  const tests = [
    {
      name: 'Organize by face',
      request: 'Find all photos of Sarah and organize them',
      expectedCapabilities: ['face_detection', 'organize_by_person']
    },
    {
      name: 'Find duplicates',
      request: 'Clean up duplicate photos in my Pictures folder',
      expectedCapabilities: ['detect_duplicates', 'remove_duplicates']
    },
    {
      name: 'Date organization',
      request: 'Organize photos from last summer vacation',
      expectedCapabilities: ['organize_by_date', 'create_albums']
    }
  ];

  for (const test of tests) {
    try {
      console.log(`  Testing: ${test.name}`);
      const response = await registry.processRequest({
        userRequest: test.request,
        primaryAgent: 'photo_organizer',
        userId: 'test-user',
        conversationId: 'test-photo-' + Date.now()
      });
      
      console.log(`    ✓ Success: ${response.reasoning}`);
      console.log(`    Confidence: ${response.confidence}`);
    } catch (error) {
      console.log(`    ✗ Failed: ${(error as Error).message}`);
    }
  }
}

async function testFileManagerAgent(registry: UniversalAgentRegistry) {
  console.log('\n📁 Testing FileManagerAgent...');
  
  // Create test directory structure
  const testDir = path.join(process.cwd(), 'test_files');
  await fs.mkdir(testDir, { recursive: true });
  
  const tests = [
    {
      name: 'Organize downloads',
      request: 'Organize my Downloads folder by file type',
      expectedCapabilities: ['organize_files', 'categorize_files']
    },
    {
      name: 'Find large files',
      request: 'Find files larger than 100MB on my desktop',
      expectedCapabilities: ['analyze_files', 'find_large_files']
    },
    {
      name: 'Smart search',
      request: 'Find all project documentation files',
      expectedCapabilities: ['content_search', 'intelligent_search']
    }
  ];

  for (const test of tests) {
    try {
      console.log(`  Testing: ${test.name}`);
      const response = await registry.processRequest({
        userRequest: test.request,
        primaryAgent: 'file_manager',
        userId: 'test-user',
        conversationId: 'test-file-' + Date.now()
      });
      
      console.log(`    ✓ Success: ${response.reasoning}`);
      console.log(`    Confidence: ${response.confidence}`);
    } catch (error) {
      console.log(`    ✗ Failed: ${(error as Error).message}`);
    }
  }
}

async function testCodeAssistantAgent(registry: UniversalAgentRegistry) {
  console.log('\n💻 Testing CodeAssistantAgent...');
  
  const tests = [
    {
      name: 'Generate code',
      request: 'Create a Python function to calculate fibonacci numbers',
      expectedCapabilities: ['generate_code', 'code_completion']
    },
    {
      name: 'Analyze project',
      request: 'Analyze this TypeScript project and suggest improvements',
      expectedCapabilities: ['analyze_code', 'suggest_refactoring']
    },
    {
      name: 'Git operations',
      request: 'Create a commit message for the recent changes',
      expectedCapabilities: ['git_operations', 'generate_commit_message']
    }
  ];

  for (const test of tests) {
    try {
      console.log(`  Testing: ${test.name}`);
      const response = await registry.processRequest({
        userRequest: test.request,
        primaryAgent: 'code_assistant',
        userId: 'test-user',
        conversationId: 'test-code-' + Date.now()
      });
      
      console.log(`    ✓ Success: ${response.reasoning}`);
      console.log(`    Confidence: ${response.confidence}`);
    } catch (error) {
      console.log(`    ✗ Failed: ${(error as Error).message}`);
    }
  }
}

async function testSystemControlAgent(registry: UniversalAgentRegistry) {
  console.log('\n⚙️ Testing SystemControlAgent...');
  
  const tests = [
    {
      name: 'Check system health',
      request: 'How is my system performing?',
      expectedCapabilities: ['monitor_system', 'check_performance']
    },
    {
      name: 'App management',
      request: 'Open Safari browser',
      expectedCapabilities: ['launch_app', 'control_applications']
    },
    {
      name: 'System optimization',
      request: 'Clean up system caches and free up space',
      expectedCapabilities: ['optimize_system', 'cleanup_caches']
    }
  ];

  for (const test of tests) {
    try {
      console.log(`  Testing: ${test.name}`);
      const response = await registry.processRequest({
        userRequest: test.request,
        primaryAgent: 'system_control',
        userId: 'test-user',
        conversationId: 'test-system-' + Date.now()
      });
      
      console.log(`    ✓ Success: ${response.reasoning}`);
      console.log(`    Confidence: ${response.confidence}`);
    } catch (error) {
      console.log(`    ✗ Failed: ${(error as Error).message}`);
    }
  }
}

async function testWebScraperAgent(registry: UniversalAgentRegistry) {
  console.log('\n🌐 Testing WebScraperAgent...');
  
  const tests = [
    {
      name: 'Scrape website',
      request: 'Get the latest news headlines from TechCrunch',
      expectedCapabilities: ['scrape_website', 'extract_content']
    },
    {
      name: 'Monitor changes',
      request: 'Monitor Apple.com for new product announcements',
      expectedCapabilities: ['monitor_website', 'detect_changes']
    },
    {
      name: 'API request',
      request: 'Get weather data for San Francisco',
      expectedCapabilities: ['api_request', 'parse_json']
    }
  ];

  for (const test of tests) {
    try {
      console.log(`  Testing: ${test.name}`);
      const response = await registry.processRequest({
        userRequest: test.request,
        primaryAgent: 'web_scraper',
        userId: 'test-user',
        conversationId: 'test-web-' + Date.now()
      });
      
      console.log(`    ✓ Success: ${response.reasoning}`);
      console.log(`    Confidence: ${response.confidence}`);
    } catch (error) {
      console.log(`    ✗ Failed: ${(error as Error).message}`);
    }
  }
}

async function testToolMakerAgent(registry: UniversalAgentRegistry) {
  console.log('\n🔧 Testing ToolMakerAgent...');
  
  const tests = [
    {
      name: 'Create custom tool',
      request: 'Create a tool that converts markdown to PDF',
      expectedCapabilities: ['create_tool', 'generate_code']
    },
    {
      name: 'Build integration',
      request: 'Build an integration with Slack for notifications',
      expectedCapabilities: ['generate_integration', 'create_api_wrapper']
    },
    {
      name: 'Create workflow',
      request: 'Create a workflow that backs up photos daily',
      expectedCapabilities: ['create_workflow', 'schedule_automation']
    }
  ];

  for (const test of tests) {
    try {
      console.log(`  Testing: ${test.name}`);
      const response = await registry.processRequest({
        userRequest: test.request,
        primaryAgent: 'tool_maker',
        userId: 'test-user',
        conversationId: 'test-tool-' + Date.now()
      });
      
      console.log(`    ✓ Success: ${response.reasoning}`);
      console.log(`    Confidence: ${response.confidence}`);
    } catch (error) {
      console.log(`    ✗ Failed: ${(error as Error).message}`);
    }
  }
}

async function testMultiAgentCoordination(registry: UniversalAgentRegistry) {
  console.log('\n🤝 Testing Multi-Agent Coordination...');
  
  const tests = [
    {
      name: 'Complex task coordination',
      request: 'Organize all photos from my last trip, create a presentation, and schedule a meeting to share it',
      expectedAgents: ['photo_organizer', 'file_manager', 'calendar_agent']
    },
    {
      name: 'Development workflow',
      request: 'Analyze this project, fix any issues, commit changes, and create documentation',
      expectedAgents: ['code_assistant', 'file_manager', 'tool_maker']
    },
    {
      name: 'System maintenance',
      request: 'Clean up my system, organize files, remove duplicates, and optimize performance',
      expectedAgents: ['system_control', 'file_manager', 'photo_organizer']
    }
  ];

  for (const test of tests) {
    try {
      console.log(`  Testing: ${test.name}`);
      const response = await registry.processRequest({
        userRequest: test.request,
        primaryAgent: 'personal_assistant',
        userId: 'test-user',
        conversationId: 'test-multi-' + Date.now()
      });
      
      console.log(`    ✓ Success: ${response.reasoning}`);
      console.log(`    Confidence: ${response.confidence}`);
      
      // Check if multiple agents were involved
      if (response.metadata?.agentsInvolved) {
        console.log(`    Agents used: ${response.metadata.agentsInvolved.join(', ')}`);
      }
    } catch (error) {
      console.log(`    ✗ Failed: ${(error as Error).message}`);
    }
  }
}

async function runAllTests() {
  console.log('🚀 Universal AI Tools - Personal Agents Test Suite');
  console.log('================================================\n');
  
  // Initialize Supabase client
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // Initialize registry
  const registry = new UniversalAgentRegistry(supabase);
  await registry.initialize();
  
  // Register personal agents
  console.log('📋 Registering Personal Agents...');
  const registered = await registry.getRegisteredAgents(AgentCategory.PERSONAL);
  console.log(`  Registered ${registered.length} personal agents`);
  
  // Run individual agent tests
  await testCalendarAgent(registry);
  await testPhotoOrganizerAgent(registry);
  await testFileManagerAgent(registry);
  await testCodeAssistantAgent(registry);
  await testSystemControlAgent(registry);
  await testWebScraperAgent(registry);
  await testToolMakerAgent(registry);
  
  // Test multi-agent coordination
  await testMultiAgentCoordination(registry);
  
  console.log('\n✅ Test Suite Complete!');
}

// Run tests
runAllTests().catch(console.error);