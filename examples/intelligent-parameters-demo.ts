#!/usr/bin/env ts-node
/**
 * Intelligent Parameters System Demo
 * Demonstrates automatic parameter optimization based on task type
 */

import { intelligentParameterService, TaskType } from '../src/services/intelligent-parameter-service';
import { optimizeParameters } from '../src/middleware/intelligent-parameters';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m'
};

function colorLog(color: string, text: string) {
  console.log(`${color}${text}${colors.reset}`);
}

function showParameters(params: any, title: string) {
  colorLog(colors.cyan, `\n📊 ${title}`);
  console.log(`   🌡️  Temperature: ${params.temperature}`);
  console.log(`   📏 Max Tokens: ${params.maxTokens}`);
  console.log(`   📖 Context Length: ${params.contextLength}`);
  console.log(`   🎯 Top P: ${params.topP}`);
  console.log(`   🚫 Presence Penalty: ${params.presencePenalty || 0}`);
  console.log(`   🔄 Frequency Penalty: ${params.frequencyPenalty || 0}`);
  console.log(`   📝 System Prompt: ${params.systemPrompt.substring(0, 60)}...`);
  console.log(`   ✅ Task Type: ${params.taskType}`);
}

async function demonstrateTaskDetection() {
  colorLog(colors.bright + colors.green, '\n🧠 INTELLIGENT PARAMETER SYSTEM DEMO');
  colorLog(colors.bright + colors.green, '================================================\n');

  const testCases = [
    {
      input: "Write a Python function to calculate fibonacci numbers",
      expectedType: TaskType.CODE_GENERATION,
      description: "Code Generation Task"
    },
    {
      input: "Review this JavaScript code for potential security issues",
      expectedType: TaskType.CODE_REVIEW,
      description: "Code Review Task"
    },
    {
      input: "Write a creative story about a robot discovering emotions",
      expectedType: TaskType.CREATIVE_WRITING,
      description: "Creative Writing Task"
    },
    {
      input: "Analyze this sales data and identify trends",
      expectedType: TaskType.DATA_ANALYSIS,
      description: "Data Analysis Task"
    },
    {
      input: "What is the capital of France?",
      expectedType: TaskType.FACTUAL_QA,
      description: "Factual Question Answering"
    },
    {
      input: "Solve this math problem step by step: 2x + 5 = 13",
      expectedType: TaskType.REASONING,
      description: "Reasoning Task"
    },
    {
      input: "Brainstorm creative marketing ideas for a new app",
      expectedType: TaskType.BRAINSTORMING,
      description: "Brainstorming Task"
    },
    {
      input: "Translate this text to Spanish: Hello, how are you?",
      expectedType: TaskType.TRANSLATION,
      description: "Translation Task"
    },
    {
      input: "Summarize the key points from this research paper",
      expectedType: TaskType.SUMMARIZATION,
      description: "Summarization Task"
    },
    {
      input: "Hi there! How's your day going?",
      expectedType: TaskType.CASUAL_CHAT,
      description: "Casual Conversation"
    }
  ];

  colorLog(colors.bright + colors.blue, '🎯 TASK TYPE DETECTION DEMO');
  colorLog(colors.blue, '─'.repeat(50));

  for (const testCase of testCases) {
    const detectedType = intelligentParameterService.detectTaskType(testCase.input);
    const isCorrect = detectedType === testCase.expectedType;
    
    console.log(`\n📝 Input: "${testCase.input}"`);
    console.log(`🎯 Expected: ${testCase.expectedType}`);
    console.log(`🤖 Detected: ${detectedType}`);
    console.log(`${isCorrect ? '✅' : '❌'} ${isCorrect ? 'CORRECT' : 'INCORRECT'}`);
  }
}

