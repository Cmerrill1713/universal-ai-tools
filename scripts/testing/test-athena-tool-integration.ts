/**
 * Test script for Athena Tool Integration
 *
 * Tests the seamless natural language tool creation through Sweet Athena
 */

import { createClient } from '@supabase/supabase-js';
import { logger } from './src/utils/logger';
import { AthenaToolIntegrationService } from './src/services/athena-tool-integration';
import type { ConversationRequest } from './src/services/athena-conversation-engine';

// Test configuration
const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || 'your-service-key';

async function testToolCreation() {
  process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.log('🧪 Testing Athena Tool Integration...\n');

  // Initialize services
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const athenaService = new AthenaToolIntegrationService(supabase, logger);

  await athenaService.initialize();
  console.log('✅ Service initialized\n');

  // Test scenarios
  const testScenarios = [
    {
      name: 'Widget Creation Request',
      message: 'Athena, create a widget that shows user profiles',
      expectedIntent: 'create_widget',
    },
    {
      name: 'Tool Building Request',
      message: 'Build me a tool to manage my todo list',
      expectedIntent: 'add_tool',
    },
    {
      name: 'Component Creation Request',
      message: 'I need a component for displaying charts',
      expectedIntent: 'create_widget',
    },
    {
      name: 'Natural Conversation Flow',
      message:
        'Hey Athena, can you help me create a widget called ProfileCard that displays user information?',
      expectedIntent: 'create_widget',
    },
  ];

  for (const scenario of testScenarios) {
    console.log(`\n📝 Testing: ${scenario.name}`);
    console.log(`Message: "${scenario.message}"`);

    const request: ConversationRequest = {
      userId: 'test-user',
      conversationId: `test-${Date.now()}`,
      message: scenario.message,
    };

    try {
      const response = await athenaService.processMessage(request);

      console.log("\n✨ Athena's Response:");
      console.log(`Content: ${response.content}`);
      console.log(`Mood: ${response.personalityMood}`);
      console.log(`Sweetness Level: ${response.sweetnessLevel}/10`);

      if (response.suggestedNextActions) {
        console.log('\nSuggested Actions:');
        response.suggestedNextActions.forEach((action, i) => {
          console.log(`  ${i + 1}. ${action}`);
        });
      }

      console.log('\n' + '='.repeat(60));
    } catch (error) {
      process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.error(`❌ Error: ${(error as Error).message}`);
    }
  }

  // Test conversation flow
  console.log('\n\n🎭 Testing Multi-Step Conversation Flow...\n');

  const conversationId = `conv-test-${Date.now()}`;
  const conversationFlow = [
    'Athena, I want to create a widget',
    'I want it to show a list of tasks',
    'Call it TaskListWidget',
    'Yes, that sounds perfect!',
    'Deploy it please',
  ];

  for (const [index, message] of conversationFlow.entries()) {
    console.log(`\nStep ${index + 1}: User says: "${message}"`);

    const request: ConversationRequest = {
      userId: 'test-user',
      conversationId,
      message,
    };

    try {
      const response = await athenaService.processMessage(request);
      console.log(`Athena responds: ${response.content.substring(0, 200)}...`);

      // Small delay between messages
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`Error at step ${index + 1}: ${(error as Error).message}`);
      break;
    }
  }

  console.log('\n\n✅ Testing complete!');
}

// Run the test
testToolCreation().catch(console.error);
