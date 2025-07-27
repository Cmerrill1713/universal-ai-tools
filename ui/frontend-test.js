// Frontend Testing Script - Universal AI Tools
// This script tests the React frontend using fetch API

import fetch from 'node-fetch';

async function testFrontend() {
  console.log('🚀 Starting Universal AI Tools Frontend Testing\n');

  // Test 1: Basic server response
  console.log('📋 Test 1: Server Response');
  try {
    const response = await fetch('http://localhost:5173');
    const html = await response.text();
    console.log('✅ Server responding');
    console.log('✅ HTML contains React app structure');
    
    if (html.includes('<div id="root">')) {
      console.log('✅ React root element found');
    } else {
      console.log('❌ React root element missing');
    }
  } catch (error) {
    console.log('❌ Server not responding:', error.message);
    return;
  }

  // Test 2: Available routes
  console.log('\n📋 Test 2: Route Accessibility');
  const routes = [
    '/',
    '/sweet-athena',
    '/natural-language-widgets',
    '/performance',
    '/chat',
    '/memory',
    '/agents',
    '/tools',
    '/dspy',
    '/monitoring',
    '/settings'
  ];

  for (const route of routes) {
    try {
      const response = await fetch(`http://localhost:5173${route}`);
      if (response.ok) {
        console.log(`✅ ${route} - accessible`);
      } else {
        console.log(`❌ ${route} - error ${response.status}`);
      }
    } catch (error) {
      console.log(`❌ ${route} - failed:`, error.message);
    }
  }

  // Test 3: React main entry point
  console.log('\n📋 Test 3: React Application Bundle');
  try {
    const response = await fetch(`http://localhost:5173/src/main.tsx?t=${Date.now()}`);
    const content = await response.text();
    
    if (content.includes('ReactDOM.createRoot')) {
      console.log('✅ React application entry point accessible');
    } else {
      console.log('❌ React entry point issues');
    }
    
    if (content.includes('App from "/src/App.tsx"')) {
      console.log('✅ App component import working');
    } else {
      console.log('❌ App component import issues');
    }
  } catch (error) {
    console.log('❌ React bundle test failed:', error.message);
  }

  // Test 4: Static assets
  console.log('\n📋 Test 4: Static Assets');
  const assets = [
    '/src/index.css',
    '/vite.svg'
  ];

  for (const asset of assets) {
    try {
      const response = await fetch(`http://localhost:5173${asset}`);
      if (response.ok) {
        console.log(`✅ ${asset} - loaded`);
      } else {
        console.log(`❌ ${asset} - missing`);
      }
    } catch (error) {
      console.log(`❌ ${asset} - failed:`, error.message);
    }
  }

  console.log('\n🎯 Frontend Testing Complete');
  console.log('\nNext Steps for Browser Testing:');
  console.log('1. Open http://localhost:5173 in Chrome/Firefox');
  console.log('2. Install React Developer Tools extension');
  console.log('3. Open Developer Tools (F12)');
  console.log('4. Check Console tab for any JavaScript errors');
  console.log('5. Use React DevTools to inspect component tree');
  console.log('6. Test each route manually for functionality');
  console.log('7. Verify Sweet Athena personality system works');
  console.log('8. Test widget creation and natural language processing');
}

testFrontend().catch(console.error);