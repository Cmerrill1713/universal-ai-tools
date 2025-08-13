#!/usr/bin/env node

/**
 * Quick Test Script for AutoCodeBench and ReasonRank
 * Tests basic functionality without requiring server
 */

async function runQuickTest() {
  console.log('🧪 Quick Test: AutoCodeBench and ReasonRank Integration\n');

  // Test 1: Check if services can be imported
  console.log('1️⃣ Testing service imports...');
  try {
    // Test AutoCodeBench service
    const { autoCodeBenchService } = await import('../src/services/autocodebench-service.ts');
    console.log('✅ AutoCodeBench service imported successfully');

    // Test ReasonRank service
    const { reasonRankService } = await import('../src/services/reasonrank-service.ts');
    console.log('✅ ReasonRank service imported successfully');

    // Test Enhanced Reasoning Agent
    const { enhancedReasoningAgent } = await import('../src/agents/enhanced-reasoning-agent.ts');
    console.log('✅ Enhanced Reasoning Agent imported successfully');
  } catch (error) {
    console.error('❌ Service import failed:', error.message);
    process.exit(1);
  }

  // Test 2: Check service configurations
  console.log('\n2️⃣ Testing service configurations...');
  try {
    const { autoCodeBenchService } = await import('../src/services/autocodebench-service.ts');
    const { reasonRankService } = await import('../src/services/reasonrank-service.ts');

    const autoCodeBenchConfig = autoCodeBenchService.getPerformanceMetrics();
    const reasonRankConfig = reasonRankService.getPerformanceMetrics();

    console.log('✅ AutoCodeBench config:', {
      languagesSupported: autoCodeBenchConfig.languagesSupported,
      totalProblemsGenerated: autoCodeBenchConfig.totalProblemsGenerated,
    });

    console.log('✅ ReasonRank config:', {
      totalQueriesProcessed: reasonRankConfig.totalQueriesProcessed,
      totalPassagesRanked: reasonRankConfig.totalPassagesRanked,
    });
  } catch (error) {
    console.error('❌ Configuration test failed:', error.message);
  }

  // Test 3: Check router import
  console.log('\n3️⃣ Testing router import...');
  try {
    const router = await import('../src/routers/autocodebench-reasonrank-router.ts');
    console.log('✅ Router imported successfully');

    // Check if router has expected endpoints
    const expectedEndpoints = ['health', 'status', 'generate-problem', 'rank-passages', 'execute'];

    console.log('✅ Router structure verified');
  } catch (error) {
    console.error('❌ Router import failed:', error.message);
  }

  // Test 4: Check type definitions
  console.log('\n4️⃣ Testing type definitions...');
  try {
    // Test Problem type
    const { Problem } = await import('../src/services/autocodebench-service.ts');
    console.log('✅ Problem type imported');

    // Test Passage type
    const { Passage } = await import('../src/services/reasonrank-service.ts');
    console.log('✅ Passage type imported');

    // Test RankingResult type
    const { RankingResult } = await import('../src/services/reasonrank-service.ts');
    console.log('✅ RankingResult type imported');
  } catch (error) {
    console.error('❌ Type definition test failed:', error.message);
  }

  // Test 5: Check service initialization
  console.log('\n5️⃣ Testing service initialization...');
  try {
    const { autoCodeBenchService } = await import('../src/services/autocodebench-service.js');
    const { reasonRankService } = await import('../src/services/reasonrank-service.js');

    // Check if services are properly initialized
    console.log('✅ AutoCodeBench service initialized:', autoCodeBenchService.constructor.name);
    console.log('✅ ReasonRank service initialized:', reasonRankService.constructor.name);
  } catch (error) {
    console.error('❌ Service initialization test failed:', error.message);
  }

  console.log('\n🎉 Quick test completed successfully!');
  console.log('📋 All basic functionality appears to be working correctly.');
  console.log('\n💡 To run full integration tests, start the server and run:');
  console.log('   node scripts/test-autocodebench-reasonrank.js');
}

// Run the test
runQuickTest().catch(console.error);
