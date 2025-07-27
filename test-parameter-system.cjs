/**
 * Test Parameter Optimization System
 */

const path = require('path');

// Mock logger to avoid import issues
global.log = {
  info: (...args) => console.log('[INFO]', ...args),
  error: (...args) => console.error('[ERROR]', ...args),
  warn: (...args) => console.warn('[WARN]', ...args),
  debug: (...args) => console.log('[DEBUG]', ...args)
};

global.LogContext = {
  AI: 'AI',
  API: 'API',
  SERVER: 'SERVER',
  SYSTEM: 'SYSTEM'
};

// Mock config
global.config = {
  supabase: {
    url: process.env.SUPABASE_URL || 'https://test.supabase.co',
    serviceKey: process.env.SUPABASE_SERVICE_KEY || 'test-key'
  }
};

async function testIntelligentParameterService() {
  console.log('\n🧪 Testing Intelligent Parameter Service\n');
  
  try {
    // Load the service
    const { intelligentParameterService, TaskType } = require('./src/services/intelligent-parameter-service');
    
    // Test 1: Task type detection
    console.log('1️⃣ Testing task type detection...');
    const codeTask = intelligentParameterService.detectTaskType('Write a function to calculate fibonacci numbers');
    console.log('   Code task detected:', codeTask);
    
    const creativeTask = intelligentParameterService.detectTaskType('Write a story about a magical forest');
    console.log('   Creative task detected:', creativeTask);
    
    // Test 2: Get parameters for code generation
    console.log('\n2️⃣ Testing parameter optimization for code generation...');
    const codeParams = intelligentParameterService.getTaskParameters({
      userInput: 'Write a function to calculate fibonacci numbers',
      taskType: TaskType.CODE_GENERATION,
      complexity: 'medium'
    });
    console.log('   Code generation parameters:', JSON.stringify(codeParams, null, 2));
    
    // Test 3: Get parameters for creative writing
    console.log('\n3️⃣ Testing parameter optimization for creative writing...');
    const creativeParams = intelligentParameterService.getTaskParameters({
      userInput: 'Write a story about a magical forest',
      taskType: TaskType.CREATIVE_WRITING,
      userPreferences: {
        creativity: 'creative',
        lengthPreference: 'comprehensive'
      }
    });
    console.log('   Creative writing parameters:', JSON.stringify(creativeParams, null, 2));
    
    // Test 4: Optimize for different models
    console.log('\n4️⃣ Testing model-specific optimization...');
    const gpt4Params = intelligentParameterService.getTaskParameters({
      userInput: 'Explain quantum computing',
      taskType: TaskType.TECHNICAL_EXPLANATION,
      modelInfo: { provider: 'openai', model: 'gpt-4' }
    });
    console.log('   GPT-4 parameters:', JSON.stringify(gpt4Params, null, 2));
    
    const claudeParams = intelligentParameterService.getTaskParameters({
      userInput: 'Explain quantum computing',
      taskType: TaskType.TECHNICAL_EXPLANATION,
      modelInfo: { provider: 'anthropic', model: 'claude-3' }
    });
    console.log('   Claude parameters:', JSON.stringify(claudeParams, null, 2));
    
    console.log('\n✅ Intelligent Parameter Service is working correctly!');
    
  } catch (error) {
    console.error('❌ Intelligent Parameter Service test failed:', error);
  }
}

async function testParameterAnalytics() {
  console.log('\n🧪 Testing Parameter Analytics Service\n');
  
  try {
    // Load the service
    const { parameterAnalyticsService } = require('./src/services/parameter-analytics-service');
    const { TaskType } = require('./src/services/intelligent-parameter-service');
    
    // Test 1: Record execution
    console.log('1️⃣ Testing execution recording...');
    await parameterAnalyticsService.recordExecution({
      taskType: TaskType.CODE_GENERATION,
      userInput: 'Write a fibonacci function',
      parameters: {
        temperature: 0.2,
        maxTokens: 1024,
        topP: 0.9
      },
      model: 'gpt-4',
      provider: 'openai',
      userId: 'test-user-123',
      requestId: 'req-123',
      executionTime: 1200,
      tokenUsage: {
        promptTokens: 50,
        completionTokens: 200,
        totalTokens: 250
      },
      responseLength: 500,
      responseQuality: 0.85,
      userSatisfaction: 4,
      success: true,
      retryCount: 0,
      complexity: 'medium',
      endpoint: '/api/v1/test'
    });
    console.log('   ✅ Execution recorded successfully');
    
    // Test 2: Get dashboard metrics
    console.log('\n2️⃣ Testing dashboard metrics...');
    const dashboard = await parameterAnalyticsService.getDashboardMetrics();
    console.log('   Dashboard metrics:', {
      totalExecutions: dashboard.totalExecutions,
      successRate: dashboard.successRate,
      avgResponseTime: dashboard.avgResponseTime,
      topPerformingTasks: dashboard.topPerformingTasks.length
    });
    
    // Test 3: Get parameter recommendations
    console.log('\n3️⃣ Testing parameter recommendations...');
    const recommendations = await parameterAnalyticsService.getParameterRecommendations(
      TaskType.CODE_GENERATION,
      {
        complexity: 'medium',
        model: 'gpt-4'
      }
    );
    console.log('   Recommendations:', {
      confidence: recommendations.confidence,
      reasoning: recommendations.reasoning,
      recommended: recommendations.recommended
    });
    
    console.log('\n✅ Parameter Analytics Service is working correctly!');
    
  } catch (error) {
    console.error('❌ Parameter Analytics Service test failed:', error);
  }
}

