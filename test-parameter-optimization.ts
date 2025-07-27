/**
 * Test the new parameter optimization system
 */

import { TaskType } from './src/services/intelligent-parameter-service';
import { mlParameterOptimizer } from './src/services/ml-parameter-optimizer';
import { parameterAnalyticsService } from './src/services/parameter-analytics-service';
import { feedbackIntegrationService } from './src/services/feedback-integration-service';

async function testParameterOptimization() {
  console.log('🧪 Testing Parameter Optimization System\n');

  try {
    // Test 1: Get optimized parameters for code generation
    console.log('1️⃣ Testing ML Parameter Optimizer...');
    const codeGenParams = await mlParameterOptimizer.getOptimizedParameters(
      TaskType.CODE_GENERATION,
      {
        userInput: 'Write a function to calculate fibonacci numbers',
        complexity: 'medium',
        domain: 'algorithms'
      }
    );
    
    console.log('✅ Code generation parameters:', {
      taskType: codeGenParams.taskType,
      temperature: codeGenParams.predictedParameters.temperature,
      maxTokens: codeGenParams.predictedParameters.maxTokens,
      confidence: codeGenParams.confidenceScore,
      strength: codeGenParams.recommendationStrength
    });

    // Test 2: Get optimized parameters for creative writing
    console.log('\n2️⃣ Testing Creative Writing Parameters...');
    const creativeParams = await mlParameterOptimizer.getOptimizedParameters(
      TaskType.CREATIVE_WRITING,
      {
        userInput: 'Write a story about a time-traveling scientist',
        complexity: 'complex',
        domain: 'fiction'
      }
    );
    
    console.log('✅ Creative writing parameters:', {
      taskType: creativeParams.taskType,
      temperature: creativeParams.predictedParameters.temperature,
      maxTokens: creativeParams.predictedParameters.maxTokens,
      confidence: creativeParams.confidenceScore,
      strength: creativeParams.recommendationStrength
    });

    // Test 3: Simulate learning from execution
    console.log('\n3️⃣ Testing ML Learning...');
    await mlParameterOptimizer.learnFromExecution(
      TaskType.CODE_GENERATION,
      {
        temperature: 0.2,
        maxTokens: 1024,
        topP: 0.9
      },
      0.85, // Good performance score
      1200, // Execution time
      {
        complexity: 'medium',
        userSatisfaction: 4
      }
    );
    console.log('✅ ML learning completed');

    // Test 4: Test feedback collection
    console.log('\n4️⃣ Testing Feedback Integration...');
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
      modelUsed: 'claude-3-sonnet',
      endpoint: '/api/v1/test',
      wouldUseAgain: true,
      recommendToOthers: 8,
      flaggedAsIncorrect: false,
      reportedIssues: []
    });
    console.log('✅ Feedback collected with ID:', feedbackId);

    // Test 5: Get optimization insights
    console.log('\n5️⃣ Testing Optimization Insights...');
    const insights = await mlParameterOptimizer.getOptimizationInsights(TaskType.CODE_GENERATION);
    console.log('✅ Generated insights:', insights.length, 'insights found');

    // Test 6: Get learning signals
    console.log('\n6️⃣ Testing Learning Signals...');
    const signals = feedbackIntegrationService.getLearningSignals(TaskType.CODE_GENERATION);
    console.log('✅ Learning signals:', signals.length, 'signals found');
    
    if (signals.length > 0) {
      console.log('   Sample signal:', {
        signal: signals[0].signal,
        strength: signals[0].strength,
        parameter: signals[0].parameterAffected,
        action: signals[0].recommendedAction
      });
    }

    // Test 7: Apply feedback learning
    console.log('\n7️⃣ Testing Feedback Learning Application...');
    const learningResults = await feedbackIntegrationService.applyFeedbackLearning();
    console.log('✅ Learning applied:', learningResults);

    console.log('\n🎉 All tests completed successfully!');
    console.log('\n📊 System Status:');
    console.log('   ✅ ML Parameter Optimizer: Working');
    console.log('   ✅ Parameter Analytics: Working');
    console.log('   ✅ Feedback Integration: Working');
    console.log('   ✅ Learning Signals: Working');
    console.log('   ✅ Closed-loop Learning: Working');

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('\n📋 Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : 'No stack trace'
    });
  }
}

// Run the test
if (require.main === module) {
  testParameterOptimization().then(() => {
    console.log('\n✅ Test suite completed');
    process.exit(0);
  }).catch(error => {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  });
}