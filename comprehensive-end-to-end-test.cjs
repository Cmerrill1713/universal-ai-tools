#!/usr/bin/env node
/**
 * Comprehensive End-to-End System Test
 * Tests all major components and integrations for production readiness
 */

const axios = require('axios');

const BACKEND_URL = 'http://localhost:9999';

async function comprehensiveEndToEndTest() {
  console.log('🚀 COMPREHENSIVE END-TO-END SYSTEM TEST');
  console.log('=' .repeat(60));
  
  const testResults = {
    core: { passed: 0, total: 0, errors: [] },
    validation: { passed: 0, total: 0, errors: [] },
    ai: { passed: 0, total: 0, errors: [] },
    agents: { passed: 0, total: 0, errors: [] },
    memory: { passed: 0, total: 0, errors: [] },
    integration: { passed: 0, total: 0, errors: [] }
  };

  try {
    console.log('\n🏥 1. CORE SYSTEM HEALTH CHECKS');
    console.log('-'.repeat(40));
    
    // Test 1: Health endpoint
    testResults.core.total++;
    try {
      const healthResponse = await axios.get(`${BACKEND_URL}/api/v1/monitoring/health`, { timeout: 5000 });
      if (healthResponse.data.success) {
        testResults.core.passed++;
        console.log('✅ Health endpoint responding');
      } else {
        console.log('❌ Health endpoint unhealthy');
        testResults.core.errors.push('Health endpoint returned unhealthy status');
      }
    } catch (error) {
      console.log('❌ Health endpoint failed');
      testResults.core.errors.push(`Health endpoint error: ${error.message}`);
    }

    // Test 2: System metrics
    testResults.core.total++;
    try {
      const metricsResponse = await axios.get(`${BACKEND_URL}/api/v1/monitoring/metrics`, { timeout: 5000 });
      if (metricsResponse.data.timestamp) {
        testResults.core.passed++;
        console.log('✅ System metrics available');
      } else {
        console.log('❌ System metrics failed');
        testResults.core.errors.push('System metrics not available');
      }
    } catch (error) {
      console.log('❌ System metrics failed');
      testResults.core.errors.push(`System metrics error: ${error.message}`);
    }

    // Test 3: Agent registry status
    testResults.core.total++;
    try {
      const agentsResponse = await axios.get(`${BACKEND_URL}/api/v1/agents`, { timeout: 5000 });
      if (agentsResponse.data.success && agentsResponse.data.data && agentsResponse.data.data.agents.length > 0) {
        testResults.core.passed++;
        console.log(`✅ Agent registry active (${agentsResponse.data.data.agents.length} agents)`);
      } else {
        console.log('❌ Agent registry empty');
        testResults.core.errors.push('No agents available in registry');
      }
    } catch (error) {
      console.log('❌ Agent registry failed');
      testResults.core.errors.push(`Agent registry error: ${error.message}`);
    }

    console.log('\n🛡️ 2. MEMORY VALIDATION SYSTEM');
    console.log('-'.repeat(40));
    
    // Test 4: Validation rules active
    testResults.validation.total++;
    try {
      const statsResponse = await axios.get(`${BACKEND_URL}/api/v1/memory/validation/stats`, { timeout: 5000 });
      if (statsResponse.data.success && statsResponse.data.data.rules >= 10) {
        testResults.validation.passed++;
        console.log(`✅ Validation system active (${statsResponse.data.data.rules} rules)`);
      } else {
        console.log('❌ Validation system inactive');
        testResults.validation.errors.push('Insufficient validation rules active');
      }
    } catch (error) {
      console.log('❌ Validation system failed');
      testResults.validation.errors.push(`Validation system error: ${error.message}`);
    }

    // Test 5: PII protection
    testResults.validation.total++;
    try {
      await axios.post(`${BACKEND_URL}/api/v1/memory`, {
        content: "Test PII data: SSN 123-45-6789, email test@example.com",
        type: "knowledge",
        metadata: { source: "test" },
        importance: 0.5
      }, { timeout: 5000 });
      console.log('❌ PII protection failed - data was stored');
      testResults.validation.errors.push('PII data was not blocked');
    } catch (error) {
      if (error.response && error.response.status === 400) {
        testResults.validation.passed++;
        console.log('✅ PII protection active - blocked sensitive data');
      } else {
        console.log('❌ PII protection error');
        testResults.validation.errors.push(`PII protection error: ${error.message}`);
      }
    }

    // Test 6: Auto-fix functionality
    testResults.validation.total++;
    try {
      const autoFixResponse = await axios.post(`${BACKEND_URL}/api/v1/memory`, {
        content: "Valid content for testing auto-fix functionality with memory validation system",
        type: "knowledge",
        metadata: { source: "auto_fix_test" },
        tags: ["testing", "auto_fix"],
        importance: 0.7,
        autoFix: true
      }, { timeout: 5000 });
      
      if (autoFixResponse.data.success) {
        testResults.validation.passed++;
        console.log('✅ Auto-fix functionality working');
      } else {
        console.log('❌ Auto-fix functionality failed');
        testResults.validation.errors.push('Auto-fix did not work as expected');
      }
    } catch (error) {
      console.log('❌ Auto-fix functionality error');
      testResults.validation.errors.push(`Auto-fix error: ${error.message}`);
    }

    console.log('\n🧠 3. AI SERVICES INTEGRATION');
    console.log('-'.repeat(40));
    
    // Test 7: Conversation API
    testResults.ai.total++;
    try {
      const conversationResponse = await axios.post(`${BACKEND_URL}/api/v1/conversation`, {
        message: "Test message for AI conversation system",
        sessionId: "end-to-end-test"
      }, { timeout: 10000 });
      
      if (conversationResponse.data.success) {
        testResults.ai.passed++;
        console.log('✅ AI conversation system working');
      } else {
        console.log('❌ AI conversation system failed');
        testResults.ai.errors.push('AI conversation did not respond properly');
      }
    } catch (error) {
      console.log('❌ AI conversation system error');
      testResults.ai.errors.push(`AI conversation error: ${error.message}`);
    }

    // Test 8: MLX service
    testResults.ai.total++;
    try {
      const mlxResponse = await axios.get(`${BACKEND_URL}/api/v1/mlx/status`, { timeout: 5000 });
      if (mlxResponse.data.success) {
        testResults.ai.passed++;
        console.log('✅ MLX service available');
      } else {
        console.log('❌ MLX service unavailable');
        testResults.ai.errors.push('MLX service not responding');
      }
    } catch (error) {
      console.log('❌ MLX service error');
      testResults.ai.errors.push(`MLX service error: ${error.message}`);
    }

    // Test 9: Fast LLM coordinator
    testResults.ai.total++;
    try {
      const coordinatorResponse = await axios.post(`${BACKEND_URL}/api/v1/fast-coordinator/route`, {
        message: "Route this test message",
        complexity: "simple"
      }, { timeout: 10000 });
      
      if (coordinatorResponse.data.success) {
        testResults.ai.passed++;
        console.log('✅ Fast LLM coordinator working');
      } else {
        console.log('❌ Fast LLM coordinator failed');
        testResults.ai.errors.push('Fast coordinator not routing properly');
      }
    } catch (error) {
      console.log('❌ Fast LLM coordinator error');
      testResults.ai.errors.push(`Fast coordinator error: ${error.message}`);
    }

    console.log('\n🤖 4. AGENT SYSTEM TESTING');
    console.log('-'.repeat(40));
    
    // Test 10: Agent execution
    testResults.agents.total++;
    try {
      const agentResponse = await axios.post(`${BACKEND_URL}/api/v1/agents/execute`, {
        agentName: "planner",
        userRequest: "Create a simple plan for testing the agent system",
        context: {}
      }, { timeout: 30000 });
      
      if (agentResponse.data.success) {
        testResults.agents.passed++;
        console.log('✅ Agent execution working');
      } else {
        console.log('❌ Agent execution failed');
        testResults.agents.errors.push('Agent did not execute properly');
      }
    } catch (error) {
      console.log('❌ Agent execution error');
      testResults.agents.errors.push(`Agent execution error: ${error.message}`);
    }

    // Test 11: Autonomous Master Controller
    testResults.agents.total++;
    try {
      const masterResponse = await axios.post(`${BACKEND_URL}/api/v1/master/process`, {
        request: "Test the autonomous master controller system",
        priority: "normal"
      }, { timeout: 30000 });
      
      if (masterResponse.data.success) {
        testResults.agents.passed++;
        console.log('✅ Autonomous Master Controller working');
      } else {
        console.log('❌ Autonomous Master Controller failed');
        testResults.agents.errors.push('Master controller not processing requests');
      }
    } catch (error) {
      console.log('❌ Autonomous Master Controller error');
      testResults.agents.errors.push(`Master controller error: ${error.message}`);
    }

    console.log('\n📝 5. MEMORY SYSTEM TESTING');
    console.log('-'.repeat(40));
    
    // Test 12: Memory storage and retrieval
    testResults.memory.total++;
    try {
      // Store memory
      const storeResponse = await axios.post(`${BACKEND_URL}/api/v1/memory`, {
        content: "End-to-end test memory content for system validation and testing purposes",
        type: "knowledge",
        metadata: { source: "end_to_end_test" },
        tags: ["testing", "e2e", "validation"],
        importance: 0.6
      }, { timeout: 5000 });
      
      if (storeResponse.data.success) {
        // Retrieve memory
        const retrieveResponse = await axios.get(`${BACKEND_URL}/api/v1/memory?limit=1&type=knowledge`, { timeout: 5000 });
        
        if (retrieveResponse.data.success && retrieveResponse.data.data.memories.length > 0) {
          testResults.memory.passed++;
          console.log('✅ Memory storage and retrieval working');
        } else {
          console.log('❌ Memory retrieval failed');
          testResults.memory.errors.push('Could not retrieve stored memories');
        }
      } else {
        console.log('❌ Memory storage failed');
        testResults.memory.errors.push('Could not store memory');
      }
    } catch (error) {
      console.log('❌ Memory system error');
      testResults.memory.errors.push(`Memory system error: ${error.message}`);
    }

    // Test 13: Memory search
    testResults.memory.total++;
    try {
      const searchResponse = await axios.get(`${BACKEND_URL}/api/v1/memory/search?query=test&limit=5`, { timeout: 5000 });
      if (searchResponse.data.success) {
        testResults.memory.passed++;
        console.log('✅ Memory search working');
      } else {
        console.log('❌ Memory search failed');
        testResults.memory.errors.push('Memory search not returning results');
      }
    } catch (error) {
      console.log('❌ Memory search error');
      testResults.memory.errors.push(`Memory search error: ${error.message}`);
    }

    console.log('\n🔗 6. INTEGRATION TESTING');
    console.log('-'.repeat(40));
    
    // Test 14: Vision service
    testResults.integration.total++;
    try {
      const visionResponse = await axios.get(`${BACKEND_URL}/api/v1/vision/status`, { timeout: 5000 });
      if (visionResponse.data.success) {
        testResults.integration.passed++;
        console.log('✅ Vision service integration working');
      } else {
        console.log('❌ Vision service integration failed');
        testResults.integration.errors.push('Vision service not available');
      }
    } catch (error) {
      console.log('❌ Vision service integration error');
      testResults.integration.errors.push(`Vision service error: ${error.message}`);
    }

    // Test 15: WebSocket connections
    testResults.integration.total++;
    try {
      const wsResponse = await axios.get(`${BACKEND_URL}/api/v1/monitoring/websocket/status`, { timeout: 5000 });
      if (wsResponse.data.success) {
        testResults.integration.passed++;
        console.log('✅ WebSocket services working');
      } else {
        console.log('❌ WebSocket services failed');
        testResults.integration.errors.push('WebSocket services not available');
      }
    } catch (error) {
      console.log('❌ WebSocket services error');
      testResults.integration.errors.push(`WebSocket services error: ${error.message}`);
    }

    // Test 16: Database connectivity
    testResults.integration.total++;
    try {
      const dbResponse = await axios.get(`${BACKEND_URL}/api/v1/monitoring/database/status`, { timeout: 5000 });
      if (dbResponse.data.success) {
        testResults.integration.passed++;
        console.log('✅ Database connectivity working');
      } else {
        console.log('❌ Database connectivity failed');
        testResults.integration.errors.push('Database not accessible');
      }
    } catch (error) {
      console.log('❌ Database connectivity error');
      testResults.integration.errors.push(`Database connectivity error: ${error.message}`);
    }

    console.log('\n📊 END-TO-END TEST RESULTS');
    console.log('=' .repeat(60));
    
    const totalTests = Object.values(testResults).reduce((sum, cat) => sum + cat.total, 0);
    const totalPassed = Object.values(testResults).reduce((sum, cat) => sum + cat.passed, 0);
    const overallSuccess = (totalPassed / totalTests) * 100;
    
    console.log(`\nOverall Results: ${totalPassed}/${totalTests} (${overallSuccess.toFixed(1)}%)`);
    
    console.log('\nCategory Breakdown:');
    Object.entries(testResults).forEach(([category, results]) => {
      const successRate = results.total > 0 ? (results.passed / results.total) * 100 : 0;
      const status = successRate >= 80 ? '✅' : successRate >= 60 ? '⚠️' : '❌';
      console.log(`  ${status} ${category}: ${results.passed}/${results.total} (${successRate.toFixed(1)}%)`);
      
      if (results.errors.length > 0) {
        results.errors.forEach(error => {
          console.log(`    🔸 ${error}`);
        });
      }
    });
    
    console.log('\n🎯 PRODUCTION READINESS ASSESSMENT');
    console.log('-'.repeat(50));
    
    if (overallSuccess >= 95) {
      console.log('✅ EXCELLENT: System is production-ready with outstanding performance');
    } else if (overallSuccess >= 85) {
      console.log('✅ GOOD: System is production-ready with minor issues to address');
    } else if (overallSuccess >= 70) {
      console.log('⚠️ FAIR: System needs improvements before production deployment');
    } else {
      console.log('❌ POOR: System requires significant fixes before production');
    }
    
    console.log('\n🔧 CRITICAL SYSTEMS STATUS:');
    console.log(`  Core Services: ${testResults.core.passed}/${testResults.core.total} ${testResults.core.passed === testResults.core.total ? '✅' : '❌'}`);
    console.log(`  Validation System: ${testResults.validation.passed}/${testResults.validation.total} ${testResults.validation.passed === testResults.validation.total ? '✅' : '❌'}`);
    console.log(`  AI Services: ${testResults.ai.passed}/${testResults.ai.total} ${testResults.ai.passed === testResults.ai.total ? '✅' : '❌'}`);
    console.log(`  Memory System: ${testResults.memory.passed}/${testResults.memory.total} ${testResults.memory.passed === testResults.memory.total ? '✅' : '❌'}`);
    
    // Collect all errors for task creation
    const allErrors = [];
    Object.entries(testResults).forEach(([category, results]) => {
      if (results.errors.length > 0) {
        allErrors.push(...results.errors.map(error => `${category}: ${error}`));
      }
    });
    
    if (allErrors.length > 0) {
      console.log('\n❌ ERRORS TO FIX:');
      allErrors.forEach((error, i) => {
        console.log(`  ${i + 1}. ${error}`);
      });
      
      return { success: false, errors: allErrors, overallSuccess };
    } else {
      console.log('\n🚀 All systems operational - ready for production!');
      return { success: true, errors: [], overallSuccess };
    }
    
  } catch (error) {
    console.error('\n💥 Critical end-to-end test error:', error.message);
    return { success: false, errors: [`Critical test error: ${error.message}`], overallSuccess: 0 };
  }
}

// Run the comprehensive end-to-end test
comprehensiveEndToEndTest().then(result => {
  if (!result.success) {
    console.log('\n🔧 RECOMMENDED ACTIONS:');
    console.log('1. Review error details above');
    console.log('2. Fix critical system issues');
    console.log('3. Re-run end-to-end test');
    console.log('4. Verify production readiness');
    process.exit(1);
  } else {
    console.log('\n✅ System ready for production deployment!');
    process.exit(0);
  }
});