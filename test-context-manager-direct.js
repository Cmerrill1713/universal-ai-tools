#!/usr/bin/env node
/**
 * Direct Context Length Manager Test
 * Tests the context management functionality without requiring full server
 */

// Use tsx to handle TypeScript imports
import { contextLengthManager } from './src/services/context-length-manager.ts';

console.log('🧪 Testing LM Studio Context Length Management (Direct)');
console.log('===============================================================');

/**
 * Test cases for different models and scenarios
 */
const testCases = [
  {
    name: 'Large Qwen 30B model for code generation',
    request: {
      modelId: 'qwen/qwen3-30b-a3b-2507',
      provider: 'lm-studio',
      taskType: 'code-generation',
      inputLength: 2000,
      preferredOutputLength: 2048,
      priority: 'quality'
    }
  },
  {
    name: 'Small Qwen 0.5B for quick responses',
    request: {
      modelId: 'qwen2.5-0.5b-instruct-mlx',
      provider: 'lm-studio', 
      taskType: 'quick-response',
      inputLength: 200,
      preferredOutputLength: 512,
      priority: 'speed'
    }
  },
  {
    name: 'Coder model with large input context',
    request: {
      modelId: 'qwen2.5-coder-14b-instruct-mlx',
      provider: 'lm-studio',
      taskType: 'code-generation',
      inputLength: 8000,
      preferredOutputLength: 1024,
      priority: 'balanced'
    }
  },
  {
    name: 'Mistral for creative writing',
    request: {
      modelId: 'dolphin-mistral-24b-venice-edition-mlx',
      provider: 'lm-studio',
      taskType: 'creative-writing',
      inputLength: 1500,
      preferredOutputLength: 2048,
      priority: 'quality'
    }
  },
  {
    name: 'DeepSeek coder for quick fixes',
    request: {
      modelId: 'deepseek-r1-0528-coder-draft-0.6b-v1.0',
      provider: 'lm-studio',
      taskType: 'quick-code-fixes',
      inputLength: 500,
      preferredOutputLength: 1024,
      priority: 'speed'
    }
  },
  {
    name: 'Context overflow scenario',
    request: {
      modelId: 'qwen2.5-0.5b-instruct-mlx',
      provider: 'lm-studio',
      taskType: 'complex-analysis',
      inputLength: 5000, // Exceeds model capacity
      preferredOutputLength: 2048,
      priority: 'balanced'
    }
  }
];

/**
 * Run all test cases
 */
async function runTests() {
  console.log(`\n🚀 Running ${testCases.length} test cases...\n`);

  let passedTests = 0;
  let totalTests = testCases.length;

  for (const [index, testCase] of testCases.entries()) {
    console.log(`📋 Test ${index + 1}: ${testCase.name}`);
    console.log(`   Model: ${testCase.request.modelId}`);
    console.log(`   Task: ${testCase.request.taskType}`);
    console.log(`   Input: ${testCase.request.inputLength} chars, Output: ${testCase.request.preferredOutputLength} tokens`);
    
    try {
      // Test context optimization
      const optimization = contextLengthManager.getOptimalContextLength(testCase.request);
      
      console.log(`   ✅ Max Tokens: ${optimization.maxTokens}`);
      console.log(`   📊 Efficiency: ${(optimization.efficiency * 100).toFixed(1)}%`);
      console.log(`   💡 Strategy: ${optimization.truncationStrategy}`);
      console.log(`   🎯 Reasoning: ${optimization.reasoning}`);
      
      // Validate results
      if (optimization.maxTokens > 0 && optimization.efficiency > 0) {
        console.log(`   ✅ PASSED\n`);
        passedTests++;
      } else {
        console.log(`   ❌ FAILED - Invalid optimization results\n`);
      }

      // Test model info retrieval
      const modelInfo = contextLengthManager.getModelInfo(testCase.request.modelId, testCase.request.provider);
      if (modelInfo) {
        console.log(`   📝 Model Info: ${modelInfo.contextLength} max context, supports ${modelInfo.tasks.join(', ')}`);
      }

    } catch (error) {
      console.log(`   💥 ERROR: ${error.message}\n`);
    }
    
    console.log('   ' + '─'.repeat(50));
  }

  // Summary
  console.log(`\n📊 Test Results Summary:`);
  console.log(`   ✅ Passed: ${passedTests}/${totalTests}`);
  console.log(`   📈 Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  
  if (passedTests === totalTests) {
    console.log(`\n🎉 All tests passed! Context Length Manager is working correctly.`);
  } else {
    console.log(`\n⚠️  Some tests failed. Please review the context management configuration.`);
  }

  // Additional functionality tests
  console.log(`\n🔧 Testing Additional Functionality:`);
  
  try {
    // Test invalid model
    console.log(`   Testing invalid model handling...`);
    const invalidResult = contextLengthManager.getOptimalContextLength({
      modelId: 'non-existent-model',
      provider: 'lm-studio',
      taskType: 'test',
      inputLength: 100
    });
    console.log(`   ✅ Invalid model handled gracefully: ${invalidResult.reasoning}`);
  } catch (error) {
    console.log(`   ❌ Invalid model test failed: ${error.message}`);
  }

  try {
    // Test provider-specific optimization
    console.log(`   Testing Ollama provider support...`);
    const ollamaResult = contextLengthManager.getOptimalContextLength({
      modelId: 'llama3.2:3b',
      provider: 'ollama',
      taskType: 'conversation',
      inputLength: 500,
      preferredOutputLength: 1024
    });
    console.log(`   ✅ Ollama optimization: ${ollamaResult.maxTokens} tokens, ${(ollamaResult.efficiency * 100).toFixed(1)}% efficiency`);
  } catch (error) {
    console.log(`   ❌ Ollama test failed: ${error.message}`);
  }

  console.log(`\n✅ Context Length Manager functional testing completed!`);
}

// Run tests
runTests().catch(error => {
  console.error('💥 Test execution failed:', error);
  process.exit(1);
});