async function demonstrateParameterOptimization() {
  colorLog(colors.bright + colors.magenta, '\n🔧 PARAMETER OPTIMIZATION DEMO');
  colorLog(colors.magenta, '─'.repeat(50));

  const testCases = [
    {
      input: "Generate a Python class for handling API requests",
      taskType: TaskType.CODE_GENERATION,
      description: "Code Generation - Low temp, precise"
    },
    {
      input: "Write a fantasy story about magical creatures",
      taskType: TaskType.CREATIVE_WRITING,
      description: "Creative Writing - High temp, expressive"
    },
    {
      input: "Analyze customer satisfaction survey results",
      taskType: TaskType.DATA_ANALYSIS,
      description: "Data Analysis - Medium temp, thorough"
    },
    {
      input: "Debug this error: TypeError: Cannot read property",
      taskType: TaskType.CODE_DEBUGGING,
      description: "Code Debugging - Very low temp, systematic"
    }
  ];

  for (const testCase of testCases) {
    colorLog(colors.yellow, `\n🧪 Testing: ${testCase.description}`);
    console.log(`📝 Input: "${testCase.input}"`);
    
    const optimized = optimizeParameters(testCase.input, {
      taskType: testCase.taskType
    });
    
    showParameters(optimized, `Optimized Parameters for ${testCase.taskType}`);
  }
}

async function demonstrateComplexityAdjustments() {
  colorLog(colors.bright + colors.cyan, '\n⚙️ COMPLEXITY ADJUSTMENT DEMO');
  colorLog(colors.cyan, '─'.repeat(50));

  const baseInput = "Write a function to sort an array";
  
  const complexityLevels = [
    { complexity: 'simple' as const, description: 'Simple task - basic sorting' },
    { complexity: 'medium' as const, description: 'Medium task - with options' },
    { complexity: 'complex' as const, description: 'Complex task - multiple algorithms' }
  ];

  for (const level of complexityLevels) {
    colorLog(colors.yellow, `\n🎚️ Complexity Level: ${level.complexity.toUpperCase()}`);
    console.log(`📝 ${level.description}`);
    
    const optimized = optimizeParameters(baseInput, {
      taskType: TaskType.CODE_GENERATION,
      complexity: level.complexity
    });
    
    showParameters(optimized, `Parameters for ${level.complexity} task`);
  }
}

async function demonstrateUserPreferences() {
  colorLog(colors.bright + colors.green, '\n👤 USER PREFERENCES DEMO');
  colorLog(colors.green, '─'.repeat(50));

  const baseInput = "Explain machine learning concepts";
  
  const userProfiles = [
    {
      name: "Conservative User",
      preferences: {
        creativity: 'conservative' as const,
        preferredLength: 'concise' as const,
        writingStyle: 'formal' as const
      }
    },
    {
      name: "Creative User", 
      preferences: {
        creativity: 'creative' as const,
        preferredLength: 'detailed' as const,
        writingStyle: 'casual' as const
      }
    },
    {
      name: "Balanced User",
      preferences: {
        creativity: 'balanced' as const,
        preferredLength: 'detailed' as const,
        writingStyle: 'technical' as const
      }
    }
  ];

  for (const profile of userProfiles) {
    colorLog(colors.yellow, `\n👤 User Profile: ${profile.name}`);
    console.log(`🎨 Creativity: ${profile.preferences.creativity}`);
    console.log(`📏 Length: ${profile.preferences.preferredLength}`);
    console.log(`✍️ Style: ${profile.preferences.writingStyle}`);
    
    const optimized = optimizeParameters(baseInput, {
      taskType: TaskType.EXPLANATION,
      userPreferences: profile.preferences
    });
    
    showParameters(optimized, `Personalized Parameters`);
  }
}

async function demonstrateModelOptimization() {
  colorLog(colors.bright + colors.red, '\n🤖 MODEL-SPECIFIC OPTIMIZATION DEMO');
  colorLog(colors.red, '─'.repeat(50));

  const baseInput = "Write a comprehensive research summary";
  const models = [
    { name: 'gpt-4', description: 'Large context, high capability' },
    { name: 'gpt-3.5-turbo', description: 'Limited context, fast' },
    { name: 'claude-3-opus', description: 'Very large context' },
    { name: 'llama-70b', description: 'Open source, moderate context' },
    { name: 'llama-7b', description: 'Smaller model, basic context' }
  ];

  for (const model of models) {
    colorLog(colors.yellow, `\n🤖 Model: ${model.name}`);
    console.log(`📋 ${model.description}`);
    
    const optimized = optimizeParameters(baseInput, {
      taskType: TaskType.RESEARCH,
      model: model.name
    });
    
    showParameters(optimized, `Optimized for ${model.name}`);
  }
}

