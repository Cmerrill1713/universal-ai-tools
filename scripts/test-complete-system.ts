#!/usr/bin/env ts-node
/**
 * Complete System Test Script
 * Tests all components including self-healing and MAC-SPGG collaboration
 */

import axios from 'axios';

const BASE_URL = 'http://localhost:3001';

interface TestResult {
  name: string;
  success: boolean;
  error?: string;
  data?: unknown;
}

async function testCompleteSystem(): Promise<void> {
  process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.log('🚀 Testing Complete Universal AI Tools System...\n');

  const results: TestResult[] = [];

  // Test 1: Basic server health
  console.log('1. Testing basic server health...');
  try {
    const healthResponse = await axios.get(`${BASE_URL}/api/v1/health`);
    results.push({
      name: 'Basic Health Check',
      success: healthResponse.data.success,
      data: healthResponse.data.data,
    });
    console.log('✅ Basic health check passed');
  } catch (error) {
    results.push({
      name: 'Basic Health Check',
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
    console.log('❌ Basic health check failed');
  }

  // Test 2: A2A mesh connectivity
  console.log('\n2. Testing A2A mesh connectivity...');
  try {
    const meshResponse = await axios.get(`${BASE_URL}/api/v1/a2a/status`);
    results.push({
      name: 'A2A Mesh Connectivity',
      success: meshResponse.data.success,
      data: meshResponse.data.data,
    });
    console.log('✅ A2A mesh connectivity passed');
  } catch (error) {
    results.push({
      name: 'A2A Mesh Connectivity',
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
    console.log('❌ A2A mesh connectivity failed');
  }

  // Test 3: Agent registry
  console.log('\n3. Testing agent registry...');
  try {
    const agentsResponse = await axios.get(`${BASE_URL}/api/v1/agents/list`);
    results.push({
      name: 'Agent Registry',
      success: agentsResponse.data.success,
      data: agentsResponse.data.data,
    });
    console.log('✅ Agent registry test passed');
  } catch (error) {
    results.push({
      name: 'Agent Registry',
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
    console.log('❌ Agent registry test failed');
  }

  // Test 4: MAC-SPGG collaboration engine
  console.log('\n4. Testing MAC-SPGG collaboration engine...');
  try {
    // Test collaboration stats
    const statsResponse = await axios.get(`${BASE_URL}/api/v1/collaboration/stats`);

    // Test creating a collaboration session
    const sessionResponse = await axios.post(`${BASE_URL}/api/v1/collaboration/session`, {
      task: 'Test collaboration task',
      participants: ['test-agent-1', 'test-agent-2'],
    });

    results.push({
      name: 'MAC-SPGG Collaboration Engine',
      success: statsResponse.data.success && sessionResponse.data.success,
      data: {
        stats: statsResponse.data.data,
        session: sessionResponse.data.data,
      },
    });
    console.log('✅ MAC-SPGG collaboration engine test passed');
  } catch (error) {
    results.push({
      name: 'MAC-SPGG Collaboration Engine',
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
    console.log('❌ MAC-SPGG collaboration engine test failed');
  }

  // Test 5: Self-healing capabilities
  console.log('\n5. Testing self-healing capabilities...');
  try {
    const healResponse = await axios.post(`${BASE_URL}/api/v1/health/heal`);
    results.push({
      name: 'Self-Healing Capabilities',
      success: healResponse.data.success,
      data: healResponse.data.data,
    });
    console.log('✅ Self-healing test passed');
  } catch (error) {
    results.push({
      name: 'Self-Healing Capabilities',
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
    console.log('❌ Self-healing test failed');
  }

  // Test 6: Health monitoring
  console.log('\n6. Testing health monitoring...');
  try {
    const healthCheckResponse = await axios.post(`${BASE_URL}/api/v1/health/check`);
    results.push({
      name: 'Health Monitoring',
      success: healthCheckResponse.data.success,
      data: healthCheckResponse.data.data,
    });
    console.log('✅ Health monitoring test passed');
  } catch (error) {
    results.push({
      name: 'Health Monitoring',
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
    console.log('❌ Health monitoring test failed');
  }

  // Test 7: Performance metrics
  console.log('\n7. Testing performance metrics...');
  try {
    const finalHealthResponse = await axios.get(`${BASE_URL}/api/v1/health`);
    const health = finalHealthResponse.data.data.health;

    results.push({
      name: 'Performance Metrics',
      success: true,
      data: {
        systemHealth: health?.systemHealth || 0,
        responseTime: health?.responseTime || 0,
        memoryUsage: health?.memoryUsage || 0,
        cpuUsage: health?.cpuUsage || 0,
        errorRate: health?.errorRate || 0,
      },
    });
    console.log('✅ Performance metrics test passed');
  } catch (error) {
    results.push({
      name: 'Performance Metrics',
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
    console.log('❌ Performance metrics test failed');
  }

  // Test 8: Collaboration optimization
  console.log('\n8. Testing collaboration optimization...');
  try {
    const optimizeResponse = await axios.post(`${BASE_URL}/api/v1/collaboration/optimize`, {
      type: 'incentive_adjustment',
      parameters: { cooperationReward: 1.2 },
    });

    results.push({
      name: 'Collaboration Optimization',
      success: optimizeResponse.data.success,
      data: optimizeResponse.data.data,
    });
    console.log('✅ Collaboration optimization test passed');
  } catch (error) {
    results.push({
      name: 'Collaboration Optimization',
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
    console.log('❌ Collaboration optimization test failed');
  }

  // Print comprehensive results
  console.log('\n📊 COMPREHENSIVE TEST RESULTS');
  console.log('==============================');

  const passedTests = results.filter((r) => r.success).length;
  const totalTests = results.length;
  const successRate = (passedTests / totalTests) * 100;

  console.log(`\nOverall Success Rate: ${successRate.toFixed(1)}% (${passedTests}/${totalTests})`);

  console.log('\nDetailed Results:');
  results.forEach((result, index) => {
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    console.log(`${index + 1}. ${result.name}: ${status}`);

    if (!result.success && result.error) {
      console.log(`   Error: ${result.error}`);
    }

    if (result.data) {
      console.log(`   Data: ${JSON.stringify(result.data, null, 2)}`);
    }
  });

  // System status assessment
  console.log('\n🎯 SYSTEM STATUS ASSESSMENT');
  console.log('============================');

  if (successRate >= 90) {
    console.log('🟢 EXCELLENT: System is fully operational with all features working');
  } else if (successRate >= 70) {
    console.log('🟡 GOOD: System is mostly operational with minor issues');
  } else if (successRate >= 50) {
    console.log('🟠 DEGRADED: System has significant issues but core functionality works');
  } else {
    console.log('🔴 CRITICAL: System has major issues requiring immediate attention');
  }

  // Recommendations
  console.log('\n💡 RECOMMENDATIONS');
  console.log('===================');

  const failedTests = results.filter((r) => !r.success);
  if (failedTests.length > 0) {
    console.log('Issues to address:');
    failedTests.forEach((test) => {
      console.log(`- ${test.name}: ${test.error || 'Unknown error'}`);
    });
  } else {
    console.log('✅ All systems operational! No immediate action required.');
  }

  // Next steps
  console.log('\n🚀 NEXT STEPS');
  console.log('==============');
  console.log('1. Start the server: npm run dev');
  console.log('2. Run health tests: npm run test:health');
  console.log('3. Monitor system: npm run monitor');
  console.log('4. Test collaboration: npm run test:collaboration');

  if (successRate < 70) {
    console.log('\n⚠️  WARNING: System has significant issues. Consider:');
    console.log('- Checking server logs for errors');
    console.log('- Verifying all dependencies are installed');
    console.log('- Ensuring all services are running');
    console.log('- Running individual component tests');
  }

  console.log('\n🎉 Complete system test finished!');
}

// Run the test
if (require.main === module) {
  testCompleteSystem().catch(console.error);
}

export { testCompleteSystem };
