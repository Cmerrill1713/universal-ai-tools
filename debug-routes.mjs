#!/usr/bin/env node

import express from 'express';

console.log('=== ROUTE DEBUGGING TEST ===');

// Test 1: Check if server responds at all
try {
  const response = await fetch('http://localhost:9999/health');
  const data = await response.json();
  console.log('✅ Basic server health:', data.status);
} catch (error) {
  console.log('❌ Server not responding:', error.message);
  process.exit(1);
}

// Test 2: List all registered routes
try {
  const response = await fetch('http://localhost:9999/api/v1/agents');
  if (response.ok) {
    console.log('✅ Standard API routes working');
  } else {
    console.log('❌ Standard API routes failing:', response.status);
  }
} catch (error) {
  console.log('❌ API test failed:', error.message);
}

// Test 3: Try AB-MCTS routes with different paths
const testPaths = [
  '/api/v1/ab-mcts',
  '/api/v1/ab-mcts/',
  '/api/v1/ab-mcts/health',
  '/ab-mcts/health',
  '/ab-mcts'
];

console.log('\n=== TESTING AB-MCTS PATHS ===');
for (const path of testPaths) {
  try {
    const response = await fetch(`http://localhost:9999${path}`);
    const data = await response.text();
    console.log(`${path}: ${response.status} - ${data.substring(0, 100)}`);
  } catch (error) {
    console.log(`${path}: ERROR - ${error.message}`);
  }
}

// Test 4: Import the router directly
console.log('\n=== TESTING ROUTER IMPORT ===');
try {
  const routerModule = await import('./src/routers/ab-mcts-fixed.js');
  console.log('✅ Router imports successfully');
  console.log('Router type:', typeof routerModule.default);
} catch (error) {
  console.log('❌ Router import failed:', error.message);
}