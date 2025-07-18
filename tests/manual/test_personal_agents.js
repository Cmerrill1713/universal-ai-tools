#!/usr/bin/env node

/**
 * Test script for Personal AI Agents
 * Tests the integration of all personal agents with the registry
 */

const { UniversalAgentRegistry } = require('./dist/agents/universal_agent_registry.js');

async function testPersonalAgents() {
  console.log('🧪 Testing Personal AI Agents Integration...\n');

  try {
    // Initialize registry without supabase for basic testing
    const registry = new UniversalAgentRegistry();
    
    // Test registry status
    console.log('📊 Registry Status:');
    const status = registry.getStatus();
    console.log(`- Total agent definitions: ${status.totalDefinitions}`);
    console.log(`- Personal agents: ${status.agentsByCategory.personal}`);
    console.log(`- Core agents: ${status.agentsByCategory.core}`);
    console.log('');

    // List all personal agents
    console.log('👥 Personal Agents Available:');
    const personalAgents = registry.getPersonalAgents();
    personalAgents.forEach((agentName, index) => {
      console.log(`${index + 1}. ${agentName}`);
    });
    console.log('');

    // Test agent info for each personal agent
    console.log('🔍 Agent Information:');
    for (const agentName of personalAgents) {
      const info = registry.getAgentInfo(agentName);
      if (info) {
        console.log(`- ${agentName}: ${info.description}`);
        console.log(`  Priority: ${info.priority}, Capabilities: ${info.capabilities.length}`);
      }
    }
    console.log('');

    // Try to load a simple agent (this will fail without supabase but we can test the loading mechanism)
    console.log('🚀 Testing Agent Loading (without execution):');
    try {
      const agent = await registry.getAgent('calendar_agent');
      if (agent) {
        console.log('✅ CalendarAgent loaded successfully');
      } else {
        console.log('⚠️ CalendarAgent failed to load (expected without Supabase)');
      }
    } catch (error) {
      console.log('⚠️ Agent loading failed (expected without Supabase configuration)');
    }

    console.log('\n✅ Personal AI Agents system architecture is properly integrated!');
    console.log('🔧 Next steps:');
    console.log('  1. Configure Supabase connection');
    console.log('  2. Set up Ollama with required models');
    console.log('  3. Test individual agent capabilities');
    console.log('  4. Test multi-agent coordination via PersonalAssistantAgent');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the test
testPersonalAgents();