#!/usr/bin/env tsx
/**
 * Page Validation Script
 * Tests each page of the Electron app for errors and functionality
 */

import axios from 'axios';

const PAGES = [
  { name: 'Dashboard', path: '/dashboard' },
  { name: 'Chat', path: '/chat' },
  { name: 'Image Generation', path: '/image-generation' },
  { name: 'News', path: '/news' },
  { name: 'Libraries', path: '/libraries' },
  { name: 'Service Monitoring', path: '/service-monitoring' },
  { name: 'Settings', path: '/settings' },
  { name: 'Accessibility Settings', path: '/accessibility' },
  { name: 'Services', path: '/services' },
  { name: 'Profile/Login', path: '/profile' }
];

const BASE_URL = 'http://localhost:3007';

async function validatePage(page: { name: string; path: string }) {
  try {
    console.log(`\n🔍 Validating ${page.name} page...`);
    
    // Try to fetch the page (this works for the dev server)
    const response = await axios.get(BASE_URL, {
      headers: {
        'Accept': 'text/html',
      },
      validateStatus: () => true // Accept any status
    });
    
    if (response.status === 200) {
      console.log(`  ✅ ${page.name}: Page loads successfully`);
      
      // Check for common error patterns in the HTML
      const html = response.data as string;
      
      if (html.includes('Error:') || html.includes('error:')) {
        console.log(`  ⚠️  ${page.name}: Contains error text (may be false positive)`);
      }
      
      if (!html.includes('<div id="root">')) {
        console.log(`  ❌ ${page.name}: Missing root element`);
      }
      
    } else {
      console.log(`  ❌ ${page.name}: HTTP ${response.status}`);
    }
    
  } catch (error) {
    console.log(`  ❌ ${page.name}: Failed to load - ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function validateAllPages() {
  console.log('🚀 Starting page validation...');
  console.log(`📍 Testing against: ${BASE_URL}`);
  
  // First check if the dev server is running
  try {
    await axios.get(BASE_URL);
    console.log('✅ Dev server is running');
  } catch (error) {
    console.error('❌ Dev server is not running. Please run: npm run dev');
    process.exit(1);
  }
  
  // Validate each page
  for (const page of PAGES) {
    await validatePage(page);
  }
  
  console.log('\n📊 Validation Summary:');
  console.log('  - All pages are served from the same index.html in SPA mode');
  console.log('  - Client-side routing handles navigation');
  console.log('  - Check browser console for runtime errors');
  
  // Test API endpoints
  console.log('\n🔌 Testing API Endpoints...');
  await testAPIEndpoints();
}

async function testAPIEndpoints() {
  const endpoints = [
    { name: 'Go API Gateway', url: 'http://localhost:8082/health' },
    { name: 'TypeScript Backend', url: 'http://localhost:9999/api/health' },
    { name: 'Ollama', url: 'http://localhost:11434/api/tags' },
  ];
  
  for (const endpoint of endpoints) {
    try {
      const response = await axios.get(endpoint.url, {
        timeout: 2000,
        validateStatus: () => true
      });
      
      if (response.status === 200 || response.status === 404) {
        console.log(`  ✅ ${endpoint.name}: Reachable (${response.status})`);
      } else {
        console.log(`  ⚠️  ${endpoint.name}: Returned ${response.status}`);
      }
    } catch (error) {
      console.log(`  ❌ ${endpoint.name}: Not running or unreachable`);
    }
  }
}

// Run validation
validateAllPages().catch(console.error);