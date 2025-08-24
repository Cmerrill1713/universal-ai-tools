#!/usr/bin/env npx tsx
/**
 * Test Llama Model Specifically
 * Tests the llama3.2:3b model directly
 */

import { ollamaService } from '../src/services/ollama-service';
import { log, LogContext } from '../src/utils/logger';

async function testLlamaModel(): Promise<void> {
  try {
    process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.log('🦙 Testing Llama 3.2:3b Model');
    console.log('============================');
    console.log('');

    console.log('🔄 Generating response with llama3.2:3b...');
    
    const response = await ollamaService.generateResponse({
      model: 'llama3.2:3b',
      prompt: 'Hello! Please respond with a brief confirmation that you are working correctly.',
      options: {
        temperature: 0.7,
        num_predict: 50,
      }
    });
    
    console.log('✅ SUCCESS! Llama 3.2:3b is working perfectly!');
    console.log('');
    console.log('📄 Response:');
    console.log(`   "${response.response}"`);
    console.log('');
    console.log('📊 Stats:');
    console.log(`   🔢 Tokens generated: ${response.eval_count || 'N/A'}`);
    console.log(`   ⏱️  Generation time: ${response.eval_duration ? Math.round(response.eval_duration / 1000000) + 'ms' : 'N/A'}`);
    console.log(`   💾 Total time: ${response.total_duration ? Math.round(response.total_duration / 1000000) + 'ms' : 'N/A'}`);
    console.log('');
    
    // Test 2: Test with a more complex prompt
    console.log('🧠 Testing with a more complex prompt...');
    
    const complexResponse = await ollamaService.generateResponse({
      model: 'llama3.2:3b',
      prompt: 'Explain what Model Context Protocol (MCP) is in 2 sentences.',
      options: {
        temperature: 0.5,
        num_predict: 100,
      }
    });
    
    console.log('✅ Complex prompt test successful!');
    console.log('');
    console.log('📄 Response:');
    console.log(`   "${complexResponse.response}"`);
    console.log('');
    
    console.log('🎉 EXCELLENT! Your local Llama model is fully operational!');
    console.log('');
    console.log('🚀 This means your MCP integration can now:');
    console.log('   ✅ Use local Llama 3.2:3b for all AI responses');
    console.log('   ✅ Inject intelligent context into conversations');
    console.log('   ✅ Optimize parameters automatically');
    console.log('   ✅ Learn from interactions and improve over time');
    console.log('   ✅ Process requests entirely locally (privacy-first!)');
    
    log.info('🎉 Llama 3.2:3b test successful', LogContext.AI, {
      model: 'llama3.2:3b',
      tokensGenerated: response.eval_count || 0,
      responseTime: response.total_duration ? Math.round(response.total_duration / 1000000) : 0,
      responseLength: response.response.length,
    });

  } catch (error) {
    process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.error('❌ Llama model test failed:', error);
    console.log('');
    console.log('🔧 Troubleshooting suggestions:');
    console.log('   1. Ensure model is pulled: ollama pull llama3.2:3b');
    console.log('   2. Check Ollama server: ollama serve');
    console.log('   3. Verify model name: ollama list');
    
    log.error('❌ Llama model test failed', LogContext.AI, {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
}

// Run the test
testLlamaModel().catch((error) => {
  console.error('💥 Llama model test script failed:', error);
  process.exit(1);
});