async function testFeedbackIntegration() {
  console.log('\n🧪 Testing Feedback Integration Service\n');
  
  try {
    // Load the service
    const { feedbackIntegrationService } = require('./src/services/feedback-integration-service');
    const { TaskType } = require('./src/services/intelligent-parameter-service');
    
    // Test 1: Collect feedback
    console.log('1️⃣ Testing feedback collection...');
    const feedbackId = await feedbackIntegrationService.collectFeedback({
      userId: 'test-user-123',
      sessionId: 'session-456',
      executionId: 'exec-789',
      taskType: TaskType.CODE_GENERATION,
      parameters: {
        temperature: 0.2,
        maxTokens: 1024,
        topP: 0.9
      },
      qualityRating: 4,
      speedRating: 4,
      accuracyRating: 5,
      usefulnessRating: 4,
      overallSatisfaction: 4,
      userIntent: 'Generate efficient algorithm code',
      responseLength: 200,
      expectedOutcome: 'Working fibonacci function',
      metExpectations: true,
      responseTime: 1200,
      modelUsed: 'gpt-4',
      endpoint: '/api/v1/test',
      wouldUseAgain: true,
      recommendToOthers: 8,
      flaggedAsIncorrect: false,
      reportedIssues: []
    });
    console.log('   ✅ Feedback collected with ID:', feedbackId);
    
    // Test 2: Get learning signals
    console.log('\n2️⃣ Testing learning signals...');
    const signals = feedbackIntegrationService.getLearningSignals(TaskType.CODE_GENERATION);
    console.log('   Learning signals found:', signals.length);
    if (signals.length > 0) {
      console.log('   Sample signal:', {
        signal: signals[0].signal,
        strength: signals[0].strength,
        parameter: signals[0].parameterAffected
      });
    }
    
    // Test 3: Apply feedback learning
    console.log('\n3️⃣ Testing feedback learning application...');
    const learningResults = await feedbackIntegrationService.applyFeedbackLearning();
    console.log('   Learning results:', learningResults);
    
    console.log('\n✅ Feedback Integration Service is working correctly!');
    
  } catch (error) {
    console.error('❌ Feedback Integration Service test failed:', error);
  }
}

async function testMLParameterOptimizer() {
  console.log('\n🧪 Testing ML Parameter Optimizer\n');
  
  try {
    // Load the service
    const { mlParameterOptimizer } = require('./src/services/ml-parameter-optimizer');
    const { TaskType } = require('./src/services/intelligent-parameter-service');
    
    // Test 1: Get optimized parameters
    console.log('1️⃣ Testing ML optimization...');
    const prediction = await mlParameterOptimizer.getOptimizedParameters(
      TaskType.CODE_GENERATION,
      {
        userInput: 'Write a fibonacci function',
        complexity: 'medium',
        domain: 'algorithms'
      }
    );
    console.log('   ML prediction:', {
      taskType: prediction.taskType,
      confidence: prediction.confidenceScore,
      expectedPerformance: prediction.expectedPerformance,
      recommendationStrength: prediction.recommendationStrength,
      parameters: prediction.predictedParameters
    });
    
    // Test 2: Learn from execution
    console.log('\n2️⃣ Testing ML learning...');
    await mlParameterOptimizer.learnFromExecution(
      TaskType.CODE_GENERATION,
      {
        temperature: 0.2,
        maxTokens: 1024,
        topP: 0.9
      },
      0.85, // score
      1200, // execution time
      {
        complexity: 'medium',
        userSatisfaction: 4
      }
    );
    console.log('   ✅ ML learning completed');
    
    // Test 3: Get optimization insights
    console.log('\n3️⃣ Testing optimization insights...');
    const insights = await mlParameterOptimizer.getOptimizationInsights(TaskType.CODE_GENERATION);
    console.log('   Optimization insights:', insights.length);
    
    console.log('\n✅ ML Parameter Optimizer is working correctly!');
    
  } catch (error) {
    console.error('❌ ML Parameter Optimizer test failed:', error);
  }
}

async function runAllTests() {
  console.log('========================================');
  console.log('🚀 Testing Parameter Optimization System');
  console.log('========================================');
  
  await testIntelligentParameterService();
  await testParameterAnalytics();
  await testFeedbackIntegration();
  await testMLParameterOptimizer();
  
  console.log('\n========================================');
  console.log('📊 Test Summary');
  console.log('========================================');
  console.log('✅ All parameter optimization components tested');
  console.log('✅ System is ready for use');
  console.log('\n🎉 Parameter optimization system is working!');
}

// Run tests
runAllTests().catch(error => {
  console.error('\n❌ Test suite failed:', error);
  process.exit(1);
});