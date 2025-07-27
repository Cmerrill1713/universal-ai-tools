// Universal AI Tools - Full Integration Test Suite
// Tests frontend-backend integration with real API endpoints

import fetch from 'node-fetch';

const API_BASE = 'http://localhost:9999';
const FRONTEND_BASE = 'http://localhost:5173';
const API_KEY = 'universal-ai-tools-production-key-2025';

const headers = {
  'X-API-Key': API_KEY,
  'Content-Type': 'application/json'
};

async function testIntegration() {
  console.log('🚀 Universal AI Tools - Full Integration Testing\n');

  let successCount = 0;
  let totalTests = 0;

  const test = async (name, testFn) => {
    totalTests++;
    try {
      console.log(`📋 ${name}`);
      await testFn();
      console.log(`✅ ${name} - PASSED\n`);
      successCount++;
    } catch (error) {
      console.log(`❌ ${name} - FAILED: ${error.message}\n`);
    }
  };

  // Test 1: Backend Health Check
  await test('Backend Health Check', async () => {
    const response = await fetch(`${API_BASE}/api/health`, { headers });
    const data = await response.json();
    if (!data.status === 'healthy') throw new Error('Backend not healthy');
  });

  // Test 2: Frontend Accessibility
  await test('Frontend Accessibility', async () => {
    const response = await fetch(FRONTEND_BASE);
    const html = await response.text();
    if (!html.includes('<div id="root">')) throw new Error('Frontend React app not loading');
  });

  // Test 3: API Authentication
  await test('API Authentication', async () => {
    const response = await fetch(`${API_BASE}/api/v1/tools`, { headers });
    const data = await response.json();
    if (!data.tools || !Array.isArray(data.tools)) throw new Error('Authentication failed');
  });

  // Test 4: Memory System API
  await test('Memory System API', async () => {
    const response = await fetch(`${API_BASE}/api/v1/tools`, { headers });
    const data = await response.json();
    const memoryTools = data.tools.filter(tool => tool.category === 'memory');
    if (memoryTools.length === 0) throw new Error('Memory tools not available');
  });

  // Test 5: DSPy Orchestration API
  await test('DSPy Orchestration API', async () => {
    const response = await fetch(`${API_BASE}/api/v1/tools`, { headers });
    const data = await response.json();
    const orchestrationTools = data.tools.filter(tool => tool.category === 'orchestration');
    if (orchestrationTools.length === 0) throw new Error('Orchestration tools not available');
  });

  // Test 6: Frontend Route Accessibility
  await test('Frontend Route Accessibility', async () => {
    const routes = ['/', '/sweet-athena', '/natural-language-widgets', '/performance'];
    
    for (const route of routes) {
      const response = await fetch(`${FRONTEND_BASE}${route}`);
      if (!response.ok) throw new Error(`Route ${route} not accessible`);
    }
  });

  // Test 7: Frontend Assets Loading
  await test('Frontend Assets Loading', async () => {
    const assets = ['/src/index.css', '/vite.svg'];
    
    for (const asset of assets) {
      const response = await fetch(`${FRONTEND_BASE}${asset}`);
      if (!response.ok) throw new Error(`Asset ${asset} not loading`);
    }
  });

  // Test 8: Sweet Athena Component Integration
  await test('Sweet Athena Component Integration', async () => {
    const response = await fetch(`${FRONTEND_BASE}/src/components/SweetAthena/index.tsx?t=${Date.now()}`);
    const content = await response.text();
    if (!content.includes('PersonalityMood')) throw new Error('Sweet Athena personality system not integrated');
  });

  // Test 9: Widget Creator Integration
  await test('Widget Creator Integration', async () => {
    const response = await fetch(`${FRONTEND_BASE}/src/pages/NaturalLanguageWidgetCreator.tsx?t=${Date.now()}`);
    const content = await response.text();
    if (!content.includes('NaturalLanguageWidgetCreator')) throw new Error('Widget creator not integrated');
  });

  // Test 10: Real API Response Structure
  await test('Real API Response Structure', async () => {
    const response = await fetch(`${API_BASE}/api/v1/status`, { headers });
    const data = await response.json();
    if (!data.system_status || !data.version) throw new Error('API response structure invalid');
  });

  // Final Report
  console.log('🎯 Integration Test Results:');
  console.log(`✅ Passed: ${successCount}/${totalTests}`);
  console.log(`❌ Failed: ${totalTests - successCount}/${totalTests}`);
  console.log(`📊 Success Rate: ${((successCount / totalTests) * 100).toFixed(1)}%\n`);

  if (successCount === totalTests) {
    console.log('🎉 ALL TESTS PASSED - Frontend-Backend Integration Complete!');
    console.log('');
    console.log('🔗 Ready for Production Testing:');
    console.log(`Frontend: ${FRONTEND_BASE}`);
    console.log(`Backend API: ${API_BASE}/api`);
    console.log(`API Docs: ${API_BASE}/api/docs`);
    console.log('');
    console.log('🎮 Interactive Testing:');
    console.log('1. Open frontend in browser');
    console.log('2. Test Sweet Athena personality switching');
    console.log('3. Try natural language widget creation');
    console.log('4. Monitor performance dashboard');
    console.log('5. Verify real-time updates');
  } else {
    console.log('⚠️  Some tests failed - review logs above for details');
  }
}

testIntegration().catch(console.error);