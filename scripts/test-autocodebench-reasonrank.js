#!/usr/bin/env node

/**
 * Test Script for AutoCodeBench and ReasonRank Integration
 * Tests all major functionality of the new services
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api/v1/autocodebench-reasonrank';

// Test data
const testPassages = [
  {
    id: 'passage_1',
    content:
      'Python is a high-level programming language known for its simplicity and readability. It supports multiple programming paradigms including procedural, object-oriented, and functional programming.',
    metadata: { language: 'python', category: 'programming' },
    source: 'documentation',
  },
  {
    id: 'passage_2',
    content:
      'JavaScript is a programming language that is one of the core technologies of the World Wide Web. It enables interactive web pages and is an essential part of web applications.',
    metadata: { language: 'javascript', category: 'web' },
    source: 'documentation',
  },
  {
    id: 'passage_3',
    content:
      'Machine learning is a subset of artificial intelligence that focuses on algorithms and statistical models that enable computers to perform tasks without explicit instructions.',
    metadata: { language: 'general', category: 'ai' },
    source: 'documentation',
  },
];

const testQueries = [
  'How to implement a binary search algorithm?',
  'What are the best practices for web security?',
  'How to optimize database queries for performance?',
];

const testCode = `
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)

# Test the function
result = fibonacci(10)
print(f"Fibonacci of 10 is: {result}")
`;

async function testHealthCheck() {
  process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.log('🏥 Testing health check...');
  try {
    const response = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Health check passed:', response.data);
    return true;
  } catch (error) {
    process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.error('❌ Health check failed:', error.message);
    return false;
  }
}

async function testSystemStatus() {
  console.log('\n📊 Testing system status...');
  try {
    const response = await axios.get(`${BASE_URL}/status`);
    console.log('✅ System status retrieved:', {
      services: Object.keys(response.data.data.services),
      uptime: response.data.data.system.uptime,
    });
    return true;
  } catch (error) {
    console.error('❌ System status failed:', error.message);
    return false;
  }
}

async function testAutoCodeBenchGenerateProblem() {
  console.log('\n🚀 Testing AutoCodeBench problem generation...');
  try {
    const response = await axios.post(`${BASE_URL}/generate-problem`, {
      language: 'python',
      difficulty: 'medium',
      category: 'algorithms',
      complexity: 'single',
    });

    console.log('✅ Problem generated successfully:', {
      id: response.data.data.id,
      language: response.data.data.language,
      difficulty: response.data.data.difficulty,
      category: response.data.data.category,
    });
    return response.data.data;
  } catch (error) {
    console.error('❌ Problem generation failed:', error.message);
    return null;
  }
}

async function testAutoCodeBenchExecuteCode() {
  console.log('\n🔒 Testing AutoCodeBench code execution...');
  try {
    const testCases = [
      { input: '5', expectedOutput: '5' },
      { input: '10', expectedOutput: '55' },
    ];

    const response = await axios.post(`${BASE_URL}/execute-code`, {
      code: testCode,
      language: 'python',
      testCases,
      timeout: 30000,
    });

    console.log('✅ Code execution completed:', {
      totalTests: response.data.data.summary.totalTests,
      passedTests: response.data.data.summary.passedTests,
      successRate: response.data.data.summary.successRate,
    });
    return response.data.data;
  } catch (error) {
    console.error('❌ Code execution failed:', error.message);
    return null;
  }
}

async function testReasonRankPassageRanking() {
  console.log('\n📊 Testing ReasonRank passage ranking...');
  try {
    const response = await axios.post(`${BASE_URL}/rank-passages`, {
      query: 'How to implement efficient algorithms in Python?',
      passages: testPassages,
      topK: 3,
      domain: 'coding',
      complexity: 'moderate',
    });

    console.log('✅ Passage ranking completed:', {
      totalPassages: response.data.data.summary.totalPassages,
      rankedPassages: response.data.data.summary.rankedPassages,
      topResult: response.data.data.results[0]?.content.substring(0, 100) + '...',
    });
    return response.data.data;
  } catch (error) {
    console.error('❌ Passage ranking failed:', error.message);
    return null;
  }
}

async function testReasonRankTrainingDataGeneration() {
  console.log('\n📚 Testing ReasonRank training data generation...');
  try {
    const response = await axios.post(`${BASE_URL}/generate-training-data`, {
      queries: testQueries,
      passages: testPassages,
      domain: 'coding',
      complexity: 'moderate',
      maxExamples: 3,
    });

    console.log('✅ Training data generated:', {
      generatedExamples: response.data.data.summary.generatedExamples,
      totalQueries: response.data.data.summary.totalQueries,
      totalPassages: response.data.data.summary.totalPassages,
    });
    return response.data.data;
  } catch (error) {
    console.error('❌ Training data generation failed:', error.message);
    return null;
  }
}

async function testEnhancedReasoningAgent() {
  console.log('\n🧠 Testing Enhanced Reasoning Agent...');
  try {
    const response = await axios.post(`${BASE_URL}/execute`, {
      query: 'Generate a Python function to calculate the factorial of a number',
      context: 'I need this for a mathematical computation project',
      capabilities: ['code_generation', 'problem_solving'],
    });

    console.log('✅ Reasoning agent executed successfully:', {
      success: response.data.success,
      agent: response.data.metadata.agent,
      capabilities: response.data.metadata.capabilities,
    });
    return response.data;
  } catch (error) {
    console.error('❌ Reasoning agent failed:', error.message);
    return null;
  }
}

async function testCodeAnalysis() {
  console.log('\n🔍 Testing code analysis...');
  try {
    const response = await axios.post(`${BASE_URL}/analyze-code`, {
      code: testCode,
      language: 'python',
      context: 'This is a recursive Fibonacci implementation',
    });

    console.log('✅ Code analysis completed:', {
      success: response.data.success,
      language: response.data.metadata.language,
    });
    return response.data;
  } catch (error) {
    console.error('❌ Code analysis failed:', error.message);
    return null;
  }
}

async function testCodeImprovement() {
  console.log('\n✨ Testing code improvement...');
  try {
    const response = await axios.post(`${BASE_URL}/improve-code`, {
      code: testCode,
      language: 'python',
      focus: 'performance',
    });

    console.log('✅ Code improvement completed:', {
      success: response.data.success,
      language: response.data.metadata.language,
      focus: response.data.metadata.focus,
    });
    return response.data;
  } catch (error) {
    console.error('❌ Code improvement failed:', error.message);
    return null;
  }
}

async function testTestGeneration() {
  console.log('\n🧪 Testing automated test generation...');
  try {
    const response = await axios.post(`${BASE_URL}/generate-tests`, {
      code: testCode,
      language: 'python',
      testType: 'comprehensive',
    });

    console.log('✅ Test generation completed:', {
      success: response.data.success,
      language: response.data.metadata.language,
      testType: response.data.metadata.testType,
    });
    return response.data;
  } catch (error) {
    console.error('❌ Test generation failed:', error.message);
    return null;
  }
}

async function testReasoningExplanation() {
  console.log('\n💭 Testing reasoning explanation...');
  try {
    const response = await axios.post(`${BASE_URL}/explain-reasoning`, {
      query: 'Why is recursion sometimes better than iteration?',
      context: 'Understanding algorithm design principles',
      approach: 'detailed',
    });

    console.log('✅ Reasoning explanation completed:', {
      success: response.data.success,
      approach: response.data.metadata.approach,
    });
    return response.data;
  } catch (error) {
    console.error('❌ Reasoning explanation failed:', error.message);
    return null;
  }
}

async function testMetrics() {
  console.log('\n📈 Testing metrics retrieval...');
  try {
    // Test AutoCodeBench metrics
    const autoCodeBenchMetrics = await axios.get(`${BASE_URL}/metrics`);
    console.log('✅ AutoCodeBench metrics:', {
      totalProblemsGenerated: autoCodeBenchMetrics.data.data.totalProblemsGenerated,
      totalTestsExecuted: autoCodeBenchMetrics.data.data.totalTestsExecuted,
      successRate: autoCodeBenchMetrics.data.data.successRate,
    });

    // Test ReasonRank metrics
    const reasonRankMetrics = await axios.get(`${BASE_URL}/metrics`);
    console.log('✅ ReasonRank metrics:', {
      totalQueriesProcessed: reasonRankMetrics.data.data.totalQueriesProcessed,
      totalPassagesRanked: reasonRankMetrics.data.data.totalPassagesRanked,
      averageRankingTime: reasonRankMetrics.data.data.averageRankingTime,
    });

    return true;
  } catch (error) {
    console.error('❌ Metrics retrieval failed:', error.message);
    return false;
  }
}

async function testAgentCapabilities() {
  console.log('\n🔧 Testing agent capabilities...');
  try {
    const response = await axios.get(`${BASE_URL}/capabilities`);

    console.log('✅ Agent capabilities retrieved:', {
      name: response.data.data.agent.name,
      description: response.data.data.agent.description,
      capabilities: response.data.data.agent.capabilities,
      totalReasoningTasks: response.data.data.status.totalReasoningTasks,
    });
    return response.data;
  } catch (error) {
    console.error('❌ Agent capabilities failed:', error.message);
    return null;
  }
}

async function runAllTests() {
  console.log('🧪 Starting AutoCodeBench and ReasonRank Integration Tests\n');
  console.log('='.repeat(60));

  const results = {
    healthCheck: false,
    systemStatus: false,
    autoCodeBenchGenerateProblem: false,
    autoCodeBenchExecuteCode: false,
    reasonRankPassageRanking: false,
    reasonRankTrainingDataGeneration: false,
    enhancedReasoningAgent: false,
    codeAnalysis: false,
    codeImprovement: false,
    testGeneration: false,
    reasoningExplanation: false,
    metrics: false,
    agentCapabilities: false,
  };

  try {
    // Basic functionality tests
    results.healthCheck = await testHealthCheck();
    results.systemStatus = await testSystemStatus();

    // AutoCodeBench tests
    results.autoCodeBenchGenerateProblem = await testAutoCodeBenchGenerateProblem();
    results.autoCodeBenchExecuteCode = await testAutoCodeBenchExecuteCode();

    // ReasonRank tests
    results.reasonRankPassageRanking = await testReasonRankPassageRanking();
    results.reasonRankTrainingDataGeneration = await testReasonRankTrainingDataGeneration();

    // Enhanced Reasoning Agent tests
    results.enhancedReasoningAgent = await testEnhancedReasoningAgent();
    results.codeAnalysis = await testCodeAnalysis();
    results.codeImprovement = await testCodeImprovement();
    results.testGeneration = await testTestGeneration();
    results.reasoningExplanation = await testReasoningExplanation();

    // Metrics and capabilities tests
    results.metrics = await testMetrics();
    results.agentCapabilities = await testAgentCapabilities();
  } catch (error) {
    console.error('❌ Test execution failed:', error.message);
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📋 TEST SUMMARY');
  console.log('='.repeat(60));

  const passedTests = Object.values(results).filter(Boolean).length;
  const totalTests = Object.keys(results).length;

  Object.entries(results).forEach(([testName, result]) => {
    const status = result ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${testName}`);
  });

  console.log('\n' + '='.repeat(60));
  console.log(`🎯 Overall Result: ${passedTests}/${totalTests} tests passed`);
  console.log(`📊 Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

  if (passedTests === totalTests) {
    console.log(
      '🎉 All tests passed! AutoCodeBench and ReasonRank integration is working correctly.'
    );
  } else {
    console.log('⚠️  Some tests failed. Please check the error messages above.');
  }

  return results;
}

// Run tests if this script is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  runAllTests,
  testHealthCheck,
  testSystemStatus,
  testAutoCodeBenchGenerateProblem,
  testAutoCodeBenchExecuteCode,
  testReasonRankPassageRanking,
  testReasonRankTrainingDataGeneration,
  testEnhancedReasoningAgent,
  testCodeAnalysis,
  testCodeImprovement,
  testTestGeneration,
  testReasoningExplanation,
  testMetrics,
  testAgentCapabilities,
};
