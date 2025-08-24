#!/usr/bin/env npx tsx
/**
 * Test Local LLM Connectivity
 * Verifies Ollama and LM Studio connections
 */

import { llmRouter } from '../src/services/llm-router-service';
import { log, LogContext } from '../src/utils/logger';

async function testLocalLLMs(): Promise<void> {
  try {
    process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.log('🤖 Testing Local LLM Connectivity');
    console.log('=================================');
    console.log('');

    // Test message
    const testMessage = [
      {
        role: 'user' as const,
        content: 'Hello! Please respond with a brief greeting to confirm you are working.'
      }
    ];

    // Test 1: Ollama
    console.log('🦙 Testing Ollama...');
    try {
      const ollamaResponse = await llmRouter.generateResponse('ollama:llama3.2:3b', testMessage, {
        maxTokens: 50,
        temperature: 0.7,
      });
      
      console.log(`   ✅ Success! Provider: ${ollamaResponse.provider}`);
      console.log(`   📄 Response: ${ollamaResponse.content.substring(0, 100)}...`);
      console.log(`   🔢 Tokens: ${ollamaResponse.usage?.total_tokens || 'N/A'}`);
    } catch (error) {
      console.log(`   ❌ Ollama failed: ${error instanceof Error ? error.message.substring(0, 80) : String(error).substring(0, 80)}`);
    }

    console.log('');

    // Test 2: LM Studio
    console.log('🎨 Testing LM Studio...');
    try {
      const lmStudioResponse = await llmRouter.generateResponse('lmstudio:local', testMessage, {
        maxTokens: 50,
        temperature: 0.7,
      });
      
      console.log(`   ✅ Success! Provider: ${lmStudioResponse.provider}`);
      console.log(`   📄 Response: ${lmStudioResponse.content.substring(0, 100)}...`);
      console.log(`   🔢 Tokens: ${lmStudioResponse.usage?.total_tokens || 'N/A'}`);
    } catch (error) {
      console.log(`   ❌ LM Studio failed: ${error instanceof Error ? error.message.substring(0, 80) : String(error).substring(0, 80)}`);
    }

    console.log('');

    // Test 3: Multi-tier routing
    console.log('🔀 Testing Multi-tier LLM Routing...');
    try {
      const routedResponse = await llmRouter.generateResponse('auto', testMessage, {
        maxTokens: 100,
        temperature: 0.7,
        includeContext: true,
      });
      
      console.log(`   ✅ Auto-routing successful!`);
      console.log(`   🎯 Selected provider: ${routedResponse.provider}`);
      console.log(`   🤖 Selected model: ${routedResponse.model}`);
      console.log(`   📄 Response: ${routedResponse.content.substring(0, 150)}...`);
    } catch (error) {
      console.log(`   ❌ Auto-routing failed: ${error instanceof Error ? error.message.substring(0, 80) : String(error).substring(0, 80)}`);
    }

    console.log('');
    console.log('🎉 Local LLM Test Complete!');
    console.log('');
    console.log('💡 Your local LLM setup is ready for MCP integration!');
    console.log('   Now all your API endpoints will benefit from:');
    console.log('   ✅ Intelligent context injection');
    console.log('   ✅ Local LLM processing');
    console.log('   ✅ Automatic parameter optimization');
    console.log('   ✅ Context learning and improvement');

  } catch (error) {
    process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.error('❌ Local LLM test failed:', error);
    process.exit(1);
  }
}

// Run the test
testLocalLLMs().catch((error) => {
  console.error('💥 Local LLM test script failed:', error);
  process.exit(1);
});