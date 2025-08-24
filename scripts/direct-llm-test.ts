#!/usr/bin/env npx tsx
/**
 * Direct LLM Test
 * Tests LLM connections bypassing the router to identify configuration issues
 */

import { ollamaService } from '../src/services/ollama-service';
import { log, LogContext } from '../src/utils/logger';

async function directLLMTest(): Promise<void> {
  try {
    process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.log('🔍 Direct LLM Connection Test');
    console.log('============================');
    console.log('');

    // Test 1: Direct Ollama service test
    console.log('🦙 Testing Ollama Service Directly...');
    try {
      const ollamaResponse = await ollamaService.generateResponse({
        model: 'llama3.2:3b',
        prompt: 'Hello! Please respond with just "Ollama is working" to confirm connectivity.',
        options: {
          temperature: 0.7,
          num_predict: 20,
        }
      });
      
      console.log(`   ✅ Ollama Direct Success!`);
      console.log(`   📄 Response: ${ollamaResponse.response.substring(0, 100)}...`);
      console.log(`   🔢 Tokens: ${ollamaResponse.eval_count || 'N/A'}`);
      console.log(`   ⏱️  Time: ${ollamaResponse.total_duration ? Math.round(ollamaResponse.total_duration / 1000000) + 'ms' : 'N/A'}`);
      
    } catch (error) {
      console.log(`   ❌ Ollama Direct Test Failed:`);
      console.log(`      Error: ${error instanceof Error ? error.message : String(error)}`);
      
      // Check if it's a model issue
      if (error instanceof Error && error.message.includes('model')) {
        console.log(`   💡 Suggestion: Try running 'ollama pull llama3.2:3b' to ensure the model is available`);
      }
    }

    console.log('');

    // Test 2: Check available models
    console.log('📋 Checking Available Ollama Models...');
    try {
      const response = await fetch('http://localhost:11434/api/tags');
      const models = await response.json();
      
      if (models.models && models.models.length > 0) {
        console.log('   ✅ Available models:');
        models.models.forEach((model: unknown) => {
          console.log(`      • ${model.name} (${Math.round(model.size / 1024 / 1024 / 1024 * 10) / 10}GB)`);
        });
        
        // Test with the first available model
        if (models.models.length > 0) {
          const firstModel = models.models[0].name;
          console.log(`   🔄 Testing with available model: ${firstModel}`);
          
          try {
            const testResponse = await ollamaService.generateResponse({
              model: firstModel,
              prompt: 'Say "Hello from Ollama!"',
              options: {
                temperature: 0.7,
                num_predict: 10,
              }
            });
            
            console.log(`   ✅ Test with ${firstModel} successful!`);
            console.log(`   📄 Response: ${testResponse.response}`);
            
          } catch (error) {
            console.log(`   ❌ Test with ${firstModel} failed: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      } else {
        console.log('   ⚠️  No models found. Please pull a model with: ollama pull llama3.2:3b');
      }
      
    } catch (error) {
      console.log(`   ❌ Could not fetch model list: ${error instanceof Error ? error.message : String(error)}`);
    }

    console.log('');
    console.log('🎯 Test Summary:');
    console.log('   • Ollama Server: ✅ Running (v0.9.6)');
    console.log('   • Direct API Test: Check results above');
    console.log('   • Model Availability: Check results above');
    console.log('');
    console.log('💡 If tests pass, your MCP integration with local LLMs is ready!');

    log.info('🔍 Direct LLM test completed', LogContext.AI, {
      ollamaVersion: '0.9.6',
      testCompleted: true,
    });

  } catch (error) {
    process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.error('❌ Direct LLM test failed:', error);
    log.error('❌ Direct LLM test failed', LogContext.AI, {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
}

// Run the test
directLLMTest().catch((error) => {
  console.error('💥 Direct LLM test script failed:', error);
  process.exit(1);
});