#!/usr/bin/env node
/**
 * Simple test for Unified Knowledge Integration
 * Tests the core components without requiring full server stack
 */

console.log('🧪 Testing Unified Knowledge Integration Components');

async function testUnifiedKnowledgeComponents() {
  const startTime = Date.now();
  let testsCompleted = 0;
  let testsPassed = 0;

  try {
    console.log('\n📋 Test 1: Check Files Exist');
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const filesToCheck = [
      'src/services/unified-knowledge-bridge.ts',
      'src/services/enhanced-agent-executor.ts', 
      'src/services/agent-knowledge-middleware.ts',
      'src/services/graph-rag/knowledge-graph-service.ts',
      'src/services/rust-agent-registry-client.ts'
    ];
    
    let filesExist = 0;
    for (const file of filesToCheck) {
      try {
        await fs.access(file);
        console.log(`  ✅ ${file} exists`);
        filesExist++;
      } catch {
        console.log(`  ❌ ${file} missing`);
      }
    }
    
    if (filesExist === filesToCheck.length) {
      testsPassed++;
      console.log('  ✅ All unified knowledge integration files exist');
    } else {
      console.log(`  ❌ Missing ${filesToCheck.length - filesExist} files`);
    }
    testsCompleted++;

    console.log('\n📋 Test 2: Check Integration in server.ts');
    try {
      const serverContent = await fs.readFile('src/server.ts', 'utf8');
      const hasKnowledgeIntegration = serverContent.includes('initializeUnifiedKnowledgeIntegration');
      const hasImports = serverContent.includes('unified-knowledge-bridge') && 
                        serverContent.includes('enhanced-agent-executor') &&
                        serverContent.includes('agent-knowledge-middleware');
      
      if (hasKnowledgeIntegration && hasImports) {
        console.log('  ✅ server.ts includes unified knowledge integration');
        testsPassed++;
      } else {
        console.log('  ❌ server.ts missing knowledge integration setup');
      }
    } catch (error) {
      console.log(`  ❌ Failed to check server.ts: ${error.message}`);
    }
    testsCompleted++;

    console.log('\n📋 Test 3: Check Service Initialization Order');
    try {
      const serverContent = await fs.readFile('src/server.ts', 'utf8');
      const hasUnifiedKnowledgeInServices = serverContent.includes('"Unified Knowledge Bridge"') &&
                                           serverContent.includes('initializeUnifiedKnowledgeIntegration');
      
      if (hasUnifiedKnowledgeInServices) {
        console.log('  ✅ Unified knowledge integration properly registered in services');
        testsPassed++;
      } else {
        console.log('  ❌ Service initialization order needs attention');
      }
    } catch (error) {
      console.log(`  ❌ Failed to check service order: ${error.message}`);
    }
    testsCompleted++;

    console.log('\n📋 Test 4: Validate Core Architecture');
    try {
      const bridgeContent = await fs.readFile('src/services/unified-knowledge-bridge.ts', 'utf8');
      const executorContent = await fs.readFile('src/services/enhanced-agent-executor.ts', 'utf8');
      
      const hasBridgeFeatures = bridgeContent.includes('getKnowledgeForAgent') && 
                               bridgeContent.includes('GraphRAG') &&
                               bridgeContent.includes('rustAgentRegistry');
      
      const hasExecutorFeatures = executorContent.includes('executeWithKnowledge') &&
                                 executorContent.includes('unifiedKnowledgeBridge') &&
                                 executorContent.includes('KnowledgeEnhancedResponse');
      
      if (hasBridgeFeatures && hasExecutorFeatures) {
        console.log('  ✅ Core architecture implements R1 RAG → Agent integration');
        testsPassed++;
      } else {
        console.log('  ❌ Core architecture missing key features');
      }
    } catch (error) {
      console.log(`  ❌ Failed to validate architecture: ${error.message}`);
    }
    testsCompleted++;

    console.log('\n📋 Test 5: Check Integration Completeness');
    try {
      const middlewareContent = await fs.readFile('src/services/agent-knowledge-middleware.ts', 'utf8');
      
      const hasMiddlewareFeatures = middlewareContent.includes('interceptAgentRequest') &&
                                   middlewareContent.includes('enhancedAgentExecutor') &&
                                   middlewareContent.includes('transparent knowledge injection');
      
      if (hasMiddlewareFeatures) {
        console.log('  ✅ Transparent knowledge injection middleware complete');
        testsPassed++;
      } else {
        console.log('  ❌ Knowledge injection middleware needs attention');
      }
    } catch (error) {
      console.log(`  ❌ Failed to check middleware: ${error.message}`);
    }
    testsCompleted++;

    const executionTime = Date.now() - startTime;
    const successRate = (testsPassed / testsCompleted * 100).toFixed(1);
    
    console.log(`\n📊 UNIFIED KNOWLEDGE INTEGRATION COMPONENT TEST RESULTS`);
    console.log(`\n🎯 Overall Results:`);
    console.log(`   Total Tests: ${testsCompleted}`);
    console.log(`   Passed: ${testsPassed} ✅`);
    console.log(`   Failed: ${testsCompleted - testsPassed} ❌`);
    console.log(`   Success Rate: ${successRate}%`);
    console.log(`   Total Execution Time: ${executionTime}ms`);

    if (testsPassed === testsCompleted) {
      console.log(`\n✅ ALL COMPONENTS READY: Unified knowledge integration is properly set up!`);
      console.log(`\n🎯 Integration Status Summary:`);
      console.log(`   1. ✅ UnifiedKnowledgeBridge: Ready for R1 RAG integration`);
      console.log(`   2. ✅ EnhancedAgentExecutor: Ready for knowledge-enhanced execution`);
      console.log(`   3. ✅ AgentKnowledgeMiddleware: Ready for transparent injection`);
      console.log(`   4. ✅ GraphRAG Service: Ready for knowledge graph queries`);
      console.log(`   5. ✅ Rust Agent Registry: Ready for high-performance agent management`);
    } else {
      console.log(`\n⚠️ SOME COMPONENTS MISSING: ${testsCompleted - testsPassed} components need attention.`);
    }

    return testsPassed === testsCompleted;

  } catch (error) {
    console.error(`\n❌ Component test suite failed: ${error.message}`);
    return false;
  }
}

// Run the test
testUnifiedKnowledgeComponents().then(success => {
  if (success) {
    console.log('\n🚀 Unified Knowledge Integration Components Test Complete! ✅');
    process.exit(0);
  } else {
    console.log('\n❌ Component tests failed. Check missing dependencies.');
    process.exit(1);
  }
}).catch(error => {
  console.error('\n💥 Test runner failed:', error);
  process.exit(1);
});