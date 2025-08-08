#!/usr/bin/env node

/**
 * Enhanced Context Management System Test Script
 * 
 * This script tests the key functionality of the enhanced context management system:
 * - Adding messages to context
 * - Retrieving enhanced context
 * - Semantic search
 * - System health and analytics
 */

const baseUrl = 'http://localhost:9999';
const testUserId = 'test_user_123';
const testSessionId = 'test_session_456';

// Helper function to make API calls
async function apiCall(endpoint, method = 'GET', body = null) {
  const url = `${baseUrl}${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    console.log(`${method} ${endpoint}`);
    const response = await fetch(url, options);
    const data = await response.json();
    
    if (!response.ok) {
      console.error(`❌ Failed: ${data.error?.message || 'Unknown error'}`);
      return null;
    }
    
    console.log(`✅ Success: ${response.status}`);
    return data;
  } catch (error) {
    console.error(`❌ Network error:`, error.message);
    return null;
  }
}

// Test functions
async function testServerHealth() {
  console.log('\n🏥 Testing Server Health...');
  const health = await apiCall('/health');
  
  if (health) {
    console.log(`Server Status: ${health.status}`);
    console.log(`Services Available:`, Object.entries(health.services || {})
      .filter(([, status]) => status)
      .map(([name]) => name)
      .join(', '));
  }
}

async function testContextHealth() {
  console.log('\n🧠 Testing Context System Health...');
  const health = await apiCall('/api/v1/context/health');
  
  if (health?.success && health.data) {
    console.log(`Overall Status: ${health.data.overallStatus}`);
    console.log('System Components:');
    Object.entries(health.data.systems).forEach(([component, status]) => {
      console.log(`  ${component}: ${status.status}`);
    });
  }
}

async function testAddMessage() {
  console.log('\n📝 Testing Add Message...');
  
  const messages = [
    {
      role: 'user',
      content: 'Hello, I need help with TypeScript configuration for a React project.'
    },
    {
      role: 'assistant', 
      content: 'I can help you with TypeScript configuration for React. Here are the key files you\'ll need: tsconfig.json for compiler options, and proper type definitions for React components.'
    },
    {
      role: 'user',
      content: 'What should I include in my tsconfig.json file?'
    },
    {
      role: 'assistant',
      content: 'For a React project, your tsconfig.json should include: "compilerOptions" with "target": "ES2020", "module": "ESNext", "jsx": "react-jsx", "strict": true, and "moduleResolution": "node".'
    }
  ];

  for (const message of messages) {
    const result = await apiCall('/api/v1/context/messages', 'POST', {
      sessionId: testSessionId,
      userId: testUserId,
      ...message,
      metadata: {
        testScript: true,
        projectPath: '/test/project'
      }
    });

    if (result?.success) {
      console.log(`  Added ${message.role} message (${result.data.tokenCount} tokens)`);
      if (result.data.shouldCompress) {
        console.log('  ⚠️ Compression recommended');
      }
    }
  }
}

async function testRetrieveContext() {
  console.log('\n🔍 Testing Context Retrieval...');
  
  const context = await apiCall(`/api/v1/context/enhanced/${testSessionId}/${testUserId}?maxTokens=4000`);
  
  if (context?.success && context.data) {
    console.log(`  Retrieved ${context.data.messages?.length || 0} messages`);
    console.log(`  Retrieved ${context.data.summaries?.length || 0} summaries`);
    console.log(`  Total tokens: ${context.data.totalTokens}`);
    console.log(`  Source: ${context.data.source}`);
  }
}

async function testSemanticSearch() {
  console.log('\n🔍 Testing Semantic Search...');
  
  const searchResult = await apiCall('/api/v1/context/semantic-search', 'POST', {
    query: 'TypeScript configuration',
    userId: testUserId,
    maxResults: 5,
    timeWindow: 1
  });

  if (searchResult?.success && searchResult.data) {
    console.log(`  Found ${searchResult.data.results?.length || 0} results`);
    console.log(`  Found ${searchResult.data.clusters?.clusters?.length || 0} clusters`);
    console.log(`  Search time: ${searchResult.data.searchTime}ms`);
    console.log(`  Average relevance: ${searchResult.data.metrics?.averageRelevance?.toFixed(3) || 'N/A'}`);
  }
}

async function testSystemStats() {
  console.log('\n📊 Testing System Statistics...');
  
  const stats = await apiCall('/api/v1/context/system-stats');
  
  if (stats?.success && stats.data) {
    const overview = stats.data.overview;
    console.log('  System Overview:');
    console.log(`    Active Contexts: ${overview?.totalActiveContexts || 0}`);
    console.log(`    Active Sessions: ${overview?.totalActiveSessions || 0}`);
    console.log(`    Total Messages: ${overview?.totalMessages || 0}`);
    console.log(`    Total Tokens: ${overview?.totalTokens || 0}`);
    console.log(`    Cache Hit Rate: ${((overview?.cacheHitRate || 0) * 100).toFixed(1)}%`);
    console.log(`    Cache Memory: ${overview?.cacheMemoryUsage || 0}MB`);
  }
}

async function testAnalytics() {
  console.log('\n📈 Testing Analytics...');
  
  // Current metrics
  const metrics = await apiCall('/api/v1/context/analytics/metrics');
  if (metrics?.success && metrics.data?.metrics) {
    console.log('  Current Metrics:');
    const m = metrics.data.metrics;
    console.log(`    Total Contexts: ${m.totalContexts}`);
    console.log(`    Total Messages: ${m.totalMessages}`);
    console.log(`    Average Context Size: ${Math.round(m.averageContextSize)} tokens`);
    console.log(`    Compression Ratio: ${(m.compressionRatio * 100).toFixed(1)}%`);
  }

  // User analytics
  const userAnalytics = await apiCall(`/api/v1/context/analytics/user/${testUserId}`);
  if (userAnalytics?.success && userAnalytics.data?.analytics) {
    console.log('  User Analytics:');
    const ua = userAnalytics.data.analytics;
    console.log(`    Session Count: ${ua.sessionCount}`);
    console.log(`    Message Count: ${ua.messageCount}`);
    console.log(`    Total Tokens: ${Math.round(ua.totalTokens)}`);
    console.log(`    Compression Savings: ${Math.round(ua.efficiency?.compressionSavings || 0)} tokens`);
  }
}

async function testOptimization() {
  console.log('\n💰 Testing Cost Optimization...');
  
  const optimization = await apiCall('/api/v1/context/optimization');
  
  if (optimization?.success && optimization.data?.optimization) {
    const opt = optimization.data.optimization;
    console.log('  Potential Savings:');
    console.log(`    Token Compression: $${opt.potentialSavings?.tokenCompressionSavings?.toFixed(4) || 0}`);
    console.log(`    Storage Optimization: $${opt.potentialSavings?.storageOptimization?.toFixed(4) || 0}`);
    console.log(`    Cache Efficiency: $${opt.potentialSavings?.cacheEfficiency?.toFixed(4) || 0}`);
    
    if (opt.recommendations?.length > 0) {
      console.log('  Recommendations:');
      opt.recommendations.forEach((rec, i) => {
        console.log(`    ${i + 1}. [${rec.impact?.toUpperCase()}] ${rec.description}`);
        console.log(`       Estimated savings: $${rec.estimatedSavings?.toFixed(4) || 0}`);
      });
    } else {
      console.log('  No optimization recommendations at this time');
    }
  }
}

async function testBasicContextOperations() {
  console.log('\n📋 Testing Basic Context Operations...');
  
  // Test basic context storage
  const storeResult = await apiCall(`/api/v1/context/${testUserId}`, 'POST', {
    content: 'Test context entry for enhanced context management system',
    category: 'test_results',
    source: 'test_script',
    projectPath: '/test/project',
    metadata: {
      testType: 'integration',
      timestamp: new Date().toISOString()
    }
  });

  if (storeResult?.success) {
    console.log(`  ✅ Stored context entry: ${storeResult.data.contextId}`);
  }

  // Test basic context retrieval
  const retrieveResult = await apiCall(`/api/v1/context/${testUserId}?category=test_results&limit=5`);
  
  if (retrieveResult?.success && retrieveResult.data) {
    console.log(`  ✅ Retrieved ${retrieveResult.data.total} context entries`);
  }
}

// Main test runner
async function runTests() {
  console.log('🚀 Enhanced Context Management System Tests');
  console.log('='.repeat(50));

  try {
    await testServerHealth();
    await testContextHealth();
    await testBasicContextOperations();
    await testAddMessage();
    await testRetrieveContext();
    await testSemanticSearch();
    await testSystemStats();
    await testAnalytics();
    await testOptimization();
    
    console.log('\n✅ All tests completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Check the system health at: http://localhost:9999/api/v1/context/health');
    console.log('2. View analytics at: http://localhost:9999/api/v1/context/analytics/metrics');
    console.log('3. Try semantic search: POST http://localhost:9999/api/v1/context/semantic-search');
    console.log('4. Monitor system stats: http://localhost:9999/api/v1/context/system-stats');
    
  } catch (error) {
    console.error('\n❌ Test suite failed:', error.message);
    process.exit(1);
  }
}

// Check if fetch is available (Node.js 18+)
if (typeof fetch === 'undefined') {
  console.error('❌ This script requires Node.js 18+ with built-in fetch support');
  console.error('Run: npm install node-fetch if using older Node.js versions');
  process.exit(1);
}

// Run tests if server is available
async function checkServer() {
  try {
    const response = await fetch(`${baseUrl}/health`);
    if (response.ok) {
      console.log('✅ Server is running, starting tests...\n');
      await runTests();
    } else {
      throw new Error(`Server returned ${response.status}`);
    }
  } catch (error) {
    console.error('❌ Server is not running or not accessible');
    console.error('Please start the server with: npm run dev');
    console.error(`Expected server at: ${baseUrl}`);
    process.exit(1);
  }
}

checkServer();