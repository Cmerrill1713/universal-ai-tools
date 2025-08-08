#!/usr/bin/env npx tsx

/**
 * Test script to validate memory-driven configuration improvements
 */

import { intelligentParameterService } from './src/services/intelligent-parameter-service';
import { llmRouter } from './src/services/llm-router-service';
import { TaskType } from './src/services/intelligent-parameter-service';

async function testMemoryDrivenConfig() {
  console.log('🧪 Testing Memory-Driven Configuration Improvements');
  console.log('=================================================');

  try {
    // Test 1: IntelligentParameterService memory loading
    console.log('\n📋 Test 1: IntelligentParameterService Memory Loading');
    console.log('---------------------------------------------------');
    
    const taskContext = intelligentParameterService.createTaskContext(
      'Generate a complex TypeScript function for data analysis',
      TaskType.CODE_GENERATION
    );
    
    const parameters = await intelligentParameterService.getTaskParameters(taskContext);
    
    console.log('✅ Task parameters generated:', {
      contextLength: parameters.contextLength,
      temperature: parameters.temperature,
      maxTokens: parameters.maxTokens,
      hasSystemPrompt: !!parameters.systemPrompt
    });

    // Test 2: LLM Router performance-based routing
    console.log('\n📋 Test 2: LLM Router Performance-Based Routing');
    console.log('----------------------------------------------');
    
    const availableModels = llmRouter.getAvailableModels();
    console.log('✅ Available models:', availableModels.slice(0, 5));
    
    const providerStatus = llmRouter.getProviderStatus();
    console.log('✅ Provider status:', providerStatus);

    // Test 3: Test specific model capabilities
    console.log('\n📋 Test 3: Model Capability Detection');
    console.log('------------------------------------');
    
    const codeModelCapabilities = llmRouter.getModelCapabilities('code-expert');
    console.log('✅ Code expert capabilities:', codeModelCapabilities);
    
    const plannerCapabilities = llmRouter.getModelCapabilities('planner-pro');
    console.log('✅ Planner capabilities:', plannerCapabilities);

    // Test 4: Task type detection
    console.log('\n📋 Test 4: Task Type Detection');
    console.log('-----------------------------');
    
    const detectedTypes = [
      intelligentParameterService.detectTaskType('Write code for a web scraper'),
      intelligentParameterService.detectTaskType('Debug this function'),
      intelligentParameterService.detectTaskType('Analyze this data set'),
      intelligentParameterService.detectTaskType('Brainstorm ideas for a product')
    ];
    
    console.log('✅ Detected task types:', detectedTypes);

    console.log('\n🎉 Memory-driven configuration test completed successfully!');
    console.log('=======================================================');
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Test failed:', error instanceof Error ? error.message : String(error));
    console.error('\nError details:', error);
    process.exit(1);
  }
}

// Run the test
testMemoryDrivenConfig();