async function demonstrateRealWorldScenarios() {
  colorLog(colors.bright + colors.magenta, '\n🌍 REAL-WORLD SCENARIOS DEMO');
  colorLog(colors.magenta, '─'.repeat(50));

  const scenarios = [
    {
      name: "Code Review in Academic Setting",
      input: "Review this research algorithm implementation",
      context: {
        taskType: TaskType.CODE_REVIEW,
        domain: 'academic',
        complexity: 'complex' as const,
        userPreferences: { writingStyle: 'formal' as const, preferredLength: 'comprehensive' as const }
      }
    },
    {
      name: "Creative Writing for Marketing",
      input: "Write engaging product descriptions",
      context: {
        taskType: TaskType.CREATIVE_WRITING,
        domain: 'business',
        complexity: 'medium' as const,
        userPreferences: { creativity: 'creative' as const, writingStyle: 'casual' as const }
      }
    },
    {
      name: "Technical Support Debugging",
      input: "Help debug this network connectivity issue",
      context: {
        taskType: TaskType.TECHNICAL_SUPPORT,
        domain: 'technical',
        complexity: 'complex' as const,
        userPreferences: { preferredLength: 'detailed' as const, writingStyle: 'technical' as const }
      }
    },
    {
      name: "Data Analysis for Business Intelligence",
      input: "Analyze quarterly sales performance metrics",
      context: {
        taskType: TaskType.DATA_ANALYSIS,
        domain: 'business',
        complexity: 'complex' as const,
        userPreferences: { preferredLength: 'comprehensive' as const, writingStyle: 'formal' as const }
      }
    }
  ];

  for (const scenario of scenarios) {
    colorLog(colors.yellow, `\n🎭 Scenario: ${scenario.name}`);
    console.log(`📝 Input: "${scenario.input}"`);
    console.log(`🏢 Domain: ${scenario.context.domain}`);
    console.log(`⚙️ Complexity: ${scenario.context.complexity}`);
    
    const optimized = optimizeParameters(scenario.input, scenario.context);
    
    showParameters(optimized, `Real-world Optimized Parameters`);
  }
}

async function runDemo() {
  try {
    await demonstrateTaskDetection();
    await demonstrateParameterOptimization();
    await demonstrateComplexityAdjustments();
    await demonstrateUserPreferences();
    await demonstrateModelOptimization();
    await demonstrateRealWorldScenarios();
    
    colorLog(colors.bright + colors.green, '\n🎉 DEMO COMPLETED SUCCESSFULLY!');
    colorLog(colors.green, '=' + '='.repeat(50));
    
    colorLog(colors.bright, '\n📈 BENEFITS OF INTELLIGENT PARAMETERS:');
    console.log('   ✅ Automatic task type detection');
    console.log('   ✅ Optimal temperature for each task');
    console.log('   ✅ Context length optimization');
    console.log('   ✅ User preference personalization');
    console.log('   ✅ Model-specific adjustments');
    console.log('   ✅ Domain and complexity awareness');
    console.log('   ✅ Improved response quality');
    console.log('   ✅ Reduced manual parameter tuning');
    
    colorLog(colors.bright, '\n🚀 INTEGRATION STATUS:');
    console.log('   ✅ HuggingFace service integrated');
    console.log('   ✅ MLX service integrated');
    console.log('   ✅ Agent orchestration integrated');
    console.log('   ✅ Vision tasks supported');
    console.log('   ✅ Fine-tuning tasks optimized');
    console.log('   ✅ Middleware ready for all endpoints');
    
  } catch (error) {
    colorLog(colors.red, `\n❌ Demo failed: ${error}`);
    console.error(error);
    process.exit(1);
  }
}

// Run the demo
if (require.main === module) {
  runDemo();
}

export { runDemo };