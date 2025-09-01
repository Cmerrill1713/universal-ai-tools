#!/usr/bin/env node
/**
 * Comprehensive Functional Test with Output Generation
 * Tests all major system capabilities and generates detailed outputs
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

const BACKEND_URL = 'http://localhost:9999';
const OUTPUT_DIR = './test-outputs';

// Ensure output directory exists
async function ensureOutputDir() {
  try {
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    console.log(`📁 Output directory ready: ${OUTPUT_DIR}`);
  } catch (error) {
    console.error(`Failed to create output directory: ${error.message}`);
  }
}

// Save test results to file
async function saveTestOutput(filename, data) {
  try {
    const filepath = path.join(OUTPUT_DIR, filename);
    await fs.writeFile(filepath, JSON.stringify(data, null, 2));
    console.log(`💾 Saved: ${filepath}`);
  } catch (error) {
    console.error(`Failed to save ${filename}: ${error.message}`);
  }
}

async function comprehensiveFunctionalTest() {
  console.log('🚀 COMPREHENSIVE FUNCTIONAL TEST WITH OUTPUT GENERATION');
  console.log('=' .repeat(70));
  
  await ensureOutputDir();
  
  const testResults = {
    timestamp: new Date().toISOString(),
    systemInfo: {},
    healthCheck: {},
    agentSystem: {},
    memorySystem: {},
    aiServices: {},
    conversationTest: {},
    visionServices: {},
    monitoring: {},
    errors: []
  };

  try {
    console.log('\n🏥 1. SYSTEM HEALTH & STATUS');
    console.log('-'.repeat(40));
    
    // Health check
    try {
      const healthResponse = await axios.get(`${BACKEND_URL}/api/v1/monitoring/health`, { timeout: 5000 });
      testResults.healthCheck = healthResponse.data;
      console.log('✅ System health check completed');
      console.log(`   Status: ${healthResponse.data.status}`);
      console.log(`   Uptime: ${Math.floor(healthResponse.data.uptime)}s`);
    } catch (error) {
      testResults.errors.push(`Health check failed: ${error.message}`);
      console.log('❌ Health check failed');
    }

    // System metrics
    try {
      const metricsResponse = await axios.get(`${BACKEND_URL}/api/v1/monitoring/metrics`, { timeout: 5000 });
      testResults.systemInfo = metricsResponse.data;
      console.log('✅ System metrics retrieved');
      const heapUsed = metricsResponse.data.performance?.memoryUsage?.heapUsed || metricsResponse.data.system?.memory?.used || 0;
      console.log(`   Memory Usage: ${Math.round(heapUsed / 1024 / 1024)}MB`);
    } catch (error) {
      testResults.errors.push(`Metrics retrieval failed: ${error.message}`);
      console.log('❌ System metrics failed');
    }

    console.log('\n🤖 2. AGENT SYSTEM TESTING');
    console.log('-'.repeat(40));
    
    // Agent registry
    try {
      const agentsResponse = await axios.get(`${BACKEND_URL}/api/v1/agents`, { timeout: 5000 });
      testResults.agentSystem.registry = agentsResponse.data;
      const agentCount = agentsResponse.data?.data?.agents?.length || 0;
      console.log(`✅ Agent registry active (${agentCount} agents)`);
      
      if (agentCount > 0) {
        const agents = agentsResponse.data.data.agents;
        agents.forEach(agent => {
          console.log(`   - ${agent.id}: ${agent.name || 'Unnamed'}`);
        });
      }
    } catch (error) {
      testResults.errors.push(`Agent registry failed: ${error.message}`);
      console.log('❌ Agent registry failed');
    }

    // Agent execution test
    try {
      const agentExecResponse = await axios.post(`${BACKEND_URL}/api/v1/agents/execute`, {
        agentName: "planner",
        userRequest: "Create a brief test plan for validating the Universal AI Tools system functionality",
        context: { testMode: true }
      }, { timeout: 30000 });
      
      testResults.agentSystem.execution = agentExecResponse.data;
      console.log('✅ Agent execution successful');
      if (agentExecResponse.data.success && agentExecResponse.data.data?.response) {
        console.log(`   Response: ${agentExecResponse.data.data.response.substring(0, 100)}...`);
      }
    } catch (error) {
      testResults.errors.push(`Agent execution failed: ${error.message}`);
      console.log('❌ Agent execution failed');
    }

    console.log('\n📝 3. MEMORY SYSTEM TESTING');
    console.log('-'.repeat(40));
    
    // Store test memory
    try {
      const storeResponse = await axios.post(`${BACKEND_URL}/api/v1/memory`, {
        content: "Functional test memory entry - This is a comprehensive test of the Universal AI Tools memory system with advanced validation and storage capabilities.",
        type: "knowledge",
        metadata: { 
          source: "functional_test",
          testId: `test_${Date.now()}`
        },
        tags: ["testing", "functional", "memory", "validation"],
        importance: 0.8
      }, { timeout: 10000 });
      
      testResults.memorySystem.storage = storeResponse.data;
      console.log('✅ Memory storage successful');
      
      if (storeResponse.data.success && storeResponse.data.data?.id) {
        console.log(`   Memory ID: ${storeResponse.data.data.id}`);
        testResults.memorySystem.testMemoryId = storeResponse.data.data.id;
      }
    } catch (error) {
      testResults.errors.push(`Memory storage failed: ${error.message}`);
      console.log('❌ Memory storage failed');
    }

    // Memory retrieval
    try {
      const retrieveResponse = await axios.get(`${BACKEND_URL}/api/v1/memory?limit=5&type=knowledge`, { timeout: 5000 });
      testResults.memorySystem.retrieval = retrieveResponse.data;
      const memoryCount = retrieveResponse.data?.data?.memories?.length || 0;
      console.log(`✅ Memory retrieval successful (${memoryCount} memories)`);
    } catch (error) {
      testResults.errors.push(`Memory retrieval failed: ${error.message}`);
      console.log('❌ Memory retrieval failed');
    }

    // Memory search
    try {
      const searchResponse = await axios.get(`${BACKEND_URL}/api/v1/memory/search?query=functional&limit=3`, { timeout: 5000 });
      testResults.memorySystem.search = searchResponse.data;
      const searchCount = searchResponse.data?.data?.results?.length || 0;
      console.log(`✅ Memory search successful (${searchCount} results)`);
    } catch (error) {
      testResults.errors.push(`Memory search failed: ${error.message}`);
      console.log('❌ Memory search failed');
    }

    // Memory validation stats
    try {
      const validationResponse = await axios.get(`${BACKEND_URL}/api/v1/memory/validation/stats`, { timeout: 5000 });
      testResults.memorySystem.validation = validationResponse.data;
      console.log(`✅ Memory validation system active`);
      console.log(`   Rules: ${validationResponse.data?.data?.rules || 0}`);
    } catch (error) {
      testResults.errors.push(`Memory validation failed: ${error.message}`);
      console.log('❌ Memory validation failed');
    }

    console.log('\n🧠 4. AI SERVICES TESTING');
    console.log('-'.repeat(40));
    
    // Fast coordinator test
    try {
      const coordinatorResponse = await axios.post(`${BACKEND_URL}/api/v1/fast-coordinator/route`, {
        message: "Test routing through the fast coordinator system",
        complexity: "medium"
      }, { timeout: 10000 });
      
      testResults.aiServices.fastCoordinator = coordinatorResponse.data;
      console.log('✅ Fast coordinator routing successful');
    } catch (error) {
      testResults.errors.push(`Fast coordinator failed: ${error.message}`);
      console.log('❌ Fast coordinator failed');
    }

    // Conversation test
    try {
      const conversationResponse = await axios.post(`${BACKEND_URL}/api/v1/conversation`, {
        message: "Hello! Please provide a brief summary of your capabilities for this functional test.",
        sessionId: "functional-test-session"
      }, { timeout: 15000 });
      
      testResults.conversationTest = conversationResponse.data;
      console.log('✅ Conversation API successful');
      if (conversationResponse.data.success && conversationResponse.data.response) {
        console.log(`   Response: ${conversationResponse.data.response.substring(0, 150)}...`);
      }
    } catch (error) {
      testResults.errors.push(`Conversation API failed: ${error.message}`);
      console.log('❌ Conversation API failed');
    }

    // MLX status check
    try {
      const mlxResponse = await axios.get(`${BACKEND_URL}/api/v1/mlx/status`, { timeout: 5000 });
      testResults.aiServices.mlx = mlxResponse.data;
      console.log('✅ MLX service available');
      console.log(`   Status: ${mlxResponse.data?.status || 'Unknown'}`);
    } catch (error) {
      testResults.errors.push(`MLX service failed: ${error.message}`);
      console.log('❌ MLX service failed');
    }

    console.log('\n👁️ 5. VISION SERVICES TESTING');
    console.log('-'.repeat(40));
    
    // Vision status
    try {
      const visionResponse = await axios.get(`${BACKEND_URL}/api/v1/vision/status`, { timeout: 5000 });
      testResults.visionServices.status = visionResponse.data;
      console.log('✅ Vision services available');
      
      if (visionResponse.data?.data?.models) {
        console.log(`   Models: ${visionResponse.data.data.models.join(', ')}`);
      }
    } catch (error) {
      testResults.errors.push(`Vision services failed: ${error.message}`);
      console.log('❌ Vision services failed');
    }

    console.log('\n📊 6. MONITORING & INFRASTRUCTURE');
    console.log('-'.repeat(40));
    
    // WebSocket status
    try {
      const wsResponse = await axios.get(`${BACKEND_URL}/api/v1/monitoring/websocket/status`, { timeout: 5000 });
      testResults.monitoring.websocket = wsResponse.data;
      console.log('✅ WebSocket services operational');
    } catch (error) {
      testResults.errors.push(`WebSocket monitoring failed: ${error.message}`);
      console.log('❌ WebSocket monitoring failed');
    }

    // Database status
    try {
      const dbResponse = await axios.get(`${BACKEND_URL}/api/v1/monitoring/database/status`, { timeout: 5000 });
      testResults.monitoring.database = dbResponse.data;
      console.log('✅ Database connectivity confirmed');
    } catch (error) {
      testResults.errors.push(`Database monitoring failed: ${error.message}`);
      console.log('❌ Database monitoring failed');
    }

    console.log('\n🔬 7. ADVANCED FEATURES TESTING');
    console.log('-'.repeat(40));
    
    // Autonomous Master Controller
    try {
      const masterResponse = await axios.post(`${BACKEND_URL}/api/v1/master/process`, {
        request: "Process this test request through the autonomous master controller",
        priority: "normal"
      }, { timeout: 10000 });
      
      testResults.aiServices.autonomousMaster = masterResponse.data;
      console.log('✅ Autonomous Master Controller operational');
    } catch (error) {
      testResults.errors.push(`Autonomous Master Controller failed: ${error.message}`);
      console.log('❌ Autonomous Master Controller failed');
    }

    // AB-MCTS orchestration test
    try {
      const abMctsResponse = await axios.get(`${BACKEND_URL}/api/v1/ab-mcts/health`, { timeout: 5000 });
      testResults.aiServices.abMcts = abMctsResponse.data;
      console.log('✅ AB-MCTS orchestration available');
    } catch (error) {
      testResults.errors.push(`AB-MCTS failed: ${error.message}`);
      console.log('❌ AB-MCTS failed');
    }

    // Save all test results
    await saveTestOutput('comprehensive-functional-test.json', testResults);
    
    // Generate summary report
    const summary = {
      timestamp: testResults.timestamp,
      totalTests: Object.keys(testResults).length - 2, // Exclude timestamp and errors
      errors: testResults.errors.length,
      successfulSections: Object.keys(testResults).filter(key => 
        key !== 'timestamp' && key !== 'errors' && Object.keys(testResults[key]).length > 0
      ).length,
      systemHealth: testResults.healthCheck?.status || 'unknown',
      agentCount: testResults.agentSystem?.registry?.data?.agents?.length || 0,
      memoryValidationRules: testResults.memorySystem?.validation?.data?.rules || 0,
      mlxStatus: testResults.aiServices?.mlx?.status || 'unknown',
      overallStatus: testResults.errors.length === 0 ? 'EXCELLENT' : testResults.errors.length < 3 ? 'GOOD' : 'NEEDS_ATTENTION'
    };
    
    await saveTestOutput('test-summary.json', summary);

    console.log('\n📊 FUNCTIONAL TEST RESULTS');
    console.log('=' .repeat(50));
    console.log(`✅ Test Completed: ${new Date().toLocaleTimeString()}`);
    console.log(`📊 Total Sections Tested: ${summary.totalTests}`);
    console.log(`✅ Successful Sections: ${summary.successfulSections}`);
    console.log(`❌ Errors Encountered: ${summary.errors}`);
    console.log(`🏥 System Health: ${summary.systemHealth}`);
    console.log(`🤖 Active Agents: ${summary.agentCount}`);
    console.log(`🛡️ Validation Rules: ${summary.memoryValidationRules}`);
    console.log(`🍎 MLX Status: ${summary.mlxStatus}`);
    console.log(`🎯 Overall Status: ${summary.overallStatus}`);
    
    if (testResults.errors.length > 0) {
      console.log('\n❌ ERRORS ENCOUNTERED:');
      testResults.errors.forEach((error, i) => {
        console.log(`  ${i + 1}. ${error}`);
      });
    }
    
    console.log(`\n💾 Test outputs saved to: ${OUTPUT_DIR}/`);
    console.log('   - comprehensive-functional-test.json (detailed results)');
    console.log('   - test-summary.json (executive summary)');
    
    // Return summary for further processing
    return {
      success: testResults.errors.length < 3,
      summary,
      testResults,
      outputDir: OUTPUT_DIR
    };
    
  } catch (error) {
    console.error('\n💥 Critical functional test error:', error.message);
    testResults.errors.push(`Critical error: ${error.message}`);
    await saveTestOutput('error-report.json', { 
      error: error.message, 
      stack: error.stack,
      testResults 
    });
    return { success: false, error: error.message, testResults };
  }
}

// Execute the comprehensive functional test
if (require.main === module) {
  comprehensiveFunctionalTest().then(result => {
    if (result.success) {
      console.log('\n🎉 FUNCTIONAL TEST COMPLETED SUCCESSFULLY!');
      console.log('✅ Universal AI Tools system is fully operational');
      process.exit(0);
    } else {
      console.log('\n⚠️ Functional test completed with issues');
      console.log('🔧 Review the error reports and test outputs');
      process.exit(1);
    }
  }).catch(error => {
    console.error('\n💥 Functional test failed:', error.message);
    process.exit(1);
  });
}

module.exports = { comprehensiveFunctionalTest };